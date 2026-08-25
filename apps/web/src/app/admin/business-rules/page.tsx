"use client";

import { useEffect, useState } from "react";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { ADMIN_NAV_GROUPS } from "@/components/portal/nav-items";
import { RecordListSkeleton } from "@/components/portal/RecordList";
import { Card } from "@/components/ui/primitives";

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

/** Rule status has its own vocabulary, distinct from the payout lifecycle, so
 * it gets its own pill rather than being forced through StatusPill. Each
 * carries a dot as well as a colour — status is never colour alone. */
const RULE_STATUS: Record<RuleRow["status"], { label: string; className: string }> = {
  FINAL: { label: "Final", className: "bg-success-soft text-success-strong" },
  CONFIGURED: { label: "Configured", className: "bg-navy-100 text-navy-700" },
  PENDING_CEO_APPROVAL: { label: "Pending CEO approval", className: "bg-warning-soft text-warning-strong" },
};

export default function BusinessRulesPage() {
  const authOk = useAdminAuthGuard();
  const [rows, setRows] = useState<RuleRow[] | null>(null);

  useEffect(() => {
    if (!authOk) return;
    api.get<RuleRow[]>("/api/v1/admin/business-rules").then(setRows).catch(() => setRows([]));
  }, [authOk]);

  const pending = rows?.filter((r) => r.status === "PENDING_CEO_APPROVAL") ?? [];

  return (
    <PortalShell navGroups={ADMIN_NAV_GROUPS}>
      <PageHead
        title="Business rules"
        lead="Every rule is versioned, dated and attributed. A rule the business has not decided yet was never quietly guessed — it is marked pending, and the payout engine refuses to move anything that depends on it past ELIGIBLE."
      />

      {pending.length > 0 && (
        <Card tone="gold" className="mb-6 p-4 sm:p-5">
          <p className="font-display text-base font-bold text-navy-900">
            {pending.length} rule{pending.length > 1 ? "s" : ""} awaiting a decision
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-navy-700">
            Payouts that depend on {pending.length > 1 ? "these" : "this"} are held at ELIGIBLE and cannot be paid. They are
            listed below with their conservative default.
          </p>
        </Card>
      )}

      {rows === null ? (
        <RecordListSkeleton rows={5} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const tone = RULE_STATUS[r.status];
            return (
              <li key={r.key}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-semibold leading-snug text-navy-900">{r.label}</p>
                      <p className="mt-1 text-caption text-navy-500">
                        Version {r.version} · effective{" "}
                        {new Date(r.effectiveFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span
                      className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${tone.className}`}
                    >
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {tone.label}
                    </span>
                  </div>

                  {/* Rule values are arbitrary keys; two columns at 360px, more
                      as the screen allows. break-words because some values are
                      long unbroken identifiers. */}
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                    {Object.entries(r.currentValue).map(([k, v]) => (
                      <div key={k} className="min-w-0">
                        <dt className="text-caption text-navy-400">{k}</dt>
                        <dd className="tnum mt-0.5 break-words text-sm font-medium text-navy-900">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>

                  <p className="mt-4 border-t border-navy-900/[0.08] pt-3 text-caption text-navy-500">
                    Set by {r.createdByUserId.slice(0, 8)}… ·{" "}
                    {r.approvedByUserId ? `approved by ${r.approvedByUserId.slice(0, 8)}…` : "not yet approved"}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </PortalShell>
  );
}
