"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { ADMIN_NAV_GROUPS } from "@/components/portal/nav-items";
import { RecordList, RecordListSkeleton } from "@/components/portal/RecordList";
import { Field, Input, FormCard, FormError, CredentialNotice } from "@/components/portal/Form";
import { Button, EmptyState } from "@/components/ui/primitives";

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

  const reload = useCallback(() => {
    api.get<Partner[]>("/api/v1/admin/partners").then(setPartners).catch(() => setPartners([]));
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
        title="Channel partners"
        lead="Each partner gets a code. Every booking they refer is attributed to that code, and that attribution decides who earns on it."
        action={
          <Button variant={showForm ? "outline" : "primary"} onClick={() => setShowForm((s) => !s)} className="w-full sm:w-auto">
            {showForm ? "Cancel" : "Create login"}
          </Button>
        }
      />

      {lastCreated && (
        <CredentialNotice
          lines={[
            { label: "Partner code", value: lastCreated.partnerCode },
            { label: "Email", value: lastCreated.email },
            { label: "Password", value: lastCreated.password },
          ]}
          onDismiss={() => setLastCreated(null)}
        />
      )}

      {showForm && (
        <FormCard title="Create partner login" onSubmit={onSubmit}>
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

      {partners === null ? (
        <RecordListSkeleton />
      ) : partners.length === 0 ? (
        <EmptyState
          title="No partners yet"
          body="Create a login for a channel partner and they can follow their own referrals, balance sheet, royalty and rewards."
          action={<Button onClick={() => setShowForm(true)}>Create login</Button>}
        />
      ) : (
        <RecordList
          items={partners.map((p) => ({
            id: p.id,
            title: p.name,
            subtitle: p.user.email ?? "No email on record",
            status: p.user.status,
            fields: [
              { label: "Partner code", value: <span className="tnum">{p.partnerCode}</span>, emphasis: true },
              { label: "Joined", value: new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
            ],
          }))}
        />
      )}
    </PortalShell>
  );
}
