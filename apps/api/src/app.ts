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

export function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: true,
  });

  app.register(helmet);
  app.register(cors, { origin: true, credentials: true });
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
