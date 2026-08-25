# 07 — Product Alignment Audit (Business PDF ↔ Implementation)

**Audit date:** 2026-08-24
**Repository state audited:** `main` @ `6269fba`
**Business source of truth:** `MERA_MAKAN_Channel_Partner_Deck_FINAL_FINAL_1.pdf` (9 slides)
**Verification method:** PDF text + rendered slide images compared against Prisma schema, seed data, domain services, API routes, web pages, and a live test run.

> **Nothing in this document silently resolves a business ambiguity.** Every unresolved
> item is listed in §D with an explicit `PENDING CEO APPROVAL` marker.

---

## Verification performed (not assumed)

| Claim from PR #1 / existing docs | Verified? | Evidence |
|---|---|---|
| 83 passing API tests | ✅ **Now 88/88 passing** | `pnpm exec vitest run` → 12 files, 88 passed |
| Append-only LedgerEntry | ✅ **Enforced in the database, not just code** | `prisma/migrations/20260824072400_ledger_immutability_guard/migration.sql` — `RAISE EXCEPTION` triggers on DELETE and on mutation of financial columns |
| Centralised payout state machine | ✅ | `src/domain/payout.service.ts` `PAYOUT_TRANSITIONS` |
| Versioned business rules | ✅ | All rule tables carry `version`, `status`, `effectiveFrom`, `createdByUserId` |
| Concurrency protection | ✅ | `SELECT … FOR UPDATE` (`booking.service.ts:24,54`), unique `idempotencyKey` on `LedgerEntry` |
| Four portal surfaces | ⚠️ **Partial** — all four exist but Admin is ~5 of ~20 required areas (§C-2) |
| Forbidden-terms CI lint | ❌ **DOES NOT EXIST** (§B-2) |
| Vercel `apps/web` root dir + separate API hosting | ✅ **Resolved since PR #1** — `mera` (web) and `mera-api` both deploy; login verified working end-to-end |

---

## A. MATCH — verified correct against the PDF

