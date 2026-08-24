import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { referralCommissionService } from "../src/domain/referral.service.js";
import { NotEligibleError, UnresolvedCalendarRuleError } from "../src/domain/errors.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot, makeCommissionRule } from "./factories.js";

async function fullyCollectedBooking(partnerId?: string, fullyCollectedAt = new Date("2026-03-05T12:00:00Z")) {
  const { customer } = await makeCustomerUser();
  const { plot } = await makeProjectAndPlot();
  const booking = await prisma.$transaction(async (tx) => {
    const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id, partnerId });
    await bookingService.reserve(tx, b.id);
    await bookingService.confirmBooking(tx, b.id);
    return tx.booking.update({ where: { id: b.id }, data: { status: "FULLY_COLLECTED", fullyCollectedAt } });
  });
  return booking;
}

describe("ReferralCommissionService", () => {
  it("computes ₹35,000 gross -> ₹32,550 net on a ₹3,50,000 plot", async () => {
    await makeCommissionRule();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking(partner.id);

    const result = await prisma.$transaction((tx) => referralCommissionService.evaluate(tx, booking.id));
    expect(result.ledgerEntry.grossAmountPaise.toString()).toBe("3500000"); // ₹35,000
    expect(result.ledgerEntry.deductionAmountPaise.toString()).toBe("245000"); // ₹1,750 + ₹700
    expect(result.ledgerEntry.netAmountPaise.toString()).toBe("3255000"); // ₹32,550
    expect(result.cycle.businessLine).toBe("REFERRAL");
    expect(result.cycle.cycleLabel).toBe("A_1_10");
  });

  it("is idempotent: evaluating twice does not create two ledger entries", async () => {
    await makeCommissionRule();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking(partner.id);

    const r1 = await prisma.$transaction((tx) => referralCommissionService.evaluate(tx, booking.id));
    const r2 = await prisma.$transaction((tx) => referralCommissionService.evaluate(tx, booking.id));
    expect(r1.ledgerEntry.id).toBe(r2.ledgerEntry.id);

    const count = await prisma.ledgerEntry.count({ where: { type: "REFERRAL_COMMISSION", sourceId: booking.id } });
    expect(count).toBe(1);
  });

  it("skips (throws NotEligibleError) when the booking has no referring partner", async () => {
    await makeCommissionRule();
    const booking = await fullyCollectedBooking(undefined);
    await expect(prisma.$transaction((tx) => referralCommissionService.evaluate(tx, booking.id))).rejects.toThrow(
      NotEligibleError
    );
  });

  it("does not evaluate a booking that has not reached FULLY_COLLECTED", async () => {
    await makeCommissionRule();
    const { customer } = await makeCustomerUser();
    const { partner } = await makePartnerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id, partnerId: partner.id });
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id); // still BOOKED, not fully collected
    });
    await expect(prisma.$transaction((tx) => referralCommissionService.evaluate(tx, booking.id))).rejects.toThrow(
      NotEligibleError
    );
  });

  it("assigns a day-31 transaction to Cycle C when EXTEND_CYCLE_C is configured, and refuses when UNSET", async () => {
    await makeCommissionRule();
    const admin = await prisma.user.create({ data: { role: "SUPER_ADMIN", email: "ceo@test.com", status: "ACTIVE" } });

    // Case 1: UNSET (default) -> refuses
    const { partner: p1 } = await makePartnerUser();
    const b1 = await fullyCollectedBooking(p1.id, new Date("2026-01-31T12:00:00Z"));
    await expect(prisma.$transaction((tx) => referralCommissionService.evaluate(tx, b1.id))).rejects.toThrow(
      UnresolvedCalendarRuleError
    );
    // Ledger entry for the commission itself is still created (business fact),
    // only the cycle assignment step fails and the whole transaction rolls back
    // per Postgres transaction semantics -> so nothing at all should be posted.
    const countAfterFailedAttempt = await prisma.ledgerEntry.count({ where: { type: "REFERRAL_COMMISSION", sourceId: b1.id } });
    expect(countAfterFailedAttempt).toBe(0);

    // Case 2: Super Admin configures EXTEND_CYCLE_C -> now it resolves
    await prisma.closingCalendarRule.create({
      data: {
        version: 1,
        day31Policy: "EXTEND_CYCLE_C",
        status: "CONFIGURED",
        effectiveFrom: new Date("2020-01-01"),
        createdByUserId: admin.id,
        approvedByUserId: admin.id,
      },
    });
    const { partner: p2 } = await makePartnerUser();
    const b2 = await fullyCollectedBooking(p2.id, new Date("2026-01-31T12:00:00Z"));
    const result = await prisma.$transaction((tx) => referralCommissionService.evaluate(tx, b2.id));
    expect(result.cycle.cycleLabel).toBe("C_21_END");
    expect(result.cycle.cycleMonth).toBe(1);
  });
});
