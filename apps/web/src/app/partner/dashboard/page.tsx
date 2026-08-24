"use client";

import { useEffect, useState } from "react";
import { api, formatPaise } from "@/lib/api";
import { useSurfaceGuard, signOut } from "@/lib/useAuthGuard";
import { StatusPill } from "@/components/StatusPill";

interface Dashboard {
  totalPersonalSalesPaise: string;
  totalBookings: number;
  referral: { grossPaise: string; netPaise: string; entryCount: number };
  balanceSheet: { currentCarryForwardPaise: string; payoutStatus: string };
  currentTier: { tierCode: string; tierName: string; royaltyStartDate: string; royaltyEndDate: string } | null;
  rewardsUnlocked: { rewardName: string; amountPaise: string; status: string }[];
  payouts: { id: string; type: string; status: string; netAmountPaise: string }[];
}

export default function PartnerDashboard() {
  const ready = useSurfaceGuard("partner");
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.get<Dashboard>("/api/v1/partner/dashboard").then(setData);
  }, [ready]);

  if (!ready || !data) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">MERA MAKAN</p>
          <h1 className="text-2xl font-bold text-ink-900">Partner Dashboard</h1>
        </div>
        <button
          onClick={() => {
            signOut();
          }}
          className="text-sm text-ink-700 hover:text-brand-700"
        >
          Log out
        </button>
      </div>

      {/* Top KPIs */}
      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Total Personal Sales" value={formatPaise(data.totalPersonalSalesPaise)} />
        <Kpi label="Bookings Referred" value={String(data.totalBookings)} />
        <Kpi label="Referral (net)" value={formatPaise(data.referral.netPaise)} />
        <Kpi label="Balance Sheet Carry Forward" value={formatPaise(data.balanceSheet.currentCarryForwardPaise)} />
      </section>

      {/* Five streams — each its own card, never combined into one % */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <StreamCard title="01 — Referral Bonus (10%)">
          <Row label="Gross" value={formatPaise(data.referral.grossPaise)} />
          <Row label="Net (after admin charge + TDS)" value={formatPaise(data.referral.netPaise)} />
          <Row label="Commission events" value={String(data.referral.entryCount)} />
        </StreamCard>

        <StreamCard title="03 — Balance Sheet (8%)">
          <p className="text-xs text-ink-700">INPUT → OUTPUT → BALANCE → CARRY FORWARD</p>
          <Row label="Current Carry Forward" value={formatPaise(data.balanceSheet.currentCarryForwardPaise)} />
          <Row
            label="Payout Status"
            value={data.balanceSheet.payoutStatus === "SCHEDULED" ? "Scheduled" : "Awaiting payout schedule configuration"}
          />
        </StreamCard>

        <StreamCard title="04 — Royalty">
          {data.currentTier ? (
            <>
              <Row label="Active Tier" value={`${data.currentTier.tierCode} · ${data.currentTier.tierName}`} />
              <Row
                label="Royalty Window"
                value={`${new Date(data.currentTier.royaltyStartDate).toLocaleDateString("en-IN")} → ${new Date(
                  data.currentTier.royaltyEndDate
                ).toLocaleDateString("en-IN")}`}
              />
            </>
          ) : (
            <p className="text-sm text-ink-700">No active royalty tier yet.</p>
          )}
        </StreamCard>

        <StreamCard title="05 — Rewards">
          {data.rewardsUnlocked.length === 0 ? (
            <p className="text-sm text-ink-700">No rewards unlocked yet.</p>
          ) : (
            data.rewardsUnlocked.map((r, i) => (
              <Row key={i} label={r.rewardName} value={formatPaise(r.amountPaise)} status={r.status} />
            ))
          )}
        </StreamCard>
      </div>

      {/* Payout history — every amount carries an explicit state */}
      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink-900">Payout History</h2>
        <p className="text-xs text-ink-700">
          Every figure above has a state (PENDING / ELIGIBLE / APPROVED / PROCESSING / PAID / HELD / REVERSED / CANCELLED).
          Nothing shown as &quot;estimated&quot; is treated as payable until it reaches PAID.
        </p>
        <div className="mt-4 space-y-2">
          {data.payouts.length === 0 && <p className="text-sm text-ink-700">No payouts yet.</p>}
          {data.payouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-brand-100 px-4 py-3 text-sm">
              <span className="font-medium">{p.type.replace(/_/g, " ")}</span>
              <span>{formatPaise(p.netAmountPaise)}</span>
              <StatusPill status={p.status} />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-brand-100 p-4">
      <p className="text-xs text-ink-700">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}

function StreamCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-brand-100 p-5">
      <h3 className="font-bold text-ink-900">{title}</h3>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, status }: { label: string; value: string; status?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ink-700">{label}</span>
      <span className="flex items-center gap-2 font-semibold text-ink-900">
        {value}
        {status && <StatusPill status={status} />}
      </span>
    </div>
  );
}
