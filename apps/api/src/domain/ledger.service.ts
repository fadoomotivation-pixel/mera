import type { Prisma, PrismaClient, LedgerEntryType } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export interface PostLedgerEntryInput {
  type: LedgerEntryType;
  entryDate?: Date;
  sourceType: string;
  sourceId: string;
  ruleVersionType?: string;
  ruleVersionId?: string;
  grossAmountPaise: bigint;
  deductionAmountPaise?: bigint;
  netAmountPaise: bigint;
  idempotencyKey: string;
  createdByUserId?: string;
}

/**
 * LedgerService is the ONLY place that inserts into LedgerEntry. Every stream
 * service (Referral, ROI, Balance Sheet, Royalty, Reward, Payout) calls
 * `post()` rather than touching `prisma.ledgerEntry` directly, so idempotency
 * and the "immutable once posted" invariant are enforced in exactly one spot
 * (backed further by the DB triggers in migration 20260824072400).
 */
export class LedgerService {
  /**
   * Idempotent insert: if a row with this idempotencyKey already exists,
   * returns it unchanged instead of creating a duplicate. Callers should
   * derive idempotencyKey deterministically from the business event
   * (e.g. `referral:${bookingId}`, `roi:${bookingId}:${monthNumber}`,
   * `royalty-allocation:${snapshotId}:${partnerId}:${tierCode}`) so that
   * retries, duplicate webhooks, and duplicate admin clicks all collapse
   * onto the same row.
   */
  async post(tx: Tx, input: PostLedgerEntryInput) {
    const existing = await tx.ledgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    return tx.ledgerEntry.create({
      data: {
        type: input.type,
        entryDate: input.entryDate ?? new Date(),
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        ruleVersionType: input.ruleVersionType,
        ruleVersionId: input.ruleVersionId,
        grossAmountPaise: input.grossAmountPaise,
        deductionAmountPaise: input.deductionAmountPaise ?? 0n,
        netAmountPaise: input.netAmountPaise,
        idempotencyKey: input.idempotencyKey,
        createdByUserId: input.createdByUserId,
      },
    });
  }

  /** Marks an entry VOID/REVERSED/ADJUSTED — the only mutation the DB permits. */
  async setStatus(
    tx: Tx,
    ledgerEntryId: string,
    status: "VOID" | "REVERSED" | "ADJUSTED"
  ) {
    return tx.ledgerEntry.update({
      where: { id: ledgerEntryId },
      data: { status },
    });
  }

  /** Reconciliation helper: sum of netAmountPaise for a type over a date range. */
  async sumNetByType(
    tx: Tx,
    type: LedgerEntryType,
    range?: { from?: Date; to?: Date }
  ): Promise<bigint> {
    const rows = await tx.ledgerEntry.findMany({
      where: {
        type,
        status: "POSTED",
        entryDate: range ? { gte: range.from, lte: range.to } : undefined,
      },
      select: { netAmountPaise: true },
    });
    return rows.reduce((acc, r) => acc + r.netAmountPaise, 0n);
  }
}

export const ledgerService = new LedgerService();
