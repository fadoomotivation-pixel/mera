import type { Prisma, PrismaClient } from "@prisma/client";
import { ledgerService } from "./ledger.service.js";
import { NotEligibleError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Stream 5 — Rewards (3% pool tracked separately as a liability figure; each
 * individual reward is a FIXED catalogue value, per docs/01 §6 and the
 * pool-vs-fixed-value addendum in docs/03-erd.md). Unlike Royalty, reward
 * milestones are cumulative, not "highest replaces lower": reaching 5+5 does
 * not undo the 2+2 Mobile reward already earned — each milestone is its own
 * once-only achievement (`@@unique(partnerId, rewardMilestoneRuleId)`).
 */
export class RewardService {
  /**
   * Evaluates every milestone the partner newly qualifies for (there can be
   * more than one if achievement counts jumped past several thresholds
   * between evaluations) and creates the once-only achievement + allocation
   * + ledger entry for each. Requires full cash collection on the qualifying
   * booking. Concurrency-safe: takes a Postgres advisory transaction lock
   * keyed on (partnerId, rewardMilestoneRuleId) before the check-then-create,
   * so two concurrent deliveries of the same qualifying event (duplicate
   * webhook, duplicate admin click, a race between two evaluators) cannot
   * both pass the "does this achievement already exist" check before either
   * commits — the DB unique constraint is the final backstop either way.
   */
  async evaluate(
    tx: Tx,
    input: { partnerId: string; qualifyingBookingId: string; groupACount: number; groupBCount: number; createdByUserId?: string }
  ) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: input.qualifyingBookingId } });
    if (!["FULLY_COLLECTED", "REGISTERED", "COMPLETED"].includes(booking.status)) {
      throw new NotEligibleError(
        `Qualifying booking ${input.qualifyingBookingId} is not fully collected; reward cannot be evaluated yet`
      );
    }

    const asOf = booking.fullyCollectedAt ?? new Date();
    const eligibleRules = await tx.rewardMilestoneRule.findMany({
      where: {
        achievementLeft: { lte: input.groupACount },
        achievementRight: { lte: input.groupBCount },
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }],
      },
    });

    const results = [];
    for (const rule of eligibleRules) {
      results.push(await this.awardMilestone(tx, input.partnerId, rule.id, input.qualifyingBookingId, asOf, input.createdByUserId));
    }
    return results;
  }

  private async awardMilestone(
    tx: Tx,
    partnerId: string,
    rewardMilestoneRuleId: string,
    qualifyingBookingId: string,
    asOf: Date,
    createdByUserId?: string
  ) {
    // Serialize concurrent attempts at the same (partner, milestone) pair.
    const lockKey = `${partnerId}:${rewardMilestoneRuleId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey})::bigint)`;

    const existing = await tx.rewardAchievement.findUnique({
      where: { partnerId_rewardMilestoneRuleId: { partnerId, rewardMilestoneRuleId } },
      include: { allocation: true },
    });
    if (existing) return { achievement: existing, allocation: existing.allocation, alreadyExisted: true as const };

    const rule = await tx.rewardMilestoneRule.findUniqueOrThrow({ where: { id: rewardMilestoneRuleId } });

    const achievement = await tx.rewardAchievement.create({
      data: {
        partnerId,
        rewardMilestoneRuleId,
        achievedAt: asOf,
        qualifyingBookingId,
        status: "ELIGIBLE",
      },
    });

    const idempotencyKey = `reward:${partnerId}:${rewardMilestoneRuleId}`;
    const entry = await ledgerService.post(tx, {
      type: "REWARD_ALLOCATION",
      entryDate: asOf,
      sourceType: "REWARD_ACHIEVEMENT",
      sourceId: achievement.id,
      ruleVersionType: "RewardMilestoneRule",
      ruleVersionId: rule.id,
      grossAmountPaise: rule.rewardValuePaise,
      netAmountPaise: rule.rewardValuePaise,
      idempotencyKey,
      createdByUserId,
    });

    const allocation = await tx.rewardAllocation.create({
      data: {
        rewardAchievementId: achievement.id,
        partnerId,
        amountPaise: rule.rewardValuePaise,
        ledgerEntryId: entry.id,
      },
    });

    await tx.rewardAchievement.update({ where: { id: achievement.id }, data: { status: "ALLOCATED" } });

    return { achievement, allocation, alreadyExisted: false as const };
  }

  /**
   * Monthly 3% pool liability/funding tracking (informational — does not
   * gate or split individual reward payouts). Idempotent per period.
   */
  async recordPoolPeriod(tx: Tx, periodYear: number, periodMonth: number, monthlyTurnoverPaise: bigint, finalizedByUserId: string) {
    const existing = await tx.rewardPoolPeriod.findUnique({ where: { periodYear_periodMonth: { periodYear, periodMonth } } });
    if (existing) return existing;

    const rule = await tx.rewardPoolRule.findFirst({ orderBy: { effectiveFrom: "desc" } });
    if (!rule) throw new NotEligibleError("No active RewardPoolRule configured");

    const poolAmountPaise = (monthlyTurnoverPaise * BigInt(rule.poolPercentBps)) / 10_000n;

    const periodStart = new Date(Date.UTC(periodYear, periodMonth - 1, 1));
    const periodEnd = new Date(Date.UTC(periodYear, periodMonth, 0, 23, 59, 59, 999));
    const allocatedThisPeriod = await tx.rewardAllocation.aggregate({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amountPaise: true },
    });

    return tx.rewardPoolPeriod.create({
      data: {
        periodYear,
        periodMonth,
        monthlyTurnoverPaise,
        poolPercentBps: rule.poolPercentBps,
        poolAmountPaise,
        allocatedAmountPaise: allocatedThisPeriod._sum.amountPaise ?? 0n,
        rewardPoolRuleId: rule.id,
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedByUserId,
      },
    });
  }
}

export const rewardService = new RewardService();
