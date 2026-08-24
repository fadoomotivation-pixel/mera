import type { Prisma, PrismaClient } from "@prisma/client";
import { applyBps } from "./money.js";
import { ledgerService } from "./ledger.service.js";
import { closingCalendarService } from "./closing-calendar.service.js";
import { NotEligibleError, DomainError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Stream 1 — Referral Bonus (10% of Plot Amount, minus 5% admin charge and
 * 2% TDS, per docs/01-business-rules-matrix.md §2). This is the ONLY place
 * a referral commission amount is computed; the frontend never re-derives it.
 */
export class ReferralCommissionService {
  private async resolveActiveRule(tx: Tx, asOf: Date) {
    const rule = await tx.commissionRule.findFirst({
      where: { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!rule) throw new DomainError("NO_ACTIVE_RULE", `No active CommissionRule as of ${asOf.toISOString()}`);
    return rule;
  }

  private async resolveDay31Policy(tx: Tx) {
    const rule = await tx.closingCalendarRule.findFirst({ orderBy: { effectiveFrom: "desc" } });
    return rule?.day31Policy ?? "UNSET";
  }

  /**
   * Evaluates and records the referral commission for a booking that has just
   * reached FULLY_COLLECTED. Idempotent per booking (idempotencyKey =
   * `referral:${bookingId}`) — safe to call multiple times (retry, duplicate
   * FULLY_COLLECTED event) and always resolves to the same LedgerEntry.
   * No-op (throws NotEligibleError, caught by the orchestrator as a skip) if
   * the booking has no referring partner.
   */
  async evaluate(tx: Tx, bookingId: string, createdByUserId?: string) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== "FULLY_COLLECTED" && booking.status !== "REGISTERED" && booking.status !== "COMPLETED") {
      throw new NotEligibleError(`Booking ${bookingId} is not FULLY_COLLECTED; referral commission cannot be evaluated yet`);
    }
    if (!booking.partnerId) {
      throw new NotEligibleError(`Booking ${bookingId} has no referring partner; no referral commission applies`);
    }

    const asOf = booking.fullyCollectedAt ?? new Date();
    const rule = await this.resolveActiveRule(tx, asOf);

    const grossPaise = applyBps(booking.plotAmountSnapshotPaise, rule.ratePercentBps);
    const adminChargePaise = applyBps(grossPaise, rule.adminChargePercentBps);
    const tdsPaise = applyBps(grossPaise, rule.tdsPercentBps);
    const netPaise = grossPaise - adminChargePaise - tdsPaise;

    const idempotencyKey = `referral:${bookingId}`;
    const entry = await ledgerService.post(tx, {
      type: "REFERRAL_COMMISSION",
      entryDate: asOf,
      sourceType: "BOOKING",
      sourceId: bookingId,
      ruleVersionType: "CommissionRule",
      ruleVersionId: rule.id,
      grossAmountPaise: grossPaise,
      deductionAmountPaise: adminChargePaise + tdsPaise,
      netAmountPaise: netPaise,
      idempotencyKey,
      createdByUserId,
    });

    const day31Policy = await this.resolveDay31Policy(tx);
    const cycle = await closingCalendarService.assignTransaction(
      tx,
      "REFERRAL",
      asOf,
      day31Policy,
      "REFERRAL_COMMISSION_LEDGER_ENTRY",
      entry.id
    );

    return { ledgerEntry: entry, rule, cycle, partnerId: booking.partnerId };
  }
}

export const referralCommissionService = new ReferralCommissionService();
