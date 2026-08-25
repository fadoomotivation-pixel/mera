import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import cookie from "@fastify/cookie";
import { DomainError } from "./domain/errors.js";
import { authRoutes } from "./routes/auth.routes.js";
import { publicRoutes } from "./routes/public.routes.js";
import { customerRoutes } from "./routes/customer.routes.js";
import { partnerRoutes } from "./routes/partner.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";

const ERROR_STATUS: Record<string, number> = {
  PERMISSION_DENIED: 403,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  DUPLICATE_EVENT: 409,
  UNRESOLVED_CALENDAR_RULE: 422,
  MAX_ROI_DURATION_EXCEEDED: 422,
  RULE_PENDING_APPROVAL: 422,
  NOT_ELIGIBLE: 422,
  RATE_LIMITED: 429,
  INVALID_OTP: 401,
};

/** Origins allowed to make credentialed calls to this API.
 *
 * This was `origin: true`, which reflects whatever Origin the caller sends
 * and, combined with `credentials: true`, tells the browser that *any* site
 * may read this API's responses with the user's cookies attached. That was
 * survivable only because the refresh cookie was SameSite=Strict and so never
 * left meramakan.com in the first place. It now has to be SameSite=None for
 * cross-site refresh to work at all, which means the cookie does travel — and
 * an allowlist is the thing standing between that and any site on the
 * internet calling /auth/refresh and reading a live access token out of the
 * response.
 *
 * Set CORS_ALLOWED_ORIGINS (comma-separated) to override. The defaults cover
 * the production domains and local development; preview deployments are
 * matched by suffix because their hostnames change on every build. */
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DEFAULT_ORIGINS = [
  "https://meramakan.com",
  "https://www.meramakan.com",
  "http://localhost:3000",
  "http://localhost:3100",
];

/** Vercel preview URLs for this account. They are generated per build, so
 * they cannot be listed individually. */
const PREVIEW_SUFFIX = "-fadoomotivation-pixels-projects.vercel.app";

export function isAllowedOrigin(origin: string | undefined): boolean {
  // No Origin header: same-origin navigation, curl, a health check. Not a
  // browser cross-site request, so there is nothing for CORS to protect.
  if (!origin) return true;
  const list = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;
  if (list.includes(origin)) return true;
  if (ALLOWED_ORIGINS.length) return false; // explicit list means exactly that
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "https:" && hostname.endsWith(PREVIEW_SUFFIX);
  } catch {
    return false;
  }
}

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true,
  });

  app.register(helmet);
  app.register(cors, {
    credentials: true,
    origin: (origin, cb) =>
      isAllowedOrigin(origin) ? cb(null, true) : cb(new Error(`Origin not allowed: ${origin}`), false),
  });
  app.register(cookie);
  app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof DomainError) {
      const status = ERROR_STATUS[err.code] ?? 400;
      reply.status(status).send({ error: { code: err.code, message: err.message } });
      return;
    }
    req.log.error(err);
    reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  app.register(publicRoutes, { prefix: "/api/v1/public" });
  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(customerRoutes, { prefix: "/api/v1/customer" });
  app.register(partnerRoutes, { prefix: "/api/v1/partner" });
  app.register(adminRoutes, { prefix: "/api/v1/admin" });

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
