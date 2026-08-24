# MERA MAKAN — Business Rules Matrix

**Status legend used throughout this document and enforced in `SystemSetting` / `BusinessRule` records:**

| Status | Meaning |
|---|---|
| `FINAL` | Explicitly stated by the business, safe to use in production payouts. |
| `CONFIGURED` | An Admin has picked a value for an ambiguity the business never resolved. Usable in production only after `PENDING CEO APPROVAL` is cleared. |
| `PENDING_CEO_APPROVAL` | A configured value awaiting explicit CEO sign-off. **The payout engine refuses to create a `PAID` state for any rule in this status** (see `docs/06-reconciliation-proof.md` §3). |

Every row below is versioned (`BusinessRule` table: `key`, `value`, `effectiveFrom`, `effectiveTo`, `createdBy`, `approvedBy`, `status`, `previousVersionId`). A calculation always resolves the rule version whose `effectiveFrom <= transactionDate < effectiveTo (or now)`. Changing a rule **creates a new version row**; it never mutates history.

---

## 0. Source of Truth Declaration

- The **Ledger** (`LedgerEntry` table) is the single source of financial truth. No dashboard, report, or statement computes money independently — everything reads pre-computed, persisted ledger/payout rows.
- Every derived total (outstanding, paid, pool, liability) is either a **stored, recomputed-on-write column** or a **query over ledger rows** — never a client-side sum of UI-displayed line items.
- **Money type**: all amounts stored as integer paise (₹1 = 100 paise) to avoid floating point drift. Displayed in ₹ at the UI edge only.
- **Rounding rule**: all percentage calculations round to the nearest paisa using banker's-rounding-free `Math.round` on integer paise math (half-up), applied once at the final ledger-entry-creation step — never re-rounded downstream.

---

## 1. Property Pricing (FINAL)

| Field | Value | Notes |
|---|---|---|
| Plot dimensions | 15 × 30 = 50 Gaj | |
| Rate | ₹7,000 / Gaj | |
| Plot Amount (principal) | ₹3,50,000 | = 50 × 7,000. This is the **commission base** and **ROI base** unless ROI base rule says otherwise (§4). |
| Registration (one-time) | ₹1,000 | **Never** part of the ₹3,50,000 principal. |
| Customer Total Outlay | ₹3,51,000 | = Plot Amount + Registration. Documentation/agreement papers are paid by customer at first collection, tracked separately as a `Document`-linked fee, not blended into principal. |

**90-Day Payment Plan (FINAL)**

| Month | % | Amount |
|---|---|---|
| 1 | 30% | ₹1,05,000 |
| 2 | 30% | ₹1,05,000 |
| 3 | 40% | ₹1,40,000 |

`PaymentSchedule` rows are generated from this plan at `Booking` creation from a versioned `PaymentPlanRule`, so a future project with a different plan does not require code changes.

---

## 2. Stream 1 — Referral Bonus (FINAL rate, CONFIGURED deductions/cycle-edge)

| Field | Value | Status |
|---|---|---|
| Rate | 10% of Plot Amount (₹3,50,000 base → ₹35,000 gross) | FINAL |
| Commission base | Plot Amount only. Registration (₹1,000) excluded. | FINAL |
| Admin Charge | 5% of gross | FINAL (stated explicitly), versioned |
| TDS | 2% "as applicable" | FINAL rate, but **applicability condition** (always vs. threshold-based, e.g. §194 IT Act thresholds) is CONFIGURED — defaults to "always apply" until Finance/Compliance sets a threshold rule. |
| Net payable | Gross − Admin Charge − TDS | Derived, never stored redundantly outside the ledger. |
| Beneficiary | The eligible **direct** referrer per company rules (no multi-level referral chain — that is Balance Sheet's job, not Referral's). | FINAL |

**Example**: ₹3,50,000 × 10% = ₹35,000 gross → −₹1,750 (5%) admin → −₹700 (2%) TDS → **₹32,550 net**.

### Referral Closing Cycles (FINAL structure, PENDING_CEO_APPROVAL on day-31 & month-end edge)

| Cycle | Days | Closing duration | Payout date |
|---|---|---|---|
| A | 1–10 | 10 days | 15th of same month |
| B | 11–20 | 10 days | 25th of same month |
| C | 21–30 | 10 days | 5th of following month |

