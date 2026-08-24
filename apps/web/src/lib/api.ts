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

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
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
