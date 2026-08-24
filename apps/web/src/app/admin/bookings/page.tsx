"use client";

import { useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api, formatPaise, ApiError } from "@/lib/api";
import { AdminNav } from "../AdminNav";

interface Plot {
  id: string;
  plotNumber: string;
  sizeGaj: number;
  plotAmountPaise: string;
  status: string;
}
interface Project {
  id: string;
  name: string;
  plots: Plot[];
}
interface Customer {
  id: string;
  name: string;
  user: { email: string | null };
}
interface Partner {
  id: string;
  name: string;
  partnerCode: string;
}
interface Booking {
  id: string;
  status: string;
  plotAmountSnapshotPaise: string;
  customer: { name: string };
  partner: { name: string } | null;
  plot: { plotNumber: string; project: { name: string } };
}

export default function AdminBookingsPage() {
  const authOk = useAdminAuthGuard();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reload() {
    api.get<Booking[]>("/api/v1/admin/bookings").then(setBookings);
  }

  useEffect(() => {
    if (!authOk) return;
    reload();
    api.get<Project[]>("/api/v1/admin/projects").then(setProjects);
    api.get<Customer[]>("/api/v1/admin/customers").then(setCustomers);
    api.get<Partner[]>("/api/v1/admin/partners").then(setPartners);
  }, [authOk]);

  const availablePlots = projects.find((p) => p.id === selectedProjectId)?.plots.filter((p) => p.status === "AVAILABLE") ?? [];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/admin/bookings", {
        plotId: form.get("plotId"),
        customerId: form.get("customerId"),
        partnerId: form.get("partnerId") || undefined,
      });
      setShowForm(false);
      reload();
      const refreshed = await api.get<Project[]>("/api/v1/admin/projects");
      setProjects(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create booking");
    } finally {
      setBusy(false);
    }
  }

  if (!authOk) return null;

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-ink-900">Bookings</h1>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-white"
          >
            {showForm ? "Cancel" : "+ New Booking"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-2xl border border-brand-100 p-5">
            <div>
              <label className="text-sm font-medium">Project</label>
              <select
                required
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Plot ({availablePlots.length} available)</label>
              <select name="plotId" required className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="">Select a plot</option>
                {availablePlots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.plotNumber} — {p.sizeGaj} Gaj — {formatPaise(p.plotAmountPaise)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Customer</label>
              <select name="customerId" required className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="">Select a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.user.email ? `(${c.user.email})` : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-700">
                No customer listed? Create one first on the Customers page.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Referring Partner (optional)</label>
              <select name="partnerId" className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="">No referring partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.partnerCode})
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={busy} className="rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? "Creating…" : "Create Booking"}
            </button>
          </form>
        )}

        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-ink-700">
            <tr>
              <th className="pb-2">Project / Plot</th>
              <th className="pb-2">Customer</th>
              <th className="pb-2">Partner</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings?.map((b) => (
              <tr key={b.id} className="border-t border-brand-100">
                <td className="py-2">
                  {b.plot.project.name} — {b.plot.plotNumber}
                </td>
                <td className="py-2">{b.customer.name}</td>
                <td className="py-2">{b.partner?.name ?? "—"}</td>
                <td className="py-2">{formatPaise(b.plotAmountSnapshotPaise)}</td>
                <td className="py-2">
                  <span className="status-pill status-ELIGIBLE">{b.status.replace(/_/g, " ")}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
