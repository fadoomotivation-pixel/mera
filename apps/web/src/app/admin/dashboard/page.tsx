"use client";

import { useEffect, useState } from "react";
import { api, formatPaise } from "@/lib/api";
import { useAdminAuthGuard } from "@/lib/useAuthGuard";
import { AdminNav } from "../AdminNav";

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

  useEffect(() => {
    if (!authOk) return;
    api.get<Dashboard>("/api/v1/admin/dashboard").then(setData);
  }, [authOk]);

  if (!authOk || !data) return null;

  return (
    <>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-ink-900">CEO Dashboard</h1>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Total Sales" value={formatPaise(data.totalSalesPaise)} />
          <Kpi label="Gross Bookings" value={String(data.grossBookingCount)} />
          <Kpi label="Fully Collected" value={String(data.collectedBookings)} />
          <Kpi label="Customers / Partners" value={`${data.customerCount} / ${data.partnerCount}`} />
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi label="Referral Liability" value={formatPaise(data.referralLiabilityPaise)} />
          <Kpi label="Balance Sheet Liability" value={formatPaise(data.balanceSheetLiabilityPaise)} />
          <Kpi label="Royalty Pool (cumulative)" value={formatPaise(data.royaltyPoolTotalPaise)} />
          <Kpi label="Reward Payouts (cumulative)" value={formatPaise(data.rewardPayoutTotalPaise)} />
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink-900">Payouts by Status</h2>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-ink-700">
              <tr>
                <th className="pb-2">Status</th>
                <th className="pb-2">Count</th>
                <th className="pb-2">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.payoutsByStatus.map((row) => (
                <tr key={row.status} className="border-t border-brand-100">
                  <td className="py-2">
                    <span className={`status-pill status-${row.status}`}>{row.status}</span>
                  </td>
                  <td className="py-2">{row._count}</td>
                  <td className="py-2">{formatPaise(row._sum.netAmountPaise ?? "0")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </>
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
