import type { Prisma, PrismaClient, PayoutStatus, PayoutType } from "@prisma/client";
import { assertTransition } from "./state-machine.js";
import { RulePendingApprovalError, NotFoundDomainError, DomainError } from "./errors.js";

type Tx = Prisma.TransactionClient | PrismaClient;

const PAYOUT_TRANSITIONS: Record<PayoutStatus, readonly PayoutStatus[]> = {
  PENDING: ["ELIGIBLE", "CANCELLED"],
  ELIGIBLE: ["APPROVED", "HELD", "CANCELLED"],
  APPROVED: ["PROCESSING", "HELD", "REVERSED"],
  PROCESSING: ["PAID", "HELD", "REVERSED"],
  PAID: [], // terminal — only a new offsetting Payout/Adjustment can undo money paid
  HELD: ["ELIGIBLE", "REVERSED", "CANCELLED"],
  REVERSED: [],
  CANCELLED: [],
};

/**
 * Every rule table a payout type can depend on, keyed by the string stored
 * in Payout.ruleVersionType (mirrors LedgerEntry.ruleVersionType). Used to
 * gate ELIGIBLE -> APPROVED on the Business Rules Matrix §8 enforcement
 * note: a payout whose underlying rule is still PENDING_CEO_APPROVAL can be
 * created and sit at ELIGIBLE (so Finance can see the liability) but can
 * never be approved, processed, or paid until the CEO approves the rule.
 */
async function resolveRuleStatus(tx: Tx, ruleVersionType: string, ruleVersionId: string): Promise<string> {
  switch (ruleVersionType) {
    case "CommissionRule":
      return (await tx.commissionRule.findUniqueOrThrow({ where: { id: ruleVersionId } })).status;
    case "ROIRule":
      return (await tx.rOIRule.findUniqueOrThrow({ where: { id: ruleVersionId } })).status;
    case "BalanceSheetRule":
      return (await tx.balanceSheetRule.findUniqueOrThrow({ where: { id: ruleVersionId } })).status;
    case "RoyaltyPoolRule":
      return (await tx.royaltyPoolRule.findUniqueOrThrow({ where: { id: ruleVersionId } })).status;
    case "RoyaltyTierRule":
      return (await tx.royaltyTierRule.findUniqueOrThrow({ where: { id: ruleVersionId } })).status;
    case "RewardMilestoneRule":
      // Reward catalogue values are FINAL and are NOT gated by the (separate,
      // informational-only) RewardPoolRule — see docs/03-erd.md pool-vs-fixed addendum.
      return (await tx.rewardMilestoneRule.findUniqueOrThrow({ where: { id: ruleVersionId } })).status;
    default:
      throw new DomainError("UNKNOWN_RULE_TYPE", `Unrecognized ruleVersionType '${ruleVersionType}'`);
  }
}

export interface CreatePayoutInput {
  payoutType: PayoutType;
  beneficiaryPartnerId?: string;
  beneficiaryCustomerId?: string;
  sourceLedgerEntryId: string;
  ruleVersionType: string;
  ruleVersionId: string;
  grossAmountPaise: bigint;
  adminDeductionPaise?: bigint;
  tdsPaise?: bigint;
  netAmountPaise: bigint;
}

/**
 * The single centralized Payout Engine. Every payout of every type is
 * created and transitioned here — nothing writes to the Payout table
 * directly. Idempotency key = `payout:${payoutType}:${sourceLedgerEntryId}`,
 * so re-running "generate payout batch" or reprocessing an event never
 * creates a second payout for the same underlying ledger entry.
 */
export class PayoutService {
  async createOrGet(tx: Tx, input: CreatePayoutInput, batchId?: string) {
    if (!input.beneficiaryPartnerId && !input.beneficiaryCustomerId) {
      throw new DomainError("MISSING_BENEFICIARY", "A Payout must have exactly one beneficiary (partner or customer)");
    }
    if (input.beneficiaryPartnerId && input.beneficiaryCustomerId) {
      throw new DomainError("AMBIGUOUS_BENEFICIARY", "A Payout cannot have both a partner and a customer beneficiary");
    }

    const idempotencyKey = `payout:${input.payoutType}:${input.sourceLedgerEntryId}`;
    const existing = await tx.payout.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    return tx.payout.create({
      data: {
        payoutType: input.payoutType,
        beneficiaryPartnerId: input.beneficiaryPartnerId,
        beneficiaryCustomerId: input.beneficiaryCustomerId,
        sourceLedgerEntryId: input.sourceLedgerEntryId,
        ruleVersionType: input.ruleVersionType,
        ruleVersionId: input.ruleVersionId,
        grossAmountPaise: input.grossAmountPaise,
        adminDeductionPaise: input.adminDeductionPaise ?? 0n,
        tdsPaise: input.tdsPaise ?? 0n,
        netAmountPaise: input.netAmountPaise,
        status: "PENDING",
        idempotencyKey,
        batchId,
      },
    });
  }

