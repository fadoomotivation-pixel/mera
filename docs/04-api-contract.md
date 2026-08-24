# MERA MAKAN — API Contract

Base URL: `/api/v1`. All financial/derived values in responses are pre-computed server-side; no endpoint returns raw rows for the client to sum. All money fields are serialized as **strings** (`"3500000"` paise) to avoid JS `BigInt`/JSON precision loss; the web app formats to ₹ at render time.

Auth: `Authorization: Bearer <access_jwt>`. Access tokens are short-lived (15 min); `POST /auth/refresh` rotates via an httpOnly refresh cookie. Every route below states its minimum role. See `docs/05-permission-matrix.md` for the full matrix — this doc only lists routes and payload shape.

---

## 0. Public (no auth) — `/api/v1/public/*`

| Method | Path | Purpose |
|---|---|---|
| GET | `/public/projects` | Active projects for the landing page (name, location, amenities, photos) — no pricing internals beyond the standard published plot price. |
| GET | `/public/projects/:slug/availability` | Plot availability counts only (no customer/partner identifiable data). |
| POST | `/public/leads` | Create a lead from the site-visit / availability form. Body: `{name, phone, preferredProjectId?, preferredPlotSize?, preferredVisitDate?, message?, source, utmSource?, utmMedium?, utmCampaign?, consentGiven}`. Server normalizes phone → `dedupeKey`; if a `Lead` or `Customer` already exists with that key in the dedupe window, links to it (`status: DUPLICATE` or reuse) instead of creating a fresh row — see `LeadService.captureLead()`. Rate-limited per IP+phone. |

---

