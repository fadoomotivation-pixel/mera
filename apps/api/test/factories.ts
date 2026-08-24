import { prisma } from "../src/lib/prisma.js";
import { rupeesToPaise } from "../src/domain/money.js";

let counter = 0;
function uniq(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

export async function makeCustomerUser() {
  const user = await prisma.user.create({
    data: { role: "CUSTOMER", phone: uniq("cust-phone"), status: "ACTIVE" },
  });
  const customer = await prisma.customer.create({
    data: { userId: user.id, name: "Test Customer " + uniq("name") },
  });
  return { user, customer };
}

export async function makePartnerUser() {
  const user = await prisma.user.create({
    data: { role: "CHANNEL_PARTNER", phone: uniq("partner-phone"), status: "ACTIVE" },
  });
  const partner = await prisma.channelPartner.create({
    data: { userId: user.id, partnerCode: uniq("PC"), name: "Test Partner " + uniq("name") },
  });
  return { user, partner };
}

export async function makeAdminUser(role: "SUPER_ADMIN" | "FINANCE_ADMIN" | "OPERATIONS_ADMIN" = "SUPER_ADMIN") {
  return prisma.user.create({
    data: { role, email: uniq("admin") + "@meramakan.test", passwordHash: "x", status: "ACTIVE" },
  });
}

export async function makeProjectAndPlot(overrides: { roiEligible?: boolean; isCashPlot?: boolean } = {}) {
  const project = await prisma.project.create({
    data: { name: "Test Project", slug: uniq("project"), location: "Test Location" },
  });
  const plot = await prisma.plot.create({
    data: {
      projectId: project.id,
      plotNumber: uniq("PLOT"),
      sizeGaj: 50,
      ratePerGajPaise: rupeesToPaise(7000),
      plotAmountPaise: rupeesToPaise(350_000),
      registrationAmountPaise: rupeesToPaise(1_000),
      totalCustomerAmountPaise: rupeesToPaise(351_000),
      isCashPlot: overrides.isCashPlot ?? true,
      roiEligible: overrides.roiEligible ?? true,
      status: "AVAILABLE",
    },
  });
  return { project, plot };
}

export async function makeCommissionRule(overrides: Partial<{ status: "FINAL" | "CONFIGURED" | "PENDING_CEO_APPROVAL" }> = {}) {
  const admin = await makeAdminUser();
  return prisma.commissionRule.create({
    data: {
      version: 1,
      ratePercentBps: 1000, // 10%
      adminChargePercentBps: 500, // 5%
      tdsPercentBps: 200, // 2%
      status: overrides.status ?? "FINAL",
      effectiveFrom: new Date("2020-01-01"),
      createdByUserId: admin.id,
    },
  });
}

export async function makeBalanceSheetRule(overrides: Partial<{ payoutTimingConfigured: boolean }> = {}) {
  const admin = await makeAdminUser();
  return prisma.balanceSheetRule.create({
    data: {
      version: 1,
      ratePercentBps: 800, // 8%
      payoutTimingConfigured: overrides.payoutTimingConfigured ?? false,
      status: "CONFIGURED",
      effectiveFrom: new Date("2020-01-01"),
      createdByUserId: admin.id,
    },
  });
}

const ROYALTY_TIERS = [
  { tierCode: "01", tierName: "Adviser", achievementLeft: 2, achievementRight: 2, royaltyDurationMonths: 1 },
  { tierCode: "02", tierName: "Senior Adviser", achievementLeft: 5, achievementRight: 5, royaltyDurationMonths: 2 },
  { tierCode: "03", tierName: "Supervisor", achievementLeft: 10, achievementRight: 10, royaltyDurationMonths: 3 },
  { tierCode: "04", tierName: "Senior Supervisor", achievementLeft: 25, achievementRight: 25, royaltyDurationMonths: 4 },
  { tierCode: "05", tierName: "Manager", achievementLeft: 100, achievementRight: 100, royaltyDurationMonths: 5 },
  { tierCode: "06", tierName: "Senior Manager", achievementLeft: 250, achievementRight: 250, royaltyDurationMonths: 6 },
  { tierCode: "07", tierName: "Gold", achievementLeft: 500, achievementRight: 500, royaltyDurationMonths: 7 },
  { tierCode: "08", tierName: "Diamond", achievementLeft: 1000, achievementRight: 1000, royaltyDurationMonths: 12 },
] as const;

export async function seedRoyaltyTiers() {
  const admin = await makeAdminUser();
  for (const t of ROYALTY_TIERS) {
    await prisma.royaltyTierRule.create({
      data: { version: 1, ...t, status: "FINAL", effectiveFrom: new Date("2020-01-01"), createdByUserId: admin.id },
    });
  }
}

export async function makeRoyaltyPoolRule(
  overrides: Partial<{ activationTiming: "IMMEDIATE" | "NEXT_MONTHLY_PERIOD"; supersessionTiming: "IMMEDIATE" | "FINISH_CURRENT_DURATION" }> = {}
) {
  const admin = await makeAdminUser();
  return prisma.royaltyPoolRule.create({
    data: {
      version: 1,
      poolPercentBps: 200, // 2%
      activationTiming: overrides.activationTiming ?? "IMMEDIATE",
      supersessionTiming: overrides.supersessionTiming ?? "IMMEDIATE",
      status: "PENDING_CEO_APPROVAL",
      effectiveFrom: new Date("2020-01-01"),
      createdByUserId: admin.id,
    },
  });
}

const REWARD_MILESTONES = [
  { tierCode: "01", tierName: "Adviser", achievementLeft: 2, achievementRight: 2, rewardName: "Mobile", rewardValueRupees: 20_000 },
  { tierCode: "02", tierName: "Senior Adviser", achievementLeft: 5, achievementRight: 5, rewardName: "Laptop", rewardValueRupees: 50_000 },
  { tierCode: "03", tierName: "Supervisor", achievementLeft: 10, achievementRight: 10, rewardName: "Bike", rewardValueRupees: 1_00_000 },
  { tierCode: "04", tierName: "Senior Supervisor", achievementLeft: 25, achievementRight: 25, rewardName: "Car Fund", rewardValueRupees: 2_50_000 },
  { tierCode: "05", tierName: "Manager", achievementLeft: 100, achievementRight: 100, rewardName: "Car Fund", rewardValueRupees: 10_00_000 },
  { tierCode: "06", tierName: "Senior Manager", achievementLeft: 250, achievementRight: 250, rewardName: "Plot", rewardValueRupees: 25_00_000 },
  { tierCode: "07", tierName: "Gold", achievementLeft: 500, achievementRight: 500, rewardName: "Fully Furnished Farmhouse", rewardValueRupees: 50_00_000 },
  { tierCode: "08", tierName: "Diamond", achievementLeft: 1000, achievementRight: 1000, rewardName: "Cash Reward", rewardValueRupees: 1_00_00_000 },
] as const;

export async function seedRewardMilestones() {
  const admin = await makeAdminUser();
  for (const m of REWARD_MILESTONES) {
    await prisma.rewardMilestoneRule.create({
      data: {
        version: 1,
        tierCode: m.tierCode,
        tierName: m.tierName,
        achievementLeft: m.achievementLeft,
        achievementRight: m.achievementRight,
        rewardName: m.rewardName,
        rewardValuePaise: rupeesToPaise(m.rewardValueRupees),
        status: "FINAL",
        effectiveFrom: new Date("2020-01-01"),
        createdByUserId: admin.id,
      },
    });
  }
}

export async function makeRewardPoolRule() {
  const admin = await makeAdminUser();
  return prisma.rewardPoolRule.create({
    data: {
      version: 1,
      poolPercentBps: 300, // 3%
      poolBase: "MONTHLY_TURNOVER",
      status: "PENDING_CEO_APPROVAL",
      effectiveFrom: new Date("2020-01-01"),
      createdByUserId: admin.id,
    },
  });
}

export async function makeRoiRule(
  overrides: Partial<{
    calculationBase: "PLOT_AMOUNT" | "COLLECTED_TO_DATE" | "CUSTOMER_TOTAL";
    startTrigger: "BOOKING_DATE" | "FULL_COLLECTION_DATE" | "REGISTRATION_DATE";
    maxMonths: number;
    projectId: string | null;
  }> = {}
) {
  const admin = await makeAdminUser();
  return prisma.rOIRule.create({
    data: {
      version: 1,
      projectId: overrides.projectId ?? null,
      ratePercentBps: 100, // 1%
      maxMonths: overrides.maxMonths ?? 12,
      calculationBase: overrides.calculationBase ?? "PLOT_AMOUNT",
      startTrigger: overrides.startTrigger ?? "FULL_COLLECTION_DATE",
      status: "PENDING_CEO_APPROVAL",
      effectiveFrom: new Date("2020-01-01"),
      createdByUserId: admin.id,
    },
  });
}
