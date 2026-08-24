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
