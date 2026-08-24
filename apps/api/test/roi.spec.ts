import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { roiCalculationService } from "../src/domain/roi.service.js";
import { MaxRoiDurationExceededError } from "../src/domain/errors.js";
import { makeCustomerUser, makeProjectAndPlot, makeRoiRule } from "./factories.js";

async function fullyCollectedRoiBooking() {
  const { customer } = await makeCustomerUser();
  const { plot } = await makeProjectAndPlot({ roiEligible: true, isCashPlot: true });
  const booking = await prisma.$transaction(async (tx) => {
    const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
    await bookingService.reserve(tx, b.id);
    await bookingService.confirmBooking(tx, b.id);
    return tx.booking.update({
      where: { id: b.id },
      data: { status: "FULLY_COLLECTED", fullyCollectedAt: new Date("2026-01-10T00:00:00Z") },
    });
  });
  return booking;
}

describe("ROICalculationService", () => {
  it("generates a 12-month schedule at 1%/month of the plot amount on full collection", async () => {
    await makeRoiRule({ calculationBase: "PLOT_AMOUNT", startTrigger: "FULL_COLLECTION_DATE" });
    const booking = await fullyCollectedRoiBooking();

    const result = await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));
    expect(result.started).toBe(true);
    if (!result.started) throw new Error("unreachable");
    expect(result.entries).toHaveLength(12);
    expect(result.entries[0]!.amountPaise.toString()).toBe("350000"); // ₹3,500 = 1% of ₹3,50,000
  });

  it("month 1 accrual posts ₹3,500 to the ledger; month 12 succeeds; month 13 is rejected", async () => {
    await makeRoiRule();
    const booking = await fullyCollectedRoiBooking();
    await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));

    const month1 = await prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 1));
    expect(month1.netAmountPaise.toString()).toBe("350000"); // ₹3,500 = 1% of ₹3,50,000

    const month12 = await prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 12));
    expect(month12.netAmountPaise.toString()).toBe("350000");

    await expect(prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 13))).rejects.toThrow(
      MaxRoiDurationExceededError
    );
  });

  it("is idempotent per month: accruing month 1 twice posts only one ledger entry", async () => {
    await makeRoiRule();
    const booking = await fullyCollectedRoiBooking();
    await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));

    const a = await prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 1));
    const b = await prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 1));
    expect(a.id).toBe(b.id);
    const count = await prisma.ledgerEntry.count({ where: { type: "ROI", sourceType: "ROI_SCHEDULE_ENTRY" } });
    expect(count).toBe(1);
  });

  it("does not start ROI twice on duplicate trigger events", async () => {
    await makeRoiRule();
    const booking = await fullyCollectedRoiBooking();
    const r1 = await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));
    const r2 = await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));
    expect(r1.started).toBe(true);
    expect(r2.started).toBe(false);
    const count = await prisma.roiScheduleEntry.count({ where: { bookingId: booking.id } });
    expect(count).toBe(12);
  });

  it("does not start ROI for a non-ROI-eligible booking", async () => {
    await makeRoiRule();
    const { customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot({ roiEligible: false });
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
      await bookingService.reserve(tx, b.id);
      await bookingService.confirmBooking(tx, b.id);
      return tx.booking.update({ where: { id: b.id }, data: { status: "FULLY_COLLECTED", fullyCollectedAt: new Date() } });
    });
    const result = await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));
    expect(result.started).toBe(false);
  });

  it("stopping future accrual on cancellation leaves already-credited months untouched", async () => {
    await makeRoiRule();
    const booking = await fullyCollectedRoiBooking();
    await prisma.$transaction((tx) => roiCalculationService.maybeStart(tx, booking.id, "FULL_COLLECTION_DATE"));
    await prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 1));
    await prisma.$transaction((tx) => roiCalculationService.accrueMonth(tx, booking.id, 2));

    await prisma.$transaction((tx) => roiCalculationService.stopFutureAccrual(tx, booking.id));

    const entries = await prisma.roiScheduleEntry.findMany({ where: { bookingId: booking.id }, orderBy: { monthNumber: "asc" } });
    expect(entries[0]!.status).toBe("CREDITED");
    expect(entries[1]!.status).toBe("CREDITED");
    expect(entries[2]!.status).toBe("STOPPED");
    expect(entries[11]!.status).toBe("STOPPED");

    // Past paid ledger entries still exist, untouched
    const ledgerCount = await prisma.ledgerEntry.count({ where: { type: "ROI", status: "POSTED" } });
    expect(ledgerCount).toBe(2);
  });
});
