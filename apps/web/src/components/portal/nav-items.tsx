import { Icons, type NavItem } from "@/components/ui/nav";

/** Navigation for the three signed-in surfaces, defined once.
 *
 * Only routes that exist are listed. A nav item pointing at a 404 is worse
 * than a missing one — it teaches people the console is broken. */

export const CUSTOMER_NAV: NavItem[] = [
  { href: "/customer/dashboard", label: "Property", icon: Icons.property },
];

export const PARTNER_NAV: NavItem[] = [
  { href: "/partner/dashboard", label: "Earnings", icon: Icons.chart },
];

export const ADMIN_NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: Icons.chart }],
  },
  {
    label: "Sales",
    items: [{ href: "/admin/bookings", label: "Bookings", icon: Icons.property }],
  },
  {
    label: "People",
    items: [
      { href: "/admin/customers", label: "Customers", icon: Icons.users },
      { href: "/admin/partners", label: "Partners", icon: Icons.award },
    ],
  },
  {
    label: "Settings",
    // "Business rules" wrapped onto two lines in a 72px bottom-nav cell and
    // pushed the bar out of alignment with the other four.
    items: [{ href: "/admin/business-rules", label: "Rules", icon: Icons.settings }],
  },
];