- Payout is always **5 days after cycle close** (close = last day of cycle window; payout = close + 5).
- **Day 31 (Jan, Mar, May, Jul, Aug, Oct, Dec)**: NOT DEFINED by the business. `ClosingCalendarRule.day31Policy` must be set by Super Admin to one of:
  - `EXTEND_CYCLE_C` — 31st is absorbed into Cycle C (21–end-of-month).
  - `ROLLS_TO_NEXT_CYCLE` — 31st belongs to the next month's Cycle A.
  - Until set: `day31Policy = UNSET` and the `ClosingCalendarService` **throws `UnresolvedCalendarRuleError`** for any transaction dated the 31st, rather than silently guessing. The transaction is held in a `PENDING_CYCLE_ASSIGNMENT` queue visible to Super Admin.
- **February (28/29) and 30-day months**: Cycle C is naturally shorter (21–28/29/30). This requires no special rule since Cycle C is defined as "21 to end of month" — confirmed CONFIGURED interpretation, not a business gap, because the source text only leaves the 31st ambiguous. Flagged as `CONFIGURED` (not `FINAL`) pending explicit CEO sign-off that "end of month" is the correct reading of "21–30" for short months.
- One sale/payment belongs to **exactly one** `ClosingCycle` row (unique constraint on `(businessLine, cycleYear, cycleMonth, cycleLabel)` + FK from the source transaction).
- All date math lives in **one** `ClosingCalendarService` (see `apps/api/src/domain/closing-calendar.service.ts`). No other module computes cycle boundaries.

---

## 3. Stream 2 — Cash Plot ROI (FINAL rate/cap, PENDING_CEO_APPROVAL base/triggers)

| Field | Value | Status |
|---|---|---|
| Rate | 1% per month | FINAL |
| Max duration | 12 months | FINAL — hard cap enforced in code, not just UI |
| Eligibility | Only bookings explicitly flagged `roiEligible = true` on the `Booking`/`ROIRule` | FINAL |
| Calculation base | UNRESOLVED. Candidates: (a) Plot Amount ₹3,50,000, (b) amount actually collected to date, (c) Customer Total ₹3,51,000. | `PENDING_CEO_APPROVAL` — defaults to **(a) Plot Amount**, the most conservative/explicit reading, but the system labels it "Awaiting CEO confirmation of ROI base" on every admin ROI screen until approved. |
| Start trigger | UNRESOLVED. Candidates: booking date, full-cash-collection date, registration date. | `PENDING_CEO_APPROVAL` — defaults to **full-cash-collection date**, since "Cash Plot" implies the cash benefit begins once cash is fully in. |
| Stop trigger | Cancellation/refund/chargeback → future ROI stops. Already-paid ROI is never deleted; a `REVERSAL` adjustment ledger entry is created only if the specific reversal policy says paid ROI must be clawed back (also unresolved — defaults to "no clawback of already-paid ROI, only future accrual stops"). | `PENDING_CEO_APPROVAL` |
| Month 13+ | Rejected outright by `ROICalculationService` — throws `MaxROIDurationExceededError`. | FINAL guard |

All ROI figures come from one `ROICalculationService`; the frontend never computes a monthly ROI amount — it only renders numbers returned by the API.

---

## 4. Stream 3 — Balance Sheet (FINAL rate/cycle structure, PENDING_CEO_APPROVAL payout date)

| Field | Value | Status |
|---|---|---|
| Rate | 8% | FINAL |
| Terminology | "Balance Sheet", "Generation to Generation", `INPUT → OUTPUT → BALANCE → CARRY FORWARD`. Forbidden words (`binary`, `leg`, `downline`, `upline`, `generation tree`, `pair(s)`) are enforced via a lint check (`scripts/check-forbidden-terms.ts`) run in CI over all UI copy and API response labels. | FINAL |
| Closing cycle | Same 1–10 / 11–20 / 21–30 structure as Referral, via the same `ClosingCalendarService` (shared cycle boundaries, independent ledger). | FINAL structure |
| Payout date | **Not defined anywhere in the business conversation.** | `PENDING_CEO_APPROVAL` — no default is invented. Until Super Admin sets `balanceSheetPayoutRule`, every closed Balance Sheet cycle shows status **"Awaiting payout schedule configuration"** and cannot progress past `ELIGIBLE` in the payout state machine. |
| Carry-forward | Unused/ineligible Balance Sheet balance carries forward to next cycle per `BalanceSheetLedger.carryForward` — mechanics of *what* carries forward (excess input vs. shortfall) is CONFIGURED to "excess eligible amount not yet paid out carries forward, capped at nothing" pending CEO confirmation of any cap. | `PENDING_CEO_APPROVAL` |

Balance Sheet is structurally isolated: its own ledger type (`BALANCE_SHEET`), its own rule table (`BalanceSheetRule`), never shares a row with Royalty or Reward ledgers.