| # | Business requirement (PDF) | Implementation | File |
|---|---|---|---|
| A1 | Referral **10%** | `ratePercentBps: 1000` | `prisma/seed.ts:47` |
| A2 | Commission base = **₹3,50,000 plot amount**, registration excluded | `applyBps(booking.plotAmountSnapshotPaise, …)` — registration is a separate column | `referral.service.ts:49` |
| A3 | Admin **5%**, TDS **2%** | `adminChargePercentBps: 500`, `tdsPercentBps: 200` | `prisma/seed.ts:48-49` |
| A4 | Cash Plot ROI **1%/month, max 12** | `ratePercentBps: 100`, `maxMonths: 12`, capped with `MaxRoiDurationExceededError` | `prisma/seed.ts:64-65`, `roi.service.ts:72,104` |
| A5 | ROI only on Cash Plot | Guarded by `booking.roiEligible` | `roi.service.ts:50` |
| A6 | Balance Sheet **8%** | `ratePercentBps: 800` | `prisma/seed.ts:80` |
| A7 | Balance Sheet model `INPUT → OUTPUT → BALANCE → CARRY FORWARD` | Exactly these four ledger figures | `balance-sheet.service.ts:25,89-92` |
| A8 | Royalty **2% of monthly turnover** | `poolPercentBps: 200`, `poolBase: "MONTHLY_TURNOVER"` | `prisma/seed.ts:94,110` |
| A9 | Rewards **3% pool** | `poolPercentBps: 300` | `prisma/seed.ts:109` |
| A10 | **All 8 royalty tiers + durations** (2+2→1mo … 1000+1000→1yr) | Seeded exactly, Diamond = 12 months | `prisma/seed.ts:130-138` |
| A11 | **All 8 reward milestones + values** (Mobile ₹20k … Cash ₹1cr) | Seeded exactly | `prisma/seed.ts:160-169` |
| A12 | Royalty = **equal split** among eligible achievers | `finalizeMonthlySnapshot` splits equally | `royalty.service.ts:160` |
| A13 | Rewards require **full cash collection first** | Rejects unless booking is `FULLY_COLLECTED`/`REGISTERED`/`COMPLETED` | `reward.service.ts:33` |
| A14 | Referral closing **1–10 / 11–20 / 21–30**, payout **15th / 25th / 5th** | Cycle labels + `close + 5 days` produces exactly 15/25/5 | `closing-calendar.service.ts:75,110` |
| A15 | Property: 50 Gaj, ₹7,000/Gaj, ₹3,50,000, ₹1,000 reg, **₹3,51,000 total** | Landing page + seed | `apps/web/src/app/page.tsx:21,124-136` |
| A16 | 90-day plan **30% / 30% / 40%** | ₹1,05,000 / ₹1,05,000 / ₹1,40,000 | `apps/web/src/app/page.tsx:13-15` |
| A17 | Amenities: Roads, Electricity, Water, Park, Market, Guest House | All six | `apps/web/src/app/page.tsx:4-9` |
| A18 | **Never combine percentages** (no 22%, no 10%+12%) | No combined figure anywhere in web app; partner dashboard comments enforce intent | verified by repo-wide grep |
| A19 | Forbidden terms (binary/leg/downline/upline/pair/generation tree) absent from UI | Zero occurrences in user-facing copy — only in comments/tests *about* the prohibition | verified by repo-wide grep |
| A20 | RBAC: SUPER_ADMIN / FINANCE / OPERATIONS / COMPLIANCE / SUPPORT | Exactly these five | `auth/rbac.ts:33-34` |
| A21 | Customer must not see partner/royalty/reward/ledger data | Customer serializers exclude all of it | `routes/customer.routes.ts:12-13` |
| A22 | Financial records never hard-deleted; use REVERSE/VOID/ADJUSTMENT | DB trigger blocks DELETE; `markStatus` allows only VOID/REVERSED/ADJUSTED | `ledger.service.ts:59-63` + migration trigger |
| A23 | Payout states PENDING…REVERSED/CANCELLED | Full state machine | `payout.service.ts:10-14` |

---

## B. MISMATCH — implementation contradicts the PDF or the docs

### B1. Balance Sheet payout dates exist in the PDF but are hardcoded `null` in code ⚠️ **HIGH**

- **Business requirement:** PDF slide 6 (`03 — BALANCE SHEET`) carries a **PAYOUT** bar identical to the Referral slide: `CLOSING 1-10 → PAYOUT RELEASE 15th`, `11-20 → 25th`, `21-30 → 5th`.
- **Current implementation:** `payoutDueDate` is unconditionally `null` for `BALANCE_SHEET`, and consequently `outputPaise` is forced to `0n`:
  ```ts
  // closing-calendar.service.ts:117-121
  } else {
    // BALANCE_SHEET: Business Rule #1 — no payout date defined by the business.
    payoutDueDate = null;
  }
  ```
  ```ts
  // balance-sheet.service.ts:91
  const outputPaise = payoutConfigured ? inputPaise + carryForwardIn : 0n;
  ```
- **Impact:** **The 8% Balance Sheet income stream can never pay out.** It accrues INPUT and carries forward forever. One of the five advertised income streams is functionally inert in production. The partner dashboard correctly surfaces this as *"Awaiting payout schedule configuration"*, so it is honest to the user — but it does not match the deck the partner was recruited with.
- **Exact modules:** `apps/api/src/domain/closing-calendar.service.ts` (`buildWindow`), `apps/api/src/domain/balance-sheet.service.ts` (`recordInput`), `BalanceSheetRule.payoutTimingConfigured` seed flag.
- **Recommended fix:** Set `BalanceSheetRule.payoutTimingConfigured = true` and reuse the Referral `close + 5` calculation for `BUSINESS_LINE = BALANCE_SHEET`. Because the two lines already share the identical closing structure, this is a small, well-isolated change.
- **Code change required:** Yes.
- **CEO clarification required:** **YES — do not implement until confirmed.** The execution brief explicitly said *"Do NOT invent the Balance Sheet payout date. It must remain configurable until finalized."* The PDF appears to answer it (15th/25th/5th), but the brief's instruction outranks my inference. See §D-1.

