import type { FastifyReply, FastifyRequest } from "fastify";
import { tokenService, type AccessTokenClaims } from "./token.service.js";
import { PermissionDeniedError } from "../domain/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    authClaims?: AccessTokenClaims;
  }
}

/** Verifies the Authorization: Bearer <token> header and attaches claims to
 * the request. Every non-public route registers this as a preHandler —
 * there is no route that trusts a client-supplied user id/role directly. */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new PermissionDeniedError("Missing bearer token");
  }
  const token = header.slice("Bearer ".length);
  try {
    req.authClaims = tokenService.verifyAccessToken(token);
  } catch {
    throw new PermissionDeniedError("Invalid or expired access token");
  }
}

export function claims(req: FastifyRequest): AccessTokenClaims {
  if (!req.authClaims) throw new PermissionDeniedError("Not authenticated");
  return req.authClaims;
}

/** The customer id every customer route scopes on.
 *
 * Use this instead of `claims(req).customerId!`. The `!` is a compile-time
 * assertion that does nothing at runtime, so a token issued without the claim
 * produced `where: { customerId: undefined }` — which Prisma reads as *no
 * filter*, returning every customer's rows to whoever asked. That is exactly
 * what happened: the password-login path omitted the claim and one customer
 * was served all eleven bookings in the system.
 *
 * Failing closed here means the same mistake can only ever produce a 403, not
 * a disclosure. */
export function customerScope(req: FastifyRequest): string {
  const id = claims(req).customerId;
  if (!id) throw new PermissionDeniedError("This token carries no customer scope");
  return id;
}

/** The partner id every partner route scopes on. Same reasoning as
 * `customerScope`. */
export function partnerScope(req: FastifyRequest): string {
  const id = claims(req).partnerId;
  if (!id) throw new PermissionDeniedError("This token carries no partner scope");
  return id;
}