---

## 5. Stream 4 — Royalty (FINAL tiers/pool math, PENDING_CEO_APPROVAL activation timing & supersession mechanics)

**Pool**: 2% of monthly turnover, computed **once** per month into an immutable `RoyaltySnapshot`. Corrections after finalization use `Adjustment` rows, never an edit to the snapshot.

**8 Tiers** (`RoyaltyRule` seed data):

| # | Tier | Achievement | Royalty Duration |
|---|---|---|---|
| 01 | Adviser | 2 + 2 | 1 month |
| 02 | Senior Adviser | 5 + 5 | 2 months |
| 03 | Supervisor | 10 + 10 | 3 months |
| 04 | Senior Supervisor | 25 + 25 | 4 months |
| 05 | Manager | 100 + 100 | 5 months |
| 06 | Senior Manager | 250 + 250 | 6 months |
| 07 | Gold | 500 + 500 | 7 months |
| 08 | Diamond | 1,000 + 1,000 | 1 year |

Displayed always as `ACHIEVEMENT → ROYALTY DURATION`, never a running month counter.

| Field | Rule | Status |
|---|---|---|
| Supersession | A higher achieved tier **replaces**, never stacks with, the active lower tier. `TierAchievement.supersededTier` records what it replaced. | FINAL (explicitly stated as the "final company rule") |
| Full-cash condition | Royalty allocation requires the qualifying event's underlying property transaction to be fully collected (`Booking.status = FULLY_COLLECTED`). No allocation from an incomplete transaction. | FINAL |
| Activation timing | UNRESOLVED — does royalty start immediately on full collection, or from the next completed monthly royalty period? | `PENDING_CEO_APPROVAL` — defaults to **next full monthly royalty period after the qualifying event**, to keep `RoyaltySnapshot` boundaries clean (avoids partial-month pool math), but flagged for CEO override to "immediate, pro-rated" if desired. |
| Supersession timing | UNRESOLVED — does a higher tier achieved mid-duration immediately cut over, or only after the lower tier's duration finishes? | `PENDING_CEO_APPROVAL` — defaults to **immediate cutover** (matches "do not stack" instruction most literally), CEO can override to "finish current duration first." |
| Equal split | Multiple eligible achievers at the **same tier** in the same month split that month's pool equally. | FINAL |
| Duplicate allocation guard | One person cannot receive two allocations from the same `RoyaltySnapshot` for the same tier/cycle — enforced by a DB unique constraint `(snapshotId, partnerId, tierId)` on `RoyaltyAllocation`, not just application logic. | FINAL (structural guard) |
| "2 + 2" achievement counting source | UNRESOLVED — the business gives the *thresholds* (2+2, 5+5, ...) but never states what the two counted groups actually are (two sides of the generation network? two different sale categories? a time-boxed count?) or who/what computes them. `RoyaltyService.recordAchievement()` takes the two group counts as an explicit input parameter rather than computing them internally, so the counting logic is pluggable once the CEO defines it — the service does not guess. | `PENDING_CEO_APPROVAL` |

**Logic conflict flagged during modeling — pool split scope**: the worked example ("1 eligible person → ₹2,00,000 · 4 eligible people → ₹50,000 each") splits the *whole* pool with no mention of tier, while §5's "CRITICAL ROYALTY LOGIC" scopes the equal split to "eligible achievers **at the same tier**." Read together with only one flat pool and eight tiers of differing seniority, a literal per-tier sub-pool would require a tier-weighting rule the business never gave, and a naive per-tier full-pool split would let the same ₹2,00,000 be paid out multiple times in one month (once per tier that has any achiever) — silently multiplying company liability. Resolution (`PENDING_CEO_APPROVAL`, defaults applied): the monthly pool is split **once, equally, company-wide** across every partner with an `ACTIVE` tier that period (one partner = one ACTIVE tier at a time, per the no-stacking rule, so no one is counted twice); "at the same tier" is read as guidance not to double-count a partner across a superseded and a newly-active tier within the same period, not as a per-tier sub-pool. `RoyaltyAllocation.tierCode` is still recorded per allocation for reporting/traceability even though it does not change the share size.

---

## 6. Stream 5 — Rewards (FINAL catalogue/condition, PENDING_CEO_APPROVAL pool base)

