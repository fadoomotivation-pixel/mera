# MERA MAKAN — ERD / Database Schema Notes

Full source of truth: `apps/api/prisma/schema.prisma` (validated, migrated against local Postgres 16 — see `apps/api/prisma/migrations/`).

## Design decisions & consolidations

The business spec's "DATA MODEL" section lists some entities that would create duplicate, driftable totals if implemented as literally-separate tables. Rather than silently drop them, each consolidation is recorded here:

| Spec entity | Implementation decision | Why |
|---|---|---|
| `Sale` | Not a separate table. A "sale" is a `Booking` once it reaches `FULLY_COLLECTED`. | A parallel `Sale` row would duplicate `Booking`'s amount/status fields and could drift out of sync — exactly the anti-pattern the spec forbids ("do not duplicate totals that can become inconsistent"). |
| `CommissionLedger` | Not a separate table. Implemented as `LedgerEntry` rows with `type = REFERRAL_COMMISSION`. | Needed no extra structured columns beyond the generic ledger shape (gross/deduction/net/rule version/source). |
| `CommissionRule`, `ROIRule`, `BalanceSheetRule`, `RoyaltyPoolRule`, `RoyaltyTierRule`, `RewardPoolRule`, `RewardMilestoneRule`, `ClosingCalendarRule` | Each kept as its own table, all sharing a common versioning shape (`version`, `status`, `effectiveFrom`, `effectiveTo`, `createdByUserId`, `approvedByUserId`, `previousVersionId`, `changeNote`). | Prisma has no table inheritance; repeating the shape per table is standard practice and keeps each rule type's domain-specific fields strongly typed instead of a stringly-typed generic JSON blob for financial config. |
| "Business Rules Status" registry (FINAL/CONFIGURED/PENDING_CEO_APPROVAL) | Not a separate table. A `BusinessRulesRegistryService` in the API queries the latest version row from every `*Rule` table above and normalizes them into one unified list for the Admin Settings screen. | Avoids a second source of truth for status that could disagree with the rule tables themselves. |
| `GenerationRelation` | Kept as its own table (`partnerId`, `relatedPartnerId`, `generationLevel`). | Used exclusively by `BalanceSheetService` for input/output computation across generations. Never surfaced to any UI using forbidden terms (binary/leg/downline/upline/tree/pair). |

## Money & rate representation

- **Money**: `BigInt` paise everywhere (`grossAmountPaise`, `netAmountPaise`, ...). ₹1 Crore (Diamond cash reward) = 10,000,000,000 paise, which exceeds a 32-bit int — hence `BigInt`/Postgres `BIGINT`, not `Int`.
- **Rates**: `Int` basis points (1 bps = 0.01%). 10% referral = `1000`, 1% ROI = `100`, 8% Balance Sheet = `800`, 2% Royalty pool = `200`, 3% Reward pool = `300`, 5% admin charge = `500`, 2% TDS = `200`. Avoids floating-point drift in percentage math; all arithmetic is integer `(amount * bps) / 10000` with a single documented rounding point (`apps/api/src/domain/money.ts`).

## The ledger backbone

`LedgerEntry` is the single append-only table every dashboard, statement, and report ultimately reads from (directly or via a stream-specific extension table that FKs 1:1 to it — `BalanceSheetLedger`, `RoyaltyAllocation`, `RewardAllocation`). Two Postgres triggers (migration `20260824072400_ledger_immutability_guard`) enforce this at the database level, not just in application code:

1. `trg_ledger_entry_no_delete` — any `DELETE` raises an exception. Corrections use `Adjustment` rows and a `status` change to `VOID`/`REVERSED`/`ADJUSTED`.
2. `trg_ledger_entry_no_financial_mutation` — any `UPDATE` that touches the money fields, `type`, `sourceType/sourceId`, `ruleVersionId`, `idempotencyKey`, or `entryDate` raises an exception. Only `status` may change on an existing row.

This means even a bug in application code, a raw SQL script run by an engineer, or a future ORM migration cannot silently rewrite financial history — the database itself refuses.

## Structural (not just logical) anti-duplication guards

| Invariant | Guard |
|---|---|
| One active royalty tier per partner | Partial unique index `TierAchievement_partner_active_unique` on `(partnerId) WHERE status = 'ACTIVE'` (migration `20260824072300_partial_unique_active_tier`) |
| No duplicate royalty allocation for the same snapshot/tier/partner | `@@unique([snapshotId, partnerId, tierCode])` on `RoyaltyAllocation` |
| No duplicate reward for the same partner/milestone | `@@unique([partnerId, rewardMilestoneRuleId])` on `RewardAchievement` |
| No duplicate payout for the same event | `idempotencyKey` unique on `Payout`, `LedgerEntry`, `Payment` |
| One transaction, one closing cycle | `@@unique([sourceType, sourceId])` on `TransactionClosingCycle` |
| One payment schedule installment per booking slot | `@@unique([bookingId, installmentNumber])` on `PaymentSchedule` |
| One ROI month entry per booking | `@@unique([bookingId, monthNumber])` on `RoiScheduleEntry` |
| One closing cycle per business line/period/label | `@@unique([businessLine, cycleYear, cycleMonth, cycleLabel])` on `ClosingCycle` |
| One royalty snapshot per calendar period | `@@unique([periodYear, periodMonth])` on `RoyaltySnapshot` |

## Beneficiary modeling

`Payout.beneficiaryPartnerId` / `beneficiaryCustomerId` are both nullable; application logic enforces exactly one is set, chosen by `payoutType`:

- `ROI` → `beneficiaryCustomerId` (Cash Plot ROI benefits the customer who owns the plot, not the referring partner — the business spec places the ROI section inside the *Customer* Portal, not the Partner Portal).
- `REFERRAL`, `BALANCE_SHEET`, `ROYALTY`, `REWARD` → `beneficiaryPartnerId`.

## Logic conflict flagged during modeling: "3% Reward Pool" vs. fixed milestone values

The spec states Reward Pool = 3% of turnover, then gives **fixed** catalogue values per milestone (₹20,000 Mobile ... ₹1 Crore Diamond) with no pool-splitting example (unlike Royalty, which explicitly shows "4 eligible people → ₹50,000 each"). Treating both literally would double-govern the same money in two incompatible ways. Resolution (recorded as unresolved rule #5/#11, `PENDING_CEO_APPROVAL`):

- `RewardMilestoneRule.rewardValuePaise` is FINAL and fixed — every reward payout uses this catalogue value, never a pool split.
- `RewardPoolPeriod` (mirroring `RoyaltySnapshot`'s shape) tracks the monthly 3% figure as a **funding/liability reconciliation number** — "is the pool sufficient to cover this period's awarded milestones" — visible to Finance/CEO, but it never constrains or divides an individual reward's payable amount.

This interpretation is surfaced explicitly on the Business Rules screen so the CEO can override it if the intended mechanic was actually a pool-split.
