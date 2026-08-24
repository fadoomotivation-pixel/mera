import type { Prisma, PrismaClient } from "@prisma/client";
import { applyBps, splitEqually } from "./money.js";
import { ledgerService } from "./ledger.service.js";
import { NotEligibleError, DomainError, DuplicateEventError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

function lastDayOfMonthUtc(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12, 0, 23, 59, 59, 999));
}
function firstDayOfMonthUtc(year: number, month1to12: number) {
  return new Date(Date.UTC(year, month1to12 - 1, 1, 0, 0, 0, 0));
}
function addMonthsUtc(d: Date, months: number) {
  const nd = new Date(d.getTime());
  nd.setUTCMonth(nd.getUTCMonth() + months);
  return nd;
}

/**
 * Stream 4 — Royalty. Tier achievement + supersession (docs/01 §5) and the
 * monthly immutable RoyaltySnapshot + equal-split allocation (docs/01 §5,
 * addendum on pool-split scope). Achievement "2+2"-style counting inputs are
 * accepted as parameters, not computed here — see the "2+2 achievement
 * counting source" unresolved rule.
 */
export class RoyaltyService {
  private async resolvePoolRule(tx: Tx, asOf: Date) {
    const rule = await tx.royaltyPoolRule.findFirst({
      where: { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!rule) throw new DomainError("NO_ACTIVE_RULE", `No active RoyaltyPoolRule as of ${asOf.toISOString()}`);
    return rule;
  }

  private async resolveHighestEligibleTier(tx: Tx, asOf: Date, groupACount: number, groupBCount: number) {
    const tiers = await tx.royaltyTierRule.findMany({
      where: { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
      orderBy: { achievementLeft: "desc" },
    });
    return tiers.find((t) => groupACount >= t.achievementLeft && groupBCount >= t.achievementRight) ?? null;
  }

  /**
   * Records a tier achievement for a partner and, per the "higher tier
   * replaces lower" FINAL rule, supersedes any currently ACTIVE tier.
   * Requires the qualifying booking to be FULLY_COLLECTED (full-cash
   * condition). Idempotent per (partnerId, qualifyingBookingId) — a retry
   * of the exact same qualifying event does not create a second row.
   */
  async recordAchievement(
    tx: Tx,
    input: {
      partnerId: string;
      qualifyingBookingId: string;
      groupACount: number;
      groupBCount: number;
      activationTiming: "IMMEDIATE" | "NEXT_MONTHLY_PERIOD";
      supersessionTiming: "IMMEDIATE" | "FINISH_CURRENT_DURATION";
      asOf?: Date;
    }
  ) {
    const asOf = input.asOf ?? new Date();

    const already = await tx.tierAchievement.findFirst({
      where: { partnerId: input.partnerId, qualifyingBookingId: input.qualifyingBookingId },
    });
    if (already) return already;

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: input.qualifyingBookingId } });
    if (!["FULLY_COLLECTED", "REGISTERED", "COMPLETED"].includes(booking.status)) {
      throw new NotEligibleError(
        `Qualifying booking ${input.qualifyingBookingId} is not fully collected; royalty cannot activate from an incomplete transaction`
      );
    }

    const tier = await this.resolveHighestEligibleTier(tx, asOf, input.groupACount, input.groupBCount);
    if (!tier) {
      throw new NotEligibleError(
        `Partner ${input.partnerId} does not meet any royalty tier threshold (${input.groupACount}+${input.groupBCount})`
      );
    }

    const currentActive = await tx.tierAchievement.findFirst({
      where: { partnerId: input.partnerId, status: "ACTIVE" },
      include: { royaltyTierRule: true },
    });

    if (currentActive && currentActive.royaltyTierRule.achievementLeft >= tier.achievementLeft) {
      // Not a strictly higher tier — do not stack, do not replace, do not create a second active row.
      return currentActive;
    }

    const royaltyStartDate =
      input.activationTiming === "IMMEDIATE" ? asOf : firstDayOfMonthUtc(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1 + 1);
    const royaltyEndDate = addMonthsUtc(royaltyStartDate, tier.royaltyDurationMonths);

    const becomesActiveNow = !currentActive || input.supersessionTiming === "IMMEDIATE";

    if (currentActive && input.supersessionTiming === "IMMEDIATE") {
      await tx.tierAchievement.update({
        where: { id: currentActive.id },
        data: { status: "SUPERSEDED", royaltyEndDate: asOf },
      });
    }

    const created = await tx.tierAchievement.create({
      data: {
        partnerId: input.partnerId,
        royaltyTierRuleId: tier.id,
        achievedAt: asOf,
        qualifyingBookingId: input.qualifyingBookingId,
        fullCashConditionMet: true,
        royaltyStartDate,
        royaltyEndDate,
        status: becomesActiveNow ? "ACTIVE" : "ACHIEVED",
      },
    });

    if (currentActive && input.supersessionTiming === "IMMEDIATE") {
      await tx.tierAchievement.update({
        where: { id: currentActive.id },
        data: { supersededByAchievementId: created.id },
      });
    }

    return created;
  }

