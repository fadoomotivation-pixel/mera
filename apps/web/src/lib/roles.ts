/** Role → destination mapping.
 *
 * This is the single place that decides where a person lands after signing in.
 * It exists because the alternative — each login page hardcoding its own
 * destination — is what allowed an admin to type their credentials into the
 * partner login and be told "invalid", when the credentials were fine and only
 * the door was wrong.
 *
 * The server is still the authority on what a role may *do*: every API route
 * runs `requireRole` server-side. Nothing here grants access. This only decides
 * which screen to open first, so a wrong value in localStorage changes what a
 * person sees, never what they can reach. */

export const ROLES = [
  "CUSTOMER",
  "CHANNEL_PARTNER",
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "OPERATIONS_ADMIN",
  "COMPLIANCE_AUDIT",
  "SUPPORT",
] as const;

export type Role = (typeof ROLES)[number];

/** The five admin-console roles. Kept in sync with `apps/api/src/auth/rbac.ts`
 * ADMIN_ROLES — if one changes, change both. */
export const ADMIN_ROLES: Role[] = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "OPERATIONS_ADMIN",
  "COMPLIANCE_AUDIT",
  "SUPPORT",
];

export type Surface = "customer" | "partner" | "admin";

export function surfaceForRole(role: string | null | undefined): Surface | null {
  if (!role) return null;
  if (role === "CUSTOMER") return "customer";
  if (role === "CHANNEL_PARTNER") return "partner";
  if ((ADMIN_ROLES as string[]).includes(role)) return "admin";
  return null;
}

/** Where this role's session begins. */
export function homeForRole(role: string | null | undefined): string {
  switch (surfaceForRole(role)) {
    case "customer":
      return "/customer/dashboard";
    case "partner":
      return "/partner/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      // An unrecognised role means the token is for something this build does
      // not know about. Send them back to sign in rather than guessing.
      return "/login";
  }
}

/** Human label for the signed-in role, shown in portal headers. */
export function labelForRole(role: string | null | undefined): string {
  const labels: Record<string, string> = {
    CUSTOMER: "Customer",
    CHANNEL_PARTNER: "Channel Partner",
    SUPER_ADMIN: "Super Admin",
    FINANCE_ADMIN: "Finance",
    OPERATIONS_ADMIN: "Operations",
    COMPLIANCE_AUDIT: "Compliance & Audit",
    SUPPORT: "Support",
  };
  return (role && labels[role]) || "Signed in";
}
