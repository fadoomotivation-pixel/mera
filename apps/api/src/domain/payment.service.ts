import type { Prisma, PrismaClient, PaymentStatus, PaymentMethod } from "@prisma/client";
import { assertTransition } from "./state-machine.js";
import { NotFoundDomainError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  INITIATED: ["PENDING", "FAILED"],
  PENDING: ["VERIFIED", "FAILED"],
  VERIFIED: ["COLLECTED"],
  COLLECTED: ["REFUNDED"],
  FAILED: [],
  REFUNDED: [],
};

export interface RecordPaymentInput {
  bookingId: string;
  paymentScheduleId?: string;
  amountPaise: bigint;
  method: PaymentMethod;
  idempotencyKey: string;
  gatewayReference?: string;
}

/**
 * PaymentService owns the Payment state machine end-to-end and is the single
 * entry point for both manual admin entry and gateway webhooks. Every mutating
 * call is idempotency-key-gated and takes a row lock on the target Payment
 * before transitioning it, so a duplicate webhook delivery or a duplicate
 * admin double-click resolves to the SAME payment rather than creating a
 * second one or double-transitioning state.
 */
export class PaymentService {
  /** Idempotent create: a retry with the same idempotencyKey returns the existing row. */
  async initiate(tx: Tx, input: RecordPaymentInput) {
    const existing = await tx.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;

    return tx.payment.create({
      data: {
        bookingId: input.bookingId,
        paymentScheduleId: input.paymentScheduleId,
        amountPaise: input.amountPaise,
        method: input.method,
        status: "INITIATED",
        idempotencyKey: input.idempotencyKey,
        gatewayReference: input.gatewayReference,
      },
    });
  }

  private async lockAndGet(tx: Tx, paymentId: string) {
    // SELECT ... FOR UPDATE via Prisma's queryRaw, since $transaction row locks
    // aren't otherwise exposed for a single findUnique.
    const rows = await tx.$queryRaw<{ id: string; status: PaymentStatus }[]>`
      SELECT id, status FROM "Payment" WHERE id = ${paymentId} FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new NotFoundDomainError("Payment", paymentId);
    return row;
  }

  async markPending(tx: Tx, paymentId: string) {
    const current = await this.lockAndGet(tx, paymentId);
    if (current.status === "PENDING") return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assertTransition("Payment", PAYMENT_TRANSITIONS, current.status, "PENDING");
    return tx.payment.update({ where: { id: paymentId }, data: { status: "PENDING" } });
  }

  async verify(tx: Tx, paymentId: string, verifiedByUserId: string) {
    const current = await this.lockAndGet(tx, paymentId);
    if (current.status === "VERIFIED") return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assertTransition("Payment", PAYMENT_TRANSITIONS, current.status, "VERIFIED");
    return tx.payment.update({
      where: { id: paymentId },
      data: { status: "VERIFIED", verifiedAt: new Date(), verifiedByUserId },
    });
  }

  async fail(tx: Tx, paymentId: string) {
    const current = await this.lockAndGet(tx, paymentId);
    if (current.status === "FAILED") return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assertTransition("Payment", PAYMENT_TRANSITIONS, current.status, "FAILED");
    return tx.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failedAt: new Date() } });
  }

  /** VERIFIED -> COLLECTED. This is the event BookingService listens for to
   * progress PaymentSchedule / Booking status. Idempotent. */
  async collect(tx: Tx, paymentId: string) {
    const current = await this.lockAndGet(tx, paymentId);
    if (current.status === "COLLECTED") return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assertTransition("Payment", PAYMENT_TRANSITIONS, current.status, "COLLECTED");
    return tx.payment.update({ where: { id: paymentId }, data: { status: "COLLECTED", collectedAt: new Date() } });
  }

  async refund(tx: Tx, paymentId: string) {
    const current = await this.lockAndGet(tx, paymentId);
    if (current.status === "REFUNDED") return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    assertTransition("Payment", PAYMENT_TRANSITIONS, current.status, "REFUNDED");
    return tx.payment.update({ where: { id: paymentId }, data: { status: "REFUNDED", refundedAt: new Date() } });
  }

  /**
   * Recomputes a PaymentSchedule row's status from the sum of COLLECTED
   * payments allocated to it. Derived, never independently mutated to avoid
   * drift between Payment rows and PaymentSchedule.status.
   */
  async recomputeScheduleStatus(tx: Tx, paymentScheduleId: string) {
    const schedule = await tx.paymentSchedule.findUniqueOrThrow({ where: { id: paymentScheduleId } });
    const collected = await tx.payment.findMany({
      where: { paymentScheduleId, status: "COLLECTED" },
      select: { amountPaise: true },
    });
    const collectedTotal = collected.reduce((a, p) => a + p.amountPaise, 0n);

    let status: string;
    if (collectedTotal <= 0n) status = "PENDING";
    else if (collectedTotal < schedule.amountDuePaise) status = "PARTIALLY_PAID";
    else status = "PAID";

    if (status !== schedule.status) {
      await tx.paymentSchedule.update({ where: { id: paymentScheduleId }, data: { status } });
    }
    return status;
  }
}

export const paymentService = new PaymentService();