  /**
   * FINISH_CURRENT_DURATION mode support: promotes any partner's highest
   * still-pending ACHIEVED tier to ACTIVE once their previously-ACTIVE tier
   * has EXPIRED. Run periodically (e.g. by the same job that rolls closing
   * cycles) — a no-op if nothing has expired.
   */
  async promotePendingAchievements(tx: Tx, asOf: Date = new Date()) {
    const expired = await tx.tierAchievement.findMany({
      where: { status: "ACTIVE", royaltyEndDate: { lte: asOf } },
    });
    const promoted: string[] = [];
    for (const exp of expired) {
      await tx.tierAchievement.update({ where: { id: exp.id }, data: { status: "EXPIRED" } });
      const next = await tx.tierAchievement.findFirst({
        where: { partnerId: exp.partnerId, status: "ACHIEVED" },
        orderBy: { achievedAt: "desc" },
        include: { royaltyTierRule: true },
      });
      if (next) {
        await tx.tierAchievement.update({ where: { id: next.id }, data: { status: "ACTIVE" } });
        await tx.tierAchievement.update({ where: { id: exp.id }, data: { supersededByAchievementId: next.id } });
        promoted.push(next.id);
      }
    }
    return { expiredCount: expired.length, promoted };
  }

  /**
   * Generates the immutable monthly RoyaltySnapshot: 2% of turnover, split
   * equally among every partner with an ACTIVE tier during the period
   * (company-wide, not per-tier — see docs/01 §5 addendum). Refuses to
   * regenerate an already-FINALIZED period.
   */
  async finalizeMonthlySnapshot(
    tx: Tx,
    periodYear: number,
    periodMonth: number,
    monthlyTurnoverPaise: bigint,
    finalizedByUserId: string
  ) {
    const existing = await tx.royaltySnapshot.findUnique({ where: { periodYear_periodMonth: { periodYear, periodMonth } } });
    if (existing) {
      throw new DuplicateEventError(
        `RoyaltySnapshot for ${periodYear}-${periodMonth} is already ${existing.status}; snapshots are immutable once finalized`
      );
    }

    const periodStart = firstDayOfMonthUtc(periodYear, periodMonth);
    const periodEnd = lastDayOfMonthUtc(periodYear, periodMonth);
    const rule = await this.resolvePoolRule(tx, periodEnd);
    const poolAmountPaise = applyBps(monthlyTurnoverPaise, rule.poolPercentBps);

    const eligible = await tx.tierAchievement.findMany({
      where: {
        status: "ACTIVE",
        royaltyStartDate: { lte: periodEnd },
        royaltyEndDate: { gte: periodStart },
      },
      include: { royaltyTierRule: true },
    });

    const snapshot = await tx.royaltySnapshot.create({
      data: {
        periodYear,
        periodMonth,
        monthlyTurnoverPaise,
        poolPercentBps: rule.poolPercentBps,
        poolAmountPaise,
        royaltyPoolRuleId: rule.id,
        status: "FINALIZED",
        finalizedAt: new Date(),
        finalizedByUserId,
      },
    });

    await ledgerService.post(tx, {
      type: "ROYALTY_POOL",
      sourceType: "ROYALTY_SNAPSHOT",
      sourceId: snapshot.id,
      ruleVersionType: "RoyaltyPoolRule",
      ruleVersionId: rule.id,
      grossAmountPaise: poolAmountPaise,
      netAmountPaise: poolAmountPaise,
      idempotencyKey: `royalty-pool:${periodYear}-${periodMonth}`,
      createdByUserId: finalizedByUserId,
    });

    const shares = splitEqually(poolAmountPaise, Math.max(eligible.length, 1)).slice(0, eligible.length);
    const allocations = [];
    for (let i = 0; i < eligible.length; i++) {
      const achievement = eligible[i]!;
      const sharePaise = shares[i]!;
      const idempotencyKey = `royalty-allocation:${snapshot.id}:${achievement.partnerId}`;
      const entry = await ledgerService.post(tx, {
        type: "ROYALTY_ALLOCATION",
        sourceType: "ROYALTY_SNAPSHOT",
        sourceId: snapshot.id,
        ruleVersionType: "RoyaltyTierRule",
        ruleVersionId: achievement.royaltyTierRuleId,
        grossAmountPaise: sharePaise,
        netAmountPaise: sharePaise,
        idempotencyKey,
        createdByUserId: finalizedByUserId,
      });
      const allocation = await tx.royaltyAllocation.create({
        data: {
          snapshotId: snapshot.id,
          partnerId: achievement.partnerId,
          tierAchievementId: achievement.id,
          tierCode: achievement.royaltyTierRule.tierCode,
          periodEligibleCount: eligible.length,
          allocatedAmountPaise: sharePaise,
          ledgerEntryId: entry.id,
        },
      });
      allocations.push(allocation);
    }

    return { snapshot, allocations, eligibleCount: eligible.length };
  }
}

export const royaltyService = new RoyaltyService();
