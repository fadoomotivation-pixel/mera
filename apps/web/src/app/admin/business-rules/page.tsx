"use client";

import { useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { AdminNav } from "../AdminNav";

interface RuleRow {
  key: string;
  label: string;
  currentValue: Record<string, unknown>;
  status: "FINAL" | "CONFIGURED" | "PENDING_CEO_APPROVAL";
  effectiveFrom: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  version: number;
}

const STATUS_STYLE: Record<string, string> = {
  FINAL: "bg-green-100 text-green-800",
  CONFIGURED: "bg-amber-100 text-amber-800",
  PENDING_CEO_APPROVAL: "bg-red-100 text-red-800",
};

export default function BusinessRulesPage() {
  const authOk = useAdminAuthGuard();
  const [rows, setRows] = useState<RuleRow[] | null>(null);

  useEffect(() => {
    if (!authOk) return;
    api.get<RuleRow[]>("/api/v1/admin/business-rules").then(setRows);
  }, [authOk]);

  if (!authOk) return null;

  const pendingCount = rows?.filter((r) => r.status === "PENDING_CEO_APPROVAL").length ?? 0;

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-bold text-ink-900">Settings → Business Rules</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-700">
          Every rule below is versioned with an effective date and approval status. A rule marked{" "}
          <strong>PENDING CEO APPROVAL</strong> was never silently guessed by the system — it has a
          documented conservative default (see docs/01-business-rules-matrix.md) but the payout engine
          refuses to move any payout depending on it past ELIGIBLE until the CEO approves it here.
        </p>

        {pendingCount > 0 && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>{pendingCount} rule{pendingCount > 1 ? "s" : ""}</strong> awaiting CEO approval. Production
            payouts depending on these are held at <strong>ELIGIBLE</strong> and cannot be paid.
          </div>
        )}

        <div className="mt-6 space-y-3">
          {rows === null && <p className="text-ink-700">Loading…</p>}
          {rows?.map((r) => (
            <div key={r.key} className="rounded-2xl border border-brand-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink-900">{r.label}</p>
                  <p className="text-xs text-ink-700">
                    v{r.version} · effective {new Date(r.effectiveFrom).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[r.status]}`}>
                  {r.status.replace(/_/g, " ")}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {Object.entries(r.currentValue).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-ink-700">{k}</dt>
                    <dd className="font-medium text-ink-900">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-ink-700">
                Last changed by user {r.createdByUserId.slice(0, 8)}… ·{" "}
                {r.approvedByUserId ? `Approved by ${r.approvedByUserId.slice(0, 8)}…` : "Not yet approved"}
              </p>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
