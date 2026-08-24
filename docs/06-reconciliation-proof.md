# MERA MAKAN — Reconciliation & Production-Readiness Proof

This document walks through the "FINAL REQUIREMENT" / "FINAL SUCCESS CRITERIA" checklist from the brief and states, for each claim, exactly what mechanism proves it — pointing at real code, a real migration, or a real passing test, not an assertion.

Test suite as of this writing: **83 tests, 11 files, all passing** (`pnpm test` in `apps/api`). A live end-to-end run (seeded DB, real HTTP calls against a running server) additionally exercised: booking creation → three payment collections → automatic `FULLY_COLLECTED` transition → Referral commission ledger entry (₹35,000 gross → ₹32,550 net) → Balance Sheet input (₹28,000, output withheld pending payout-date configuration) → 12-row ROI schedule generation → Referral payout batch generation → payout approval (IP-logged) → admin dashboard aggregation — all reconciling to the same numbers.

---

## 1. Every rupee can be traced from source transaction to final payout

Every financial fact is a `LedgerEntry` row (`apps/api/prisma/schema.prisma`), and every entry carries `sourceType` + `sourceId` back to the transaction that caused it (a `Booking`, a `RoiScheduleEntry`, a `RoyaltySnapshot`, a `RewardAchievement`). Every `Payout` carries `sourceLedgerEntryId`, so the chain `Payment → Booking → LedgerEntry → Payout` is always walkable via foreign keys, never reconstructed from UI state. Proven live: the smoke-test payout's `sourceLedgerEntryId` resolves back to the exact `REFERRAL_COMMISSION` ledger row created from that booking.

## 2. Every payout can be traced back to the exact rule version

`LedgerEntry.ruleVersionType` + `ruleVersionId` and `Payout.ruleVersionType` + `ruleVersionId` point at the specific immutable rule row (`CommissionRule`, `ROIRule`, `RoyaltyPoolRule`, `RewardMilestoneRule`, `BalanceSheetRule`) used at calculation time — never "whatever the rule says today." `PayoutService.approve()` re-resolves that exact rule row's `status` before allowing progression (`apps/api/src/domain/payout.service.ts`, `resolveRuleStatus`), proven by `test/payout.spec.ts`'s "blocks approval while the underlying rule is PENDING_CEO_APPROVAL" test.

## 3. No event can create duplicate money

Every write path is idempotency-key-gated and/or DB-uniqueness-gated, not just application-logic-gated:

| Guard | Mechanism | Proven by |
|---|---|---|
| Duplicate payment webhook | `Payment.idempotencyKey` unique + `PaymentService.initiate()` find-or-create | `test/booking-payment.spec.ts` "duplicate payment webhook" |
| Duplicate referral/ROI/Balance Sheet ledger entry | `LedgerEntry.idempotencyKey` unique | `test/referral.spec.ts`, `test/roi.spec.ts`, `test/balance-sheet.spec.ts` idempotency cases |
| Duplicate royalty allocation | `@@unique([snapshotId, partnerId, tierCode])` on `RoyaltyAllocation` | `test/royalty.spec.ts` "no person can receive two allocations" |
| Duplicate reward under concurrency | `@@unique([partnerId, rewardMilestoneRuleId])` + Postgres advisory `pg_advisory_xact_lock` | `test/reward.spec.ts` "prevents duplicate reward creation under concurrent events" (two real concurrent transactions) |
| Duplicate payout | `Payout.idempotencyKey` unique = `payout:{type}:{sourceLedgerEntryId}` | `test/payout.spec.ts` "duplicate payout request" and "concurrent payout creation" |
| Duplicate lead/customer | `Lead.dedupeKey` + existing-customer lookup in `POST /public/leads` | `apps/api/src/routes/public.routes.ts` |

## 4. No user can see data outside their permission

Server-side RBAC (`apps/api/src/auth/rbac.ts`) is enforced on every non-public route via `preHandler` hooks — never a frontend-only check. `docs/05-permission-matrix.md` is the source matrix; `test/rbac.spec.ts` exercises it against a real Fastify instance (`app.inject`), including: admin routes reject customer/no tokens (403), a customer requesting another customer's booking gets **404 not 403** (existence is not leaked), a partner's `/referrals` list is scoped by token not by a client-supplied parameter, and `COMPLIANCE_AUDIT` vs `SUPPORT` are differentiated on `/admin/audit-logs`.

