# Deployment notes

Things about this deployment that are not obvious from the code, and that cost
real time to work out. `vercel.json` is strict JSON with no comment support and
rejects unknown keys outright (a `"//note"` key fails the build with *should NOT
have additional property*), so the reasoning lives here instead.

## Two Vercel projects, one repository

| Project    | Root directory | Serves                       |
| ---------- | -------------- | ---------------------------- |
| `mera`     | `apps/web`     | Next.js site and portals     |
| `mera-api` | `apps/api`     | Fastify API, as one function |

Environment variables must be set on the project that actually reads them.
`DATABASE_URL` and the JWT secrets belong to **`mera-api`**;
`NEXT_PUBLIC_API_URL` belongs to **`mera`**. Adding an API variable to the web
project looks like it worked and changes nothing.

## `apps/api/vercel.json`

**`"framework": null`** — Vercel auto-detected this as a Fastify project and ran
its own preset build alongside ours, looking for `src/app.ts` by convention and
invoking the result directly. Requests to `/` hit that shadow function and
crashed with *Invalid export found in module `src/app.js`. The default export
must be a function or server* — `src/app.ts` exports `buildApp` as a named
export, which is correct for our own entry point. Setting the framework to null
stops the preset.

**`"outputDirectory": "public"`** — a consequence of the line above. With
framework detection off, Vercel falls back to expecting a static `public`
directory. The directory is empty and nothing in it is ever served: the rewrite
below sends every path, `/` included, to the function first.

**`"regions": ["bom1"]`** — Mumbai. The database is Supabase `ap-south-1` and
effectively every user is in India, so the default `iad1` (Washington DC) put
each round trip across the world twice: user → function → database and back.
Measured before the change: admin dashboard 7.5–10.3s, bookings 3.7s, projects
2.9s, customers 2.5s, partners 1.3s, login 3.6s. The region is the single
biggest lever on all of them, because it is latency rather than compute.

## Database connection

Production uses the Supavisor pooler in transaction mode, so the URL carries
`?pgbouncer=true&connection_limit=1`. Both matter:

- `pgbouncer=true` stops Prisma using prepared statements, which transaction
  mode cannot support.
- `connection_limit=1` is correct for the pooler, but it means **`Promise.all`
  does not give parallelism** — queries queue on the one connection and each
  pays full network latency in turn. The admin dashboard was eight queries in a
  `Promise.all` for exactly this reason and is now a single round trip. Prefer
  one query over several anywhere latency matters.

Note the pooler host fleet: this project is on `aws-0-ap-south-1.pooler.
supabase.com`. Using `aws-1-` instead fails with *tenant or user not found*,
which reads like a credentials problem and is not one. The direct (non-pooler)
connection is IPv6-only and unreachable from Vercel functions.

## Responsive check

`node apps/web/scripts/mobile-audit.mjs` drives the signed-in pages at
360/390/412/768/1440 and fails on horizontal overflow or any tap target under
44px. It needs a local stack with demo data seeded. Set `CHROMIUM_PATH` if
Playwright's own browser download is unavailable.
