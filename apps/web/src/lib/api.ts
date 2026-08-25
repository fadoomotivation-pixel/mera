/**
 * Thin fetch wrapper for the MERA MAKAN API. All financial figures returned
 * by the API are pre-computed server-side and arrive as paise strings — this
 * client never recomputes a commission, ROI, royalty, or reward amount; it
 * only formats what the backend already decided (docs/04-api-contract.md).
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "mm_access_token";
const ROLE_KEY = "mm_role";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(accessToken: string, role: string) {
  window.localStorage.setItem(TOKEN_KEY, accessToken);
  window.localStorage.setItem(ROLE_KEY, role);
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ROLE_KEY);
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
}

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const REFRESH_PATH = "/api/v1/auth/refresh";

/* ─────────────────────────── Session renewal ───────────────────────────
 *
 * The access token lives 15 minutes. The API has always issued a 30-day
 * refresh token alongside it and exposed /auth/refresh to trade one for a
 * fresh access token — but this client never called it. So every session
 * died fifteen minutes after sign-in and the screen said "Invalid or expired
 * access token", which reads like a broken product rather than a normal
 * expiry. Half a session system is worse than none: the user is logged out
 * on a timer while a perfectly good refresh token sits unused in a cookie.
 *
 * Renewal is single-flight. A dashboard fires several requests at once, and
 * they will all get a 401 within milliseconds of each other; without this,
 * each would start its own refresh, and because the server rotates the
 * refresh token on every use, the later ones would present an
 * already-revoked token and be logged out. One refresh, shared by all
 * waiters. */
let refreshInFlight: Promise<string | null> | null = null;

async function renewAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}${REFRESH_PATH}`, { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      const body = await res.json().catch(() => null);
      const token: string | null = body?.accessToken ?? null;
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      return token;
    } catch {
      // Network failure, not an expired session. Returning null sends the
      // caller to sign in, which is the safe direction to be wrong in.
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** Session is over: clear it and send them to sign in, carrying where they
 * were so they land back there instead of on a generic dashboard. */
function endSession() {
  clearSession();
  if (typeof window === "undefined") return;
  const here = window.location.pathname + window.location.search;
  if (window.location.pathname !== "/login") {
    window.location.replace(`/login?next=${encodeURIComponent(here)}`);
  }
}

async function request<T>(path: string, opts: RequestInit = {}, allowRenew = true): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });

  // An expired access token is an ordinary event, not an error to show
  // someone. Renew once and replay the request; only if renewal fails is
  // this actually the end of the session.
  if (res.status === 401 && allowRenew && path !== REFRESH_PATH) {
    const renewed = await renewAccessToken();
    if (renewed) return request<T>(path, opts, false);
    endSession();
    throw new ApiError(401, "SESSION_EXPIRED", "Your session has ended. Please sign in again.");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: "UNKNOWN", message: res.statusText } }));
    throw new ApiError(res.status, body.error?.code ?? "UNKNOWN", body.error?.message ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
};

/** Paise (string, as returned by the API) -> Indian-grouped ₹ display string. */
export function formatPaise(paise: string | number | undefined | null): string {
  if (paise === undefined || paise === null) return "—";
  const n = BigInt(paise);
  const rupees = n / 100n;
  const paiseRemainder = n % 100n;
  const rupeesStr = rupees.toString();
  const lastThree = rupeesStr.slice(-3);
  const rest = rupeesStr.slice(0, -3);
  const grouped = rest.length ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree : lastThree;
  return `₹${grouped}${paiseRemainder > 0n ? "." + paiseRemainder.toString().padStart(2, "0") : ""}`;
}
