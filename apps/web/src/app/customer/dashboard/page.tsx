"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, formatPaise } from "@/lib/api";
import { useSurfaceGuard, signOut } from "@/lib/useAuthGuard";

interface Booking {
  id: string;
  status: string;
  bookingDate: string;
  plotAmountSnapshotPaise: string;
  registrationAmountSnapshotPaise: string;
  totalCustomerAmountSnapshotPaise: string;
  roiEligible: boolean;
  plot: { plotNumber: string; sizeGaj: number; project: { name: string } };
}

export default function CustomerDashboard() {
  const ready = useSurfaceGuard("customer");
  const [bookings, setBookings] = useState<Booking[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.get<Booking[]>("/api/v1/customer/bookings").then(setBookings).catch(() => setBookings([]));
  }, [ready]);

  if (!ready) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-700">MERA MAKAN</p>
          <h1 className="text-2xl font-bold text-ink-900">My Bookings</h1>
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

      {bookings === null && <p className="mt-8 text-ink-700">Loading…</p>}
      {bookings?.length === 0 && <p className="mt-8 text-ink-700">No bookings yet.</p>}

      <div className="mt-8 space-y-4">
        {bookings?.map((b) => (
          <Link
            key={b.id}
            href={`/customer/bookings/${b.id}`}
            className="block rounded-2xl border border-brand-100 p-5 shadow-sm transition hover:border-brand-400"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-ink-900">
                  {b.plot.project.name} — Plot {b.plot.plotNumber}
                </p>
                <p className="text-sm text-ink-700">{b.plot.sizeGaj} Gaj</p>
              </div>
              <span className="status-pill status-ELIGIBLE">{b.status.replace(/_/g, " ")}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-ink-700">Plot Amount</p>
                <p className="font-semibold">{formatPaise(b.plotAmountSnapshotPaise)}</p>
              </div>
              <div>
                <p className="text-ink-700">Registration</p>
                <p className="font-semibold">{formatPaise(b.registrationAmountSnapshotPaise)}</p>
              </div>
              <div>
                <p className="text-ink-700">Total Outlay</p>
                <p className="font-semibold">{formatPaise(b.totalCustomerAmountSnapshotPaise)}</p>
              </div>
            </div>
            {b.roiEligible && <p className="mt-3 text-xs font-medium text-brand-700">Cash Plot ROI eligible →</p>}
          </Link>
        ))}
      </div>
    </main>
  );
}
