"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api, setSession, ApiError } from "@/lib/api";
import { homeForRole, labelForRole } from "@/lib/roles";
import { Button, Card, ErrorState, makeReferenceId } from "@/components/ui/primitives";
import { Wordmark } from "@/components/ui/nav";

/** One sign-in for everyone.
 *
 * There is deliberately no "I am a customer / partner / admin" selector. The
 * server already knows what someone is the moment their password is verified,
 * so asking them to declare it first adds a step whose only possible outcome
 * is being wrong. We sign them in, read the role off the response, and open
 * the right surface. */
function SignIn() {
  const router = useRouter();
  const params = useSearchParams();
  /** Set when a guard bounced someone here from a protected page — we send
   * them back there afterwards instead of dumping them on a dashboard. */
  const nextParam = params?.get("next") ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; reference?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Only follow `next` when it is a same-site path. An absolute URL here
   * would turn the login page into an open redirect. */
  function safeNext(): string | null {
    if (!nextParam) return null;
    if (!nextParam.startsWith("/") || nextParam.startsWith("//")) return null;
    return nextParam;
  }

  function land(role: string) {
    router.push(safeNext() ?? homeForRole(role));
  }

  function describe(err: unknown) {
    if (err instanceof ApiError) {
      // A real answer from the server — show what it said.
      return { message: err.message };
    }
    // fetch threw: the request never got a response. Saying "invalid email or
    // password" here would be a lie, and it is exactly the lie that cost hours
    // of debugging when the API was down.
    return {
      message: "Could not reach MERA MAKAN. Check your connection and try again in a moment.",
      reference: makeReferenceId(),
    };
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken?: string; role?: string; pendingTwoFactorToken?: string }>(
        "/api/v1/auth/password/login",
        { email, password }
      );
      if (res.pendingTwoFactorToken) {
        setPendingToken(res.pendingTwoFactorToken);
      } else if (res.accessToken && res.role) {
        setSession(res.accessToken, res.role);
        land(res.role);
      }
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string; role: string }>("/api/v1/auth/2fa/verify", {
        pendingTwoFactorToken: pendingToken,
        totpCode: totp,
      });
      setSession(res.accessToken, res.role);
      land(res.role);
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-navy-900/15 bg-white px-3.5 py-3 text-[15px] " +
    "placeholder:text-navy-300 focus:border-navy-400 outline-none transition";

  return (
    <main className="flex min-h-screen flex-col bg-navy-900">
      <div className="shell py-8">
        <Wordmark tone="ivory" />
      </div>

      <div className="flex flex-1 items-start justify-center px-gutter pb-16">
        <div className="w-full max-w-[400px]">
          <Card className="p-7 sm:p-8">
            {!pendingToken ? (
              <>
                <h1 className="font-display text-2xl font-bold text-navy-900">Sign in</h1>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">
                  Use the email and password given to you by MERA MAKAN. We&apos;ll take you to the right place.
                </p>

                <form onSubmit={submitPassword} className="mt-7 space-y-5">
                  <div>
                    <label htmlFor="email" className="text-sm font-medium text-navy-800">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={field}
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="text-sm font-medium text-navy-800">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${field} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        aria-pressed={showPassword}
                        className="absolute inset-y-0 right-0 mt-1.5 flex w-12 items-center justify-center text-navy-400 transition hover:text-navy-700"
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-danger">
                      {error.message}
                      {error.reference && (
                        <span className="mt-1 block text-caption text-navy-500">
                          Reference <span className="tnum select-all font-semibold">{error.reference}</span>
                        </span>
                      )}
                    </p>
                  )}

                  <Button type="submit" size="lg" disabled={busy} className="w-full">
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h1 className="font-display text-2xl font-bold text-navy-900">Verification</h1>
                <p className="mt-2 text-sm leading-relaxed text-navy-500">
                  Enter the 6-digit code from your authenticator app.
                </p>

                <form onSubmit={submitTotp} className="mt-7 space-y-5">
                  <div>
                    <label htmlFor="totp" className="text-sm font-medium text-navy-800">
                      Authentication code
                    </label>
                    <input
                      id="totp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      autoFocus
                      value={totp}
                      onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                      className={`${field} tnum text-center text-xl tracking-[0.5em]`}
                      placeholder="000000"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-danger">
                      {error.message}
                    </p>
                  )}

                  <Button type="submit" size="lg" disabled={busy} className="w-full">
                    {busy ? "Verifying…" : "Verify"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingToken(null);
                      setTotp("");
                      setError(null);
                    }}
                    className="w-full text-sm font-medium text-navy-500 transition hover:text-navy-800"
                  >
                    Back to sign in
                  </button>
                </form>
              </>
            )}
          </Card>

          <p className="mt-6 text-center text-caption text-navy-200">
            Accounts are created by MERA MAKAN. Contact your representative if you need access.
          </p>
        </div>
      </div>
    </main>
  );
}

function Eye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.04 12.32a1 1 0 0 1 0-.64C3.42 7.5 7.36 4.5 12 4.5s8.57 3 9.96 7.18a1 1 0 0 1 0 .64C20.58 16.49 16.64 19.5 12 19.5s-8.57-3-9.96-7.18Z"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-5 w-5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.22A10.48 10.48 0 0 0 1.93 12c1.3 4.34 5.31 7.5 10.07 7.5 1 0 1.95-.14 2.86-.4M6.23 6.23A10.45 10.45 0 0 1 12 4.5c4.76 0 8.77 3.16 10.07 7.5a10.52 10.52 0 0 1-4.3 5.77M6.23 6.23 3 3m3.23 3.23 3.65 3.65m7.89 7.89L21 21m-3.23-3.23-3.65-3.65m0 0a3 3 0 1 0-4.24-4.24"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-navy-900" />}>
      <SignIn />
    </Suspense>
  );
}
