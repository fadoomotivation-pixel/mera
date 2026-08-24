import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { rewardService } from "../src/domain/reward.service.js";
import { NotEligibleError } from "../src/domain/errors.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot, seedRewardMilestones, makeRewardPoolRule } from "./factories.js";

async function fullyCollectedBooking() {
  const { customer } = await makeCustomerUser();
  const { plot } = await makeProjectAndPlot();
  return prisma.$transaction(async (tx) => {
    const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
    await bookingService.reserve(tx, b.id);
    await bookingService.confirmBooking(tx, b.id);
    return tx.booking.update({ where: { id: b.id }, data: { status: "FULLY_COLLECTED", fullyCollectedAt: new Date() } });
  });
}

describe("RewardService.evaluate", () => {
  it("awards the ₹20,000 Mobile reward at 2+2 after full cash collection", async () => {
    await seedRewardMilestones();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();

    const results = await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 2, groupBCount: 2 })
    );
    expect(results).toHaveLength(1);
    expect(results[0]!.allocation?.amountPaise.toString()).toBe("2000000"); // ₹20,000
  });

  it("refuses a reward before full cash collection", async () => {
    await seedRewardMilestones();
    const { partner } = await makePartnerUser();
    const { customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id });
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id); // still BOOKED
    });
    await expect(
      prisma.$transaction((tx) =>
        rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 2, groupBCount: 2 })
      )
    ).rejects.toThrow(NotEligibleError);
  });

  it("5+5 milestone unlocks the ₹50,000 Laptop reward in addition to the earlier ₹20,000 Mobile reward (cumulative, not replaced)", async () => {
    await seedRewardMilestones();
    const { partner } = await makePartnerUser();
    const b1 = await fullyCollectedBooking();
    const b2 = await fullyCollectedBooking();

    await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: b1.id, groupACount: 2, groupBCount: 2 })
    );
    await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: b2.id, groupACount: 5, groupBCount: 5 })
    );

    const achievements = await prisma.rewardAchievement.findMany({ where: { partnerId: partner.id }, include: { allocation: true } });
    expect(achievements).toHaveLength(2);
    const amounts = achievements.map((a) => a.allocation!.amountPaise.toString()).sort();
    expect(amounts).toEqual(["2000000", "5000000"]); // ₹20,000 and ₹50,000
  });

  it("1,000+1,000 (Diamond) awards the full ₹1 Crore cash reward", async () => {
    await seedRewardMilestones();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();
    const results = await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 1000, groupBCount: 1000 })
    );
    // At 1000+1000 every lower milestone also qualifies -> all 8 awarded at once
    expect(results).toHaveLength(8);
    const diamond = results.find((r) => r.allocation?.amountPaise.toString() === "1000000000");
    expect(diamond).toBeDefined(); // ₹1,00,00,000 = ₹1 Crore in paise
  });

  it("is idempotent: evaluating the same milestone twice does not create a duplicate achievement or ledger entry", async () => {
    await seedRewardMilestones();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();
    await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 2, groupBCount: 2 })
    );
    await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 2, groupBCount: 2 })
    );
    const count = await prisma.rewardAchievement.count({ where: { partnerId: partner.id } });
    expect(count).toBe(1);
    const ledgerCount = await prisma.ledgerEntry.count({ where: { type: "REWARD_ALLOCATION" } });
    expect(ledgerCount).toBe(1);
  });

  it("prevents duplicate reward creation under concurrent events (advisory lock + unique constraint)", async () => {
    await seedRewardMilestones();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();

    const attempt = () =>
      prisma.$transaction((tx) =>
        rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 2, groupBCount: 2 })
      );

    // Fire two "duplicate webhook delivery" style concurrent evaluations.
    const [r1, r2] = await Promise.all([attempt(), attempt()]);
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);

    const achievementCount = await prisma.rewardAchievement.count({ where: { partnerId: partner.id } });
    expect(achievementCount).toBe(1);
    const allocationCount = await prisma.rewardAllocation.count({ where: { partnerId: partner.id } });
    expect(allocationCount).toBe(1);
    const ledgerCount = await prisma.ledgerEntry.count({ where: { type: "REWARD_ALLOCATION" } });
    expect(ledgerCount).toBe(1);
  });
});

describe("RewardService.recordPoolPeriod", () => {
  it("tracks the 3% monthly pool as a liability figure without constraining individual reward amounts", async () => {
    await seedRewardMilestones();
    await makeRewardPoolRule();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();
    await prisma.$transaction((tx) =>
      rewardService.evaluate(tx, { partnerId: partner.id, qualifyingBookingId: booking.id, groupACount: 2, groupBCount: 2 })
    );
    const admin = (await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } }))!;
    const now = new Date();
    const period = await prisma.$transaction((tx) =>
      rewardService.recordPoolPeriod(tx, now.getUTCFullYear(), now.getUTCMonth() + 1, 100_00_000n * 100n, admin.id)
    );
    expect(period.poolAmountPaise.toString()).toBe("30000000"); // 3% of ₹1,00,00,000 = ₹3,00,000
    expect(period.allocatedAmountPaise.toString()).toBe("2000000"); // this period's ₹20,000 Mobile reward
  });
});
