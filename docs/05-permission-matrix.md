# MERA MAKAN — Permission Matrix

**Enforcement model**: every request passes through `apps/api/src/auth/rbac.ts::requireRole(...)` and, for scoped resources, a data-scoping clause built into the Prisma query itself (`WHERE customerId = ctx.user.customerId`, `WHERE partnerId = ctx.user.partnerId`) — never a post-fetch filter, and never a check performed only in the frontend. A route handler that forgets the scoping clause is caught by an integration test suite (`apps/api/test/rbac.spec.ts`) that, for every scoped route, asserts a second user of the same role cannot read another user's rows.

Legend: **F**=Full (create/read/update, void/reverse instead of delete), **R**=Read-only, **O**=Own-data only, **A**=Approve/state-transition actions only, **–**=No access.

| Resource | SUPER_ADMIN | FINANCE_ADMIN | OPERATIONS_ADMIN | COMPLIANCE_AUDIT | SUPPORT | CHANNEL_PARTNER | CUSTOMER |
|---|---|---|---|---|---|---|---|
| Projects / Plots | F | R | F | R | R | R (public listing only) | R (public listing only) |
| Leads | F | – | F | R | F | O (own assigned) | – |
| Bookings | F | R + financial actions | F (ops actions) | R | R (limited fields) | O (own referrals) | O (own bookings) |
| Payment Schedules | F | F | R | R | – | O (own referrals, read) | O (own, read) |
| Payments | F | F (verify) | F (record) | R | R | O (read) | O (read) |
| Collections | F | F | F | R | R | O (read) | O (read) |
| Registrations | F | R | F | R | R | O (read) | O (read) |
| Documents | F | R + own-team uploads | F | R | F (customer-facing docs only) | O | O |
| Referral commission (ledger + payout) | F | F | – | R | – | O (read own) | – (never exposed) |
| Cash Plot ROI (ledger + payout) | F | F | R | R | – | – (not partner-facing) | O (read own, if booking is ROI-eligible) |
| Balance Sheet (ledger + payout) | F | F | – | R | – | O (read own) | – (never exposed) |
| Royalty Pool / Snapshot / Allocation | F | F | – | R | – | O (read own allocation) | – (never exposed) |
| Reward Pool / Achievement / Allocation | F | F | – | R | – | O (read own) | – (never exposed) |
| Payout Engine (approve/hold/reverse) | F | F (except reversal needs Super Admin co-sign for >configured threshold) | – | R | – | O (read own status) | – |
| Closing Cycles (run) | F | F | R | R | – | R (own cycle membership) | – |
| Business Rules (read) | F | R | R | R | – | – | – |
| Business Rules (write new version) | F | F (except final CEO-approval step) | – | – | – | – | – |
| Business Rules (CEO approval) | F (acting for CEO) | – | – | – | – | – | – |
| Adjustments | F | F (create; needs 2nd approver) | – | R | – | – | – |
| Refunds | F | F | Create request only | R | – | – | – |
| Reports / Exports | F | F | R (ops-relevant reports) | F (read+export, all reports) | R (customer/ticket-relevant only) | O (own statement) | O (own statement) |
| Users & Roles | F | – | – | – | – | – | – |
| Audit Logs | F | R | – | F (read+export) | – | – | – |
| Notifications (own) | F | O | O | O | O | O | O |
| Support tickets | F | R | R | F | F | O (create/read own) | O (create/read own) |
| System Settings (non-financial) | F | – | F (ops-relevant) | R | R | – | – |

## Server-side enforcement notes

1. **RBAC is never inferred from a JWT claim alone for financial writes.** The access token carries `userId` + `role`; every financial mutation re-reads the user's current role/status from the database inside the same transaction, so a role downgrade or suspension takes effect immediately, not after token expiry.
2. **Ownership scoping is a query clause, not a filter.** `customer.bookings.findMany({where: {customerId: ctx.customerId}})`, never `bookings.findMany().filter(b => b.customerId === ctx.customerId)`. This means an over-fetch bug cannot leak rows even transiently.
3. **404, not 403, for cross-tenant lookups by ID.** `GET /customer/bookings/:id` for a booking belonging to a different customer returns `404 NOT_FOUND`, not `403 PERMISSION_DENIED` — prevents existence-leakage (confirming a booking ID exists for someone else).
4. **Two-person rule on high-risk actions.** `Adjustment.approvedByUserId` must differ from `createdByUserId`. Large refunds/adjustments above a configurable threshold require SUPER_ADMIN co-sign regardless of the initiating Finance Admin.
5. **IP/device logging** is mandatory (not optional) on every payout approval, business rule change, and adjustment — captured server-side from the request, never client-supplied.
6. **Frontend role checks are UX only.** The Next.js apps hide navigation for roles that can't use a feature, purely to avoid dead-end clicks — every single one of those routes is independently re-checked server-side, and the RBAC test suite deliberately calls admin-console API routes with partner/customer tokens to prove they're rejected even if a UI guard were bypassed.
