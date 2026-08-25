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

## Sessions across two origins

The access token lasts 15 minutes; the refresh token lasts 30 days and rotates
on every use. Three things have to line up or the session dies on a timer:

1. **The client must call `/auth/refresh`.** It didn't, for a long time. The
   API issued a perfectly good refresh token that nothing ever redeemed, so
   every user was signed out fifteen minutes after signing in and shown
   *Invalid or expired access token*. `apps/web/src/lib/api.ts` now renews on
   a 401 and replays the request once. Renewal is single-flight: several
   requests expiring together must share one renewal, because the server
   rotates the token and the losers of the race would present a revoked one.

2. **401 and 403 must mean different things.** Everything auth-related used to
   answer 403, so the client could not distinguish *renew and retry* from
   *you are not allowed*. Authentication failures (no token, bad token,
   expired token, spent refresh token) are now **401 `UNAUTHENTICATED`**; role
   and scope denials stay **403 `PERMISSION_DENIED`**.

3. **The refresh cookie must be able to cross origins.** The web app is on
   `meramakan.com` and the API on `mera-api.vercel.app` — different sites, so
   `SameSite=Strict` meant the browser never sent the cookie and the refresh
   endpoint saw an anonymous request. It is now `SameSite=None; Secure` in
   production, `Lax` locally (browsers reject None without Secure, and local
   dev is plain http).

Because the cookie now travels cross-site, `origin: true` in the CORS config
was no longer acceptable — it reflected any origin *with credentials*, which
would let any page call `/auth/refresh` and read a live access token out of
the response. There is now an allowlist (`isAllowedOrigin` in `src/app.ts`),
overridable with `CORS_ALLOWED_ORIGINS`. **If the site ever moves to a new
domain, add it there or every API call will fail CORS.**

Known limitation: because refresh tokens rotate, two browser tabs that both
renew at the same moment can race, and the loser is signed out. Single-flight
solves this within one tab, not across tabs.
