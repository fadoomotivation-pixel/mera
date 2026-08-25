"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { ADMIN_NAV_GROUPS } from "@/components/portal/nav-items";
import { Stat, StatGrid, StatGridSkeleton, Section, RecordList, RecordListSkeleton } from "@/components/portal/RecordList";
import { ErrorState, EmptyState, makeReferenceId } from "@/components/ui/primitives";
import { Money } from "@/components/ui/Money";

interface Dashboard {
  totalSalesPaise: string;
  grossBookingCount: number;
  collectedBookings: number;
  referralLiabilityPaise: string;
  balanceSheetLiabilityPaise: string;
  royaltyPoolTotalPaise: string;
  rewardPayoutTotalPaise: string;
  payoutsByStatus: { status: string; _count: number; _sum: { netAmountPaise: string | null } }[];
  customerCount: number;
  partnerCount: number;
}

export default function AdminDashboard() {
  const authOk = useAdminAuthGuard();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<{ message: string; ref: string } | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .get<Dashboard>("/api/v1/admin/dashboard")
      .then(setData)
      .catch((err) =>
        setError({
          message: err instanceof ApiError ? err.message : "The dashboard could not be loaded. Check your connection and try again.",
          ref: makeReferenceId(),
        })
      );
  }, []);

  useEffect(() => {
    if (authOk) load();
  }, [authOk, load]);

  const loading = !data && !error;

  return (
    <PortalShell navGroups={ADMIN_NAV_GROUPS}>
      <PageHead
        title="Today"
        lead="Everything below is computed by the API from posted ledger entries. Nothing on this screen is estimated."
      />

      {error && (
        <ErrorState
          title="Could not load the dashboard"
          body={error.message}
          referenceId={error.ref}
          onRetry={load}
          financialAssurance="No figures were changed. This screen only reads."
        />
      )}

      {/* ── Sales ─────────────────────────────────────────────────────── */}
      {loading ? (
        <StatGridSkeleton />
      ) : (
        data && (
          <StatGrid>
            <Stat label="Total sales" paise={data.totalSalesPaise} tone="navy" />
            <Stat label="Bookings" value={data.grossBookingCount} hint={`${data.collectedBookings} fully collected`} />
            <Stat label="Customers" value={data.customerCount} />
            <Stat label="Channel partners" value={data.partnerCount} />
          </StatGrid>
        )
      )}

      {/* ── Liability ─────────────────────────────────────────────────── */}
      {data && (
        <Section
          title="Outstanding liability"
          note="What the business owes partners on work already done. Each stream is shown on its own — these are never added into a single percentage."
        >
          <StatGrid>
            <Stat label="Referral" paise={data.referralLiabilityPaise} tone="gold" />
            <Stat label="Balance sheet" paise={data.balanceSheetLiabilityPaise} tone="gold" />
            <Stat label="Royalty pool" paise={data.royaltyPoolTotalPaise} hint="Cumulative" />
            <Stat label="Rewards" paise={data.rewardPayoutTotalPaise} hint="Cumulative" />
          </StatGrid>
        </Section>
      )}

      {/* ── Payouts ───────────────────────────────────────────────────── */}
      <Section
        title="Payouts by state"
        note="A payout only leaves the business at PAID. Every other state is money still held."
      >
        {loading ? (
          <RecordListSkeleton rows={3} />
        ) : data?.payoutsByStatus.length ? (
          <RecordList
            items={data.payoutsByStatus.map((row) => ({
              id: row.status,
              title: <Money paise={row._sum.netAmountPaise ?? "0"} size="sm" />,
              subtitle: `${row._count} payout${row._count === 1 ? "" : "s"}`,
              status: row.status,
            }))}
          />
        ) : (
          data && (
            <EmptyState
              title="No payouts yet"
              body="Payouts appear here once a commission, balance sheet balance, royalty allocation or reward becomes eligible."
            />
          )
        )}
      </Section>
    </PortalShell>
  );
}