### B2. Docs claim a CI lint that does not exist ⚠️ **MEDIUM**

- **Claim:** `docs/01-business-rules-matrix.md:99` states forbidden words *"are enforced via a lint check (`scripts/check-forbidden-terms.ts`) run in CI over all UI copy and API response labels."*
- **Reality:** `scripts/` does not exist. `.github/` does not exist. **There is no CI in this repository at all** — no workflow runs tests, typecheck, or build on push/PR.
- **Impact:** The terminology guarantee is currently protected only by developer discipline. More broadly, nothing prevents a regression from reaching `main` and auto-deploying to production — the 88 tests only run when someone runs them locally. Given this is a financial system on auto-deploy, this is a real risk, not a documentation nit.
- **Exact modules:** `docs/01-business-rules-matrix.md:99`; missing `.github/workflows/ci.yml`; missing `scripts/check-forbidden-terms.ts`.
- **Recommended fix:** Either build the script + CI workflow, or correct the doc. Recommend building it: a GitHub Actions workflow running `tsc --noEmit`, `vitest run`, `next build`, and the terms lint.
- **Code change required:** Yes.
- **CEO clarification required:** No — engineering hygiene.

---

## C. PARTIAL — present but incomplete against the brief

### C1. Partner dashboard is missing required fields — **MEDIUM**

- **Business requirement (brief):** personal sales, **collected sales**, **pending collection**, referral commission, **payout cycle**, payout status, Balance Sheet, tier, royalty status/duration, reward milestone/status, payout history, **deductions**, **documents**, **notifications**.
- **Current implementation** (`apps/web/src/app/partner/dashboard/page.tsx`): Total Personal Sales, Bookings Referred, Referral (net), Balance Sheet carry-forward, active tier + royalty window, rewards, payout history with explicit states.
- **Missing:** collected vs pending collection split; current payout cycle / next payout date; deduction breakdown (gross → admin 5% → TDS 2% → net); documents; notifications.
- **Impact:** Partner sees only *net* referral income — the ₹35,000 → ₹32,550 derivation from the deck is not visible, which is exactly the transparency the PDF promises. Not a correctness bug; a disclosure gap.
- **Exact modules:** `apps/web/src/app/partner/dashboard/page.tsx`, `apps/api/src/routes/partner.routes.ts` (`/dashboard` payload).
- **Code change required:** Yes. **CEO clarification:** No.

### C2. Admin console covers ~5 of ~20 required areas — **HIGH (scope)**

- **Required (brief):** Dashboard, Projects, Inventory, Bookings, Customers, Partners, Payments, Collections, Referral, Balance Sheet, Royalty, Rewards, Payouts, Deductions, Tax/TDS, Documents, Reports, Notifications, Audit Logs, Business Rules.
- **Present as UI pages:** Dashboard, Bookings, Customers, Partners, Business Rules.
- **Present as API but with no UI:** payouts, royalty snapshot, rewards evaluation, projects/plots creation, payments (`admin.routes.ts`).
- **Missing entirely (no API, no UI):** Collections view, Deductions view, Tax/TDS reporting, Documents, Reports, Notifications, Audit Log viewer.
- **Impact:** Finance cannot operate payouts, royalty runs, or reconciliation from the UI — those flows exist only as raw API endpoints. This is the largest remaining build scope.
- **Exact modules:** `apps/web/src/app/admin/*`, `apps/api/src/routes/admin.routes.ts`.
- **Code change required:** Yes (large). **CEO clarification:** No, but prioritisation input is useful.

---

