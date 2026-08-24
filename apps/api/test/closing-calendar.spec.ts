import { describe, it, expect } from "vitest";
import { closingCalendarService } from "../src/domain/closing-calendar.service.js";
import { UnresolvedCalendarRuleError } from "../src/domain/errors.js";
import { prisma } from "../src/lib/prisma.js";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day, 12));

describe("ClosingCalendarService.resolveCycleWindow", () => {
  it("assigns day 5 to Cycle A with payout on the 15th", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 3, 5), "UNSET");
    expect(w.cycleLabel).toBe("A_1_10");
    expect(w.payoutDueDate?.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("assigns day 15 to Cycle B with payout on the 25th", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 3, 15), "UNSET");
    expect(w.cycleLabel).toBe("B_11_20");
    expect(w.payoutDueDate?.toISOString().slice(0, 10)).toBe("2026-03-25");
  });

  it("assigns day 25 to Cycle C with payout on the 5th of next month", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 3, 25), "UNSET");
    expect(w.cycleLabel).toBe("C_21_END");
    expect(w.payoutDueDate?.toISOString().slice(0, 10)).toBe("2026-04-05");
  });

  it("throws UnresolvedCalendarRuleError for day 31 when policy is UNSET", () => {
    expect(() => closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 1, 31), "UNSET")).toThrow(
      UnresolvedCalendarRuleError
    );
  });

  it("EXTEND_CYCLE_C: day 31 stays in this month's Cycle C", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 1, 31), "EXTEND_CYCLE_C");
    expect(w.cycleLabel).toBe("C_21_END");
    expect(w.cycleMonth).toBe(1);
    expect(w.endDate.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("ROLLS_TO_NEXT_CYCLE: day 31 rolls into next month's Cycle A", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 1, 31), "ROLLS_TO_NEXT_CYCLE");
    expect(w.cycleLabel).toBe("A_1_10");
    expect(w.cycleMonth).toBe(2);
  });

  it("ROLLS_TO_NEXT_CYCLE across a year boundary (Dec 31 -> Jan next year)", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 12, 31), "ROLLS_TO_NEXT_CYCLE");
    expect(w.cycleLabel).toBe("A_1_10");
    expect(w.cycleMonth).toBe(1);
    expect(w.cycleYear).toBe(2027);
  });

  it("Cycle C naturally shortens for February (non-leap year)", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2025, 2, 25), "UNSET");
    expect(w.cycleLabel).toBe("C_21_END");
    expect(w.endDate.toISOString().slice(0, 10)).toBe("2025-02-28");
  });

  it("Cycle C naturally extends for February leap year (2028)", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2028, 2, 25), "UNSET");
    expect(w.endDate.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("Cycle C ends on day 30 for a 30-day month (April)", () => {
    const w = closingCalendarService.resolveCycleWindow("REFERRAL", d(2026, 4, 25), "UNSET");
    expect(w.endDate.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("Balance Sheet cycles never get a payout date (Business Rule #1 unresolved)", () => {
    const w = closingCalendarService.resolveCycleWindow("BALANCE_SHEET", d(2026, 3, 5), "UNSET");
    expect(w.payoutDueDate).toBeNull();
  });
});

describe("ClosingCalendarService.assignTransaction", () => {
  it("assigns a transaction to exactly one cycle and is idempotent on retry", async () => {
    const c1 = await closingCalendarService.assignTransaction(
      prisma,
      "REFERRAL",
      d(2026, 3, 5),
      "UNSET",
      "PAYMENT",
      "payment-1"
    );
    const c2 = await closingCalendarService.assignTransaction(
      prisma,
      "REFERRAL",
      d(2026, 3, 5),
      "UNSET",
      "PAYMENT",
      "payment-1"
    );
    expect(c2.id).toBe(c1.id);

    const links = await prisma.transactionClosingCycle.findMany({
      where: { sourceType: "PAYMENT", sourceId: "payment-1" },
    });
    expect(links).toHaveLength(1);
  });

  it("marks a Balance Sheet cycle AWAITING_PAYOUT_CONFIG on creation", async () => {
    const cycle = await closingCalendarService.assignTransaction(
      prisma,
      "BALANCE_SHEET",
      d(2026, 3, 5),
      "UNSET",
      "BALANCE_SHEET_INPUT",
      "bs-1"
    );
    expect(cycle.status).toBe("AWAITING_PAYOUT_CONFIG");
    expect(cycle.payoutDueDate).toBeNull();
  });
});
