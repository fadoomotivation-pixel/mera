"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, ApiError } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken?: string; role?: string; pendingTwoFactorToken?: string }>(
        "/api/v1/auth/password/login",
        { email, password }
      );
      if (res.pendingTwoFactorToken) {
        setPendingToken(res.pendingTwoFactorToken);
      } else if (res.accessToken && res.role) {
        setSession(res.accessToken, res.role);
        router.push("/admin/dashboard");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify2fa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; role: string }>("/api/v1/auth/2fa/verify", {
        pendingTwoFactorToken: pendingToken,
        totpCode: totp,
      });
      setSession(res.accessToken, res.role);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid 2FA code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-2xl border border-ink-900/10 p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">MERA MAKAN</p>
      <h1 className="mt-1 text-xl font-bold text-ink-900">Admin / Management Console</h1>

      {!pendingToken ? (
        <form onSubmit={login} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} required type="password" className="mt-1 w-full rounded-lg border px-3 py-2" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-full bg-ink-900 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify2fa} className="mt-6 space-y-4">
          <p className="text-sm text-ink-700">Enter your 2FA authenticator code</p>
          <input value={totp} onChange={(e) => setTotp(e.target.value)} required maxLength={6} className="w-full rounded-lg border px-3 py-2 tracking-[0.3em]" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-full bg-ink-900 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}
    </div>
  );
}
