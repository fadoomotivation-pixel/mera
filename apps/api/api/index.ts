import type { IncomingMessage, ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";

/**
 * Vercel serverless entry point. The Fastify app itself (src/app.ts,
 * src/server.ts) is unchanged and still runs standalone via `pnpm dev`/
 * `node dist/server.js` for local development and any non-Vercel host —
 * this file only adapts it to Vercel's Node.js function signature.
 *
 * vercel.json rewrites every incoming path to this one function, so
 * Fastify's own router (not Vercel's `/api` file-based routing) is what
 * decides which handler runs — req.url arrives unchanged (e.g. `/health`,
 * `/api/v1/admin/dashboard`), exactly as it does when running under
 * `app.listen()`.
 *
 * The app (and its Prisma connection pool) is built once per warm
 * serverless instance and reused across invocations, not rebuilt per
 * request.
 */
let appReadyPromise: Promise<FastifyInstance> | null = null;

async function initApp(): Promise<FastifyInstance> {
  const app = buildApp();
  await app.ready();
  return app;
}

async function getApp(): Promise<FastifyInstance> {
  if (!appReadyPromise) {
    appReadyPromise = initApp();
  }
  return appReadyPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit("request", req, res);
}
