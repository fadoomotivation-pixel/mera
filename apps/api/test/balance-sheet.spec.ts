import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { balanceSheetService } from "../src/domain/balance-sheet.service.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot, makeBalanceSheetRule } from "./factories.js";

async function fullyCollectedBooking(partnerId: string, fullyCollectedAt = new Date("2026-03-05T12:00:00Z")) {
  const { customer } = await makeCustomerUser();
  const { plot } = await makeProjectAndPlot();
  return prisma.$transaction(async (tx) => {
    const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id, partnerId });
    await bookingService.reserve(tx, b.id);
    await bookingService.confirmBooking(tx, b.id);
    return tx.booking.update({ where: { id: b.id }, data: { status: "FULLY_COLLECTED", fullyCollectedAt } });
  });
}

describe("BalanceSheetService", () => {
  it("computes 8% INPUT on a ₹3,50,000 plot as ₹28,000, with OUTPUT withheld pending payout config", async () => {
    await makeBalanceSheetRule({ payoutTimingConfigured: false });
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking(partner.id);

    const result = await prisma.$transaction((tx) => balanceSheetService.evaluate(tx, booking.id));
    expect(result.balanceSheetLedger.inputAmountPaise.toString()).toBe("2800000"); // ₹28,000
    expect(result.balanceSheetLedger.outputAmountPaise.toString()).toBe("0");
    expect(result.balanceSheetLedger.balanceAmountPaise.toString()).toBe("2800000");
    expect(result.balanceSheetLedger.carryForwardAmountPaise.toString()).toBe("2800000");

    const status = await prisma.$transaction((tx) => balanceSheetService.getPartnerStatus(tx, partner.id));
    expect(status.payoutStatus).toBe("AWAITING_PAYOUT_SCHEDULE_CONFIGURATION");
  });

  it("carries the balance forward across multiple bookings for the same partner", async () => {
    await makeBalanceSheetRule({ payoutTimingConfigured: false });
    const { partner } = await makePartnerUser();
    const b1 = await fullyCollectedBooking(partner.id, new Date("2026-03-05T12:00:00Z"));
    const b2 = await fullyCollectedBooking(partner.id, new Date("2026-03-15T12:00:00Z"));

    await prisma.$transaction((tx) => balanceSheetService.evaluate(tx, b1.id));
    const r2 = await prisma.$transaction((tx) => balanceSheetService.evaluate(tx, b2.id));

    // Second booking's carry-forward-in should include the first's balance (₹28,000 + ₹28,000)
    expect(r2.balanceSheetLedger.carryForwardAmountPaise.toString()).toBe("5600000"); // ₹56,000
  });

  it("releases OUTPUT once payout timing is configured", async () => {
    await makeBalanceSheetRule({ payoutTimingConfigured: true });
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking(partner.id);
    const result = await prisma.$transaction((tx) => balanceSheetService.evaluate(tx, booking.id));
    expect(result.balanceSheetLedger.outputAmountPaise.toString()).toBe("2800000");
    expect(result.balanceSheetLedger.balanceAmountPaise.toString()).toBe("0");
  });

  it("is idempotent per booking", async () => {
    await makeBalanceSheetRule();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking(partner.id);
    const r1 = await prisma.$transaction((tx) => balanceSheetService.evaluate(tx, booking.id));
    const r2 = await prisma.$transaction((tx) => balanceSheetService.evaluate(tx, booking.id));
    expect(r1.ledgerEntry.id).toBe(r2.ledgerEntry.id);
    const count = await prisma.ledgerEntry.count({ where: { type: "BALANCE_SHEET", sourceId: booking.id } });
    expect(count).toBe(1);
  });

  it("uses correct terminology only — no forbidden MLM terms in the schema/service surface", async () => {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../src/domain/balance-sheet.service.ts", import.meta.url), "utf-8")
    );
    const forbidden = /\b(binary|leg|downline|upline|pairs?)\b/i;
    // "generation tree" / "tree" not checked here as a bare word since "GenerationRelation"
    // and doc prose legitimately reference the concept while explaining what NOT to call it.
    expect(forbidden.test(src)).toBe(false);
  });
});
