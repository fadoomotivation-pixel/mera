"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { ADMIN_NAV_GROUPS } from "@/components/portal/nav-items";
import { RecordList, RecordListSkeleton } from "@/components/portal/RecordList";
import { Field, Input, Select, FormCard, FormError } from "@/components/portal/Form";
import { Button, EmptyState } from "@/components/ui/primitives";
import { formatPaise } from "@/components/ui/Money";

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

  const reload = useCallback(() => {
    api.get<Booking[]>("/api/v1/admin/bookings").then(setBookings).catch(() => setBookings([]));
  }, []);

  useEffect(() => {
    if (!authOk) return;
    reload();
    api.get<Project[]>("/api/v1/admin/projects").then(setProjects).catch(() => {});
    api.get<Customer[]>("/api/v1/admin/customers").then(setCustomers).catch(() => {});
    api.get<Partner[]>("/api/v1/admin/partners").then(setPartners).catch(() => {});
  }, [authOk, reload]);

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
      setProjects(await api.get<Project[]>("/api/v1/admin/projects"));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "The booking could not be created. Nothing was saved — check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell navGroups={ADMIN_NAV_GROUPS}>
      <PageHead
        title="Bookings"
        lead="Every booking here holds a plot. Creating one moves the plot out of AVAILABLE immediately."
        action={
          <Button variant={showForm ? "outline" : "primary"} onClick={() => setShowForm((s) => !s)} className="w-full sm:w-auto">
            {showForm ? "Cancel" : "New booking"}
          </Button>
        }
      />

      {showForm && (
        <FormCard title="New booking" onSubmit={onSubmit}>
          <Field label="Project">
            <Select required value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Plot"
            hint={selectedProjectId ? `${availablePlots.length} available in this project` : "Choose a project first"}
          >
            <Select name="plotId" required disabled={!selectedProjectId}>
              <option value="">Select a plot</option>
              {availablePlots.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plotNumber} · {p.sizeGaj} Gaj · {formatPaise(p.plotAmountPaise)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Customer" hint="No customer listed? Create their login on the Customers page first.">
            <Select name="customerId" required>
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.user.email ? ` (${c.user.email})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Referring partner" hint="Leave empty for a direct sale. This decides who earns referral commission.">
            <Select name="partnerId">
              <option value="">No referring partner</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.partnerCode})
                </option>
              ))}
            </Select>
          </Field>

          {error && <FormError>{error}</FormError>}

          <Button type="submit" disabled={busy} size="lg" className="w-full sm:w-auto">
            {busy ? "Creating…" : "Create booking"}
          </Button>
        </FormCard>
      )}

      {bookings === null ? (
        <RecordListSkeleton />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          body="When a plot is booked for a customer it appears here, with the referring partner and the amount held at the time of booking."
          action={<Button onClick={() => setShowForm(true)}>New booking</Button>}
        />
      ) : (
        <RecordList
          items={bookings.map((b) => ({
            id: b.id,
            title: `${b.plot.project.name} · Plot ${b.plot.plotNumber}`,
            subtitle: b.customer.name,
            status: b.status,
            fields: [
              { label: "Partner", value: b.partner?.name ?? "Direct" },
              { label: "Plot amount", paise: b.plotAmountSnapshotPaise, emphasis: true },
            ],
          }))}
        />
      )}
    </PortalShell>
  );
}