  private async lockAndGet(tx: Tx, payoutId: string) {
    const rows = await tx.$queryRaw<{ id: string; status: PayoutStatus; ruleVersionType: string; ruleVersionId: string }[]>`
      SELECT id, status, "ruleVersionType", "ruleVersionId" FROM "Payout" WHERE id = ${payoutId} FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new NotFoundDomainError("Payout", payoutId);
    return row;
  }

  /** PENDING -> ELIGIBLE. Always allowed once a source ledger entry exists
   * (which it does, by construction, since createOrGet requires one) —
   * eligibility does NOT require the rule to be approved; only APPROVED+
   * does. This lets Finance see the full liability even for pending rules. */
  async markEligible(tx: Tx, payoutId: string) {
    const current = await this.lockAndGet(tx, payoutId);
    if (current.status === "ELIGIBLE") return tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "ELIGIBLE");
    return tx.payout.update({ where: { id: payoutId }, data: { status: "ELIGIBLE" } });
  }

  /** ELIGIBLE -> APPROVED. Hard-blocked (RulePendingApprovalError) if the
   * payout's underlying rule version is still PENDING_CEO_APPROVAL. IP and
   * device are captured server-side from the request context, never
   * client-supplied. */
  async approve(tx: Tx, payoutId: string, approvedByUserId: string, approverIp?: string, approverDevice?: string) {
    const current = await this.lockAndGet(tx, payoutId);
    if (current.status === "APPROVED") return tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "APPROVED");

    const ruleStatus = await resolveRuleStatus(tx, current.ruleVersionType, current.ruleVersionId);
    if (ruleStatus === "PENDING_CEO_APPROVAL") {
      throw new RulePendingApprovalError(`${current.ruleVersionType}:${current.ruleVersionId}`);
    }

    return tx.payout.update({
      where: { id: payoutId },
      data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId, approverIp, approverDevice },
    });
  }

  async markProcessing(tx: Tx, payoutId: string) {
    const current = await this.lockAndGet(tx, payoutId);
    if (current.status === "PROCESSING") return tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "PROCESSING");
    return tx.payout.update({ where: { id: payoutId }, data: { status: "PROCESSING" } });
  }

  async markPaid(tx: Tx, payoutId: string, paymentReference: string) {
    const current = await this.lockAndGet(tx, payoutId);
    if (current.status === "PAID") return tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "PAID");
    return tx.payout.update({ where: { id: payoutId }, data: { status: "PAID", paidAt: new Date(), paymentReference } });
  }

  async hold(tx: Tx, payoutId: string, holdReason: string) {
    const current = await this.lockAndGet(tx, payoutId);
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "HELD");
    return tx.payout.update({ where: { id: payoutId }, data: { status: "HELD", holdReason } });
  }

  async release(tx: Tx, payoutId: string) {
    const current = await this.lockAndGet(tx, payoutId);
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "ELIGIBLE");
    return tx.payout.update({ where: { id: payoutId }, data: { status: "ELIGIBLE", holdReason: null } });
  }

  async reverse(tx: Tx, payoutId: string, reversalLedgerEntryId: string) {
    const current = await this.lockAndGet(tx, payoutId);
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "REVERSED");
    return tx.payout.update({
      where: { id: payoutId },
      data: { status: "REVERSED", reversedAt: new Date(), reversalLedgerEntryId },
    });
  }

  async cancel(tx: Tx, payoutId: string) {
    const current = await this.lockAndGet(tx, payoutId);
    assertTransition("Payout", PAYOUT_TRANSITIONS, current.status, "CANCELLED");
    return tx.payout.update({ where: { id: payoutId }, data: { status: "CANCELLED" } });
  }
}

export const payoutService = new PayoutService();
