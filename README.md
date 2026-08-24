# MERA MAKAN

**अपनी ज़मीन, अपनी पहचान** — a real-estate sales and channel-partner platform: public landing site, customer portal, channel-partner portal, and an admin/management console, all backed by one auditable financial engine.

## Start here

This project was built docs-first, per the mandated development process. Read in order:

1. [`docs/01-business-rules-matrix.md`](docs/01-business-rules-matrix.md) — the five income streams, their exact math, and every business rule the source conversation left ambiguous (with the conservative default applied and why).
2. [`docs/02-state-machines.md`](docs/02-state-machines.md) — Booking / Payment / Payout / Royalty / Reward state machines.
3. [`docs/03-erd.md`](docs/03-erd.md) — data model, and the consolidation decisions that keep totals from drifting.
4. [`docs/04-api-contract.md`](docs/04-api-contract.md) — REST surface for all four experiences.
5. [`docs/05-permission-matrix.md`](docs/05-permission-matrix.md) — role × resource × action, server-enforced.
6. [`docs/06-reconciliation-proof.md`](docs/06-reconciliation-proof.md) — the "final requirement" checklist, each claim pointed at the code/migration/test that proves it, plus what is explicitly stubbed rather than silently faked.

## Repo layout

```
apps/api/    Fastify + TypeScript + Prisma/PostgreSQL — the financial engine and REST API
apps/web/    Next.js — public landing page, customer portal, partner portal, admin console
docs/        Phases 1–6 design docs + the reconciliation proof (read these first)
```

## Running locally

Prerequisites: Node 22+, pnpm, PostgreSQL 16 running locally.

```bash
pnpm install

# Database
createdb meramakan
createdb meramakan_test
cp apps/api/.env.example apps/api/.env      # edit DATABASE_URL if needed
cd apps/api && pnpm exec prisma migrate deploy && cd ../..

# Seed demo data (rules, royalty tiers, reward milestones, a project/plots,
# one Super Admin, one Finance Admin, one demo customer, one demo partner)
pnpm --filter @mera/api prisma:seed

# Run both apps
pnpm dev:api    # http://localhost:4000
pnpm dev:web    # http://localhost:3000
```

Demo credentials printed by the seed script:

| Role | Login |
|---|---|
| Super Admin | `ceo@meramakan.test` / `ChangeMe123!` |
| Finance Admin | `finance@meramakan.test` / `ChangeMe123!` |
| Customer (OTP) | `+919990000001` — dev OTP is fixed (`OTP_DEV_STATIC_CODE`, default `123456`) |
| Channel Partner (OTP) | `+919990000002` — same dev OTP |

## Tests

```bash
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/meramakan_test" pnpm exec prisma migrate deploy
pnpm test
```

83 tests across the closing-calendar service, all five income-stream services, the payout engine, booking/payment state machines, auth, and server-side RBAC — including concurrency tests (duplicate reward under simultaneous events, concurrent plot reservation, concurrent payout creation) and the day-31/leap-year/short-month closing-calendar edge cases.

## What's real vs. stubbed

See the closing section of `docs/06-reconciliation-proof.md`. In short: the entire financial engine (calculation, ledger, payout state machine, RBAC, auth) is implemented and tested end-to-end. SMS delivery, a payment-gateway/bank-payout integration, document object storage, and report file export (CSV/Excel/PDF) are deliberately stubbed with the seam already in place — not silently faked — because the business spec leaves the vendor/mechanism choice for these to a future decision (see Business Rules Matrix §8, item 10).
