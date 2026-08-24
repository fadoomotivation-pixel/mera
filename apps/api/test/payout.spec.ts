import { describe, it, expect } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { payoutService } from "../src/domain/payout.service.js";
import { InvalidStateTransitionError, RulePendingApprovalError } from "../src/domain/errors.js";
import { ledgerService } from "../src/domain/ledger.service.js";
import { makePartnerUser, makeCommissionRule, makeRoiRule, makeCustomerUser } from "./factories.js";

async function makeReferralLedgerEntry(sourceId: string, ruleId: string) {
  return prisma.$transaction((tx) =>
    ledgerService.post(tx, {
      type: "REFERRAL_COMMISSION",
      sourceType: "BOOKING",
      sourceId,
      ruleVersionType: "CommissionRule",
      ruleVersionId: ruleId,
      grossAmountPaise: 3_500_000n,
      deductionAmountPaise: 245_000n,
      netAmountPaise: 3_255_000n,
      idempotencyKey: `referral:${sourceId}`,
    })
  );
}

describe("PayoutService", () => {
  it("runs the full happy-path state machine: PENDING -> ELIGIBLE -> APPROVED -> PROCESSING -> PAID", async () => {
    const rule = await makeCommissionRule({ status: "FINAL" });
    const { partner } = await makePartnerUser();
    const admin = await prisma.user.create({ data: { role: "FINANCE_ADMIN", email: "fa@test.com", status: "ACTIVE" } });
    const entry = await makeReferralLedgerEntry("booking-1", rule.id);

    const payout = await prisma.$transaction((tx) =>
      payoutService.createOrGet(tx, {
        payoutType: "REFERRAL",
        beneficiaryPartnerId: partner.id,
        sourceLedgerEntryId: entry.id,
        ruleVersionType: "CommissionRule",
        ruleVersionId: rule.id,
        grossAmountPaise: entry.grossAmountPaise,
        adminDeductionPaise: entry.deductionAmountPaise,
        netAmountPaise: entry.netAmountPaise,
      })
    );
    expect(payout.status).toBe("PENDING");

    await prisma.$transaction((tx) => payoutService.markEligible(tx, payout.id));
    await prisma.$transaction((tx) => payoutService.approve(tx, payout.id, admin.id, "127.0.0.1", "test-device"));
    await prisma.$transaction((tx) => payoutService.markProcessing(tx, payout.id));
    const paid = await prisma.$transaction((tx) => payoutService.markPaid(tx, payout.id, "UTR123456"));

    expect(paid.status).toBe("PAID");
    expect(paid.paymentReference).toBe("UTR123456");
  });

  it("rejects an illegal transition (PENDING -> PAID directly)", async () => {
    const rule = await makeCommissionRule();
    const { partner } = await makePartnerUser();
    const entry = await makeReferralLedgerEntry("booking-2", rule.id);
    const payout = await prisma.$transaction((tx) =>
      payoutService.createOrGet(tx, {
        payoutType: "REFERRAL",
        beneficiaryPartnerId: partner.id,
        sourceLedgerEntryId: entry.id,
        ruleVersionType: "CommissionRule",
        ruleVersionId: rule.id,
        grossAmountPaise: entry.grossAmountPaise,
        netAmountPaise: entry.netAmountPaise,
      })
    );
    await expect(prisma.$transaction((tx) => payoutService.markPaid(tx, payout.id, "UTR"))).rejects.toThrow(
      InvalidStateTransitionError
    );
  });

  it("blocks approval while the underlying rule is PENDING_CEO_APPROVAL (e.g. ROI)", async () => {
    const roiRule = await makeRoiRule(); // factory creates status PENDING_CEO_APPROVAL
    const { customer } = await makeCustomerUser();
    void customer;
    const entry = await prisma.$transaction((tx) =>
      ledgerService.post(tx, {
        type: "ROI",
        sourceType: "ROI_SCHEDULE_ENTRY",
        sourceId: "roi-entry-1",
        ruleVersionType: "ROIRule",
        ruleVersionId: roiRule.id,
        grossAmountPaise: 350_000n,
        netAmountPaise: 350_000n,
        idempotencyKey: "roi:booking-x:1",
      })
    );
    const { customer: beneficiary } = await makeCustomerUser();
    const payout = await prisma.$transaction((tx) =>
      payoutService.createOrGet(tx, {
        payoutType: "ROI",
        beneficiaryCustomerId: beneficiary.id,
        sourceLedgerEntryId: entry.id,
        ruleVersionType: "ROIRule",
        ruleVersionId: roiRule.id,
        grossAmountPaise: entry.grossAmountPaise,
        netAmountPaise: entry.netAmountPaise,
      })
    );
    await prisma.$transaction((tx) => payoutService.markEligible(tx, payout.id));

    const admin = await prisma.user.create({ data: { role: "FINANCE_ADMIN", email: "fa2@test.com", status: "ACTIVE" } });
    await expect(
      prisma.$transaction((tx) => payoutService.approve(tx, payout.id, admin.id))
    ).rejects.toThrow(RulePendingApprovalError);

    const stillEligible = await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } });
    expect(stillEligible.status).toBe("ELIGIBLE"); // never advanced past ELIGIBLE
  });

  it("duplicate payout request for the same source ledger entry resolves to one payout", async () => {
    const rule = await makeCommissionRule();
    const { partner } = await makePartnerUser();
    const entry = await makeReferralLedgerEntry("booking-3", rule.id);
    const input = {
      payoutType: "REFERRAL" as const,
      beneficiaryPartnerId: partner.id,
      sourceLedgerEntryId: entry.id,
      ruleVersionType: "CommissionRule",
      ruleVersionId: rule.id,
      grossAmountPaise: entry.grossAmountPaise,
      netAmountPaise: entry.netAmountPaise,
    };
    const p1 = await prisma.$transaction((tx) => payoutService.createOrGet(tx, input));
    const p2 = await prisma.$transaction((tx) => payoutService.createOrGet(tx, input));
    expect(p1.id).toBe(p2.id);
    const count = await prisma.payout.count({ where: { sourceLedgerEntryId: entry.id } });
    expect(count).toBe(1);
  });

  it("concurrent payout creation for the same ledger entry does not create two payouts", async () => {
    const rule = await makeCommissionRule();
    const { partner } = await makePartnerUser();
    const entry = await makeReferralLedgerEntry("booking-4", rule.id);
    const input = {
      payoutType: "REFERRAL" as const,
      beneficiaryPartnerId: partner.id,
      sourceLedgerEntryId: entry.id,
      ruleVersionType: "CommissionRule",
      ruleVersionId: rule.id,
      grossAmountPaise: entry.grossAmountPaise,
      netAmountPaise: entry.netAmountPaise,
    };
    const results = await Promise.allSettled([
      prisma.$transaction((tx) => payoutService.createOrGet(tx, input)),
      prisma.$transaction((tx) => payoutService.createOrGet(tx, input)),
    ]);
    const count = await prisma.payout.count({ where: { sourceLedgerEntryId: entry.id } });
    expect(count).toBe(1);
    // Both calls should resolve to a payout (one creates, one finds — or the
    // unique constraint rejects the loser, which is also an acceptable outcome
    // as long as exactly one row exists).
    const fulfilledIds = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof payoutService.createOrGet>>> => r.status === "fulfilled")
      .map((r) => r.value.id);
    if (fulfilledIds.length === 2) {
      expect(fulfilledIds[0]).toBe(fulfilledIds[1]);
    }
  });

  it("a PAID payout can never transition further (terminal state)", async () => {
    const rule = await makeCommissionRule();
    const { partner } = await makePartnerUser();
    const admin = await prisma.user.create({ data: { role: "FINANCE_ADMIN", email: "fa3@test.com", status: "ACTIVE" } });
    const entry = await makeReferralLedgerEntry("booking-5", rule.id);
    const payout = await prisma.$transaction((tx) =>
      payoutService.createOrGet(tx, {
        payoutType: "REFERRAL",
        beneficiaryPartnerId: partner.id,
        sourceLedgerEntryId: entry.id,
        ruleVersionType: "CommissionRule",
        ruleVersionId: rule.id,
        grossAmountPaise: entry.grossAmountPaise,
        netAmountPaise: entry.netAmountPaise,
      })
    );
    await prisma.$transaction((tx) => payoutService.markEligible(tx, payout.id));
    await prisma.$transaction((tx) => payoutService.approve(tx, payout.id, admin.id));
    await prisma.$transaction((tx) => payoutService.markProcessing(tx, payout.id));
    await prisma.$transaction((tx) => payoutService.markPaid(tx, payout.id, "UTR999"));

    await expect(prisma.$transaction((tx) => payoutService.hold(tx, payout.id, "dispute"))).rejects.toThrow(
      InvalidStateTransitionError
    );
  });
});
