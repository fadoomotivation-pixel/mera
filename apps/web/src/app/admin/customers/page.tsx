"use client";

import { useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { AdminNav } from "../AdminNav";

interface Customer {
  id: string;
  name: string;
  address: string | null;
  createdAt: string;
  user: { email: string | null; phone: string | null; status: string };
}

export default function AdminCustomersPage() {
  const authOk = useAdminAuthGuard();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null);

  function reload() {
    api.get<Customer[]>("/api/v1/admin/customers").then(setCustomers);
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
      await api.post("/api/v1/admin/customers", {
        name: form.get("name"),
        email,
        password,
        phone: form.get("phone") || undefined,
      });
      setLastCreated({ email, password });
      setShowForm(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create customer");
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
          <h1 className="text-2xl font-bold text-ink-900">Customers</h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? "Cancel" : "+ Create Customer Login"}
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-700">
          No SMS gateway is configured, so customers log in with an email + password you set here — hand
          the credentials to them directly (WhatsApp, call, in person).
        </p>

        {lastCreated && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            Created. Login: <strong>{lastCreated.email}</strong> / <strong>{lastCreated.password}</strong> — share
            this with the customer now; it is not shown again.
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
              {busy ? "Creating…" : "Create Customer Login"}
            </button>
          </form>
        )}

        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-ink-700">
            <tr>
              <th className="pb-2">Name</th>
              <th className="pb-2">Email</th>
              <th className="pb-2">Phone</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {customers?.map((c) => (
              <tr key={c.id} className="border-t border-brand-100">
                <td className="py-2">{c.name}</td>
                <td className="py-2">{c.user.email ?? "—"}</td>
                <td className="py-2">{c.user.phone ?? "—"}</td>
                <td className="py-2">
                  <span className="status-pill status-ELIGIBLE">{c.user.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