## 1. Auth — `/api/v1/auth/*`

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/otp/request` | `{phone, purpose}` → sends OTP (rate-limited: 3/10min per phone, 10/hour per IP). |
| POST | `/auth/otp/verify` | `{phone, code}` → issues access+refresh tokens, creates `Customer`/`ChannelPartner` `User` on first successful login only if a matching pre-provisioned record exists (self-service customer signup is via the lead→booking flow, not raw OTP signup, to avoid unattached accounts). |
| POST | `/auth/password/login` | Admin-only. `{email, password}` → if `twoFactorEnabled`, returns a `pendingTwoFactorToken` instead of tokens. |
| POST | `/auth/2fa/verify` | Admin-only. `{pendingTwoFactorToken, totpCode}` → issues tokens. |
| POST | `/auth/refresh` | Rotates refresh token (httpOnly cookie), issues new access token. Old refresh token is revoked on use (rotation, not reuse). |
| POST | `/auth/logout` | Revokes current refresh token. |

---

## 2. Customer Portal — `/api/v1/customer/*` (role: CUSTOMER, scoped to `req.user.customerId`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/customer/me` | Profile. |
| GET | `/customer/bookings` | All bookings belonging to this customer (never another customer's — enforced by `WHERE customerId = req.user.customerId` at the query layer, not just a response filter). |
| GET | `/customer/bookings/:id` | Full detail: plot, schedule, paid/outstanding (from ledger), status, next payment. 404s (not 403) if the booking belongs to someone else, to avoid leaking existence. |
| GET | `/customer/bookings/:id/payments` | Payment history. |
| GET | `/customer/bookings/:id/roi` | 404 if `booking.roiEligible = false`. Returns rate, start/end, monthly amount, credited/paid/remaining, schedule — all from `ROICalculationService`, never computed client-side. |
| GET | `/customer/bookings/:id/documents` | List with signed, time-limited download URLs generated per request. |
| GET | `/customer/bookings/:id/documents/:docId/download` | Issues a short-lived signed URL / streams via signed token check. |
| GET | `/customer/notifications` | Own notifications only. |
| POST | `/customer/support/tickets` | Raise a support request. |

**Never exposed** to this role at the API layer (not just hidden in UI): referral commission, Balance Sheet, Royalty Pool, Reward Pool, other customers, other partners, admin deductions, internal payout ledger. These fields are excluded from the serializer used for this role, not merely omitted by the frontend.

---

## 3. Channel Partner Portal — `/api/v1/partner/*` (role: CHANNEL_PARTNER, scoped to `req.user.partnerId`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/partner/me` | Profile + partner code. |
| GET | `/partner/dashboard` | Aggregated: total personal sales, collected amount, pending collection, current tier, active royalty window, reward milestones unlocked — all pre-aggregated server-side from the ledger, each figure carrying its `status` (PENDING/ELIGIBLE/APPROVED/PROCESSING/PAID/HELD/REVERSED/CANCELLED). |
| GET | `/partner/referrals` | Bookings referred by this partner + each one's commission ledger entries/status. |
| GET | `/partner/closing-cycles` | Current + historical Referral and Balance Sheet cycles this partner has entries in. |
| GET | `/partner/balance-sheet` | Input/Output/Balance/Carry-Forward ledger rows, using only the approved terminology. |
| GET | `/partner/tier` | Current active tier, achievement history, superseded tiers, royalty duration window. |
| GET | `/partner/royalty` | Royalty allocations (by snapshot), each with status; never a dynamically recomputed historical number. |
| GET | `/partner/rewards` | Reward achievements + allocations + payout status. |
| GET | `/partner/payouts` | All payouts across all 4 partner-facing types (REFERRAL, BALANCE_SHEET, ROYALTY, REWARD) with full status/audit trail fields the partner is allowed to see (no internal approver IP/device — those are admin-only). |
| GET | `/partner/customers` | Customers referred by this partner + their payment status (no other partner's customers). |
| GET | `/partner/documents` | Own documents. |
| GET | `/partner/notifications` | Own notifications. |

---

## 4. Admin Console — `/api/v1/admin/*` (role: per-route, see permission matrix)

### Dashboard & Reporting (FINANCE_ADMIN, COMPLIANCE_AUDIT read-only, SUPER_ADMIN)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` | Total sales, GBV, collected, outstanding, per-stream liabilities, pool sizes, payout status breakdown, inventory/customer/partner counts. Filters via query params: `project, dateFrom, dateTo, closingCycleId, partnerId, customerId, paymentStatus, collectionStatus, payoutStatus, royaltyTier, rewardTier`. |
| GET | `/admin/reports/:reportKey` | One of: `daily-sales, collections, referral-commission, balance-sheet, royalty-pool, royalty-allocation, reward-eligibility, reward-payout, customer-statement, partner-statement, payout-reconciliation, tax-tds, admin-deduction, outstanding-collection, project-inventory, audit`. Query params for filters + `format=csv|xlsx|pdf` for export. |
| GET | `/admin/audit-logs` | COMPLIANCE_AUDIT / SUPER_ADMIN. Filterable, paginated, read-only. |

### Operations (OPERATIONS_ADMIN, SUPER_ADMIN)

| Method | Path | Purpose |
|---|---|---|
| POST/GET/PATCH | `/admin/projects[/:id]` | CRUD + document upload sub-route `/admin/projects/:id/documents`. |
| POST/GET/PATCH | `/admin/plots[/:id]` | Inventory create/edit; `POST /admin/plots/:id/reserve`. |
| POST | `/admin/bookings` | Confirm booking (RESERVED → BOOKED). |
| PATCH | `/admin/bookings/:id/status` | Guarded by the Booking state machine — illegal transitions return 409 with the allowed-next-states list. |
| POST | `/admin/bookings/:id/registration` | Mark registration complete. |
| POST | `/admin/payments` | Record a payment (manual entry) or receive gateway webhook via `/admin/payments/webhook` (idempotency-key enforced, signature-verified). |
| POST | `/admin/payments/:id/verify` | PENDING → VERIFIED. |
| POST | `/admin/bookings/:id/collection` | Mark collection complete (creates `Collection` row; only legal once all schedule rows COLLECTED). |
| POST | `/admin/documents` | Upload (any owner type). |

### Finance (FINANCE_ADMIN, SUPER_ADMIN)

| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/closing-cycles/run` | `{businessLine, cycleYear, cycleMonth, cycleLabel}` — seals a cycle (idempotent: re-running an already-CLOSED cycle is a no-op, not a duplicate). |
| POST | `/admin/referral/payout-batch` | Generates a `PayoutBatch` for a closed Referral cycle. |
| POST | `/admin/balance-sheet/closing` | Generates the Balance Sheet ledger snapshot for a closed cycle; payout stays `AWAITING_PAYOUT_CONFIG` until Business Rule #1 is resolved. |
| POST | `/admin/royalty/snapshot` | `{periodYear, periodMonth}` — generates the immutable monthly `RoyaltySnapshot` + allocations. Re-invoking an already-`FINALIZED` period returns 409, never a second snapshot. |
| POST | `/admin/rewards/evaluate` | Runs eligibility evaluation for a booking/partner (also runs automatically on the `FULLY_COLLECTED` event; this route is for manual re-trigger, which is idempotent). |
| POST | `/admin/payouts/:id/approve` | ELIGIBLE → APPROVED. Logs approver IP/device. Refuses if any dependent `BusinessRule` is `PENDING_CEO_APPROVAL`. |
| POST | `/admin/payouts/:id/hold` \| `/release` \| `/reverse` \| `/cancel` | State-machine-guarded transitions. |
| POST | `/admin/adjustments` | Create an `Adjustment`; requires a second approver (`approvedByUserId` ≠ `createdByUserId`) before it applies. |
| POST | `/admin/refunds` | Create/approve/process refund workflow. |
| POST | `/admin/financial-periods/:id/freeze` | Prevents further postings into a closed period without an explicit unfreeze + audit entry. |

### Business Rules (SUPER_ADMIN only for writes; all admin roles can read)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/business-rules` | Unified registry across every `*Rule` table — current value, effective date, last changed by, status, previous version, change history. |
| POST | `/admin/business-rules/:ruleKey` | Creates a new version (never edits in place). Requires `confirm: true` in body (UI double-confirmation) + writes an `AuditLog` entry. |
| POST | `/admin/business-rules/:ruleKey/approve` | Moves `PENDING_CEO_APPROVAL` → `CONFIGURED`/`FINAL`. Only SUPER_ADMIN (acting as/for CEO). |

### User & Role Management (SUPER_ADMIN)

| Method | Path | Purpose |
|---|---|---|
| POST/GET/PATCH | `/admin/users[/:id]` | Create/list/update admin & staff accounts, assign roles. |
| POST | `/admin/users/:id/suspend` | Deactivate access without deleting the row (financial FK integrity). |

---

## Error contract

All errors: `{error: {code, message, details?}}`. Notable codes used by the financial engine: `INVALID_STATE_TRANSITION`, `UNRESOLVED_CALENDAR_RULE`, `MAX_ROI_DURATION_EXCEEDED`, `RULE_PENDING_APPROVAL`, `DUPLICATE_IDEMPOTENCY_KEY` (returns the original result with 200, not an error, per idempotent-retry semantics — documented per-route where applicable), `PERMISSION_DENIED`, `NOT_FOUND`.