## D. AMBIGUOUS — **PENDING CEO APPROVAL** (do not code until resolved)

| # | Question | Why it is unresolved | Current safe behaviour |
|---|---|---|---|
| **D1** | **Balance Sheet payout timing** — adopt the PDF's 15th/25th/5th? | PDF slide 6 shows it; execution brief says do not invent it. Direct conflict. | `payoutDueDate = null`, OUTPUT = 0, UI says "Awaiting payout schedule configuration" |
| **D2** | **Day-31 handling** | Cycle C is "21–30". Months with 31 days need a rule. | `day31Policy: "UNSET"` — throws a descriptive error rather than guessing (`closing-calendar.service.ts:56-60`) |
| **D3** | **TDS "as applicable"** | PDF says *2% as applicable*. Condition undefined (PAN on file? threshold? resident status?). | Flat 2% on gross, always |
| **D4** | **"Eligible achiever" definition for Royalty** | PDF: pool split "among eligible achievers at the attained leadership tier". Whether a tier stays eligible every month of its duration, or requires monthly re-qualification, is not stated. | `RoyaltyRule.status = PENDING_CEO_APPROVAL`; split is across partners with an ACTIVE tier in the period |
| **D5** | **Royalty rounding remainder** | Equal split of ₹2,00,000 across 3 achievers leaves 1 paisa. Destination undefined. | Needs confirmation — see §F-3 |
| **D6** | **Reward pool 3% vs. fixed milestone values** | PDF states a 3% pool *and* fixed values (₹20,000 … ₹1cr). If the pool is smaller than the sum of earned milestones, precedence is undefined. | `RewardPoolRule.status = PENDING_CEO_APPROVAL` |
| **D7** | **ROI basis and payment mechanism** | 1% of plot amount? of amount paid? credited as cash, adjustment, or extension? | `ROIRule.status = PENDING_CEO_APPROVAL` |
| **D8** | **Cancellation / refund clawback policy** | See §E-1 — the single most important open item. | **No reversal happens at all today** |

---

## E. FINANCIAL RECONCILIATION RISKS

### E1. Cancellation and refund do not reverse downstream financial events 🔴 **CRITICAL**

- **Finding:** `bookingService.cancel()` and `completeRefund()` change booking status and release the plot back to `AVAILABLE` — and do nothing else:
  ```ts
  // booking.service.ts:124-128
  async cancel(tx: Tx, bookingId: string, reason: string) {
    const booking = await this.transition(tx, bookingId, "CANCELLED", { … });
    await tx.plot.update({ where: { id: booking.plotId }, data: { status: "AVAILABLE" } });
    return booking;
  }
  ```
- **What is NOT reversed:** referral commission ledger entry, Balance Sheet INPUT and carry-forward, ROI accrual schedule, reward achievement, and the booking's contribution to monthly turnover (which sizes the Royalty pool).
- **Concrete failure scenario:** Partner refers a ₹3,50,000 booking → ₹35,000 gross commission posts and pays out on the 15th → customer cancels in month 2 and is refunded → **the partner keeps ₹32,550 net on a sale that no longer exists**, the plot returns to `AVAILABLE`, is re-sold, and generates a **second full commission on the same plot**. Meanwhile the cancelled sale still inflates that month's turnover, so the 2% Royalty pool was over-funded and already distributed.
- **Why this is not merely theoretical:** the reversal machinery already exists and is deliberately unused — `ledgerService.markStatus(…, "REVERSED")` and `payoutService.reverse()` are implemented and tested, but no caller wires cancellation to them.
- **Exact modules:** `apps/api/src/domain/booking.service.ts` (`cancel`, `completeRefund`), `referral.service.ts`, `balance-sheet.service.ts`, `roi.service.ts`, `reward.service.ts`, `royalty.service.ts`.
- **Recommended fix:** A `BookingReversalService` invoked on `CANCELLED` / `REFUNDED` that, in one transaction: marks the referral ledger entry `REVERSED` and posts an offsetting entry; reverses Balance Sheet INPUT and recomputes carry-forward; halts future ROI accruals; revokes reward achievements not yet paid; and records a turnover adjustment for the affected royalty period. Already-**PAID** payouts need a clawback/recovery record rather than a silent reversal.
- **Code change required:** Yes. **CEO clarification required:** **YES** — the *policy* is a business decision (§D-8): full clawback, partial, or only-if-unpaid; and what happens when the payout is already PAID.

