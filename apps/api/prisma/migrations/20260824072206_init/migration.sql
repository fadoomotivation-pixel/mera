-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('FINAL', 'CONFIGURED', 'PENDING_CEO_APPROVAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'FINANCE_ADMIN', 'OPERATIONS_ADMIN', 'COMPLIANCE_AUDIT', 'SUPPORT', 'CHANNEL_PARTNER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'VERIFY_PHONE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('META_ADS', 'GOOGLE_ADS', 'WHATSAPP', 'DIRECT', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'SITE_VISIT_SCHEDULED', 'CONVERTED', 'DUPLICATE', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'SOLD_OUT', 'CLOSED');

-- CreateEnum
CREATE TYPE "PlotStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'BOOKED', 'SOLD', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('DRAFT', 'RESERVED', 'BOOKED', 'PAYMENT_IN_PROGRESS', 'FULLY_COLLECTED', 'REGISTERED', 'COMPLETED', 'CANCELLED', 'REFUND_INITIATED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'ONLINE_GATEWAY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'VERIFIED', 'COLLECTED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DocumentOwnerType" AS ENUM ('BOOKING', 'CUSTOMER', 'PARTNER', 'PROJECT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BOOKING_CONFIRMATION', 'AGREEMENT', 'RECEIPT', 'REGISTRATION_DOC', 'ROI_STATEMENT', 'ACCOUNT_STATEMENT', 'KYC', 'PROJECT_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "ClosingBusinessLine" AS ENUM ('REFERRAL', 'BALANCE_SHEET');

-- CreateEnum
CREATE TYPE "ClosingCycleLabel" AS ENUM ('A_1_10', 'B_11_20', 'C_21_END');

-- CreateEnum
CREATE TYPE "ClosingCycleStatus" AS ENUM ('OPEN', 'CLOSED', 'SNAPSHOT_GENERATED', 'PAYOUT_SCHEDULED', 'AWAITING_PAYOUT_CONFIG');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('SALE', 'PAYMENT', 'COLLECTION', 'REFERRAL_COMMISSION', 'BALANCE_SHEET', 'ROI', 'ROYALTY_POOL', 'ROYALTY_ALLOCATION', 'REWARD_POOL', 'REWARD_ALLOCATION', 'ADMIN_DEDUCTION', 'TDS', 'REFUND', 'CHARGEBACK', 'ADJUSTMENT', 'PAYOUT');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('POSTED', 'VOID', 'REVERSED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "RoiCalculationBase" AS ENUM ('PLOT_AMOUNT', 'COLLECTED_TO_DATE', 'CUSTOMER_TOTAL');

-- CreateEnum
CREATE TYPE "RoiStartTrigger" AS ENUM ('BOOKING_DATE', 'FULL_COLLECTION_DATE', 'REGISTRATION_DATE');

-- CreateEnum
CREATE TYPE "RoyaltyActivationTiming" AS ENUM ('IMMEDIATE', 'NEXT_MONTHLY_PERIOD');

-- CreateEnum
CREATE TYPE "RoyaltySupersessionTiming" AS ENUM ('IMMEDIATE', 'FINISH_CURRENT_DURATION');

-- CreateEnum
CREATE TYPE "TierAchievementStatus" AS ENUM ('ACHIEVED', 'ACTIVE', 'SUPERSEDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RewardPoolBase" AS ENUM ('MONTHLY_TURNOVER', 'GROSS_BOOKING_VALUE', 'COLLECTED_CASH');

-- CreateEnum
CREATE TYPE "RewardAchievementStatus" AS ENUM ('ELIGIBLE', 'ALLOCATED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('REFERRAL', 'BALANCE_SHEET', 'ROYALTY', 'REWARD', 'ROI');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'APPROVED', 'PROCESSING', 'PAID', 'HELD', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Day31Policy" AS ENUM ('UNSET', 'EXTEND_CYCLE_C', 'ROLLS_TO_NEXT_CYCLE');

-- CreateEnum
CREATE TYPE "AdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "altPhone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelPartner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "panNumber" TEXT,
    "bankAccountRef" TEXT,
    "referredByPartnerId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRelation" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "relatedPartnerId" TEXT NOT NULL,
    "generationLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "campaign" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "preferredProjectId" TEXT,
    "preferredPlotSize" TEXT,
    "preferredVisitDate" TIMESTAMP(3),
    "message" TEXT,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedPartnerId" TEXT,
    "convertedCustomerId" TEXT,
    "duplicateOfLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT,
    "hasRoads" BOOLEAN NOT NULL DEFAULT true,
    "hasElectricity" BOOLEAN NOT NULL DEFAULT true,
    "hasWater" BOOLEAN NOT NULL DEFAULT true,
    "hasPark" BOOLEAN NOT NULL DEFAULT true,
    "hasMarket" BOOLEAN NOT NULL DEFAULT true,
    "hasGuestHouse" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "plotNumber" TEXT NOT NULL,
    "sizeGaj" INTEGER NOT NULL,
    "ratePerGajPaise" BIGINT NOT NULL,
    "plotAmountPaise" BIGINT NOT NULL,
    "registrationAmountPaise" BIGINT NOT NULL DEFAULT 100000,
    "totalCustomerAmountPaise" BIGINT NOT NULL,
    "isCashPlot" BOOLEAN NOT NULL DEFAULT true,
    "roiEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partnerId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'DRAFT',
    "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plotAmountSnapshotPaise" BIGINT NOT NULL,
    "registrationAmountSnapshotPaise" BIGINT NOT NULL,
    "totalCustomerAmountSnapshotPaise" BIGINT NOT NULL,
    "roiEligible" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "fullyCollectedAt" TIMESTAMP(3),
    "registeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSchedule" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "amountDuePaise" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentScheduleId" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
    "idempotencyKey" TEXT NOT NULL,
    "gatewayReference" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "confirmedByUserId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCollectedSnapshotPaise" BIGINT NOT NULL,
    "note" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "registrationNumber" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredByUserId" TEXT NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "referredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "customerId" TEXT,
    "partnerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosingCycle" (
    "id" TEXT NOT NULL,
    "businessLine" "ClosingBusinessLine" NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "cycleMonth" INTEGER NOT NULL,
    "cycleLabel" "ClosingCycleLabel" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "payoutDueDate" TIMESTAMP(3),
    "status" "ClosingCycleStatus" NOT NULL DEFAULT 'OPEN',
    "closedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionClosingCycle" (
    "id" TEXT NOT NULL,
    "closingCycleId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionClosingCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingCycleAssignment" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "PendingCycleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "ruleVersionType" TEXT,
    "ruleVersionId" TEXT,
    "grossAmountPaise" BIGINT NOT NULL,
    "deductionAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "netAmountPaise" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'POSTED',
    "idempotencyKey" TEXT NOT NULL,
    "reversalOfEntryId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ratePercentBps" INTEGER NOT NULL,
    "adminChargePercentBps" INTEGER NOT NULL,
    "tdsPercentBps" INTEGER NOT NULL,
    "status" "RuleStatus" NOT NULL DEFAULT 'FINAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ROIRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "projectId" TEXT,
    "ratePercentBps" INTEGER NOT NULL,
    "maxMonths" INTEGER NOT NULL DEFAULT 12,
    "calculationBase" "RoiCalculationBase" NOT NULL DEFAULT 'PLOT_AMOUNT',
    "startTrigger" "RoiStartTrigger" NOT NULL DEFAULT 'FULL_COLLECTION_DATE',
    "status" "RuleStatus" NOT NULL DEFAULT 'PENDING_CEO_APPROVAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ROIRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoiScheduleEntry" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "monthNumber" INTEGER NOT NULL,
    "roiRuleId" TEXT NOT NULL,
    "baseAmountPaise" BIGINT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoiScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSheetRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "ratePercentBps" INTEGER NOT NULL,
    "payoutTimingConfigured" BOOLEAN NOT NULL DEFAULT false,
    "payoutTimingRuleJson" JSONB,
    "status" "RuleStatus" NOT NULL DEFAULT 'CONFIGURED',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSheetRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSheetLedger" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "closingCycleId" TEXT NOT NULL,
    "inputAmountPaise" BIGINT NOT NULL,
    "outputAmountPaise" BIGINT NOT NULL,
    "balanceAmountPaise" BIGINT NOT NULL,
    "carryForwardAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSheetLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyPoolRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "poolPercentBps" INTEGER NOT NULL,
    "activationTiming" "RoyaltyActivationTiming" NOT NULL DEFAULT 'NEXT_MONTHLY_PERIOD',
    "supersessionTiming" "RoyaltySupersessionTiming" NOT NULL DEFAULT 'IMMEDIATE',
    "status" "RuleStatus" NOT NULL DEFAULT 'PENDING_CEO_APPROVAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyPoolRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyTierRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tierCode" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "achievementLeft" INTEGER NOT NULL,
    "achievementRight" INTEGER NOT NULL,
    "royaltyDurationMonths" INTEGER NOT NULL,
    "status" "RuleStatus" NOT NULL DEFAULT 'FINAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyTierRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierAchievement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "royaltyTierRuleId" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifyingBookingId" TEXT NOT NULL,
    "fullCashConditionMet" BOOLEAN NOT NULL DEFAULT false,
    "royaltyStartDate" TIMESTAMP(3),
    "royaltyEndDate" TIMESTAMP(3),
    "status" "TierAchievementStatus" NOT NULL DEFAULT 'ACHIEVED',
    "supersededByAchievementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltySnapshot" (
    "id" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "monthlyTurnoverPaise" BIGINT NOT NULL,
    "poolPercentBps" INTEGER NOT NULL,
    "poolAmountPaise" BIGINT NOT NULL,
    "royaltyPoolRuleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoyaltyAllocation" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "tierAchievementId" TEXT NOT NULL,
    "tierCode" TEXT NOT NULL,
    "eligibleAtTierCount" INTEGER NOT NULL,
    "allocatedAmountPaise" BIGINT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoyaltyAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPoolRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "poolPercentBps" INTEGER NOT NULL,
    "poolBase" "RewardPoolBase" NOT NULL DEFAULT 'MONTHLY_TURNOVER',
    "status" "RuleStatus" NOT NULL DEFAULT 'PENDING_CEO_APPROVAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPoolRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPoolPeriod" (
    "id" TEXT NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "monthlyTurnoverPaise" BIGINT NOT NULL,
    "poolPercentBps" INTEGER NOT NULL,
    "poolAmountPaise" BIGINT NOT NULL,
    "allocatedAmountPaise" BIGINT NOT NULL DEFAULT 0,
    "rewardPoolRuleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPoolPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardMilestoneRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "tierCode" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "achievementLeft" INTEGER NOT NULL,
    "achievementRight" INTEGER NOT NULL,
    "rewardName" TEXT NOT NULL,
    "rewardValuePaise" BIGINT NOT NULL,
    "status" "RuleStatus" NOT NULL DEFAULT 'FINAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardMilestoneRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAchievement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "rewardMilestoneRuleId" TEXT NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifyingBookingId" TEXT NOT NULL,
    "status" "RewardAchievementStatus" NOT NULL DEFAULT 'ELIGIBLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardAllocation" (
    "id" TEXT NOT NULL,
    "rewardAchievementId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "payoutType" "PayoutType" NOT NULL,
    "closingCycleId" TEXT,
    "generatedByUserId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalGrossPaise" BIGINT NOT NULL,
    "totalNetPaise" BIGINT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "payoutType" "PayoutType" NOT NULL,
    "beneficiaryPartnerId" TEXT,
    "beneficiaryCustomerId" TEXT,
    "sourceLedgerEntryId" TEXT NOT NULL,
    "ruleVersionType" TEXT NOT NULL,
    "ruleVersionId" TEXT NOT NULL,
    "grossAmountPaise" BIGINT NOT NULL,
    "adminDeductionPaise" BIGINT NOT NULL DEFAULT 0,
    "tdsPaise" BIGINT NOT NULL DEFAULT 0,
    "netAmountPaise" BIGINT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approverIp" TEXT,
    "approverDevice" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "holdReason" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalLedgerEntryId" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxDeduction" (
    "id" TEXT NOT NULL,
    "payoutId" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "section" TEXT NOT NULL DEFAULT '194H',
    "amountPaise" BIGINT NOT NULL,
    "certificateDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosingCalendarRule" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "day31Policy" "Day31Policy" NOT NULL DEFAULT 'UNSET',
    "shortMonthPolicy" TEXT NOT NULL DEFAULT 'END_OF_MONTH',
    "status" "RuleStatus" NOT NULL DEFAULT 'PENDING_CEO_APPROVAL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "previousVersionId" TEXT,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosingCalendarRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adjustment" (
    "id" TEXT NOT NULL,
    "targetLedgerEntryId" TEXT,
    "targetPayoutId" TEXT,
    "reason" TEXT NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "status" "AdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "appliedLedgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amountPaise" BIGINT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "processedAt" TIMESTAMP(3),
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "OtpChallenge_phone_purpose_idx" ON "OtpChallenge"("phone", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelPartner_userId_key" ON "ChannelPartner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelPartner_partnerCode_key" ON "ChannelPartner"("partnerCode");

-- CreateIndex
CREATE INDEX "ChannelPartner_partnerCode_idx" ON "ChannelPartner"("partnerCode");

-- CreateIndex
CREATE INDEX "GenerationRelation_partnerId_generationLevel_idx" ON "GenerationRelation"("partnerId", "generationLevel");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRelation_partnerId_relatedPartnerId_key" ON "GenerationRelation"("partnerId", "relatedPartnerId");

-- CreateIndex
CREATE INDEX "Lead_dedupeKey_idx" ON "Lead"("dedupeKey");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Plot_status_idx" ON "Plot"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_projectId_plotNumber_key" ON "Plot"("projectId", "plotNumber");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_partnerId_idx" ON "Booking"("partnerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSchedule_bookingId_installmentNumber_key" ON "PaymentSchedule"("bookingId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_bookingId_key" ON "Collection"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_bookingId_key" ON "Registration"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_bookingId_key" ON "Referral"("bookingId");

-- CreateIndex
CREATE INDEX "Document_ownerType_ownerId_idx" ON "Document"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "ClosingCycle_status_idx" ON "ClosingCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClosingCycle_businessLine_cycleYear_cycleMonth_cycleLabel_key" ON "ClosingCycle"("businessLine", "cycleYear", "cycleMonth", "cycleLabel");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionClosingCycle_sourceType_sourceId_key" ON "TransactionClosingCycle"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "PendingCycleAssignment_sourceType_sourceId_key" ON "PendingCycleAssignment"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_type_entryDate_idx" ON "LedgerEntry"("type", "entryDate");

-- CreateIndex
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CommissionRule_effectiveFrom_idx" ON "CommissionRule"("effectiveFrom");

-- CreateIndex
CREATE INDEX "ROIRule_effectiveFrom_idx" ON "ROIRule"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RoiScheduleEntry_ledgerEntryId_key" ON "RoiScheduleEntry"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RoiScheduleEntry_bookingId_monthNumber_key" ON "RoiScheduleEntry"("bookingId", "monthNumber");

-- CreateIndex
CREATE INDEX "BalanceSheetRule_effectiveFrom_idx" ON "BalanceSheetRule"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "BalanceSheetLedger_ledgerEntryId_key" ON "BalanceSheetLedger"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "BalanceSheetLedger_partnerId_idx" ON "BalanceSheetLedger"("partnerId");

-- CreateIndex
CREATE INDEX "BalanceSheetLedger_closingCycleId_idx" ON "BalanceSheetLedger"("closingCycleId");

-- CreateIndex
CREATE INDEX "RoyaltyPoolRule_effectiveFrom_idx" ON "RoyaltyPoolRule"("effectiveFrom");

-- CreateIndex
CREATE INDEX "RoyaltyTierRule_tierCode_effectiveFrom_idx" ON "RoyaltyTierRule"("tierCode", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TierAchievement_partnerId_status_idx" ON "TierAchievement"("partnerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoyaltySnapshot_periodYear_periodMonth_key" ON "RoyaltySnapshot"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "RoyaltyAllocation_ledgerEntryId_key" ON "RoyaltyAllocation"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RoyaltyAllocation_snapshotId_partnerId_tierCode_key" ON "RoyaltyAllocation"("snapshotId", "partnerId", "tierCode");

-- CreateIndex
CREATE INDEX "RewardPoolRule_effectiveFrom_idx" ON "RewardPoolRule"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RewardPoolPeriod_periodYear_periodMonth_key" ON "RewardPoolPeriod"("periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "RewardMilestoneRule_tierCode_effectiveFrom_idx" ON "RewardMilestoneRule"("tierCode", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAchievement_partnerId_rewardMilestoneRuleId_key" ON "RewardAchievement"("partnerId", "rewardMilestoneRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAllocation_rewardAchievementId_key" ON "RewardAllocation"("rewardAchievementId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAllocation_ledgerEntryId_key" ON "RewardAllocation"("ledgerEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payout_payoutType_status_idx" ON "Payout"("payoutType", "status");

-- CreateIndex
CREATE INDEX "Payout_beneficiaryPartnerId_idx" ON "Payout"("beneficiaryPartnerId");

-- CreateIndex
CREATE INDEX "Payout_beneficiaryCustomerId_idx" ON "Payout"("beneficiaryCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxDeduction_payoutId_key" ON "TaxDeduction"("payoutId");

-- CreateIndex
CREATE INDEX "ClosingCalendarRule_effectiveFrom_idx" ON "ClosingCalendarRule"("effectiveFrom");

-- CreateIndex
CREATE INDEX "Notification_userId_status_idx" ON "Notification"("userId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelPartner" ADD CONSTRAINT "ChannelPartner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelPartner" ADD CONSTRAINT "ChannelPartner_referredByPartnerId_fkey" FOREIGN KEY ("referredByPartnerId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRelation" ADD CONSTRAINT "GenerationRelation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRelation" ADD CONSTRAINT "GenerationRelation_relatedPartnerId_fkey" FOREIGN KEY ("relatedPartnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_preferredProjectId_fkey" FOREIGN KEY ("preferredProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedPartnerId_fkey" FOREIGN KEY ("assignedPartnerId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSchedule" ADD CONSTRAINT "PaymentSchedule_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentScheduleId_fkey" FOREIGN KEY ("paymentScheduleId") REFERENCES "PaymentSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionClosingCycle" ADD CONSTRAINT "TransactionClosingCycle_closingCycleId_fkey" FOREIGN KEY ("closingCycleId") REFERENCES "ClosingCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoiScheduleEntry" ADD CONSTRAINT "RoiScheduleEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSheetLedger" ADD CONSTRAINT "BalanceSheetLedger_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSheetLedger" ADD CONSTRAINT "BalanceSheetLedger_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierAchievement" ADD CONSTRAINT "TierAchievement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierAchievement" ADD CONSTRAINT "TierAchievement_royaltyTierRuleId_fkey" FOREIGN KEY ("royaltyTierRuleId") REFERENCES "RoyaltyTierRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierAchievement" ADD CONSTRAINT "TierAchievement_qualifyingBookingId_fkey" FOREIGN KEY ("qualifyingBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyAllocation" ADD CONSTRAINT "RoyaltyAllocation_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RoyaltySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyAllocation" ADD CONSTRAINT "RoyaltyAllocation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoyaltyAllocation" ADD CONSTRAINT "RoyaltyAllocation_tierAchievementId_fkey" FOREIGN KEY ("tierAchievementId") REFERENCES "TierAchievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAchievement" ADD CONSTRAINT "RewardAchievement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAchievement" ADD CONSTRAINT "RewardAchievement_rewardMilestoneRuleId_fkey" FOREIGN KEY ("rewardMilestoneRuleId") REFERENCES "RewardMilestoneRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAchievement" ADD CONSTRAINT "RewardAchievement_qualifyingBookingId_fkey" FOREIGN KEY ("qualifyingBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_rewardAchievementId_fkey" FOREIGN KEY ("rewardAchievementId") REFERENCES "RewardAchievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardAllocation" ADD CONSTRAINT "RewardAllocation_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ChannelPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_beneficiaryPartnerId_fkey" FOREIGN KEY ("beneficiaryPartnerId") REFERENCES "ChannelPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_beneficiaryCustomerId_fkey" FOREIGN KEY ("beneficiaryCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxDeduction" ADD CONSTRAINT "TaxDeduction_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
