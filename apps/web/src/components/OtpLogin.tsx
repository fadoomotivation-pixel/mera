"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, ApiError } from "@/lib/api";

export function OtpLogin({ title, redirectTo }: { title: string; redirectTo: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/api/v1/auth/otp/request", { phone, purpose: "LOGIN" });
      setStage("code");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.post<{ accessToken: string; role: string }>("/api/v1/auth/otp/verify", { phone, code });
      setSession(res.accessToken, res.role);
      router.push(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-24 max-w-sm rounded-2xl border border-brand-100 p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">MERA MAKAN</p>
      <h1 className="mt-1 text-xl font-bold text-ink-900">{title}</h1>

      {stage === "phone" ? (
        <form onSubmit={requestOtp} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium">Mobile Number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2"
              placeholder="+91XXXXXXXXXX"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-full bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "Sending…" : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="mt-6 space-y-4">
          <p className="text-sm text-ink-700">Enter the OTP sent to {phone}</p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={6}
            className="mt-1 w-full rounded-lg border border-brand-200 px-3 py-2 tracking-[0.3em]"
            placeholder="123456"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-full bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:opacity-60">
            {busy ? "Verifying…" : "Verify & Continue"}
          </button>
        </form>
      )}
    </div>
  );
}
