"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, ApiError } from "@/lib/api";

/** Email+password login, shared by the Customer and Partner portals. Used
 * instead of the OTP flow because no SMS gateway is configured for this
 * deployment (see docs/01-business-rules-matrix.md §8 item 10) — the admin
 * creates each account's email+password directly (Admin → Customers /
 * Partners) and hands it to them. The OTP backend (auth/otp.service.ts,
 * POST /auth/otp/request|verify) is untouched and can be wired back in as
 * the primary flow once an SMS provider is set up; nothing here removes it. */
export function PasswordLogin({ title, redirectTo }: { title: string; redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; role: string }>("/api/v1/auth/password/login", { email, password });
      setSession(res.accessToken, res.role);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid email or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-2xl border border-brand-100 p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">MERA MAKAN</p>
      <h1 className="mt-1 text-xl font-bold text-ink-900">{title}</h1>
      <p className="mt-1 text-sm text-ink-700">
        Use the email and password given to you by MERA MAKAN.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            type="password"
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