### E2. Royalty pool is sized from turnover that can later be cancelled — **MEDIUM**
Follows from E1. Even with reversal implemented, a snapshot finalised in month 1 and distributed cannot un-distribute when a month-1 sale cancels in month 2. Needs a stated policy: adjust the *next* period's pool, or accept the variance.

### E3. Rounding remainder on equal royalty split — **LOW**
Equal division of an indivisible paisa amount needs a defined destination (largest-remainder to earliest achiever, or retain in pool). Currently unspecified. See §D-5.

---

## F. SECURITY RISKS

| # | Finding | Severity | Detail |
|---|---|---|---|
| F1 | **Shared seeded password across all 4 demo accounts, published in chat** | 🔴 **HIGH** | `ChangeMe123!` is live on `ceo@meramakan.test` (SUPER_ADMIN), `finance@`, and both demo accounts. Verified live against the production DB. **Rotate immediately.** |
| F2 | **No CI** | MEDIUM | Nothing blocks a broken or malicious commit from auto-deploying to production (§B-2). |
| F3 | 2FA implemented but disabled for all seeded admins | MEDIUM | `twoFactorEnabled: false` on `ceo@`. TOTP verify path exists (`auth.routes.ts:62`). Recommend enabling for SUPER_ADMIN and FINANCE_ADMIN. |
| F4 | Test-domain emails in production | LOW | `@meramakan.test` accounts are real, active, privileged accounts in the production database. |
| F5 | Authorization is server-side | ✅ **PASS** | `requireRole` runs in `preHandler` hooks; no client-side-only gating found. |
| F6 | Ledger tamper-resistance | ✅ **PASS** | Enforced by DB triggers, not application code — survives ORM bypass. |

---

## G. UI / UX MISMATCHES vs the PDF

