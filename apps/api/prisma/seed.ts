/**
 * Seeds the MERA MAKAN dev database with a realistic minimum data set:
 * business rules (some FINAL/CONFIGURED, some deliberately left
 * PENDING_CEO_APPROVAL — see docs/01-business-rules-matrix.md §8), the 8
 * Royalty tiers, the 8 Reward milestones, one project with Cash Plots, one
 * Super Admin, one demo customer and one demo partner with known OTP-login
 * phone numbers for manual testing.
 */
import { PrismaClient } from "@prisma/client";
import { passwordService } from "../src/auth/password.service.js";
import { rupeesToPaise } from "../src/domain/money.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding MERA MAKAN dev database…");

  const superAdmin = await prisma.user.upsert({
    where: { email: "ceo@meramakan.test" },
    update: {},
    create: {
      role: "SUPER_ADMIN",
      email: "ceo@meramakan.test",
      passwordHash: await passwordService.hash("ChangeMe123!"),
      status: "ACTIVE",
    },
  });

  const financeAdmin = await prisma.user.upsert({
    where: { email: "finance@meramakan.test" },
    update: {},
    create: {
      role: "FINANCE_ADMIN",
      email: "finance@meramakan.test",
      passwordHash: await passwordService.hash("ChangeMe123!"),
      status: "ACTIVE",
    },
  });

  // ---------- Business rules ----------
  await prisma.commissionRule.upsert({
    where: { id: "seed-commission-v1" },
    update: {},
    create: {
      id: "seed-commission-v1",
      version: 1,
      ratePercentBps: 1000,
      adminChargePercentBps: 500,
      tdsPercentBps: 200,
      status: "FINAL",
      effectiveFrom: new Date("2024-01-01"),
      createdByUserId: superAdmin.id,
      approvedByUserId: superAdmin.id,
    },
  });

  await prisma.rOIRule.upsert({
    where: { id: "seed-roi-v1" },
    update: {},
    create: {
      id: "seed-roi-v1",
      version: 1,
      projectId: null,
      ratePercentBps: 100,
      maxMonths: 12,
      calculationBase: "PLOT_AMOUNT",
      startTrigger: "FULL_COLLECTION_DATE",
      status: "PENDING_CEO_APPROVAL", // deliberately unresolved — see Business Rules Matrix §3
      effectiveFrom: new Date("2024-01-01"),
      createdByUserId: superAdmin.id,
    },
  });

  await prisma.balanceSheetRule.upsert({
    where: { id: "seed-bs-v1" },
    update: {},
    create: {
      id: "seed-bs-v1",
      version: 1,
      ratePercentBps: 800,
      payoutTimingConfigured: false, // Business Rule #1 — deliberately unresolved
      status: "CONFIGURED",
      effectiveFrom: new Date("2024-01-01"),
      createdByUserId: superAdmin.id,
    },
  });

  await prisma.royaltyPoolRule.upsert({
    where: { id: "seed-royalty-pool-v1" },
    update: {},
    create: {
      id: "seed-royalty-pool-v1",
      version: 1,
      poolPercentBps: 200,
      activationTiming: "NEXT_MONTHLY_PERIOD",
      supersessionTiming: "IMMEDIATE",
      status: "PENDING_CEO_APPROVAL",
      effectiveFrom: new Date("2024-01-01"),
      createdByUserId: superAdmin.id,
    },
  });

  await prisma.rewardPoolRule.upsert({
    where: { id: "seed-reward-pool-v1" },
    update: {},
    create: {
      id: "seed-reward-pool-v1",
      version: 1,
      poolPercentBps: 300,
      poolBase: "MONTHLY_TURNOVER",
      status: "PENDING_CEO_APPROVAL",
      effectiveFrom: new Date("2024-01-01"),
      createdByUserId: superAdmin.id,
    },
  });

  await prisma.closingCalendarRule.upsert({
    where: { id: "seed-calendar-v1" },
    update: {},
    create: {
      id: "seed-calendar-v1",
      version: 1,
      day31Policy: "UNSET", // deliberately unresolved — see Business Rules Matrix §2
      status: "PENDING_CEO_APPROVAL",
      effectiveFrom: new Date("2024-01-01"),
      createdByUserId: superAdmin.id,
    },
  });

  const ROYALTY_TIERS = [
    ["01", "Adviser", 2, 2, 1],
    ["02", "Senior Adviser", 5, 5, 2],
    ["03", "Supervisor", 10, 10, 3],
    ["04", "Senior Supervisor", 25, 25, 4],
    ["05", "Manager", 100, 100, 5],
    ["06", "Senior Manager", 250, 250, 6],
    ["07", "Gold", 500, 500, 7],
    ["08", "Diamond", 1000, 1000, 12],
  ] as const;
  for (const [tierCode, tierName, left, right, months] of ROYALTY_TIERS) {
    await prisma.royaltyTierRule.upsert({
      where: { id: `seed-tier-${tierCode}` },
      update: {},
      create: {
        id: `seed-tier-${tierCode}`,
        version: 1,
        tierCode,
        tierName,
        achievementLeft: left,
        achievementRight: right,
        royaltyDurationMonths: months,
        status: "FINAL",
        effectiveFrom: new Date("2024-01-01"),
        createdByUserId: superAdmin.id,
        approvedByUserId: superAdmin.id,
      },
    });
  }

  const REWARD_MILESTONES = [
    ["01", "Adviser", 2, 2, "Mobile", 20_000],
    ["02", "Senior Adviser", 5, 5, "Laptop", 50_000],
    ["03", "Supervisor", 10, 10, "Bike", 1_00_000],
    ["04", "Senior Supervisor", 25, 25, "Car Fund", 2_50_000],
    ["05", "Manager", 100, 100, "Car Fund", 10_00_000],
    ["06", "Senior Manager", 250, 250, "Plot", 25_00_000],
    ["07", "Gold", 500, 500, "Fully Furnished Farmhouse", 50_00_000],
    ["08", "Diamond", 1000, 1000, "Cash Reward", 1_00_00_000],
  ] as const;
  for (const [tierCode, tierName, left, right, rewardName, valueRupees] of REWARD_MILESTONES) {
    await prisma.rewardMilestoneRule.upsert({
      where: { id: `seed-reward-${tierCode}` },
      update: {},
      create: {
        id: `seed-reward-${tierCode}`,
        version: 1,
        tierCode,
        tierName,
        achievementLeft: left,
        achievementRight: right,
        rewardName,
        rewardValuePaise: rupeesToPaise(valueRupees),
        status: "FINAL",
        effectiveFrom: new Date("2024-01-01"),
        createdByUserId: superAdmin.id,
        approvedByUserId: superAdmin.id,
      },
    });
  }

  // ---------- Project & Plots ----------
  const project = await prisma.project.upsert({
    where: { slug: "shyam-vatika" },
    update: {},
    create: {
      name: "Shyam Vatika",
      slug: "shyam-vatika",
      location: "Khatu Shyam Ji, Sikar, Rajasthan",
      description: "Fully developed society near Khatu Shyam Dham — roads, electricity, water, park, market and guest house.",
      status: "ACTIVE",
    },
  });

  for (let i = 1; i <= 5; i++) {
    const plotNumber = `A-${i.toString().padStart(3, "0")}`;
    const plotAmountPaise = rupeesToPaise(350_000);
    const registrationAmountPaise = rupeesToPaise(1_000);
    await prisma.plot.upsert({
      where: { projectId_plotNumber: { projectId: project.id, plotNumber } },
      update: {},
      create: {
        projectId: project.id,
        plotNumber,
        sizeGaj: 50,
        ratePerGajPaise: rupeesToPaise(7_000),
        plotAmountPaise,
        registrationAmountPaise,
        totalCustomerAmountPaise: plotAmountPaise + registrationAmountPaise,
        isCashPlot: true,
        roiEligible: true,
        status: "AVAILABLE",
      },
    });
  }

  // ---------- Demo customer & partner ----------
  // No SMS gateway is configured for this deployment, so demo accounts use
  // the same admin-created email+password login as real accounts (see
  // POST /admin/customers, /admin/partners) rather than OTP.
  const demoPasswordHash = await passwordService.hash("ChangeMe123!");

  const customerUser = await prisma.user.upsert({
    where: { email: "ravi.demo@meramakan.test" },
    update: {},
    create: {
      role: "CUSTOMER",
      email: "ravi.demo@meramakan.test",
      phone: "+919990000001",
      passwordHash: demoPasswordHash,
      status: "ACTIVE",
    },
  });
  await prisma.customer.upsert({
    where: { userId: customerUser.id },
    update: {},
    create: { userId: customerUser.id, name: "Ravi Kumar" },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: "anita.demo@meramakan.test" },
    update: {},
    create: {
      role: "CHANNEL_PARTNER",
      email: "anita.demo@meramakan.test",
      phone: "+919990000002",
      passwordHash: demoPasswordHash,
      status: "ACTIVE",
    },
  });
  await prisma.channelPartner.upsert({
    where: { userId: partnerUser.id },
    update: {},
    create: { userId: partnerUser.id, partnerCode: "MM-P-0001", name: "Anita Sharma" },
  });

  console.log("Seed complete.");
  console.log("  Super Admin login:   ceo@meramakan.test / ChangeMe123!");
  console.log("  Finance Admin login: finance@meramakan.test / ChangeMe123!");
  console.log("  Demo customer login: ravi.demo@meramakan.test / ChangeMe123!");
  console.log("  Demo partner login:  anita.demo@meramakan.test / ChangeMe123!");
  void financeAdmin;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
