"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, formatPaise } from "@/lib/api";
import { useSurfaceGuard } from "@/lib/useAuthGuard";

interface BookingDetail {
  id: string;
  status: string;
  registeredAt: string | null;
  plotAmountSnapshotPaise: string;
  registrationAmountSnapshotPaise: string;
  totalCustomerAmountSnapshotPaise: string;
  roiEligible: boolean;
  paidPaise: string;
  outstandingPaise: string;
  plot: { plotNumber: string; sizeGaj: number; project: { name: string } };
  paymentSchedules: { installmentNumber: number; dueDate: string; amountDuePaise: string; status: string }[];
}

interface Payment {
  id: string;
  amountPaise: string;
  method: string;
  status: string;
  collectedAt: string | null;
  createdAt: string;
}

interface RoiEntry {
  monthNumber: number;
  amountPaise: string;
  status: string;
}
interface RoiSummary {
  entries: RoiEntry[];
  monthsCredited: number;
  monthsRemaining: number;
  totalRoiGeneratedPaise: string;
}

export default function BookingDetailPage() {
  const ready = useSurfaceGuard("customer");
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [roi, setRoi] = useState<RoiSummary | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.get<BookingDetail>(`/api/v1/customer/bookings/${params.id}`).then(setBooking);
    api.get<Payment[]>(`/api/v1/customer/bookings/${params.id}/payments`).then(setPayments);
  }, [ready, params.id]);

  useEffect(() => {
    if (!ready || !booking?.roiEligible) return;
    api
      .get<RoiSummary>(`/api/v1/customer/bookings/${params.id}/roi`)
      .then(setRoi)
      .catch(() => setRoi(null));
  }, [ready, booking?.roiEligible, params.id]);

  if (!ready || !booking) return null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/customer/dashboard" className="text-sm text-brand-700 hover:underline">
        ← My Bookings
      </Link>

      <h1 className="mt-2 text-2xl font-bold text-ink-900">
        {booking.plot.project.name} — Plot {booking.plot.plotNumber}
      </h1>
      <div className="mt-2 flex gap-2">
        <span className="status-pill status-ELIGIBLE">{booking.status.replace(/_/g, " ")}</span>
        <span className="status-pill status-PENDING">Registry: {booking.registeredAt ? "Complete" : "Pending"}</span>
      </div>

      <section className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-brand-100 p-5 sm:grid-cols-4">
        <Stat label="Plot Amount" value={formatPaise(booking.plotAmountSnapshotPaise)} />
        <Stat label="Registration" value={formatPaise(booking.registrationAmountSnapshotPaise)} />
        <Stat label="Paid" value={formatPaise(booking.paidPaise)} />
        <Stat label="Outstanding" value={formatPaise(booking.outstandingPaise)} highlight />
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink-900">Payment Schedule</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-ink-700">
            <tr>
              <th className="pb-2">#</th>
              <th className="pb-2">Due Date</th>
              <th className="pb-2">Amount</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {booking.paymentSchedules
              .sort((a, b) => a.installmentNumber - b.installmentNumber)
              .map((s) => (
                <tr key={s.installmentNumber} className="border-t border-brand-100">
                  <td className="py-2">{s.installmentNumber}</td>
                  <td className="py-2">{new Date(s.dueDate).toLocaleDateString("en-IN")}</td>
                  <td className="py-2">{formatPaise(s.amountDuePaise)}</td>
                  <td className="py-2">
                    <span className={`status-pill status-${s.status === "PAID" ? "PAID" : "PENDING"}`}>{s.status}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-ink-900">Payment History</h2>
        {payments.length === 0 && <p className="mt-2 text-sm text-ink-700">No payments recorded yet.</p>}
        <ul className="mt-3 space-y-2">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-xl border border-brand-100 px-4 py-2 text-sm">
              <span>{p.method.replace(/_/g, " ")}</span>
              <span>{formatPaise(p.amountPaise)}</span>
              <span className={`status-pill status-${p.status === "COLLECTED" ? "PAID" : "PENDING"}`}>{p.status}</span>
            </li>
          ))}
        </ul>
      </section>

      {booking.roiEligible && roi && (
        <section className="mt-8 rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="text-lg font-bold text-ink-900">Cash Plot ROI</h2>
          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <Stat label="Months Credited" value={String(roi.monthsCredited)} />
            <Stat label="Months Remaining" value={String(roi.monthsRemaining)} />
            <Stat label="Total ROI Generated" value={formatPaise(roi.totalRoiGeneratedPaise)} />
          </div>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-ink-700">
              <tr>
                <th className="pb-2">Month</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {roi.entries.map((e) => (
                <tr key={e.monthNumber} className="border-t border-brand-100">
                  <td className="py-1.5">{e.monthNumber}</td>
                  <td className="py-1.5">{formatPaise(e.amountPaise)}</td>
                  <td className="py-1.5">
                    <span className="status-pill status-ELIGIBLE">{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-ink-700">{label}</p>
      <p className={`font-semibold ${highlight ? "text-brand-700" : "text-ink-900"}`}>{value}</p>
    </div>
  );
}