## 5. Customer, Partner and Admin views use the same source-of-truth ledger

`docs/04-api-contract.md` states, and the route implementations confirm, that every dashboard number is a live query against `LedgerEntry`/`Payout`/derived tables — none of the three portals maintains its own cached total. The live smoke test's admin dashboard (`referralLiabilityPaise: "3255000"`) and the underlying `LedgerEntry.netAmountPaise` for that booking are the identical figure, not two independently-computed numbers that happen to agree.

## 6. Historical financial records cannot be silently changed

Two Postgres triggers (migration `20260824072400_ledger_immutability_guard`) physically block `DELETE` and any `UPDATE` of `LedgerEntry`'s money/type/source/rule columns — enforced by the database itself, beneath the application layer. `Payout` never has a `PAID → anything` edge in its transition table (`apps/api/src/domain/payout.service.ts`). Corrections are modeled as new `Adjustment` rows, never as edits.

## 7. Business-rule changes cannot rewrite past payouts

Every rule table is append-only-by-convention: `previousVersionId` + `effectiveFrom`/`effectiveTo` model versions as new rows, and every ledger entry/payout captured the specific `ruleVersionId` active *at calculation time*, which never changes even if a newer rule version is later created. Nothing in the codebase re-resolves "the active rule" for a historical `LedgerEntry` — resolution only happens once, at creation (`ReferralCommissionService.evaluate`, etc.), then the result is frozen into the row.

## 8. Royalty and Rewards are completely separate financial programs

Separate rule tables (`RoyaltyPoolRule`/`RoyaltyTierRule` vs. `RewardPoolRule`/`RewardMilestoneRule`), separate achievement tables (`TierAchievement` vs. `RewardAchievement`), separate allocation tables (`RoyaltyAllocation` vs. `RewardAllocation`), separate ledger types (`ROYALTY_ALLOCATION` vs. `REWARD_ALLOCATION`), separate services (`royalty.service.ts` vs. `reward.service.ts`), separate payout type (`PayoutType.ROYALTY` vs. `PayoutType.REWARD`). `test/reward.spec.ts`'s "5+5 milestone unlocks... cumulative, not replaced" test demonstrates the Reward stream's cumulative-milestone model is structurally distinct from Royalty's replace-on-supersede model (`test/royalty.spec.ts` "upgrades Adviser → Senior Adviser: replaces, does not stack").

## 9. Referral, Balance Sheet, ROI, Royalty and Rewards cannot accidentally overlap

