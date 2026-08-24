import type { Prisma, PrismaClient, ClosingBusinessLine, ClosingCycleLabel, Day31Policy } from "@prisma/client";
import { UnresolvedCalendarRuleError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface CycleWindow {
  cycleYear: number;
  cycleMonth: number; // 1-12
  cycleLabel: ClosingCycleLabel;
  startDate: Date;
  endDate: Date; // inclusive, end-of-day
  closeDate: Date;
  payoutDueDate: Date | null; // null for Balance Sheet until Business Rule #1 is configured
}

function lastDayOfMonth(year: number, month1to12: number): number {
  // day 0 of next month == last day of this month
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function endOfDayUtc(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, 23, 59, 59, 999));
}

function startOfDayUtc(year: number, month1to12: number, day: number): Date {
  return new Date(Date.UTC(year, month1to12 - 1, day, 0, 0, 0, 0));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * THE single source of closing-cycle date math. Every other module (routes,
 * reports, UI) asks this service for cycle boundaries — nothing else computes
 * "which cycle does this date belong to" independently, per the business
 * spec's explicit "single ClosingCalendar service" requirement.
 */
export class ClosingCalendarService {
  /**
   * Resolves the cycle window a given date falls into for a business line.
   * Throws UnresolvedCalendarRuleError for a 31st-of-month date when
   * day31Policy is UNSET — this is deliberate: the system must not guess.
   */
  resolveCycleWindow(
    businessLine: ClosingBusinessLine,
    date: Date,
    day31Policy: Day31Policy
  ): CycleWindow {
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const lastDay = lastDayOfMonth(year, month);

    if (day === 31) {
      if (day31Policy === "UNSET") {
        throw new UnresolvedCalendarRuleError(
          `Date ${date.toISOString().slice(0, 10)} falls on the 31st. ClosingCalendarRule.day31Policy is UNSET — ` +
            `Super Admin must configure EXTEND_CYCLE_C or ROLLS_TO_NEXT_CYCLE before this transaction can be assigned to a cycle.`
        );
      }
      if (day31Policy === "ROLLS_TO_NEXT_CYCLE") {
        // Roll into next month's Cycle A window.
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
        return this.buildWindow(businessLine, year, month, "A_1_10", day31Policy);
      }
      // EXTEND_CYCLE_C: falls through to normal C-cycle resolution below
      // (Cycle C's endDate is already "last day of month", which includes the 31st).
    }

    const label: ClosingCycleLabel = day <= 10 ? "A_1_10" : day <= 20 ? "B_11_20" : "C_21_END";
    void lastDay;
    return this.buildWindow(businessLine, year, month, label, day31Policy);
  }

  private buildWindow(
    businessLine: ClosingBusinessLine,
    year: number,
    month: number,
    label: ClosingCycleLabel,
    _day31Policy: Day31Policy
  ): CycleWindow {
    const lastDay = lastDayOfMonth(year, month);

    let startDay: number, endDay: number;
    if (label === "A_1_10") {
      startDay = 1;
      endDay = 10;
    } else if (label === "B_11_20") {
      startDay = 11;
      endDay = 20;
    } else {
      startDay = 21;
      endDay = lastDay; // naturally handles Feb 28/29, 30-day and 31-day months
    }

    const startDate = startOfDayUtc(year, month, startDay);
    const endDate = endOfDayUtc(year, month, endDay);
    const closeDate = endDate;

    let payoutDueDate: Date | null;
    if (businessLine === "REFERRAL") {
      // Payout = 5 days after close. Cycle A/B pay out same month (15th/25th
      // respectively, which is exactly close+5); Cycle C pays the 5th of the
      // following month (also close+5 across the month boundary).
      payoutDueDate = addDays(closeDate, 5);
      // normalize to date-only (00:00 UTC) for a clean due-date, not a
      // millisecond-precision end-of-day-plus-5 timestamp
      payoutDueDate = startOfDayUtc(
        payoutDueDate.getUTCFullYear(),
        payoutDueDate.getUTCMonth() + 1,
        payoutDueDate.getUTCDate()
      );
    } else {
      // BALANCE_SHEET: Business Rule #1 — no payout date defined by the
      // business. Never invented here.
      payoutDueDate = null;
    }

    return { cycleYear: year, cycleMonth: month, cycleLabel: label, startDate, endDate, closeDate, payoutDueDate };
  }

  /**
   * Finds-or-creates the ClosingCycle row for a window, and assigns the given
   * source transaction to it via the unique TransactionClosingCycle join —
   * guaranteeing one transaction belongs to exactly one cycle. Idempotent:
   * calling twice for the same sourceType/sourceId is a no-op the second time.
   */
  async assignTransaction(
    tx: Tx,
    businessLine: ClosingBusinessLine,
    date: Date,
    day31Policy: Day31Policy,
    sourceType: string,
    sourceId: string
  ) {
    const already = await tx.transactionClosingCycle.findUnique({
      where: { sourceType_sourceId: { sourceType, sourceId } },
    });
    if (already) {
      return tx.closingCycle.findUniqueOrThrow({ where: { id: already.closingCycleId } });
    }

    const window = this.resolveCycleWindow(businessLine, date, day31Policy);

    const cycle = await tx.closingCycle.upsert({
      where: {
        businessLine_cycleYear_cycleMonth_cycleLabel: {
          businessLine,
          cycleYear: window.cycleYear,
          cycleMonth: window.cycleMonth,
          cycleLabel: window.cycleLabel,
        },
      },
      update: {},
      create: {
        businessLine,
        cycleYear: window.cycleYear,
        cycleMonth: window.cycleMonth,
        cycleLabel: window.cycleLabel,
        startDate: window.startDate,
        endDate: window.endDate,
        closeDate: window.closeDate,
        payoutDueDate: window.payoutDueDate,
        status: window.payoutDueDate === null && businessLine === "BALANCE_SHEET" ? "AWAITING_PAYOUT_CONFIG" : "OPEN",
      },
    });

    await tx.transactionClosingCycle.create({
      data: { closingCycleId: cycle.id, sourceType, sourceId },
    });

    return cycle;
  }
}

export const closingCalendarService = new ClosingCalendarService();
