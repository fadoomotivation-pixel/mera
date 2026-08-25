"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useSurfaceGuard } from "@/lib/useAuthGuard";
import { PortalShell, PageHead } from "@/components/portal/PortalShell";
import { CUSTOMER_NAV } from "@/components/portal/nav-items";
import { RecordList, RecordListSkeleton } from "@/components/portal/RecordList";
import { EmptyState, ButtonLink } from "@/components/ui/primitives";

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

  return (
    <PortalShell nav={CUSTOMER_NAV}>
      <PageHead
        title="My property"
        lead={bookings?.length === 1 ? undefined : "Tap a plot to see its payment plan, what has been paid and what is still due."}
      />

      {bookings === null ? (
        <RecordListSkeleton rows={2} />
      ) : bookings.length === 0 ? (
        <EmptyState
          title="No plot yet"
          body="Once your booking is recorded it appears here, with the full payment plan and every receipt against it."
          action={<ButtonLink href="/" variant="outline">See the project</ButtonLink>}
        />
      ) : (
        <RecordList
          items={bookings.map((b) => ({
            id: b.id,
            href: `/customer/bookings/${b.id}`,
            title: `${b.plot.project.name} · Plot ${b.plot.plotNumber}`,
            subtitle: `${b.plot.sizeGaj} Gaj · booked ${new Date(b.bookingDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}`,
            status: b.status,
            fields: [
              { label: "Plot amount", paise: b.plotAmountSnapshotPaise },
              { label: "Registration", paise: b.registrationAmountSnapshotPaise },
              { label: "Total", paise: b.totalCustomerAmountSnapshotPaise, emphasis: true },
            ],
            footnote: b.roiEligible ? "Cash Plot ROI applies to this plot" : undefined,
          }))}
        />
      )}
    </PortalShell>
  );
}
