import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { serializeBigInts } from "../lib/serialize.js";
import { authenticate, claims, customerScope } from "../auth/authenticate.js";
import { requireRole } from "../auth/rbac.js";
import { bookingService } from "../domain/booking.service.js";
import { NotFoundDomainError } from "../domain/errors.js";

/**
 * Every route here is scoped with a `WHERE customerId = ...` query clause,
 * never a post-fetch filter (docs/05-permission-matrix.md enforcement note
 * #2). None of these serializers include referral commission, Balance
 * Sheet, Royalty Pool, Reward Pool, other-partner, or admin-deduction
 * fields — those simply aren't in the `select`, so there is no field to
 * accidentally leak.
 */
export async function customerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", async (req) => requireRole(claims(req), "CUSTOMER"));

  app.get("/me", async (req, reply) => {
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerScope(req) } });
    reply.send(serializeBigInts(customer));
  });

  app.get("/bookings", async (req, reply) => {
    const bookings = await prisma.booking.findMany({
      where: { customerId: customerScope(req) },
      include: { plot: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
    });
    reply.send(serializeBigInts(bookings));
  });

  app.get("/bookings/:id", async (req, reply) => {
    const scopedCustomerId = customerScope(req);
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { plot: { include: { project: true } }, paymentSchedules: true },
    });
    if (!booking || booking.customerId !== scopedCustomerId) {
      // 404, not 403 — avoid confirming existence of another customer's booking
      throw new NotFoundDomainError("Booking", id);
    }
    const summary = await prisma.$transaction((tx) => bookingService.getFinancialSummary(tx, id));
    reply.send(serializeBigInts({ ...booking, ...summary }));
  });

  app.get("/bookings/:id/payments", async (req, reply) => {
    const scopedCustomerId = customerScope(req);
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.customerId !== scopedCustomerId) throw new NotFoundDomainError("Booking", id);
    const payments = await prisma.payment.findMany({ where: { bookingId: id }, orderBy: { createdAt: "desc" } });
    reply.send(serializeBigInts(payments));
  });

  app.get("/bookings/:id/roi", async (req, reply) => {
    const scopedCustomerId = customerScope(req);
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.customerId !== scopedCustomerId) throw new NotFoundDomainError("Booking", id);
    if (!booking.roiEligible) throw new NotFoundDomainError("ROI schedule for booking", id);

    const entries = await prisma.roiScheduleEntry.findMany({ where: { bookingId: id }, orderBy: { monthNumber: "asc" } });
    const credited = entries.filter((e) => e.status === "CREDITED" || e.status === "PAID");
    const totalCreditedPaise = credited.reduce((acc, e) => acc + e.amountPaise, 0n);
    reply.send(
      serializeBigInts({
        entries,
        monthsCredited: credited.length,
        monthsRemaining: entries.filter((e) => e.status === "PENDING").length,
        totalRoiGeneratedPaise: totalCreditedPaise,
      })
    );
  });

  app.get("/bookings/:id/documents", async (req, reply) => {
    const scopedCustomerId = customerScope(req);
    const { id } = req.params as { id: string };
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking || booking.customerId !== scopedCustomerId) throw new NotFoundDomainError("Booking", id);
    const docs = await prisma.document.findMany({ where: { ownerType: "BOOKING", ownerId: id } });
    reply.send(serializeBigInts(docs));
  });

  app.get("/notifications", async (req, reply) => {
    const c = claims(req);
    const notifications = await prisma.notification.findMany({
      where: { userId: c.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    reply.send(serializeBigInts(notifications));
  });
}
