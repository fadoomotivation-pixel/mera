import type { Prisma, PrismaClient } from "@prisma/client";
import { applyBps } from "./money.js";
import { ledgerService } from "./ledger.service.js";
import { closingCalendarService } from "./closing-calendar.service.js";
import { NotEligibleError, DomainError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Stream 3 — Balance Sheet (8%, "Generation to Generation" terminology,
 * INPUT -> OUTPUT -> BALANCE -> CARRY FORWARD). See
 * docs/01-business-rules-matrix.md §4 for the full rule set, and
 * docs/03-erd.md for why generation-level fan-out is NOT implemented here:
 * the business conversation gives a single flat 8% rate and the
 * "generation to generation" concept, but never specifies how many
 * generations share it or in what split. Inventing a multi-level split
 * would be exactly the kind of silent business-rule invention this project
 * is required to avoid. `GenerationRelation` rows are captured for every
 * booking so a future CEO-approved multi-generation rule can be applied
 * retroactively via a report, but the INPUT credited today goes to the
 * direct referring partner only (same beneficiary as Referral), rather
 * than guessing a level-2/level-3 percentage.
 *
 * Payout timing is Business Rule #1 (unresolved) — this service always
 * computes and posts the ledger INPUT/OUTPUT/BALANCE/CARRY_FORWARD figures
 * (Finance can see exactly what's owed), but OUTPUT stays 0 and the cycle
 * stays AWAITING_PAYOUT_CONFIG until Super Admin configures
 * BalanceSheetRule.payoutTimingConfigured.
 */
export class BalanceSheetService {
  private async resolveActiveRule(tx: Tx, asOf: Date) {
    const rule = await tx.balanceSheetRule.findFirst({
      where: { effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!rule) throw new DomainError("NO_ACTIVE_RULE", `No active BalanceSheetRule as of ${asOf.toISOString()}`);
    return rule;
  }

  private async resolveDay31Policy(tx: Tx) {
    const rule = await tx.closingCalendarRule.findFirst({ orderBy: { effectiveFrom: "desc" } });
    return rule?.day31Policy ?? "UNSET";
  }

  /** Balance Sheet is modeled as a running ledger per partner: each new row's
   * carry-forward-in is simply the immediately preceding row's carry-forward,
   * regardless of which cycle it landed in. This avoids inventing cycle-boundary
   * reset semantics the business never specified (see class-level doc comment). */
  private async priorCarryForward(tx: Tx, partnerId: string) {
    const prior = await tx.balanceSheetLedger.findFirst({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
    });
    return prior?.carryForwardAmountPaise ?? 0n;
  }

  /** Records this booking's Balance Sheet INPUT for its referring partner.
   * Idempotent per booking (idempotencyKey = `balance-sheet:${bookingId}`). */
  async evaluate(tx: Tx, bookingId: string, createdByUserId?: string) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (booking.status !== "FULLY_COLLECTED" && booking.status !== "REGISTERED" && booking.status !== "COMPLETED") {
      throw new NotEligibleError(`Booking ${bookingId} is not FULLY_COLLECTED; Balance Sheet input cannot be evaluated yet`);
    }
    if (!booking.partnerId) {
      throw new NotEligibleError(`Booking ${bookingId} has no referring partner; no Balance Sheet input applies`);
    }

    const asOf = booking.fullyCollectedAt ?? new Date();
    const rule = await this.resolveActiveRule(tx, asOf);
    const inputPaise = applyBps(booking.plotAmountSnapshotPaise, rule.ratePercentBps);

    const idempotencyKey = `balance-sheet:${bookingId}`;
    const existingEntry = await tx.ledgerEntry.findUnique({ where: { idempotencyKey } });
    if (existingEntry) {
      const existingBsLedger = await tx.balanceSheetLedger.findUnique({ where: { ledgerEntryId: existingEntry.id } });
      return { ledgerEntry: existingEntry, balanceSheetLedger: existingBsLedger! };
    }

    const day31Policy = await this.resolveDay31Policy(tx);
    const cycle = await closingCalendarService.assignTransaction(
      tx,
      "BALANCE_SHEET",
      asOf,
      day31Policy,
      "BALANCE_SHEET_INPUT",
      bookingId
    );

    const carryForwardIn = await this.priorCarryForward(tx, booking.partnerId);
    const payoutConfigured = rule.payoutTimingConfigured;
    const outputPaise = payoutConfigured ? inputPaise + carryForwardIn : 0n;
    const balancePaise = inputPaise + carryForwardIn - outputPaise;

    const entry = await ledgerService.post(tx, {
      type: "BALANCE_SHEET",
      entryDate: asOf,
      sourceType: "BOOKING",
      sourceId: bookingId,
      ruleVersionType: "BalanceSheetRule",
      ruleVersionId: rule.id,
      grossAmountPaise: inputPaise,
      netAmountPaise: inputPaise,
      idempotencyKey,
      createdByUserId,
    });

    const bsLedger = await tx.balanceSheetLedger.create({
      data: {
        ledgerEntryId: entry.id,
        partnerId: booking.partnerId,
        closingCycleId: cycle.id,
        inputAmountPaise: inputPaise,
        outputAmountPaise: outputPaise,
        balanceAmountPaise: balancePaise,
        carryForwardAmountPaise: balancePaise,
      },
    });

    return { ledgerEntry: entry, balanceSheetLedger: bsLedger, cycle };
  }

  async getPartnerStatus(tx: Tx, partnerId: string) {
    const latest = await tx.balanceSheetLedger.findFirst({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      include: { closingCycle: true },
    });
    const rule = await this.resolveActiveRule(tx, new Date());
    return {
      currentCarryForwardPaise: latest?.carryForwardAmountPaise ?? 0n,
      payoutStatus: rule.payoutTimingConfigured ? "SCHEDULED" : "AWAITING_PAYOUT_SCHEDULE_CONFIGURATION",
      latestCycle: latest?.closingCycle ?? null,
    };
  }
}

export const balanceSheetService = new BalanceSheetService();
