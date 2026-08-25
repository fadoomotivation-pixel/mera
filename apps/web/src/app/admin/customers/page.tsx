"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { ADMIN_NAV_GROUPS } from "@/components/portal/nav-items";
import { RecordList, RecordListSkeleton } from "@/components/portal/RecordList";
import { Field, Input, FormCard, FormError, CredentialNotice } from "@/components/portal/Form";
import { Button, EmptyState } from "@/components/ui/primitives";

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

  const reload = useCallback(() => {
    api.get<Customer[]>("/api/v1/admin/customers").then(setCustomers).catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    if (authOk) reload();
  }, [authOk, reload]);

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
      setError(
        err instanceof ApiError
          ? err.message
          : "The login could not be created. Nothing was saved — check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell navGroups={ADMIN_NAV_GROUPS}>
      <PageHead
        title="Customers"
        lead="No SMS gateway is configured, so customers sign in with an email and a password you set here. Hand the credentials over directly."
        action={
          <Button variant={showForm ? "outline" : "primary"} onClick={() => setShowForm((s) => !s)} className="w-full sm:w-auto">
            {showForm ? "Cancel" : "Create login"}
          </Button>
        }
      />

      {lastCreated && (
        <CredentialNotice
          lines={[
            { label: "Email", value: lastCreated.email },
            { label: "Password", value: lastCreated.password },
          ]}
          onDismiss={() => setLastCreated(null)}
        />
      )}

      {showForm && (
        <FormCard title="Create customer login" onSubmit={onSubmit}>
          <Field label="Full name">
            <Input name="name" required autoComplete="off" />
          </Field>
          <Field label="Email" hint="This is what they type to sign in.">
            <Input name="email" type="email" inputMode="email" required autoComplete="off" />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters. Shown once, on the next screen.">
            <Input name="password" required minLength={8} autoComplete="new-password" />
          </Field>
          <Field label="Phone">
            <Input name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="Optional" />
          </Field>

          {error && <FormError>{error}</FormError>}

          <Button type="submit" disabled={busy} size="lg" className="w-full sm:w-auto">
            {busy ? "Creating…" : "Create login"}
          </Button>
        </FormCard>
      )}

      {customers === null ? (
        <RecordListSkeleton />
      ) : customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          body="Create a login for a customer and they can follow their own booking, payments and documents from their phone."
          action={<Button onClick={() => setShowForm(true)}>Create login</Button>}
        />
      ) : (
        <RecordList
          items={customers.map((c) => ({
            id: c.id,
            title: c.name,
            subtitle: c.user.email ?? "No email on record",
            status: c.user.status,
            fields: [
              { label: "Phone", value: c.user.phone ?? "—" },
              { label: "Added", value: new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
            ],
          }))}
        />
      )}
    </PortalShell>
  );
}
