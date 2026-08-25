"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { useSurfaceGuard } from "@/lib/useAuthGuard";
import { PortalShell } from "@/components/portal/PortalShell";
import { CUSTOMER_NAV } from "@/components/portal/nav-items";
import { RecordList, RecordListSkeleton, Section, Stat, StatGrid } from "@/components/portal/RecordList";
import { Card, StatusPill, Progress, EmptyState } from "@/components/ui/primitives";
import { Money } from "@/components/ui/Money";

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

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export default function BookingDetailPage() {
  const ready = useSurfaceGuard("customer");
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [roi, setRoi] = useState<RoiSummary | null>(null);

  useEffect(() => {
    if (!ready) return;
    api.get<BookingDetail>(`/api/v1/customer/bookings/${params.id}`).then(setBooking).catch(() => {});
    api.get<Payment[]>(`/api/v1/customer/bookings/${params.id}/payments`).then(setPayments).catch(() => setPayments([]));
  }, [ready, params.id]);

  useEffect(() => {
    if (!ready || !booking?.roiEligible) return;
    api.get<RoiSummary>(`/api/v1/customer/bookings/${params.id}/roi`).then(setRoi).catch(() => setRoi(null));
  }, [ready, booking?.roiEligible, params.id]);

  return (
    <PortalShell nav={CUSTOMER_NAV}>
      <Link
        href="/customer/dashboard"
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-navy-500 transition hover:text-navy-900"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
          <path d="m14 6-6 6 6 6" />
        </svg>
        My property
      </Link>

      {!booking ? (
        <div className="mt-4 space-y-4" aria-hidden>
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-40 rounded-card" />
          <div className="skeleton h-32 rounded-card" />
        </div>
      ) : (
        <>
          <header className="mt-2">
            <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-navy-900 sm:text-display-md">
              {booking.plot.project.name}
            </h1>
            <p className="mt-1 text-navy-500">
              Plot {booking.plot.plotNumber} · {booking.plot.sizeGaj} Gaj
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusPill status={booking.status} />
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-navy-900/[0.06] px-2.5 py-1 text-xs font-semibold text-navy-600">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                Registry {booking.registeredAt ? "complete" : "pending"}
              </span>
            </div>
          </header>

          {/* ── The one number that matters, then the supporting ones ──── */}
          <Card tone="navy" className="mt-6 p-5 sm:p-7">
            <p className="text-caption text-navy-200">Still to pay</p>
            <p className="mt-1.5">
              <Money paise={booking.outstandingPaise} size="xl" tone={booking.outstandingPaise === "0" ? "onNavy" : "gold"} />
            </p>
            <div className="mt-5">
              <Progress
                tone="gold"
                value={Number(BigInt(booking.paidPaise) / 100n)}
                max={Number(BigInt(booking.totalCustomerAmountSnapshotPaise) / 100n)}
                label="Amount paid so far"
              />
              <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption text-navy-200">
                <span>
                  Paid <Money paise={booking.paidPaise} size="xs" tone="onNavy" />
                </span>
                <span>
                  of <Money paise={booking.totalCustomerAmountSnapshotPaise} size="xs" tone="onNavy" />
                </span>
              </div>
            </div>
          </Card>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
            <Stat label="Plot amount" paise={booking.plotAmountSnapshotPaise} />
            <Stat label="Registration" paise={booking.registrationAmountSnapshotPaise} />
          </div>

          {/* ── Payment plan ─────────────────────────────────────────── */}
          <Section title="Payment plan" note="Each instalment shows its due date and whether it has been received.">
            <RecordList
              items={[...booking.paymentSchedules]
                .sort((a, b) => a.installmentNumber - b.installmentNumber)
                .map((s) => ({
                  id: String(s.installmentNumber),
                  title: `Instalment ${s.installmentNumber}`,
                  subtitle: `Due ${shortDate(s.dueDate)}`,
                  status: s.status,
                  fields: [{ label: "Amount", paise: s.amountDuePaise, emphasis: true }],
                }))}
            />
          </Section>

          {/* ── Receipts ─────────────────────────────────────────────── */}
          <Section title="Payments received" note="Every payment recorded against this plot, newest first.">
            {payments === null ? (
              <RecordListSkeleton rows={2} />
            ) : payments.length === 0 ? (
              <EmptyState
                title="Nothing received yet"
                body="Payments appear here as soon as they are recorded against this plot."
              />
            ) : (
              <RecordList
                items={payments.map((p) => ({
                  id: p.id,
                  title: p.method.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()),
                  subtitle: shortDate(p.collectedAt ?? p.createdAt),
                  status: p.status,
                  fields: [{ label: "Amount", paise: p.amountPaise, emphasis: true }],
                }))}
              />
            )}
          </Section>

          {/* ── Cash Plot ROI ────────────────────────────────────────── */}
          {booking.roiEligible && roi && (
            <Section
              title="Cash Plot ROI"
              note="Credited monthly against this plot. Each month carries its own state — only a credited month is money you have."
            >
              <StatGrid>
                <Stat label="Months credited" value={roi.monthsCredited} />
                <Stat label="Months remaining" value={roi.monthsRemaining} />
                <Stat label="Total generated" paise={roi.totalRoiGeneratedPaise} tone="gold" />
              </StatGrid>
              <div className="mt-4">
                <RecordList
                  items={roi.entries.map((e) => ({
                    id: String(e.monthNumber),
                    title: `Month ${e.monthNumber}`,
                    status: e.status,
                    fields: [{ label: "Amount", paise: e.amountPaise, emphasis: true }],
                  }))}
                />
              </div>
            </Section>
          )}
        </>
      )}
    </PortalShell>
  );
}
