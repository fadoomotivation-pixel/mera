import { beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";

const TABLES = [
  "TaxDeduction",
  "Payout",
  "PayoutBatch",
  "RewardAllocation",
  "RewardAchievement",
  "RewardMilestoneRule",
  "RewardPoolPeriod",
  "RewardPoolRule",
  "RoyaltyAllocation",
  "RoyaltySnapshot",
  "TierAchievement",
  "RoyaltyTierRule",
  "RoyaltyPoolRule",
  "BalanceSheetLedger",
  "BalanceSheetRule",
  "RoiScheduleEntry",
  "ROIRule",
  "CommissionRule",
  "Adjustment",
  "Refund",
  "LedgerEntry",
  "TransactionClosingCycle",
  "PendingCycleAssignment",
  "ClosingCycle",
  "ClosingCalendarRule",
  "Document",
  "Referral",
  "Registration",
  "Collection",
  "Payment",
  "PaymentSchedule",
  "Booking",
  "Plot",
  "Project",
  "Lead",
  "GenerationRelation",
  "ChannelPartner",
  "Customer",
  "Notification",
  "AuditLog",
  "OtpChallenge",
  "RefreshToken",
  "SystemSetting",
  "User",
];

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE;`
  );
});
