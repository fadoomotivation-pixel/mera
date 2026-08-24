# MERA MAKAN — State Machines

Every state machine below is enforced in exactly one place: a `*.transitions.ts` guard used by the corresponding domain service. No route handler, UI component, or webhook consumer sets a status field directly — all mutations go through `assertTransition(current, next, machine)` which throws `InvalidStateTransitionError` on an illegal edge. This is what "no invalid state transitions" means structurally, not just as a code review guideline.

---

## 1. Booking State Machine

```
DRAFT ──────────────▶ RESERVED ──────────────▶ BOOKED
                                                   │
                                                   ▼
                                     PAYMENT_IN_PROGRESS
                                                   │
                                    (all schedule rows COLLECTED)
                                                   ▼
                                          FULLY_COLLECTED
                                                   │
                                       (registration recorded)
                                                   ▼
                                            REGISTERED
                                                   │
                                                   ▼
                                            COMPLETED

Any of BOOKED / PAYMENT_IN_PROGRESS / FULLY_COLLECTED / REGISTERED
                                                   │
                                       ┌───────────┴───────────┐
                                       ▼                       ▼
                                  CANCELLED              REFUND_INITIATED ──▶ REFUNDED
```

**Allowed edges:**

| From | To | Guard |
|---|---|---|
| DRAFT | RESERVED | Plot has no other active reservation (row lock on `Plot`) |
| RESERVED | BOOKED | Booking amount recorded, customer confirmed |
| RESERVED | CANCELLED | Reservation timeout or customer withdrawal — releases plot |
| BOOKED | PAYMENT_IN_PROGRESS | First `PaymentSchedule` payment `COLLECTED` |
| PAYMENT_IN_PROGRESS | FULLY_COLLECTED | All `PaymentSchedule` rows `COLLECTED` |
| FULLY_COLLECTED | REGISTERED | Admin marks registration complete + document uploaded |
| REGISTERED | COMPLETED | Terminal, admin-confirmed close-out |
| {BOOKED, PAYMENT_IN_PROGRESS, FULLY_COLLECTED, REGISTERED} | CANCELLED | Explicit admin cancellation action, reason required |
| {BOOKED, PAYMENT_IN_PROGRESS, FULLY_COLLECTED, REGISTERED} | REFUND_INITIATED | Explicit admin refund action |
| REFUND_INITIATED | REFUNDED | Refund payment processed and recorded |

**No edge exists** back from CANCELLED/REFUNDED into any active state — a cancelled booking is never silently reactivated; a new `Booking` row is created if the customer re-books the same or another plot.

**Downstream effects (all via explicit service calls, never implicit):**
- `→ FULLY_COLLECTED`: triggers `ReferralCommissionService.evaluate()`, `RoyaltyService.checkQualifyingEvent()`, `RewardService.checkEligibility()`, `ROICalculationService.maybeStart()` — each independently, each idempotent per booking.
- `→ CANCELLED` / `→ REFUNDED`: triggers `ReversalCoordinator.reverseBooking(bookingId)` which, per Business Rule #7 (unresolved, see §8 of the Business Rules Matrix), creates a Finance-review task rather than auto-reversing paid amounts; it *does* immediately stop future ROI accrual (FINAL rule) and freezes any `PENDING`/`ELIGIBLE` (not yet `PAID`) payouts tied to this booking into `HELD`.

---

## 2. Payment State Machine

```
INITIATED ──▶ PENDING ──▶ VERIFIED ──▶ COLLECTED
     │            │
     ▼            ▼
  FAILED       FAILED
                                COLLECTED ──▶ REFUNDED
```

| From | To | Guard |
|---|---|---|
| INITIATED | PENDING | Payment gateway/manual entry accepted the attempt |
| PENDING | VERIFIED | Admin/Finance verifies (bank statement match, receipt upload, or gateway webhook signature valid) |
| PENDING | FAILED | Gateway declined / manual entry marked failed |
| INITIATED | FAILED | Gateway rejected before pending |
| VERIFIED | COLLECTED | Funds confirmed settled (this is the event that updates `PaymentSchedule` and can flip `Booking` toward `FULLY_COLLECTED`) |
| COLLECTED | REFUNDED | Explicit refund action, creates `REFUND` ledger entry, never deletes the original `COLLECTED` entry |

**Idempotency**: every inbound payment webhook carries (or is assigned) an `idempotencyKey`. `PaymentService.recordWebhook()` upserts on that key inside a DB transaction with `SELECT ... FOR UPDATE` on the target `Payment` row; a duplicate delivery is a no-op that returns the existing result rather than re-transitioning state.

---

## 3. Payout State Machine

