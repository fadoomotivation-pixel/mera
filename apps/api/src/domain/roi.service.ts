import type { Prisma, PrismaClient } from "@prisma/client";
import { applyBps } from "./money.js";
import { ledgerService } from "./ledger.service.js";
import { bookingService } from "./booking.service.js";
import { NotEligibleError, MaxRoiDurationExceededError, DomainError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

export type RoiStartEvent = "BOOKING_DATE" | "FULL_COLLECTION_DATE" | "REGISTRATION_DATE";

/**
 * Stream 2 — Cash Plot ROI (1% per month, up to 12 months, per
 * docs/01-business-rules-matrix.md §3). Calculation base and start trigger
 * are CONFIGURABLE (ROIRule), never hardcoded here or in the frontend — this
 * service resolves whichever rule version is active and applies it.
 */
export class ROICalculationService {
  private async resolveActiveRule(tx: Tx, asOf: Date, projectId: string) {
    const projectSpecific = await tx.rOIRule.findFirst({
      where: { projectId, effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    if (projectSpecific) return projectSpecific;
    const global = await tx.rOIRule.findFirst({
      where: { projectId: null, effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: asOf } }] },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!global) throw new DomainError("NO_ACTIVE_RULE", `No active ROIRule as of ${asOf.toISOString()}`);
    return global;
  }

  private async computeBase(tx: Tx, bookingId: string, calculationBase: string) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (calculationBase === "PLOT_AMOUNT") return booking.plotAmountSnapshotPaise;
    if (calculationBase === "CUSTOMER_TOTAL") return booking.totalCustomerAmountSnapshotPaise;
    // COLLECTED_TO_DATE
    const { paidPaise } = await bookingService.getFinancialSummary(tx, bookingId);
    return paidPaise;
  }

  /**
   * Call after any lifecycle event that could be the configured start
   * trigger (booking confirmation, full collection, registration). No-op
   * unless: (a) booking.roiEligible, (b) this event matches the active
   * rule's startTrigger, (c) no ROI schedule has been generated yet for this
   * booking (idempotent — a duplicate event does not restart or extend ROI).
   */
  async maybeStart(tx: Tx, bookingId: string, occurredEvent: RoiStartEvent, createdByUserId?: string) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (!booking.roiEligible) return { started: false as const, reason: "NOT_ROI_ELIGIBLE" as const };

    const plot = await tx.plot.findUniqueOrThrow({ where: { id: booking.plotId } });
    const rule = await this.resolveActiveRule(tx, new Date(), plot.projectId);
    if (rule.startTrigger !== occurredEvent) {
      return { started: false as const, reason: "TRIGGER_NOT_MATCHED" as const };
    }

    const existing = await tx.roiScheduleEntry.findFirst({ where: { bookingId } });
    if (existing) return { started: false as const, reason: "ALREADY_STARTED" as const };

    const startDate =
      occurredEvent === "BOOKING_DATE"
        ? booking.bookingDate
        : occurredEvent === "FULL_COLLECTION_DATE"
          ? (booking.fullyCollectedAt ?? new Date())
          : (booking.registeredAt ?? new Date());

    const basePaise = await this.computeBase(tx, bookingId, rule.calculationBase);
    const monthlyAmountPaise = applyBps(basePaise, rule.ratePercentBps);

    const entries = [];
    for (let month = 1; month <= rule.maxMonths; month++) {
      const dueDate = new Date(startDate.getTime());
      dueDate.setUTCMonth(dueDate.getUTCMonth() + month);
      const entry = await tx.roiScheduleEntry.create({
        data: {
          bookingId,
          monthNumber: month,
          roiRuleId: rule.id,
          baseAmountPaise: basePaise,
          amountPaise: monthlyAmountPaise,
          status: "PENDING",
        },
      });
      entries.push(entry);
    }

    void createdByUserId;
    return { started: true as const, rule, startDate, entries };
  }

  /**
   * Credits (posts to the ledger) a specific month's ROI once it falls due.
   * Refuses beyond the rule's maxMonths (default 12) — MaxRoiDurationExceededError,
   * not a silently clamped value. Idempotent per (bookingId, monthNumber).
   */
  async accrueMonth(tx: Tx, bookingId: string, monthNumber: number, createdByUserId?: string) {
    const scheduleEntry = await tx.roiScheduleEntry.findUnique({
      where: { bookingId_monthNumber: { bookingId, monthNumber } },
    });
    if (!scheduleEntry) {
      const rule = await tx.roiScheduleEntry.findFirst({ where: { bookingId }, select: { roiRuleId: true } });
      const maxMonths = rule ? (await tx.rOIRule.findUnique({ where: { id: rule.roiRuleId } }))?.maxMonths ?? 12 : 12;
      throw new MaxRoiDurationExceededError(bookingId, monthNumber, maxMonths);
    }
    if (scheduleEntry.status === "STOPPED") {
      throw new NotEligibleError(`ROI for booking ${bookingId} was stopped; month ${monthNumber} cannot be accrued`);
    }
    if (scheduleEntry.status === "CREDITED" || scheduleEntry.status === "PAID") {
      return tx.ledgerEntry.findUniqueOrThrow({ where: { id: scheduleEntry.ledgerEntryId! } });
    }

    const idempotencyKey = `roi:${bookingId}:${monthNumber}`;
    const entry = await ledgerService.post(tx, {
      type: "ROI",
      sourceType: "ROI_SCHEDULE_ENTRY",
      sourceId: scheduleEntry.id,
      ruleVersionType: "ROIRule",
      ruleVersionId: scheduleEntry.roiRuleId,
      grossAmountPaise: scheduleEntry.amountPaise,
      netAmountPaise: scheduleEntry.amountPaise,
      idempotencyKey,
      createdByUserId,
    });

    await tx.roiScheduleEntry.update({
      where: { id: scheduleEntry.id },
      data: { status: "CREDITED", ledgerEntryId: entry.id },
    });

    return entry;
  }

  /**
   * Stops all future (PENDING) ROI accrual for a booking — called on
   * cancellation/refund/chargeback. Already-CREDITED/PAID months are left
   * untouched; they never silently disappear (per Business Rules Matrix §3,
   * §8 rule #7 — no clawback of already-paid ROI without an explicit
   * Adjustment).
   */
  async stopFutureAccrual(tx: Tx, bookingId: string) {
    const result = await tx.roiScheduleEntry.updateMany({
      where: { bookingId, status: "PENDING" },
      data: { status: "STOPPED" },
    });
    return { stoppedCount: result.count };
  }
}

export const roiCalculationService = new ROICalculationService();
