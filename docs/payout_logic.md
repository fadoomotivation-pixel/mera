# MERA MAKAN - Payout & Ledger Calculation Logic

This document specifies the exact calculation formulas and triggers for the 5 business streams.

## Stream 1: Referral Bonus (10%)

**Trigger:** Plot Sale (Booking State: `RESERVED` -> `BOOKED`)
**Calculation Base:** `Plot Amount` (Excluding Registration)
**Formula:**
`Gross Referral = Plot Amount * 0.10`
`Admin Deduction = Gross Referral * Admin_Fee_Rate`
`TDS = (Gross Referral - Admin Deduction) * TDS_Rate` *(If applicable based on PAN)*
`Net Payable = Gross Referral - Admin Deduction - TDS`

**Eligibility condition for payout:** Cycle Close + Configured Payout Date. Does *not* strictly require 100% cash collection to generate the ledger entry (unless configured otherwise by CEO).

## Stream 2: Cash Plot ROI (1% per month)

**Trigger:** Eligible Cash Plot reaches initial required payment (typically 1st month 30%).
**Calculation Base:** *[PENDING CEO APPROVAL - Assume Total Plot Amount for now]*
**Formula:**
`Monthly ROI = Calculation_Base * 0.01`
**Duration:** Max 12 iterations.
**State Management:** Cron job runs monthly. Checks `BookingStatus`. If `CANCELLED` or `REFUNDED`, skips generation.

## Stream 3: Balance Sheet (8%)

**Trigger:** Referral Cycle Close.
**Logic:**
Maintains a separate ledger from referrals.
Follows Generation to Generation mapping.
Input volume calculated from downline -> Output -> Carries forward remaining balance.
**Payout:** Requires explicit CEO configuration on Payout Dates to transition from `ELIGIBLE` to `APPROVED`.

## Stream 4: Royalty (2% Pool)

**Trigger:** Monthly cron job (e.g., 1st of next month 00:00 UTC).
**Pre-condition:** Only properties with `BookingStatus = FULLY_COLLECTED` contribute to achievement counting.

**Step 1: Calculate Pool**
`Turnover = SUM(All Verified Collections in Month)`
`Royalty Pool = Turnover * 0.02`

**Step 2: Identify Achievers**
Query all partners whose active/unexpired Royalty Duration overlaps with the month.
*Constraint:* If a partner achieved multiple tiers (e.g., Adviser in Week 1, Senior Adviser in Week 3), only the *highest active tier* counts.

**Step 3: Allocate**
`Allocation per Achiever = Royalty Pool / COUNT(Eligible Achievers)`
Create `ROYALTY_ALLOCATION` ledger entries.

## Stream 5: Rewards (3% Pool/Fund)

**Trigger:** Event-driven upon a Booking reaching `FULLY_COLLECTED`.
**Logic:**
1. Check partner's total `FULLY_COLLECTED` pairs (e.g., 2+2, 5+5).
2. Check `RewardAchievement` table. If milestone X is met and *not* present in table, unlock reward.
**Formula:** Fixed cash/item value based on tier (e.g., ₹20,000 for Adviser).
*Constraint:* Independent of Royalty. Even if Royalty tier expires, the Reward is given once permanently.

## Anti-Bug & Concurrency Safe-Guards

1. **Idempotency:** When `POST /cycles/close` is called twice for the same cycle ID, the DB transaction must abort the second request.
2. **Double Payout Prevention:** Ledger insertion uses `ON CONFLICT (SourceID, SourceType)` to ensure one sale generates exactly one referral commission.
3. **Immutability:** Once a `PayoutBatch` is generated, the underlying ledger entries are locked (`Status = PROCESSING`). They cannot be modified by late adjustments. Adjustments must target the *next* cycle.
