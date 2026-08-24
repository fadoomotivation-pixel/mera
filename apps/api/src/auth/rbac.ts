import type { UserRole } from "@prisma/client";
import { PermissionDeniedError } from "../domain/errors.js";
import type { AccessTokenClaims } from "./token.service.js";

/**
 * Server-side RBAC. This is the ONLY place a request's role is checked
 * against a resource's requirements — see docs/05-permission-matrix.md.
 * The frontend also hides nav items per role, but purely as a UX nicety;
 * every route handler calls one of these before touching data.
 */
export function requireRole(claims: AccessTokenClaims, ...allowed: UserRole[]): void {
  if (!allowed.includes(claims.role)) {
    throw new PermissionDeniedError(`Role ${claims.role} is not permitted; requires one of [${allowed.join(", ")}]`);
  }
}

/** Ownership scoping helper: throws unless the claims' own customerId
 * matches the resource's customerId. Callers should use this to build a
 * `WHERE customerId = ...` query clause, never to filter an already-fetched
 * list (see docs/05-permission-matrix.md enforcement note #2). */
export function requireOwnCustomer(claims: AccessTokenClaims, resourceCustomerId: string): void {
  if (claims.role !== "CUSTOMER" || claims.customerId !== resourceCustomerId) {
    throw new PermissionDeniedError("Not your booking");
  }
}

export function requireOwnPartner(claims: AccessTokenClaims, resourcePartnerId: string): void {
  if (claims.role !== "CHANNEL_PARTNER" || claims.partnerId !== resourcePartnerId) {
    throw new PermissionDeniedError("Not your data");
  }
}

export const ADMIN_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN", "OPERATIONS_ADMIN", "COMPLIANCE_AUDIT", "SUPPORT"];
export const FINANCIAL_WRITE_ROLES: UserRole[] = ["SUPER_ADMIN", "FINANCE_ADMIN"];
