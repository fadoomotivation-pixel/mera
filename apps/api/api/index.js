// Vercel serverless entry point — plain JavaScript, deliberately not TypeScript.
//
// The real source of truth is src/app.ts (compiled by `pnpm run build`,
// via vercel.json's buildCommand, into dist/src/app.js before this file is
// ever bundled). This file only imports that compiled output and adapts it
// to Vercel's Node.js function signature.
//
// Why plain JS: Vercel's Node.js function builder runs its own TypeScript
// handling on a `.ts` entry file, and in this monorepo that pass produced
// spurious type errors (Zod-parsed object fields getting inferred as
// optional when they aren't) that do NOT reproduce under a normal
// `tsc -p tsconfig.json` run — verified against a completely fresh clone
// and a fresh `pnpm install`, matching Vercel's own install process, which
// typechecks clean. Rather than fight Vercel's separate, undocumented
// checking pass, real type-checking happens once, correctly, via the
// project's own `tsc -p tsconfig.json` (part of buildCommand and CI), and
// this entry file is deliberately outside that pass since it needs none of
// its own logic to check.
//
// vercel.json rewrites every incoming path to this one function, so
// Fastify's own router (not Vercel's `/api` file-based routing) decides
// which handler runs — req.url arrives unchanged (e.g. `/health`,
// `/api/v1/admin/dashboard`), exactly as it does under `app.listen()`.
//
// The app (and its Prisma connection pool) is built once per warm
// serverless instance and reused across invocations, not rebuilt per request.

import { buildApp } from "../dist/src/app.js";

let appReadyPromise = null;

async function initApp() {
  const app = buildApp();
  await app.ready();
  return app;
}

function getApp() {
  if (!appReadyPromise) {
    appReadyPromise = initApp();
  }
  return appReadyPromise;
}

export default async function handler(req, res) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