**Reward Pool = 3%.** UNRESOLVED: 3% of *what* — monthly turnover (mirroring Royalty's base), gross booking value, or collected cash? `PENDING_CEO_APPROVAL` — defaults to **monthly turnover** (same base as Royalty, for consistency) but explicitly flagged since the business text never states it.

**Milestone catalogue** (`RewardRule` seed data — never write "pair(s)"):

| Tier | Achievement | Reward | Value |
|---|---|---|---|
| Adviser | 2 + 2 | Mobile | ₹20,000 |
| Senior Adviser | 5 + 5 | Laptop | ₹50,000 |
| Supervisor | 10 + 10 | Bike | ₹1,00,000 |
| Senior Supervisor | 25 + 25 | Car Fund | ₹2,50,000 |
| Manager | 100 + 100 | Car Fund | ₹10,00,000 |
| Senior Manager | 250 + 250 | Plot | ₹25,00,000 |
| Gold | 500 + 500 | Fully Furnished Farmhouse | ₹50,00,000 |
| Diamond | 1,000 + 1,000 | Cash Reward | ₹1,00,00,000 |

| Field | Rule | Status |
|---|---|---|
| Condition | Full cash collection **first**, then milestone eligibility check. Both required. | FINAL |
| Once-only | One award per achievement per partner unless an approved `Adjustment`/reversal exists. | FINAL |
| Concurrency | Enforced via DB unique constraint `(partnerId, rewardRuleId)` on `RewardAchievement` **plus** a Postgres advisory lock keyed on `(partnerId, rewardRuleId)` around the eligibility-check-then-create transaction, so two concurrent webhook deliveries cannot race past the uniqueness check before either commits. | FINAL (structural guard) |
| Separation from Royalty | Same qualifying event may trigger both, but `RewardAllocation` and `RoyaltyAllocation` are different tables with different FKs to different rule/snapshot tables. No shared row, no shared ledger type. | FINAL |

---

## 7. Cross-Stream Isolation Rules (FINAL)

1. Referral, ROI, Balance Sheet, Royalty, Rewards each have: their own `*Rule` table, their own ledger `type` enum value, their own eligibility function, their own payout `type`.
2. The UI **never** sums two stream percentages into one headline number. Enforced by the forbidden-terms/forbidden-pattern lint (also checks for patterns like `\d+%\s*\+\s*\d+%`).
3. A single qualifying event (e.g., a booking reaching `FULLY_COLLECTED`) may fan out to multiple streams (Referral commission + Royalty eligibility check + Reward eligibility check), but each stream's service is invoked independently and writes to its own ledger/allocation table under its own idempotency key. There is no shared mutable "total income" row.

---

## 8. Unresolved Business Rules Register (must not be silently guessed)

This is the authoritative list surfaced verbatim on **Admin → Settings → Business Rules** with live status badges. Implemented as seed rows in `BusinessRule` with `status = PENDING_CEO_APPROVAL` and a `defaultRationale` field explaining the conservative default chosen (where a default was safe to apply) or `NONE` (where no default is applied and the feature blocks, e.g. day-31 assignment and Balance Sheet payout date).

| # | Rule | Default applied? | Blocks production payout until approved? |
|---|---|---|---|
| 1 | Balance Sheet payout date | No default | Yes — payout stuck at ELIGIBLE |
| 2 | Day 31 handling | No default | Yes — transaction stuck at PENDING_CYCLE_ASSIGNMENT |
| 3 | Feb 28/29 & short-month closing | Configured default (end-of-month) | Yes (flagged, not blocking calculation, blocks payout) |
| 4 | ROI calculation base | Defaulted to Plot Amount | Yes — payout stuck at ELIGIBLE |
| 5 | Reward Pool 3% base | Defaulted to monthly turnover | Yes — payout stuck at ELIGIBLE |
| 6 | Royalty activation timing | Defaulted to next monthly period | Yes |
| 7 | Cancellation/refund effect on paid commission/royalty/ROI/reward | No default (reversal always requires explicit Admin `Adjustment` action) | Yes — reversal requires manual Finance approval regardless |
| 8 | Tier supersession timing (immediate vs. finish current) | Defaulted to immediate | Yes |
| 9 | Royalty start: immediate vs. next completed month | Same as #6 | Yes |
| 10 | Payment gateway / bank payout integration | No default — `PayoutService` marks payouts `APPROVED` and stops; actual bank transfer is a manual, audited step (`PaymentReference` field filled by Finance) until an integration is selected | N/A (manual step is itself the safe default) |

**Enforcement**: `PayoutService.approve()` checks every rule the payout type depends on; if any required rule is `PENDING_CEO_APPROVAL`, the payout is created but capped at status `ELIGIBLE` and cannot be moved to `APPROVED`/`PROCESSING`/`PAID`. This is a hard server-side gate, not a UI warning.
