# MERA MAKAN - API Contract

This document outlines the core RESTful APIs needed to power the three portals (Customer, Partner, Admin). All endpoints require authentication and enforce RBAC server-side.

## Authentication (Common)

- `POST /api/v1/auth/login/otp` - Request OTP.
- `POST /api/v1/auth/verify/otp` - Verify OTP, returns JWT (Access + Refresh).
- `POST /api/v1/auth/login/password` - Secondary login for Admin/Email users.
- `POST /api/v1/auth/refresh` - Refresh access token.

## 1. Customer Portal APIs (Context: `Self` only)

- `GET /api/v1/customer/dashboard` - Aggregated summary (total paid, next due).
- `GET /api/v1/customer/bookings` - List of customer's bookings.
- `GET /api/v1/customer/bookings/{id}` - Details (plot info, outstanding amount, status).
- `GET /api/v1/customer/bookings/{id}/schedule` - Payment schedule & history.
- `GET /api/v1/customer/bookings/{id}/roi` - ROI calculation (if eligible).
- `GET /api/v1/customer/documents` - Downloadable PDFs (Receipts, Agreement).

> **Security Note:** Customer endpoints must automatically inject the authenticated `CustomerID` into queries. URL parameters like `{id}` must validate ownership.

## 2. Channel Partner Portal APIs (Context: `Self` only)

- `GET /api/v1/partner/dashboard` - Tier status, royalty eligibility, reward milestone.
- `GET /api/v1/partner/sales` - List of referred customers and their booking statuses.
- `GET /api/v1/partner/referrals` - Referral income ledger (PENDING, ELIGIBLE, etc.).
- `GET /api/v1/partner/balance-sheet` - Balance sheet carry forward and cycle stats.
- `GET /api/v1/partner/payouts` - History of processed/paid amounts and TDS deductions.

> **Security Note:** Partners cannot view other partners' data or the global internal payout ledger. Financial values must come strictly from the immutable ledger tables.

## 3. Admin / Management Console APIs (Context: `Role-based`)

### Inventory & Bookings
- `POST /api/v1/admin/projects` - Create project.
- `POST /api/v1/admin/plots` - Bulk create inventory.
- `POST /api/v1/admin/bookings` - Create booking (Draft/Reserve).
- `PUT /api/v1/admin/bookings/{id}/status` - Advance booking state.

### Financial Operations
- `POST /api/v1/admin/payments/verify` - Mark payment as collected.
- `POST /api/v1/admin/cycles/close` - Trigger closing cycle calculation (Idempotent).
- `POST /api/v1/admin/royalty/snapshot` - Generate monthly turnover snapshot.
- `POST /api/v1/admin/payouts/batch` - Generate payout batch for bank API.
- `PUT /api/v1/admin/payouts/{id}/approve` - Approve a single/batch payout.
- `POST /api/v1/admin/ledger/adjust` - Create a manual adjustment (requires reason & audit).

### Business Rules (Super Admin Only)
- `GET /api/v1/admin/rules` - List all business rule configurations.
- `PUT /api/v1/admin/rules/{id}` - Update rule (creates new version, effective date).

## Data Standards

- **Amounts:** Handled in smallest currency unit (Paisa) internally to avoid floating-point errors.
- **Dates:** Stored as UTC, sent as ISO-8601 strings.
- **Pagination:** Uses `limit` and `offset` for all list endpoints.
- **Errors:** Standardized JSON error response: `{ "error": "CODE", "message": "Human readable", "trace_id": "uuid" }`
