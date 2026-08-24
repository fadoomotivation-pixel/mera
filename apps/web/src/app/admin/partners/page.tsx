"use client";

import { useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { AdminNav } from "../AdminNav";

interface Partner {
  id: string;
  name: string;
  partnerCode: string;
  createdAt: string;
  user: { email: string | null; phone: string | null; status: string };
}

export default function AdminPartnersPage() {
  const authOk = useAdminAuthGuard();
  const [partners, setPartners] = useState<Partner[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string; partnerCode: string } | null>(null);

  function reload() {
    api.get<Partner[]>("/api/v1/admin/partners").then(setPartners);
  }

  useEffect(() => {
    if (authOk) reload();
  }, [authOk]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    try {
      const created = await api.post<Partner>("/api/v1/admin/partners", {
        name: form.get("name"),
        email,
        password,
        phone: form.get("phone") || undefined,
      });
      setLastCreated({ email, password, partnerCode: created.partnerCode });
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create partner");
    } finally {
      setBusy(false);
    }
  }

  if (!authOk) return null;

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink-900">Channel Partners</h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? "Cancel" : "+ Create Partner Login"}
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-700">
          Same as customers — no SMS gateway, so partners log in with an email + password you set here.
        </p>

        {lastCreated && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            Created partner <strong>{lastCreated.partnerCode}</strong>. Login:{" "}
            <strong>{lastCreated.email}</strong> / <strong>{lastCreated.password}</strong> — share this now; it is
            not shown again.
          </div>
        )}

        {showForm && (
          <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl border border-brand-100 p-5">
            <div>
              <label className="text-sm font-medium">Name</label>
              <input name="name" required className="mt-1 w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Email (their login)</label>
              <input name="email" type="email" required className="mt-1 w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Temporary Password</label>
              <input name="password" required minLength={8} className="mt-1 w-full rounded-lg border px-3 py-2" />
            </div>
            <div>
              <label className="text-sm font-medium">Phone (optional)</label>
              <input name="phone" className="mt-1 w-full rounded-lg border px-3 py-2" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Creating…" : "Create Partner Login"}
            </button>
          </form>
        )}

        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-ink-700">
            <tr>
              <th className="pb-2">Code</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {partners?.map((p) => (
              <tr key={p.id} className="border-t border-brand-100">
                <td className="py-2 font-mono text-xs">{p.partnerCode}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2">{p.user.email ?? "—"}</td>
                <td className="py-2">
                  <span className="status-pill status-ELIGIBLE">{p.user.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
