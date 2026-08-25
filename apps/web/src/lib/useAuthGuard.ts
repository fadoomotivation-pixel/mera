"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getRole } from "./api";
import { ADMIN_ROLES, surfaceForRole, type Surface } from "./roles";

/** Client-side guard: purely a UX nicety (redirect before a flash of empty
 * content). The real enforcement is server-side RBAC on every API call —
 * see docs/05-permission-matrix.md note #6.
 *
 * Everyone is bounced to the one sign-in page, carrying `next` so they land
 * back where they were aiming instead of on a generic dashboard. */
function bounce(router: ReturnType<typeof useRouter>) {
  const here = typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
  router.replace(here ? `/login?next=${encodeURIComponent(here)}` : "/login");
}

/** Guards a surface rather than a single role, so the partner portal accepts
 * CHANNEL_PARTNER and the admin console accepts any of the five admin roles
 * without each page restating the list. */
export function useSurfaceGuard(surface: Surface) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const role = getRole();
    if (!token || surfaceForRole(role) !== surface) {
      bounce(router);
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

/** @deprecated Prefer `useSurfaceGuard`. Retained so existing pages keep
 * compiling while they migrate; `loginPath` is ignored — there is one sign-in
 * page now and hardcoded per-portal login paths are exactly what caused
 * people to be told "invalid" at the wrong door. */
export function useAuthGuard(requiredRole: string, _loginPath?: string) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const role = getRole();
    if (!token || role !== requiredRole) {
      bounce(router);
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

/** Accepts any of the five admin roles — the per-action role check still
 * happens server-side. */
export function useAdminAuthGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    const role = getRole();
    if (!token || !role || !(ADMIN_ROLES as string[]).includes(role)) {
      bounce(router);
      return;
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

/** Signs out and returns to the single sign-in page. One helper so every
 * surface clears the session identically. */
export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("mm_access_token");
  window.localStorage.removeItem("mm_role");
  window.location.href = "/login";
}
