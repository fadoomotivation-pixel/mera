import type { Prisma, PrismaClient, BookingStatus } from "@prisma/client";
import { assertTransition } from "./state-machine.js";
import { NotFoundDomainError, DomainError } from "./errors.js";
import { NINETY_DAY_PLAN } from "./payment-plan.js";

type Tx = Prisma.TransactionClient | PrismaClient;

const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  DRAFT: ["RESERVED", "CANCELLED"],
  RESERVED: ["BOOKED", "CANCELLED"],
  BOOKED: ["PAYMENT_IN_PROGRESS", "CANCELLED", "REFUND_INITIATED"],
  PAYMENT_IN_PROGRESS: ["FULLY_COLLECTED", "CANCELLED", "REFUND_INITIATED"],
  FULLY_COLLECTED: ["REGISTERED", "CANCELLED", "REFUND_INITIATED"],
  REGISTERED: ["COMPLETED", "CANCELLED", "REFUND_INITIATED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUND_INITIATED: ["REFUNDED"],
  REFUNDED: [],
};

export class BookingService {
  private async transition(tx: Tx, bookingId: string, to: BookingStatus, extra: Record<string, unknown> = {}) {
    const rows = await tx.$queryRaw<{ id: string; status: BookingStatus }[]>`
      SELECT id, status FROM "Booking" WHERE id = ${bookingId} FOR UPDATE
    `;
    const current = rows[0];
    if (!current) throw new NotFoundDomainError("Booking", bookingId);
    if (current.status === to) return tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    assertTransition("Booking", BOOKING_TRANSITIONS, current.status, to);
    return tx.booking.update({ where: { id: bookingId }, data: { status: to, ...extra } });
  }

  async createDraft(tx: Tx, input: { plotId: string; customerId: string; partnerId?: string }) {
    const plot = await tx.plot.findUniqueOrThrow({ where: { id: input.plotId } });
    return tx.booking.create({
      data: {
        plotId: input.plotId,
        customerId: input.customerId,
        partnerId: input.partnerId,
        status: "DRAFT",
        plotAmountSnapshotPaise: plot.plotAmountPaise,
        registrationAmountSnapshotPaise: plot.registrationAmountPaise,
        totalCustomerAmountSnapshotPaise: plot.totalCustomerAmountPaise,
        roiEligible: plot.isCashPlot && plot.roiEligible,
      },
    });
  }

  /** Reserves the plot exclusively — row-locks the Plot to prevent two
   * concurrent bookings on the same plot racing past an AVAILABLE check. */
  async reserve(tx: Tx, bookingId: string) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const plotRows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status FROM "Plot" WHERE id = ${booking.plotId} FOR UPDATE
    `;
    const plot = plotRows[0];
    if (!plot) throw new NotFoundDomainError("Plot", booking.plotId);
    if (plot.status !== "AVAILABLE") {
      throw new DomainError("PLOT_NOT_AVAILABLE", `Plot ${plot.id} is ${plot.status}, cannot reserve`);
    }
    await tx.plot.update({ where: { id: plot.id }, data: { status: "RESERVED" } });
    return this.transition(tx, bookingId, "RESERVED");
  }

  /** Confirms the booking and generates the 90-day PaymentSchedule + a
   * registration schedule row is implied by the Registration flow (separate). */
  async confirmBooking(tx: Tx, bookingId: string) {
    const booking = await this.transition(tx, bookingId, "BOOKED");
    await tx.plot.update({ where: { id: booking.plotId }, data: { status: "BOOKED" } });

    for (const installment of NINETY_DAY_PLAN) {
      const amountDue = (booking.plotAmountSnapshotPaise * BigInt(installment.percentBps)) / 10_000n;
      const dueDate = new Date(booking.bookingDate.getTime() + installment.dueOffsetDays * 24 * 60 * 60 * 1000);
      await tx.paymentSchedule.upsert({
        where: { bookingId_installmentNumber: { bookingId, installmentNumber: installment.installmentNumber } },
        update: {},
        create: {
          bookingId,
          installmentNumber: installment.installmentNumber,
          dueDate,
          percentBps: installment.percentBps,
          amountDuePaise: amountDue,
          status: "PENDING",
        },
      });
    }
    return booking;
  }

  /** Called after a Payment reaches COLLECTED. Advances BOOKED ->
   * PAYMENT_IN_PROGRESS on the first collection, and -> FULLY_COLLECTED once
   * every schedule row (plus registration fee, tracked via Collection) is
   * settled. Returns whether this call is what caused FULLY_COLLECTED, since
   * that edge is what downstream stream evaluators key off of (fires exactly
   * once per booking). */
  async onPaymentScheduleUpdated(tx: Tx, bookingId: string): Promise<{ justFullyCollected: boolean }> {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const schedules = await tx.paymentSchedule.findMany({ where: { bookingId } });
    const anyCollectedOrPartial = schedules.some((s) => s.status === "PAID" || s.status === "PARTIALLY_PAID");
    const allPaid = schedules.length > 0 && schedules.every((s) => s.status === "PAID");

    if (booking.status === "BOOKED" && anyCollectedOrPartial) {
      await this.transition(tx, bookingId, "PAYMENT_IN_PROGRESS");
    }

    if (
      (booking.status === "PAYMENT_IN_PROGRESS" || booking.status === "BOOKED") &&
      allPaid
    ) {
      await this.transition(tx, bookingId, "FULLY_COLLECTED", { fullyCollectedAt: new Date() });
      return { justFullyCollected: true };
    }
    return { justFullyCollected: false };
  }

  async markRegistered(tx: Tx, bookingId: string) {
    return this.transition(tx, bookingId, "REGISTERED", { registeredAt: new Date() });
  }

  async complete(tx: Tx, bookingId: string) {
    return this.transition(tx, bookingId, "COMPLETED", { completedAt: new Date() });
  }

  async cancel(tx: Tx, bookingId: string, reason: string) {
    const booking = await this.transition(tx, bookingId, "CANCELLED", { cancelledAt: new Date(), cancelReason: reason });
    await tx.plot.update({ where: { id: booking.plotId }, data: { status: "AVAILABLE" } });
    return booking;
  }

  async initiateRefund(tx: Tx, bookingId: string) {
    return this.transition(tx, bookingId, "REFUND_INITIATED");
  }

  async completeRefund(tx: Tx, bookingId: string) {
    const booking = await this.transition(tx, bookingId, "REFUNDED", { refundedAt: new Date() });
    await tx.plot.update({ where: { id: booking.plotId }, data: { status: "AVAILABLE" } });
    return booking;
  }

  /** Outstanding = total customer amount - sum of COLLECTED payments. Always
   * derived from the ledger of Payment rows, never a client-maintained field. */
  async getFinancialSummary(tx: Tx, bookingId: string) {
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const collected = await tx.payment.findMany({
      where: { bookingId, status: "COLLECTED" },
      select: { amountPaise: true },
    });
    const paidPaise = collected.reduce((a, p) => a + p.amountPaise, 0n);
    const outstandingPaise = booking.totalCustomerAmountSnapshotPaise - paidPaise;
    return { paidPaise, outstandingPaise: outstandingPaise < 0n ? 0n : outstandingPaise };
  }
}

export const bookingService = new BookingService();