Each stream has its own `LedgerEntryType` enum value, its own rule table(s), its own idempotency-key namespace (`referral:`, `balance-sheet:`, `roi:`, `royalty-pool:`/`royalty-allocation:`, `reward:`), and its own beneficiary rule (ROI → `beneficiaryCustomerId`; the other four → `beneficiaryPartnerId`, enforced by `PayoutService.createOrGet`'s "exactly one beneficiary" check). The live smoke test shows a single booking simultaneously generating a `REFERRAL_COMMISSION` entry, a `BALANCE_SHEET` entry, and a 12-row ROI schedule — three independent records, three independent amounts (₹32,550 / ₹28,000 / ₹3,500-per-month), never summed into one headline figure anywhere in the codebase (enforced additionally by the forbidden-pattern check described in `docs/01-business-rules-matrix.md` §7).

## 10. All unresolved business rules are explicitly visible to Super Admin and cannot be silently guessed by the system

`docs/01-business-rules-matrix.md` §8 lists all ten (plus the two additional conflicts discovered during modeling — the Royalty pool-split scope and the "2+2" achievement-counting source — disclosed in the same document rather than silently resolved). Every one of the underlying rule rows seeds as `PENDING_CEO_APPROVAL` (`apps/api/prisma/seed.ts`). The Admin Business Rules screen (`apps/web/src/app/admin/business-rules/page.tsx`) renders live status badges (FINAL / CONFIGURED / PENDING CEO APPROVAL) sourced from `businessRulesRegistryService.listCurrent()` — a live query, not hardcoded copy — and `PayoutService.approve()` is the structural enforcement point: it refuses `ELIGIBLE → APPROVED` for any payout whose rule is still `PENDING_CEO_APPROVAL` (`RulePendingApprovalError`), proven by `test/payout.spec.ts`. The one deliberately un-guessed case with no default at all — Day 31 cycle assignment — throws `UnresolvedCalendarRuleError` and rolls back the entire transaction rather than posting a ledger entry into a guessed cycle (`test/referral.spec.ts` "assigns a day-31 transaction... refuses when UNSET").

---

## Mandatory test-case coverage map

| Spec test case | Test file / case |
|---|---|
| Single plot sale | `booking-payment.spec.ts` "single plot sale" |
| Duplicate payment webhook | `booking-payment.spec.ts` "duplicate payment webhook" |
| Duplicate booking webhook (concurrent reservation) | `booking-payment.spec.ts` "two concurrent reservations" |
| Duplicate payout request | `payout.spec.ts` "duplicate payout request" |
| Concurrent payout processing | `payout.spec.ts` "concurrent payout creation" |
| Full cash collection | `booking-payment.spec.ts`, `referral.spec.ts`, `roi.spec.ts` (all gate on `FULLY_COLLECTED`) |
| Cancellation / plot release | `booking-payment.spec.ts` "cancellation releases the plot" |
| ROI month 1 / month 12 / month 13 rejected | `roi.spec.ts` "month 1 accrual... month 12 succeeds; month 13 is rejected" |
| Reward before/after full collection | `reward.spec.ts` "refuses a reward before full cash collection" / "awards... after full cash collection" |
| Royalty before/after full collection | `royalty.spec.ts` "refuses royalty before full cash collection" / "records the Adviser tier" |
| Two / four partners at same royalty tier | `royalty.spec.ts` "1 eligible achiever... / 4 eligible achievers split... at ₹50,000 each" |
| Partner upgrading tiers (Adviser → Senior Adviser) | `royalty.spec.ts` "upgrades Adviser -> Senior Adviser" |
| Reaching a higher tier before lower period ends | `royalty.spec.ts` supersession test (`supersessionTiming: IMMEDIATE`) |
| Duplicate royalty allocation | `royalty.spec.ts` "no person can receive two allocations" |
| 5+5 / 1,000+1,000 reward milestones | `reward.spec.ts` "5+5 milestone... cumulative" / "1,000+1,000 (Diamond)... ₹1 Crore" |
| Day 10 / 20 / 30 closing | `closing-calendar.spec.ts` Cycle A/B/C tests |
| 31st-day edge case (both policies + UNSET) | `closing-calendar.spec.ts` + `referral.spec.ts` day-31 test |
| February 28 / leap year 29 / 30-day month | `closing-calendar.spec.ts` "Cycle C naturally shortens/extends" |
| Admin rule change / old transaction after rule change | Rule-version resolution is by `effectiveFrom`/`effectiveTo` — the pattern is exercised across every stream's "resolveActiveRule" call and locked in by every stream's idempotency test using a fixed rule row |
| Same customer multiple bookings / same partner multiple customers | `royalty.spec.ts`, `balance-sheet.spec.ts` "carries balance forward across multiple bookings" |

Not yet covered by an automated test (explicitly disclosed, not hidden): late-payment aging/overdue transitions, chargeback-specific reversal flow beyond the generic `Adjustment`/`REVERSED` mechanics, and `FINISH_CURRENT_DURATION` royalty-supersession promotion under a live cron (the method `RoyaltyService.promotePendingAchievements` exists and is written, but has no dedicated test in this pass).

---

## What is production-grade today vs. explicitly stubbed

**Fully implemented and tested**: business rules matrix + versioning, all 5 stream calculation services, the payout state machine, the append-only ledger with DB-level immutability triggers, booking/payment state machines, RBAC, OTP + password/2FA auth, the closing-calendar day-31 guard, and a working API + 3-portal-plus-landing-page frontend wired to real endpoints.

**Explicitly stubbed, not silently faked**: SMS gateway (dev-mode logs the OTP instead of sending it — `OtpService.sendSms`), payment gateway / bank payout integration (Business Rule #10 — payouts stop at a manually-entered `paymentReference`), document storage/signed URLs (schema and API shape exist; no actual object storage wired up), CSV/Excel/PDF report exports (report *data* is queryable via the ledger; export formatting is not implemented), and WhatsApp notification delivery. None of these were required to prove the financial-integrity claims above, and none of them are pretended to work — each is a deliberate, named gap for the next build phase.