```
PENDING ──▶ ELIGIBLE ──▶ APPROVED ──▶ PROCESSING ──▶ PAID

Any of PENDING / ELIGIBLE / APPROVED / PROCESSING
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
      HELD      REVERSED    CANCELLED

HELD ──▶ ELIGIBLE   (release hold, re-enters normal flow)
```

| From | To | Guard |
|---|---|---|
| PENDING | ELIGIBLE | Source ledger entry exists AND all `BusinessRule`s the payout type depends on are not `PENDING_CEO_APPROVAL` (see Business Rules Matrix §8 enforcement note) |
| ELIGIBLE | APPROVED | Finance Admin (or Super Admin) explicit approval action, IP/device logged |
| APPROVED | PROCESSING | Payout batch dispatched (manual bank step or future gateway integration) |
| PROCESSING | PAID | Payment reference confirmed, terminal |
| {PENDING, ELIGIBLE, APPROVED, PROCESSING} | HELD | Admin hold action (e.g., booking under dispute) |
| HELD | ELIGIBLE | Admin release action |
| {PENDING, ELIGIBLE, APPROVED, PROCESSING, HELD} | REVERSED | Admin reversal — creates offsetting `ADJUSTMENT` ledger entry, original row stays for audit |
| {PENDING, ELIGIBLE} | CANCELLED | Admin cancels before approval (e.g., duplicate detected) |

**No edge** allows PAID → anything. A paid payout can only be offset by a **new** `ADJUSTMENT`/`REFUND` ledger entry and, if truly necessary, a brand-new reversing `Payout` row of the same type — the original `PAID` row is immutable.

**Idempotency key** on `Payout`: `(payoutType, sourceTransactionId, ruleVersionId)` unique constraint. `PayoutService.create()` always does find-or-create inside a transaction with row locking on the source ledger entry, so a duplicate event (retry, duplicate webhook, duplicate admin click) resolves to the same `Payout` row.

---

## 4. Royalty Tier / Achievement State

```
tier achieved (qualifying event + FULLY_COLLECTED)
        │
        ▼
  TierAchievement created (status: ACHIEVED)
        │
        ▼
  royalty period computed (start/end per activation-timing rule)
        │
        ├── higher tier achieved before end ──▶ current TierAchievement.status = SUPERSEDED
        │                                        new TierAchievement.status = ACTIVE
        │
        └── duration elapses naturally ──▶ TierAchievement.status = EXPIRED
```

Exactly one `TierAchievement` per partner may be `ACTIVE` at a time (DB partial unique index `WHERE status = 'ACTIVE'`). Supersession is a single transaction: expire-or-supersede the old row, insert the new row, both writes committed together or not at all.

---

## 5. Reward Achievement State

```
milestone thresholds met + FULLY_COLLECTED
        │
        ▼
  RewardAchievement created (status: ELIGIBLE)   ── unique(partnerId, rewardRuleId)
        │
        ▼
  RewardAllocation created (status: PENDING)  ──▶ feeds Payout state machine (type=REWARD)
```

A `RewardAchievement` is never re-created for the same `(partnerId, rewardRuleId)` pair; the unique constraint plus advisory lock (Business Rules Matrix §6) makes a second concurrent attempt a no-op that returns the existing row.

---

## 6. Referral / Balance Sheet Closing Cycle State

```
OPEN (transactions accruing) ──▶ CLOSED (cycle end date reached, ClosingCalendarService seals it)
                                       │
                                       ▼
                              SNAPSHOT_GENERATED (CommissionLedger / BalanceSheetLedger rows finalized)
                                       │
                                       ▼
                              PAYOUT_SCHEDULED  (Referral: has a date. Balance Sheet: PENDING_CEO_APPROVAL, see §4 of Business Rules Matrix)
```

A cycle transitions `OPEN → CLOSED` only via the admin "Run Closing Cycle" action (or a scheduled job once enabled), never automatically mid-day, so Finance always controls exactly when a cycle seals.

---

## 7. Cross-Machine Invariant Summary

| Invariant | Enforced by |
|---|---|
| Booking must be `FULLY_COLLECTED` before Royalty/Reward allocation | `RoyaltyService`/`RewardService` check `Booking.status` inside the same transaction that creates the allocation row |
| ROI never exceeds 12 months | `ROICalculationService` counts existing `ROI` ledger entries for the booking before creating month N+1; refuses at N=13 |
| Payout never reaches PAID while its rule is PENDING_CEO_APPROVAL | `PayoutService.approve()` / `.process()` re-check rule status at each transition, not just at creation |
| No transaction belongs to two closing cycles | Unique constraint `(sourceTransactionId)` on the join table `TransactionClosingCycle` |
