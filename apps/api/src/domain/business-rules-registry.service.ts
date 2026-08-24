import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface BusinessRuleRow {
  key: string;
  label: string;
  currentValue: Record<string, unknown>;
  status: string;
  effectiveFrom: Date;
  createdByUserId: string;
  approvedByUserId: string | null;
  previousVersionId: string | null;
  version: number;
}

/**
 * Powers Admin -> Settings -> Business Rules. Reads the latest version row
 * from every rule table (each independently versioned — see docs/03-erd.md)
 * and normalizes them into one list, rather than maintaining a second,
 * independent "status" store that could drift from the rule tables
 * themselves.
 */
export class BusinessRulesRegistryService {
  async listCurrent(tx: Tx): Promise<BusinessRuleRow[]> {
    const [commission, roi, balanceSheet, royaltyPool, rewardPool, closingCalendar] = await Promise.all([
      tx.commissionRule.findFirst({ orderBy: { effectiveFrom: "desc" } }),
      tx.rOIRule.findFirst({ where: { projectId: null }, orderBy: { effectiveFrom: "desc" } }),
      tx.balanceSheetRule.findFirst({ orderBy: { effectiveFrom: "desc" } }),
      tx.royaltyPoolRule.findFirst({ orderBy: { effectiveFrom: "desc" } }),
      tx.rewardPoolRule.findFirst({ orderBy: { effectiveFrom: "desc" } }),
      tx.closingCalendarRule.findFirst({ orderBy: { effectiveFrom: "desc" } }),
    ]);

    const rows: BusinessRuleRow[] = [];
    if (commission) {
      rows.push({
        key: "referral.commission",
        label: "Referral Bonus — rate / admin charge / TDS",
        currentValue: {
          ratePercent: commission.ratePercentBps / 100,
          adminChargePercent: commission.adminChargePercentBps / 100,
          tdsPercent: commission.tdsPercentBps / 100,
        },
        status: commission.status,
        effectiveFrom: commission.effectiveFrom,
        createdByUserId: commission.createdByUserId,
        approvedByUserId: commission.approvedByUserId,
        previousVersionId: commission.previousVersionId,
        version: commission.version,
      });
    }
    if (roi) {
      rows.push({
        key: "roi.rule",
        label: "Cash Plot ROI — rate / base / start trigger / max months",
        currentValue: {
          ratePercent: roi.ratePercentBps / 100,
          maxMonths: roi.maxMonths,
          calculationBase: roi.calculationBase,
          startTrigger: roi.startTrigger,
        },
        status: roi.status,
        effectiveFrom: roi.effectiveFrom,
        createdByUserId: roi.createdByUserId,
        approvedByUserId: roi.approvedByUserId,
        previousVersionId: roi.previousVersionId,
        version: roi.version,
      });
    }
    if (balanceSheet) {
      rows.push({
        key: "balance-sheet.rule",
        label: "Balance Sheet — rate / payout timing",
        currentValue: {
          ratePercent: balanceSheet.ratePercentBps / 100,
          payoutTimingConfigured: balanceSheet.payoutTimingConfigured,
        },
        status: balanceSheet.status,
        effectiveFrom: balanceSheet.effectiveFrom,
        createdByUserId: balanceSheet.createdByUserId,
        approvedByUserId: balanceSheet.approvedByUserId,
        previousVersionId: balanceSheet.previousVersionId,
        version: balanceSheet.version,
      });
    }
    if (royaltyPool) {
      rows.push({
        key: "royalty.pool",
        label: "Royalty Pool — percent / activation timing / supersession timing",
        currentValue: {
          poolPercent: royaltyPool.poolPercentBps / 100,
          activationTiming: royaltyPool.activationTiming,
          supersessionTiming: royaltyPool.supersessionTiming,
        },
        status: royaltyPool.status,
        effectiveFrom: royaltyPool.effectiveFrom,
        createdByUserId: royaltyPool.createdByUserId,
        approvedByUserId: royaltyPool.approvedByUserId,
        previousVersionId: royaltyPool.previousVersionId,
        version: royaltyPool.version,
      });
    }
    if (rewardPool) {
      rows.push({
        key: "reward.pool",
        label: "Reward Pool — percent / base",
        currentValue: { poolPercent: rewardPool.poolPercentBps / 100, poolBase: rewardPool.poolBase },
        status: rewardPool.status,
        effectiveFrom: rewardPool.effectiveFrom,
        createdByUserId: rewardPool.createdByUserId,
        approvedByUserId: rewardPool.approvedByUserId,
        previousVersionId: rewardPool.previousVersionId,
        version: rewardPool.version,
      });
    }
    if (closingCalendar) {
      rows.push({
        key: "closing-calendar.rule",
        label: "Closing Calendar — day 31 policy / short month policy",
        currentValue: { day31Policy: closingCalendar.day31Policy, shortMonthPolicy: closingCalendar.shortMonthPolicy },
        status: closingCalendar.status,
        effectiveFrom: closingCalendar.effectiveFrom,
        createdByUserId: closingCalendar.createdByUserId,
        approvedByUserId: closingCalendar.approvedByUserId,
        previousVersionId: closingCalendar.previousVersionId,
        version: closingCalendar.version,
      });
    }
    return rows;
  }
}

export const businessRulesRegistryService = new BusinessRulesRegistryService();
