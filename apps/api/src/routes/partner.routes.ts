import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { serializeBigInts } from "../lib/serialize.js";
import { authenticate, claims } from "../auth/authenticate.js";
import { requireRole } from "../auth/rbac.js";
import { balanceSheetService } from "../domain/balance-sheet.service.js";

export async function partnerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", async (req) => requireRole(claims(req), "CHANNEL_PARTNER"));

  app.get("/me", async (req, reply) => {
    const c = claims(req);
    const partner = await prisma.channelPartner.findUniqueOrThrow({ where: { id: c.partnerId! } });
    reply.send(serializeBigInts(partner));
  });

  app.get("/dashboard", async (req, reply) => {
    const c = claims(req);
    const partnerId = c.partnerId!;

    const [bookings, referralEntries, roiSkipped, bsStatus, activeTier, rewardAchievements, payouts] = await Promise.all([
      prisma.booking.findMany({ where: { partnerId } }),
      prisma.ledgerEntry.findMany({ where: { type: "REFERRAL_COMMISSION", sourceType: "BOOKING", status: "POSTED" } }),
      Promise.resolve(null),
      prisma.$transaction((tx) => balanceSheetService.getPartnerStatus(tx, partnerId)),
      prisma.tierAchievement.findFirst({ where: { partnerId, status: "ACTIVE" }, include: { royaltyTierRule: true } }),
      prisma.rewardAchievement.findMany({ where: { partnerId }, include: { rewardMilestoneRule: true, allocation: true } }),
      prisma.payout.findMany({ where: { beneficiaryPartnerId: partnerId }, orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    void roiSkipped;

    const myBookingIds = new Set(bookings.map((b) => b.id));
    const myReferralEntries = referralEntries.filter((e) => myBookingIds.has(e.sourceId));
    const totalSalesPaise = bookings.reduce((acc, b) => acc + b.plotAmountSnapshotPaise, 0n);
    const referralIncomeGrossPaise = myReferralEntries.reduce((acc, e) => acc + e.grossAmountPaise, 0n);
    const referralIncomeNetPaise = myReferralEntries.reduce((acc, e) => acc + e.netAmountPaise, 0n);

    reply.send(
      serializeBigInts({
        totalPersonalSalesPaise: totalSalesPaise,
        totalBookings: bookings.length,
        referral: { grossPaise: referralIncomeGrossPaise, netPaise: referralIncomeNetPaise, entryCount: myReferralEntries.length },
        balanceSheet: bsStatus,
        currentTier: activeTier
          ? { tierCode: activeTier.royaltyTierRule.tierCode, tierName: activeTier.royaltyTierRule.tierName, royaltyStartDate: activeTier.royaltyStartDate, royaltyEndDate: activeTier.royaltyEndDate }
          : null,
        rewardsUnlocked: rewardAchievements.map((r) => ({
          rewardName: r.rewardMilestoneRule.rewardName,
          amountPaise: r.allocation?.amountPaise ?? 0n,
          status: r.status,
        })),
        payouts: payouts.map((p) => ({ id: p.id, type: p.payoutType, status: p.status, netAmountPaise: p.netAmountPaise })),
      })
    );
  });

  app.get("/referrals", async (req, reply) => {
    const c = claims(req);
    const bookings = await prisma.booking.findMany({
      where: { partnerId: c.partnerId! },
      include: { customer: { select: { name: true } }, plot: { include: { project: true } } },
      orderBy: { createdAt: "desc" },
    });
    const entries = await prisma.ledgerEntry.findMany({
      where: { type: "REFERRAL_COMMISSION", sourceId: { in: bookings.map((b) => b.id) } },
    });
    const byBooking = new Map(entries.map((e) => [e.sourceId, e]));
    reply.send(serializeBigInts(bookings.map((b) => ({ booking: b, commission: byBooking.get(b.id) ?? null }))));
  });

  app.get("/balance-sheet", async (req, reply) => {
    const c = claims(req);
    const ledger = await prisma.balanceSheetLedger.findMany({
      where: { partnerId: c.partnerId! },
      include: { closingCycle: true },
      orderBy: { createdAt: "desc" },
    });
    reply.send(serializeBigInts(ledger));
  });

  app.get("/tier", async (req, reply) => {
    const c = claims(req);
    const achievements = await prisma.tierAchievement.findMany({
      where: { partnerId: c.partnerId! },
      include: { royaltyTierRule: true },
      orderBy: { achievedAt: "desc" },
    });
    reply.send(serializeBigInts(achievements));
  });

  app.get("/royalty", async (req, reply) => {
    const c = claims(req);
    const allocations = await prisma.royaltyAllocation.findMany({
      where: { partnerId: c.partnerId! },
      include: { snapshot: true },
      orderBy: { createdAt: "desc" },
    });
    reply.send(serializeBigInts(allocations));
  });

  app.get("/rewards", async (req, reply) => {
    const c = claims(req);
    const achievements = await prisma.rewardAchievement.findMany({
      where: { partnerId: c.partnerId! },
      include: { rewardMilestoneRule: true, allocation: true },
      orderBy: { achievedAt: "desc" },
    });
    reply.send(serializeBigInts(achievements));
  });

  app.get("/payouts", async (req, reply) => {
    const c = claims(req);
    const payouts = await prisma.payout.findMany({
      where: { beneficiaryPartnerId: c.partnerId! },
      orderBy: { createdAt: "desc" },
    });
    reply.send(serializeBigInts(payouts));
  });

  app.get("/customers", async (req, reply) => {
    const c = claims(req);
    const bookings = await prisma.booking.findMany({
      where: { partnerId: c.partnerId! },
      include: { customer: true },
      distinct: ["customerId"],
    });
    reply.send(serializeBigInts(bookings.map((b) => b.customer)));
  });
}
