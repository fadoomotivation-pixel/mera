"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useSurfaceGuard } from "@/lib/useAuthGuard";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { PARTNER_NAV } from "@/components/portal/nav-items";
import { RecordList, RecordListSkeleton, Stat, StatGrid, StatGridSkeleton, Section } from "@/components/portal/RecordList";
import { Card, StatusPill, EmptyState, Eyebrow } from "@/components/ui/primitives";
import { Money } from "@/components/ui/Money";

interface Dashboard {
  totalPersonalSalesPaise: string;
  totalBookings: number;
  referral: { grossPaise: string; netPaise: string; entryCount: number };
  balanceSheet: { currentCarryForwardPaise: string; payoutStatus: string };
  currentTier: { tierCode: string; tierName: string; royaltyStartDate: string; royaltyEndDate: string } | null;
  rewardsUnlocked: { rewardName: string; amountPaise: string; status: string }[];
  payouts: { id: string; type: string; status: string; netAmountPaise: string }[];
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function PartnerDashboard() {
  const ready = useSurfaceGuard("partner");
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.get<Dashboard>("/api/v1/partner/dashboard").then(setData).catch(() => {});
  }, [ready]);

  return (
    <PortalShell nav={PARTNER_NAV}>
      <PageHead
        title="My earnings"
        lead="Each income stream stands on its own below. They are never added together into a single percentage — what you are paid on one has nothing to do with another."
      />

      {!data ? (
        <>
          <StatGridSkeleton />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="skeleton h-52 rounded-card" />
            <div className="skeleton h-52 rounded-card" />
          </div>
        </>
      ) : (
        <>
          <StatGrid>
            <Stat label="Personal sales" paise={data.totalPersonalSalesPaise} tone="navy" />
            <Stat label="Bookings referred" value={data.totalBookings} />
            <Stat label="Referral, net" paise={data.referral.netPaise} tone="gold" />
            <Stat label="Carry forward" paise={data.balanceSheet.currentCarryForwardPaise} />
          </StatGrid>

          {/* ── The streams. One card each, deliberately never summed. ──── */}
          <Section
            title="Income streams"
            note="Every figure carries a state. Nothing is payable until it reaches PAID."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <StreamCard number="01" title="Referral bonus">
                <Line label="Gross" paise={data.referral.grossPaise} />
                <Line label="Net, after admin charge and TDS" paise={data.referral.netPaise} emphasis />
                <Line label="Commission events" value={String(data.referral.entryCount)} />
              </StreamCard>

              <StreamCard number="03" title="Balance sheet">
                <p className="mb-3 text-caption leading-relaxed text-navy-500">
                  Input → Output → Balance → Carry forward. What is left after each closing carries into the next.
                </p>
                <Line label="Current carry forward" paise={data.balanceSheet.currentCarryForwardPaise} emphasis />
                <Line
                  label="Payout"
                  value={
                    data.balanceSheet.payoutStatus === "SCHEDULED"
                      ? "Scheduled"
                      : "Awaiting a payout schedule from the business"
                  }
                />
              </StreamCard>

              <StreamCard number="04" title="Royalty">
                {data.currentTier ? (
                  <>
                    <Line label="Active tier" value={`${data.currentTier.tierCode} · ${data.currentTier.tierName}`} emphasis />
                    <Line
                      label="Royalty window"
                      value={`${shortDate(data.currentTier.royaltyStartDate)} — ${shortDate(data.currentTier.royaltyEndDate)}`}
                    />
                  </>
                ) : (
                  <p className="py-2 text-sm leading-relaxed text-navy-500">
                    No royalty tier reached yet. Royalty starts the month after a tier is achieved.
                  </p>
                )}
              </StreamCard>

              <StreamCard number="05" title="Rewards">
                {data.rewardsUnlocked.length === 0 ? (
                  <p className="py-2 text-sm leading-relaxed text-navy-500">
                    No rewards unlocked yet. Each reward is tied to a milestone in your own sales — generation to generation.
                  </p>
                ) : (
                  data.rewardsUnlocked.map((r, i) => (
                    <Line key={i} label={r.rewardName} paise={r.amountPaise} status={r.status} emphasis />
                  ))
                )}
              </StreamCard>
            </div>
          </Section>

          {/* ── Payouts ──────────────────────────────────────────────── */}
          <Section
            title="Payout history"
            note="Pending, eligible, approved, processing, paid, held, reversed or cancelled — the state is always shown, and only PAID has left the business."
          >
            {data.payouts.length === 0 ? (
              <EmptyState
                title="No payouts yet"
                body="A payout is created once an amount you have earned becomes eligible. You will see it here at every stage, not only when it is paid."
              />
            ) : (
              <RecordList
                items={data.payouts.map((p) => ({
                  id: p.id,
                  title: p.type.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()),
                  status: p.status,
                  fields: [{ label: "Net amount", paise: p.netAmountPaise, emphasis: true }],
                }))}
              />
            )}
          </Section>
        </>
      )}
    </PortalShell>
  );
}

/** One income stream. The number is kept because partners refer to the streams
 * by number in training material — 01 referral, 03 balance sheet, and so on. */
function StreamCard({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col p-4 sm:p-5">
      <div className="flex items-baseline gap-2.5">
        <Eyebrow>{number}</Eyebrow>
        <h3 className="font-display text-lg font-bold text-navy-900">{title}</h3>
      </div>
      <div className="mt-4 flex-1 divide-y divide-navy-900/[0.06]">{children}</div>
    </Card>
  );
}

/** A labelled figure. Wraps to two lines rather than squeezing on a 360px
 * screen — a label truncated to "Net, after admin cha…" is worse than a
 * second line. */
function Line({
  label,
  value,
  paise,
  status,
  emphasis,
}: {
  label: string;
  value?: string;
  paise?: string;
  status?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
      <span className="min-w-0 text-sm text-navy-500">{label}</span>
      <span className="flex flex-wrap items-center gap-2">
        {paise !== undefined ? (
          <Money paise={paise} size="xs" tone={emphasis ? "gold" : "default"} />
        ) : (
          <span className={`text-sm ${emphasis ? "font-semibold text-navy-900" : "text-navy-800"}`}>{value}</span>
        )}
        {status && <StatusPill status={status} />}
      </span>
    </div>
  );
}
