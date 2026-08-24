import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { paymentService } from "../src/domain/payment.service.js";
import { InvalidStateTransitionError, DomainError } from "../src/domain/errors.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot } from "./factories.js";

describe("Booking + Payment lifecycle", () => {
  it("single plot sale: reserve -> book -> pay 3 installments -> fully collected exactly once", async () => {
    const { customer } = await makeCustomerUser();
    const { partner } = await makePartnerUser();
    const { plot } = await makeProjectAndPlot();

    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id, partnerId: partner.id });
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id);
    });

    expect(booking.status).toBe("BOOKED");
    const schedules = await prisma.paymentSchedule.findMany({ where: { bookingId: booking.id }, orderBy: { installmentNumber: "asc" } });
    expect(schedules).toHaveLength(3);
    expect(schedules.map((s) => s.amountDuePaise.toString())).toEqual(["10500000", "10500000", "14000000"]);

    let fullyCollectedCount = 0;
    for (const schedule of schedules) {
      await prisma.$transaction(async (tx) => {
        const payment = await paymentService.initiate(tx, {
          bookingId: booking.id,
          paymentScheduleId: schedule.id,
          amountPaise: schedule.amountDuePaise,
          method: "BANK_TRANSFER",
          idempotencyKey: `pay-${schedule.id}`,
        });
        await paymentService.markPending(tx, payment.id);
        await paymentService.verify(tx, payment.id, "admin-1");
        await paymentService.collect(tx, payment.id);
        await paymentService.recomputeScheduleStatus(tx, schedule.id);
        const { justFullyCollected } = await bookingService.onPaymentScheduleUpdated(tx, booking.id);
        if (justFullyCollected) fullyCollectedCount += 1;
      });
    }

    expect(fullyCollectedCount).toBe(1); // fires exactly once, not once per installment

    const final = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(final.status).toBe("FULLY_COLLECTED");
    expect(final.fullyCollectedAt).not.toBeNull();

    const summary = await prisma.$transaction((tx) => bookingService.getFinancialSummary(tx, booking.id));
    // Only the ₹3,50,000 plot amount is covered by the 90-day schedule; the
    // ₹1,000 registration fee is deliberately excluded (spec: "Do not include
    // registration inside the ₹3,50,000 plot principal"), so ₹1,000 remains
    // outstanding against the ₹3,51,000 customer total until registration is paid.
    expect(summary.outstandingPaise.toString()).toBe("100000"); // ₹1,000 registration fee
    expect(summary.paidPaise.toString()).toBe("35000000"); // ₹3,50,000 in paise
  });

  it("rejects an illegal booking transition (DRAFT -> FULLY_COLLECTED)", async () => {
    const { customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    await expect(
      prisma.$transaction(async (tx) => {
        const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
        // @ts-expect-error accessing private for the negative-path test
        return bookingService["transition"](tx, b.id, "FULLY_COLLECTED");
      })
    ).rejects.toThrow(InvalidStateTransitionError);
  });

  it("two concurrent reservations on the same plot: only one succeeds", async () => {
    const { customer: c1 } = await makeCustomerUser();
    const { customer: c2 } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();

    const b1 = await prisma.$transaction((tx) => bookingService.createDraft(tx, { plotId: plot.id, customerId: c1.id }));
    const b2 = await prisma.$transaction((tx) => bookingService.createDraft(tx, { plotId: plot.id, customerId: c2.id }));

    const results = await Promise.allSettled([
      prisma.$transaction((tx) => bookingService.reserve(tx, b1.id)),
      prisma.$transaction((tx) => bookingService.reserve(tx, b2.id)),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(DomainError);
  });

  it("duplicate payment webhook (same idempotencyKey) does not create two payments", async () => {
    const { customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id);
    });
    const schedule = await prisma.paymentSchedule.findFirstOrThrow({ where: { bookingId: booking.id } });

    const key = `webhook-${schedule.id}`;
    const p1 = await prisma.$transaction((tx) =>
      paymentService.initiate(tx, {
        bookingId: booking.id,
        paymentScheduleId: schedule.id,
        amountPaise: schedule.amountDuePaise,
        method: "ONLINE_GATEWAY",
        idempotencyKey: key,
      })
    );
    const p2 = await prisma.$transaction((tx) =>
      paymentService.initiate(tx, {
        bookingId: booking.id,
        paymentScheduleId: schedule.id,
        amountPaise: schedule.amountDuePaise,
        method: "ONLINE_GATEWAY",
        idempotencyKey: key,
      })
    );
    expect(p1.id).toBe(p2.id);
    const count = await prisma.payment.count({ where: { bookingId: booking.id } });
    expect(count).toBe(1);
  });

  it("cancellation releases the plot back to AVAILABLE", async () => {
    const { customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id);
    });
    await prisma.$transaction((tx) => bookingService.cancel(tx, booking.id, "Customer withdrew"));
    const updatedPlot = await prisma.plot.findUniqueOrThrow({ where: { id: plot.id } });
    expect(updatedPlot.status).toBe("AVAILABLE");
    const updatedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(updatedBooking.status).toBe("CANCELLED");
  });
});
