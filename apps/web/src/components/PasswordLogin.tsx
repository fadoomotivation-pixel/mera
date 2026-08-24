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
  const [showPassword, setShowPassword] = useState(false);
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
      // Distinguish a real "wrong credentials" response from the API
      // (ApiError) from a network/deployment failure (fetch threw before
      // getting a response at all) — showing "Invalid email or password"
      // for the latter is actively misleading when the real problem is
      // the API being unreachable.
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not reach MERA MAKAN. Check your connection and try again in a moment.");
      }
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
          <div className="relative mt-1">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              type={showPassword ? "text" : "password"}
              className="w-full rounded-lg border border-brand-200 px-3 py-2 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-700 hover:text-ink-900"
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
