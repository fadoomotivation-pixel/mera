"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getRole } from "./api";

/** Client-side guard: purely a UX nicety (redirect before a flash of empty
 * content). The real enforcement is server-side RBAC on every API call —
 * see docs/05-permission-matrix.md note #6. */
export function useAuthGuard(requiredRole: string, loginPath: string) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const role = getRole();
    if (!token || role !== requiredRole) {
      router.replace(loginPath);
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

const ADMIN_ROLES = ["SUPER_ADMIN", "FINANCE_ADMIN", "OPERATIONS_ADMIN", "COMPLIANCE_AUDIT", "SUPPORT"];

/** Same UX-only guard as useAuthGuard, but accepts any of the 5 admin roles
 * — the actual per-action role check still happens server-side. */
export function useAdminAuthGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const role = getRole();
    if (!token || !role || !ADMIN_ROLES.includes(role)) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}
