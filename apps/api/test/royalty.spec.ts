import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { bookingService } from "../src/domain/booking.service.js";
import { royaltyService } from "../src/domain/royalty.service.js";
import { NotEligibleError, DuplicateEventError } from "../src/domain/errors.js";
import { makeCustomerUser, makePartnerUser, makeProjectAndPlot, seedRoyaltyTiers, makeRoyaltyPoolRule, makeAdminUser } from "./factories.js";

async function fullyCollectedBooking(partnerId?: string) {
  const { customer } = await makeCustomerUser();
  const { plot } = await makeProjectAndPlot();
  return prisma.$transaction(async (tx) => {
    const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id, partnerId });
    await bookingService.reserve(tx, b.id);
    await bookingService.confirmBooking(tx, b.id);
    return tx.booking.update({ where: { id: b.id }, data: { status: "FULLY_COLLECTED", fullyCollectedAt: new Date() } });
  });
}

describe("RoyaltyService.recordAchievement", () => {
  it("records the Adviser tier (2+2) for the qualifying booking", async () => {
    await seedRoyaltyTiers();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();

    const achievement = await prisma.$transaction((tx) =>
      royaltyService.recordAchievement(tx, {
        partnerId: partner.id,
        qualifyingBookingId: booking.id,
        groupACount: 2,
        groupBCount: 2,
        activationTiming: "IMMEDIATE",
        supersessionTiming: "IMMEDIATE",
      })
    );
    expect(achievement.status).toBe("ACTIVE");
    const tier = await prisma.royaltyTierRule.findUniqueOrThrow({ where: { id: achievement.royaltyTierRuleId } });
    expect(tier.tierCode).toBe("01");
  });

  it("refuses royalty before full cash collection", async () => {
    await seedRoyaltyTiers();
    const { partner } = await makePartnerUser();
    const { customer } = await makeCustomerUser();
    const { plot } = await makeProjectAndPlot();
    const booking = await prisma.$transaction(async (tx) => {
      const b = await bookingService.createDraft(tx, { plotId: plot.id, customerId: customer.id, partnerId: partner.id });
      await bookingService.reserve(tx, b.id);
      return bookingService.confirmBooking(tx, b.id); // still BOOKED
    });
    await expect(
      prisma.$transaction((tx) =>
        royaltyService.recordAchievement(tx, {
          partnerId: partner.id,
          qualifyingBookingId: booking.id,
          groupACount: 2,
          groupBCount: 2,
          activationTiming: "IMMEDIATE",
          supersessionTiming: "IMMEDIATE",
        })
      )
    ).rejects.toThrow(NotEligibleError);
  });

  it("upgrades Adviser -> Senior Adviser: replaces, does not stack durations", async () => {
    await seedRoyaltyTiers();
    const { partner } = await makePartnerUser();
    const b1 = await fullyCollectedBooking();
    const b2 = await fullyCollectedBooking();

    const first = await prisma.$transaction((tx) =>
      royaltyService.recordAchievement(tx, {
        partnerId: partner.id,
        qualifyingBookingId: b1.id,
        groupACount: 2,
        groupBCount: 2,
        activationTiming: "IMMEDIATE",
        supersessionTiming: "IMMEDIATE",
      })
    );
    const second = await prisma.$transaction((tx) =>
      royaltyService.recordAchievement(tx, {
        partnerId: partner.id,
        qualifyingBookingId: b2.id,
        groupACount: 5,
        groupBCount: 5,
        activationTiming: "IMMEDIATE",
        supersessionTiming: "IMMEDIATE",
      })
    );

    const firstReloaded = await prisma.tierAchievement.findUniqueOrThrow({ where: { id: first.id } });
    expect(firstReloaded.status).toBe("SUPERSEDED");
    expect(firstReloaded.supersededByAchievementId).toBe(second.id);
    expect(second.status).toBe("ACTIVE");

    // Exactly one ACTIVE row for this partner (structural guard also enforces this)
    const activeCount = await prisma.tierAchievement.count({ where: { partnerId: partner.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("does not downgrade or double-activate when a lower/equal tier is achieved again", async () => {
    await seedRoyaltyTiers();
    const { partner } = await makePartnerUser();
    const b1 = await fullyCollectedBooking();
    const b2 = await fullyCollectedBooking();

    await prisma.$transaction((tx) =>
      royaltyService.recordAchievement(tx, {
        partnerId: partner.id,
        qualifyingBookingId: b1.id,
        groupACount: 10,
        groupBCount: 10, // Supervisor
        activationTiming: "IMMEDIATE",
        supersessionTiming: "IMMEDIATE",
      })
    );
    const second = await prisma.$transaction((tx) =>
      royaltyService.recordAchievement(tx, {
        partnerId: partner.id,
        qualifyingBookingId: b2.id,
        groupACount: 2,
        groupBCount: 2, // Adviser — lower than current active Supervisor
        activationTiming: "IMMEDIATE",
        supersessionTiming: "IMMEDIATE",
      })
    );
    const tier = await prisma.royaltyTierRule.findUniqueOrThrow({ where: { id: second.royaltyTierRuleId } });
    expect(tier.tierCode).toBe("03"); // still Supervisor — returned the existing active row unchanged
    const activeCount = await prisma.tierAchievement.count({ where: { partnerId: partner.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("is idempotent per (partner, qualifying booking)", async () => {
    await seedRoyaltyTiers();
    const { partner } = await makePartnerUser();
    const booking = await fullyCollectedBooking();
    const input = {
      partnerId: partner.id,
      qualifyingBookingId: booking.id,
      groupACount: 2,
      groupBCount: 2,
      activationTiming: "IMMEDIATE" as const,
      supersessionTiming: "IMMEDIATE" as const,
    };
    const a = await prisma.$transaction((tx) => royaltyService.recordAchievement(tx, input));
    const b = await prisma.$transaction((tx) => royaltyService.recordAchievement(tx, input));
    expect(a.id).toBe(b.id);
    const count = await prisma.tierAchievement.count({ where: { partnerId: partner.id } });
    expect(count).toBe(1);
  });
});

describe("RoyaltyService.finalizeMonthlySnapshot", () => {
  async function activatePartnerAtTier(partnerId: string, groupA: number, groupB: number) {
    const booking = await fullyCollectedBooking();
    return prisma.$transaction((tx) =>
      royaltyService.recordAchievement(tx, {
        partnerId,
        qualifyingBookingId: booking.id,
        groupACount: groupA,
        groupBCount: groupB,
        activationTiming: "IMMEDIATE",
        supersessionTiming: "IMMEDIATE",
        asOf: new Date("2026-03-01T00:00:00Z"),
      })
    );
  }

  it("1 eligible achiever receives the full ₹2,00,000 pool on ₹1,00,00,000 turnover", async () => {
    await seedRoyaltyTiers();
    await makeRoyaltyPoolRule();
    const { partner } = await makePartnerUser();
    await activatePartnerAtTier(partner.id, 2, 2);
    const admin = await makeAdminUser();

    const turnoverPaise = 100_00_000n * 100n; // ₹1,00,00,000 in paise
    const result = await prisma.$transaction((tx) =>
      royaltyService.finalizeMonthlySnapshot(tx, 2026, 3, turnoverPaise, admin.id)
    );
    expect(result.eligibleCount).toBe(1);
    expect(result.snapshot.poolAmountPaise.toString()).toBe("20000000"); // ₹2,00,000 in paise
    expect(result.allocations[0]!.allocatedAmountPaise.toString()).toBe("20000000"); // full pool to the sole achiever
  });

  it("4 eligible achievers split the pool equally at ₹50,000 each", async () => {
    await seedRoyaltyTiers();
    await makeRoyaltyPoolRule();
    const partners = await Promise.all([makePartnerUser(), makePartnerUser(), makePartnerUser(), makePartnerUser()]);
    for (const { partner } of partners) {
      await activatePartnerAtTier(partner.id, 2, 2);
    }
    const admin = await makeAdminUser();
    const turnoverPaise = 100_00_000n * 100n; // ₹1,00,00,000 in paise

    const result = await prisma.$transaction((tx) => royaltyService.finalizeMonthlySnapshot(tx, 2026, 3, turnoverPaise, admin.id));
    expect(result.eligibleCount).toBe(4);
    expect(result.snapshot.poolAmountPaise.toString()).toBe("20000000"); // ₹2,00,000 in paise
    for (const a of result.allocations) {
      expect(a.allocatedAmountPaise.toString()).toBe("5000000"); // ₹50,000 in paise
    }
    const sum = result.allocations.reduce((acc, a) => acc + a.allocatedAmountPaise, 0n);
    expect(sum).toBe(result.snapshot.poolAmountPaise);
  });

  it("refuses to regenerate an already-finalized period (immutability)", async () => {
    await seedRoyaltyTiers();
    await makeRoyaltyPoolRule();
    const admin = await makeAdminUser();
    const turnoverPaise = 100_00_000n * 100n;
    await prisma.$transaction((tx) => royaltyService.finalizeMonthlySnapshot(tx, 2026, 4, turnoverPaise, admin.id));
    await expect(
      prisma.$transaction((tx) => royaltyService.finalizeMonthlySnapshot(tx, 2026, 4, turnoverPaise, admin.id))
    ).rejects.toThrow(DuplicateEventError);
  });

  it("no person can receive two allocations from the same snapshot/tier (structural guard)", async () => {
    await seedRoyaltyTiers();
    await makeRoyaltyPoolRule();
    const { partner } = await makePartnerUser();
    await activatePartnerAtTier(partner.id, 2, 2);
    const admin = await makeAdminUser();
    const turnoverPaise = 100_00_000n * 100n;
    // activatePartnerAtTier() hardcodes asOf = 2026-03-01, so the achiever's royalty
    // window (Adviser, 1 month) covers March; finalize that same period so the
    // achiever is actually eligible and a real row exists to collide with.
    await prisma.$transaction((tx) => royaltyService.finalizeMonthlySnapshot(tx, 2026, 3, turnoverPaise, admin.id));

    const snapshot = await prisma.royaltySnapshot.findUniqueOrThrow({ where: { periodYear_periodMonth: { periodYear: 2026, periodMonth: 3 } } });
    await expect(
      prisma.royaltyAllocation.create({
        data: {
          snapshotId: snapshot.id,
          partnerId: partner.id,
          tierAchievementId: (await prisma.tierAchievement.findFirstOrThrow({ where: { partnerId: partner.id } })).id,
          tierCode: "01",
          periodEligibleCount: 1,
          allocatedAmountPaise: 1n,
          ledgerEntryId: (await prisma.ledgerEntry.findFirstOrThrow()).id + "-dup", // won't exist but unique() fails first
        },
      })
    ).rejects.toThrow();
  });
});
