import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { serializeBigInts } from "../lib/serialize.js";
import { authenticate, claims } from "../auth/authenticate.js";
import { requireRole, ADMIN_ROLES, FINANCIAL_WRITE_ROLES } from "../auth/rbac.js";
import { bookingService } from "../domain/booking.service.js";
import { paymentService } from "../domain/payment.service.js";
import { referralCommissionService } from "../domain/referral.service.js";
import { balanceSheetService } from "../domain/balance-sheet.service.js";
import { roiCalculationService } from "../domain/roi.service.js";
import { royaltyService } from "../domain/royalty.service.js";
import { rewardService } from "../domain/reward.service.js";
import { payoutService } from "../domain/payout.service.js";
import { businessRulesRegistryService } from "../domain/business-rules-registry.service.js";
import { passwordService } from "../auth/password.service.js";
import { NotEligibleError, DomainError } from "../domain/errors.js";

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", async (req) => requireRole(claims(req), ...ADMIN_ROLES));

  // ---------- Dashboard ----------
  app.get("/dashboard", async (_req, reply) => {
    const [bookings, referralLedger, bsLedger, royaltySnapshots, rewardAllocations, payouts, customerCount, partnerCount] =
      await Promise.all([
        prisma.booking.findMany({ select: { status: true, plotAmountSnapshotPaise: true } }),
        prisma.ledgerEntry.aggregate({ where: { type: "REFERRAL_COMMISSION", status: "POSTED" }, _sum: { netAmountPaise: true } }),
        prisma.ledgerEntry.aggregate({ where: { type: "BALANCE_SHEET", status: "POSTED" }, _sum: { netAmountPaise: true } }),
        prisma.royaltySnapshot.aggregate({ _sum: { poolAmountPaise: true } }),
        prisma.rewardAllocation.aggregate({ _sum: { amountPaise: true } }),
        prisma.payout.groupBy({ by: ["status"], _sum: { netAmountPaise: true }, _count: true }),
        prisma.customer.count(),
        prisma.channelPartner.count(),
      ]);

    const totalSalesPaise = bookings.reduce((acc, b) => acc + b.plotAmountSnapshotPaise, 0n);
    const grossBookingCount = bookings.length;
    const collectedBookings = bookings.filter((b) =>
      ["FULLY_COLLECTED", "REGISTERED", "COMPLETED"].includes(b.status)
    ).length;

    reply.send(
      serializeBigInts({
        totalSalesPaise,
        grossBookingCount,
        collectedBookings,
        referralLiabilityPaise: referralLedger._sum.netAmountPaise ?? 0n,
        balanceSheetLiabilityPaise: bsLedger._sum.netAmountPaise ?? 0n,
        royaltyPoolTotalPaise: royaltySnapshots._sum.poolAmountPaise ?? 0n,
        rewardPayoutTotalPaise: rewardAllocations._sum.amountPaise ?? 0n,
        payoutsByStatus: payouts,
        customerCount,
        partnerCount,
      })
    );
  });

  // ---------- Business Rules ----------
  app.get("/business-rules", async (_req, reply) => {
    const rows = await prisma.$transaction((tx) => businessRulesRegistryService.listCurrent(tx));
    reply.send(serializeBigInts(rows));
  });

  // ---------- Customer & Partner accounts ----------
  // No SMS/OTP delivery is configured for this deployment (see docs/01-business-rules-matrix.md
  // §8 item 10), so account creation is admin-driven: the admin sets an email + temporary
  // password directly, and hands it to the customer/partner out of band (WhatsApp/call/in
  // person). The OTP login path (auth.routes.ts) still exists and works unmodified if an SMS
  // provider is wired up later — nothing here removes it, this just adds the alternative.
  app.get("/customers", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN", "SUPPORT", "FINANCE_ADMIN", "COMPLIANCE_AUDIT");
    const customers = await prisma.customer.findMany({
      include: { user: { select: { email: true, phone: true, status: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    reply.send(serializeBigInts(customers));
  });

  app.post("/customers", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN", "SUPPORT");
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
      .parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new DomainError("EMAIL_IN_USE", `A user with email ${body.email} already exists`);

    const passwordHash = await passwordService.hash(body.password);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: "CUSTOMER", email: body.email, phone: body.phone, passwordHash, status: "ACTIVE" },
      });
      return tx.customer.create({
        data: { userId: user.id, name: body.name, address: body.address },
        include: { user: { select: { email: true, phone: true } } },
      });
    });
    reply.status(201).send(serializeBigInts(created));
  });

  app.get("/partners", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN", "FINANCE_ADMIN", "COMPLIANCE_AUDIT");
    const partners = await prisma.channelPartner.findMany({
      include: { user: { select: { email: true, phone: true, status: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    reply.send(serializeBigInts(partners));
  });

  app.post("/partners", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN");
    const body = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        phone: z.string().optional(),
        panNumber: z.string().optional(),
      })
      .parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new DomainError("EMAIL_IN_USE", `A user with email ${body.email} already exists`);

    const partnerCode = `MM-P-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const passwordHash = await passwordService.hash(body.password);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { role: "CHANNEL_PARTNER", email: body.email, phone: body.phone, passwordHash, status: "ACTIVE" },
      });
      return tx.channelPartner.create({
        data: { userId: user.id, name: body.name, partnerCode, panNumber: body.panNumber },
        include: { user: { select: { email: true, phone: true } } },
      });
    });
    reply.status(201).send(serializeBigInts(created));
  });

  // ---------- Projects & Plots (Operations) ----------
  app.post("/projects", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN");
    const body = z
      .object({ name: z.string(), slug: z.string(), location: z.string(), description: z.string().optional() })
      .parse(req.body);
    const project = await prisma.project.create({ data: body });
    reply.status(201).send(serializeBigInts(project));
  });

  app.get("/projects", async (_req, reply) => {
    const projects = await prisma.project.findMany({ include: { plots: true } });
    reply.send(serializeBigInts(projects));
  });

  app.post("/plots", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN");
    const body = z
      .object({
        projectId: z.string().uuid(),
        plotNumber: z.string(),
        sizeGaj: z.number().int().positive(),
        ratePerGajPaise: z.string(),
        registrationAmountPaise: z.string().default("100000"),
        isCashPlot: z.boolean().default(true),
        roiEligible: z.boolean().default(false),
      })
      .parse(req.body);
    const ratePerGajPaise = BigInt(body.ratePerGajPaise);
    const registrationAmountPaise = BigInt(body.registrationAmountPaise);
    const plotAmountPaise = ratePerGajPaise * BigInt(body.sizeGaj);
    const plot = await prisma.plot.create({
      data: {
        projectId: body.projectId,
        plotNumber: body.plotNumber,
        sizeGaj: body.sizeGaj,
        ratePerGajPaise,
        plotAmountPaise,
        registrationAmountPaise,
        totalCustomerAmountPaise: plotAmountPaise + registrationAmountPaise,
        isCashPlot: body.isCashPlot,
        roiEligible: body.roiEligible,
      },
    });
    reply.status(201).send(serializeBigInts(plot));
  });

  // ---------- Bookings ----------
  app.post("/bookings", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN");
    const body = z.object({ plotId: z.string().uuid(), customerId: z.string().uuid(), partnerId: z.string().uuid().optional() }).parse(
      req.body
    );
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, body);
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id);
    });
    reply.status(201).send(serializeBigInts(booking));
  });

  app.get("/bookings", async (req, reply) => {
    const q = z
      .object({ status: z.string().optional(), partnerId: z.string().optional(), customerId: z.string().optional() })
      .parse(req.query);
    const bookings = await prisma.booking.findMany({
      where: {
        status: q.status as never,
        partnerId: q.partnerId,
        customerId: q.customerId,
      },
      include: { customer: true, partner: true, plot: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    reply.send(serializeBigInts(bookings));
  });

  app.post("/bookings/:id/registration", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "OPERATIONS_ADMIN");
    const { id } = req.params as { id: string };
    const c = claims(req);
    const result = await prisma.$transaction(async (tx) => {
      const booking = await bookingService.markRegistered(tx, id);
      await tx.registration.create({ data: { bookingId: id, registeredByUserId: c.sub } });
      return booking;
    });
    reply.send(serializeBigInts(result));
  });

  // ---------- Payments ----------
  app.post("/payments", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES, "OPERATIONS_ADMIN");
    const body = z
      .object({
        bookingId: z.string().uuid(),
        paymentScheduleId: z.string().uuid().optional(),
        amountPaise: z.string(),
        method: z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "ONLINE_GATEWAY"]),
        idempotencyKey: z.string(),
      })
      .parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const payment = await paymentService.initiate(tx, { ...body, amountPaise: BigInt(body.amountPaise) });
      await paymentService.markPending(tx, payment.id);
      return payment;
    });
    reply.status(201).send(serializeBigInts(result));
  });

  app.post("/payments/:id/verify", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const { id } = req.params as { id: string };
    const c = claims(req);
    const result = await prisma.$transaction(async (tx) => {
      await paymentService.verify(tx, id, c.sub);
      const payment = await paymentService.collect(tx, id);
      if (payment.paymentScheduleId) {
        await paymentService.recomputeScheduleStatus(tx, payment.paymentScheduleId);
        const { justFullyCollected } = await bookingService.onPaymentScheduleUpdated(tx, payment.bookingId);
        if (justFullyCollected) {
          try {
            await referralCommissionService.evaluate(tx, payment.bookingId, c.sub);
          } catch (e) {
            if (!(e instanceof NotEligibleError)) throw e;
          }
          try {
            await balanceSheetService.evaluate(tx, payment.bookingId, c.sub);
          } catch (e) {
            if (!(e instanceof NotEligibleError)) throw e;
          }
          await roiCalculationService.maybeStart(tx, payment.bookingId, "FULL_COLLECTION_DATE", c.sub);
        }
      }
      return payment;
    });
    reply.send(serializeBigInts(result));
  });

  // ---------- Closing cycles / payout batches ----------
  app.post("/referral/payout-batch", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const body = z.object({ closingCycleId: z.string().uuid() }).parse(req.body);
    const c = claims(req);
    const result = await prisma.$transaction(async (tx) => {
      const cycle = await tx.closingCycle.findUniqueOrThrow({ where: { id: body.closingCycleId } });
      const links = await tx.transactionClosingCycle.findMany({
        where: { closingCycleId: cycle.id, sourceType: "REFERRAL_COMMISSION_LEDGER_ENTRY" },
      });
      const batch = await tx.payoutBatch.create({
        data: {
          payoutType: "REFERRAL",
          closingCycleId: cycle.id,
          generatedByUserId: c.sub,
          totalGrossPaise: 0n,
          totalNetPaise: 0n,
          itemCount: 0,
        },
      });
      let totalGross = 0n;
      let totalNet = 0n;
      let count = 0;
      for (const link of links) {
        const entry = await tx.ledgerEntry.findUniqueOrThrow({ where: { id: link.sourceId } });
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: entry.sourceId } });
        if (!booking.partnerId) continue;
        const payout = await payoutService.createOrGet(
          tx,
          {
            payoutType: "REFERRAL",
            beneficiaryPartnerId: booking.partnerId,
            sourceLedgerEntryId: entry.id,
            ruleVersionType: entry.ruleVersionType!,
            ruleVersionId: entry.ruleVersionId!,
            grossAmountPaise: entry.grossAmountPaise,
            adminDeductionPaise: entry.deductionAmountPaise,
            netAmountPaise: entry.netAmountPaise,
          },
          batch.id
        );
        await payoutService.markEligible(tx, payout.id);
        totalGross += entry.grossAmountPaise;
        totalNet += entry.netAmountPaise;
        count += 1;
      }
      await tx.closingCycle.update({ where: { id: cycle.id }, data: { status: "PAYOUT_SCHEDULED" } });
      return tx.payoutBatch.update({
        where: { id: batch.id },
        data: { totalGrossPaise: totalGross, totalNetPaise: totalNet, itemCount: count },
      });
    });
    reply.status(201).send(serializeBigInts(result));
  });

  app.post("/royalty/snapshot", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const body = z.object({ periodYear: z.number().int(), periodMonth: z.number().int(), monthlyTurnoverPaise: z.string() }).parse(
      req.body
    );
    const c = claims(req);
    const result = await prisma.$transaction((tx) =>
      royaltyService.finalizeMonthlySnapshot(tx, body.periodYear, body.periodMonth, BigInt(body.monthlyTurnoverPaise), c.sub)
    );
    reply.status(201).send(serializeBigInts(result));
  });

  app.post("/rewards/evaluate", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const body = z
      .object({ partnerId: z.string().uuid(), qualifyingBookingId: z.string().uuid(), groupACount: z.number(), groupBCount: z.number() })
      .parse(req.body);
    const c = claims(req);
    const result = await prisma.$transaction((tx) => rewardService.evaluate(tx, { ...body, createdByUserId: c.sub }));
    reply.send(serializeBigInts(result));
  });

  // ---------- Payouts ----------
  app.get("/payouts", async (req, reply) => {
    const q = z.object({ status: z.string().optional(), payoutType: z.string().optional() }).parse(req.query);
    const payouts = await prisma.payout.findMany({
      where: { status: q.status as never, payoutType: q.payoutType as never },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    reply.send(serializeBigInts(payouts));
  });

  app.post("/payouts/:id/approve", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const { id } = req.params as { id: string };
    const c = claims(req);
    const result = await prisma.$transaction((tx) =>
      payoutService.approve(tx, id, c.sub, req.ip, req.headers["x-device-id"] as string | undefined)
    );
    reply.send(serializeBigInts(result));
  });

  app.post("/payouts/:id/hold", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const { id } = req.params as { id: string };
    const body = z.object({ reason: z.string() }).parse(req.body);
    const result = await prisma.$transaction((tx) => payoutService.hold(tx, id, body.reason));
    reply.send(serializeBigInts(result));
  });

  app.post("/payouts/:id/release", async (req, reply) => {
    requireRole(claims(req), ...FINANCIAL_WRITE_ROLES);
    const { id } = req.params as { id: string };
    const result = await prisma.$transaction((tx) => payoutService.release(tx, id));
    reply.send(serializeBigInts(result));
  });

  // ---------- Audit ----------
  app.get("/audit-logs", async (req, reply) => {
    requireRole(claims(req), "SUPER_ADMIN", "COMPLIANCE_AUDIT");
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    reply.send(serializeBigInts(logs));
  });
}