| # | Finding | Severity |
|---|---|---|
| G1 | **No "Become a Channel Partner" page.** The deck's entire closing CTA (slide 9) and its purpose — partner recruitment — has no counterpart on the website. `/partner/login` assumes you are already a partner. | **HIGH** |
| G2 | The public site does not present the five income streams as the deck does (slide 3's `01–05` layout). Deliberate and defensible for a *customer* audience, but it leaves the deck's partner-facing story with nowhere to live online. Resolve together with G1. | MEDIUM |
| G3 | No notifications surface in any portal, though the brief lists it for customer, partner, and admin. | MEDIUM |
| G4 | No documents/receipts module (customer receipts, agreement papers, partner payout statements) — the PDF explicitly calls out customer-paid agreement/documentation papers. | MEDIUM |
| G5 | PDF slide 5 (Cash Plot ROI) renders "1% / MONTH" twice and omits the 12-month cap that appears in the slide-9 footer. **This is a defect in the deck, not the code** — the code and website both correctly state the 12-month cap. Worth fixing before the deck is circulated. | LOW (deck-side) |

---

## H. EXACT FILES REQUIRING CHANGES

| Priority | File | Change |
|---|---|---|
| P0 | `apps/api/src/domain/booking.service.ts` + new `booking-reversal.service.ts` | Cancellation/refund reversal (§E1) — **after** D8 is answered |
| P0 | *(operational, no file)* | Rotate `ChangeMe123!` on all four accounts (§F1) |
| P1 | `.github/workflows/ci.yml`, `scripts/check-forbidden-terms.ts` | Add CI + terms lint (§B2) |
| P1 | `apps/api/src/domain/closing-calendar.service.ts`, `balance-sheet.service.ts`, `prisma/seed.ts` | Balance Sheet payout timing (§B1) — **after** D1 is answered |
| P2 | `apps/web/src/app/partner/dashboard/page.tsx`, `apps/api/src/routes/partner.routes.ts` | Collected/pending split, payout cycle, deduction breakdown (§C1) |
| P2 | `apps/web/src/app/(public)/partner-programme/page.tsx` *(new)* | Channel-partner recruitment page (§G1, G2) |
| P3 | `apps/web/src/app/admin/*`, `apps/api/src/routes/admin.routes.ts` | Payouts, Collections, Deductions, TDS, Reports, Audit Log UIs (§C2) |
| P3 | schema + routes + UI | Notifications (§G3), Documents (§G4) |
| — | `docs/01-business-rules-matrix.md:99` | Correct the CI claim, or delete once B2 lands |

---

## I. TESTS TO ADD / UPDATE

| Area | Test |
|---|---|
| §E1 | Cancelling a booking with a POSTED commission reverses it; ledger nets to zero |
| §E1 | Cancel → plot re-sold → **exactly one** live commission exists for that plot |
| §E1 | Cancelling with an already-**PAID** payout creates a clawback record, never a silent reversal |
| §E1 | Cancellation halts future ROI accruals but preserves already-accrued history |
| §E1 | Reward achievement on a cancelled booking is revoked when unpaid |
| §B1 | Balance Sheet cycle produces payout dates 15/25/5 (once D1 is approved) |
| §B1 | Balance Sheet OUTPUT is non-zero once `payoutTimingConfigured = true` |
| §B2 | Forbidden-terms lint fails on a seeded violation |
| §D5 | Royalty split remainder lands per the approved rule; sum of allocations == pool exactly |
| §C1 | Partner dashboard payload exposes gross, admin, TDS and net (not net alone) |
| Regression | Full suite after every financial change (currently 88/88) |

---

## J. RECOMMENDED EXECUTION ORDER

1. **Rotate the shared password** (§F1) — minutes, and it is a live production exposure.
2. **Get CEO answers to §D**, especially **D8 (cancellation policy)** and **D1 (Balance Sheet payout)**. These block the two largest correctness items and should not be guessed.
3. **Add CI** (§B2) — do this *before* the financial refactor so every subsequent change is gated by the 88 tests.
4. **Implement cancellation/refund reversal** (§E1) with its full test set. Highest financial-risk item; every day it ships without this, a cancelled booking can pay a commission twice.
5. **Balance Sheet payout timing** (§B1), once D1 is approved — small change, unblocks a whole advertised income stream.
6. **Partner dashboard disclosure** (§C1) — deduction transparency matching the deck.
7. **Channel-partner recruitment page** (§G1/G2) — gives the deck a home online.
8. **Admin console build-out** (§C2) — largest scope; sequence Payouts → Collections → Deductions/TDS → Audit Log → Reports.
9. **Notifications and Documents** (§G3/G4).

After each financial change: `tsc --noEmit` → `vitest run` → `next build` → live smoke test → reconciliation check.

---

## Bottom line

The **core financial engine is in materially better shape than a spot-check would suggest**: every percentage, all eight royalty tiers, all eight reward milestones, the referral commission base, the closing calendar, and the ledger immutability guarantees match the PDF exactly, and the 88-test suite genuinely passes. The architecture (append-only ledger, versioned rules, idempotency keys, row locks, state machines) is sound and should be built on, not replaced.

Two things stand between this and a system that can be trusted with real money:

1. **Cancellation does not reverse anything** (§E1) — the one finding that can pay a partner twice for the same plot.
2. **An advertised income stream cannot pay out** (§B1) — Balance Sheet accrues forever.

Both are contained, well-understood, and blocked only on business decisions that must come from the CEO, not from me.
