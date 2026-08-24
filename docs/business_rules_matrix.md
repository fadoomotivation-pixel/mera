# MERA MAKAN - Business Rules Matrix

This document defines the core business rules for the Mera Makan platform. The rules are categorized into streams, and any unresolved ambiguities are explicitly flagged for CEO approval. 

> [!WARNING]
> The system must NOT be deployed to production with any rules in the **PENDING CEO APPROVAL** state. Production financial payouts will be blocked until these rules are fully configured.

## 1. Referral Bonus (Stream 1)

| Rule Name | Value / Logic | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Referral Rate** | 10% | FINAL | Based on Plot Amount, excluding Registration fees. |
| **Admin Deduction** | 5% | CONFIGURED | Configurable percentage with effective dates. |
| **TDS Deduction** | 2% | CONFIGURED | Configurable based on PAN presence/tax laws. |
| **Closing Cycles** | 1-10, 11-20, 21-30 | FINAL | Three 10-day cycles. |
| **Payout Schedule** | 5 days after cycle ends (15th, 25th, 5th) | FINAL | Payout run scheduled automatically. |
| **31st Day Handling** | To be determined | **PENDING CEO APPROVAL** | Does 31st roll into next cycle or append to 21-30 cycle? |
| **February Handling** | To be determined | **PENDING CEO APPROVAL** | How are 28/29-day months treated for the final cycle? |
| **Cancellation Impact** | To be determined | **PENDING CEO APPROVAL** | Does a cancelled/refunded plot reverse already paid referral commissions? |

## 2. Cash Plot ROI (Stream 2)

| Rule Name | Value / Logic | Status | Notes |
| :--- | :--- | :--- | :--- |
| **ROI Rate** | 1% per month | FINAL | Configurable calculation base. |
| **Duration** | Maximum 12 months | FINAL | Strictly enforced maximum. |
| **Eligibility** | Specific Cash Plot Bookings | FINAL | Driven by specific project settings. |
| **Calculation Base** | To be determined | **PENDING CEO APPROVAL** | Is the 1% calculated on Plot Amount, Amount Paid, or another value? |
| **Cancellation Impact** | Future ROI stops immediately | FINAL | Adjustments needed if past ROI requires clawback. |
| **Clawback Rule** | To be determined | **PENDING CEO APPROVAL** | Do we reverse previously paid ROI upon plot cancellation? |

## 3. Balance Sheet (Stream 3)

| Rule Name | Value / Logic | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Balance Sheet Rate** | 8% | FINAL | Generation to Generation structure. |
| **Closing Cycles** | 1-10, 11-20, 21-30 | FINAL | Synchronized with Referral Bonus closing cycles. |
| **Carry Forward** | Approved amount carries forward | FINAL | Based on INPUT → OUTPUT → BALANCE → CARRY FORWARD. |
| **Payout Date** | To be determined | **PENDING CEO APPROVAL** | Admin must configure explicit payout dates for this stream. |
| **Cancellation Impact** | To be determined | **PENDING CEO APPROVAL** | Impact of plot refund on Balance Sheet payouts. |

## 4. Royalty (Stream 4)

| Rule Name | Value / Logic | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Royalty Pool** | 2% of Monthly Turnover | FINAL | Calculated once per monthly RoyaltySnapshot. |
| **Royalty Tiers** | 8 Tiers (Adviser to Diamond) | FINAL | Achievements based on units (e.g. 2+2, 5+5). |
| **Pool Distribution**| Equal split among eligible achievers | FINAL | No duplicate allocations per person for the same tier/cycle. |
| **Requirement** | Full Cash Collection | FINAL | Royalty activates only after full property cash collection. |
| **Tier Superseding**| To be determined | **PENDING CEO APPROVAL** | Does a higher tier immediately replace the remaining duration of a lower tier? |
| **Royalty Start Date**| To be determined | **PENDING CEO APPROVAL** | Does it start the exact day of full collection or next full month? |
| **Cancellation Impact**| To be determined | **PENDING CEO APPROVAL** | Does cancellation revoke an active royalty tier? |

## 5. Rewards (Stream 5)

| Rule Name | Value / Logic | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Reward Pool Base** | To be determined | **PENDING CEO APPROVAL** | Is this 3% of turnover funded into a pool, or fixed amounts paid from 3% margin? |
| **Milestones** | Adviser to Diamond | FINAL | Rewards range from ₹20,000 to ₹1 Crore. |
| **Requirement** | Full Cash Collection | FINAL | Rewards unlock only after full cash condition is satisfied. |
| **Frequency** | Once per milestone per partner | FINAL | Unless an approved reversal requires a reset. |

## 6. General Financial & Operational

| Rule Name | Value / Logic | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Rule Versioning** | Immutable past transactions | FINAL | Old transactions use the rule active at their creation time. |
| **Payment Gateway** | To be determined | **PENDING CEO APPROVAL** | Exact payment gateway and bank API details required for payouts. |
| **Adjustment Policy**| Use Void/Reverse/Adjust | FINAL | No hard deletes of financial ledgers. |
| **Source of Truth** | Centralised Ledger | FINAL | All views (Customer, Partner, Admin) compute from identical ledger entries. |
