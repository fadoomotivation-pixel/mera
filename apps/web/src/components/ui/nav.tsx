"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type NavItem = { href: string; label: string; icon: ReactNode };

/* ─────────────────────────── Icons ───────────────────────────
 * A small, consistent stroke set. Deliberately few: the brief warns against
 * icon spam, so icons exist only where they aid recognition in navigation. */

const ico = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
    {d}
  </svg>
);

export const Icons = {
  home: ico(<><path d="M3 10.5 12 4l9 6.5" /><path d="M5.5 9.5V20h13V9.5" /></>),
  property: ico(<><rect x="3.5" y="8" width="17" height="12" rx="1.5" /><path d="M3.5 12h17M9 8V4.5h6V8" /></>),
  payments: ico(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></>),
  documents: ico(<><path d="M6 3h7l5 5v13H6z" /><path d="M13 3v5h5M9 13h6M9 17h6" /></>),
  support: ico(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-.9.7-.9 1.3v.3" /><path d="M12 17h.01" /></>),
  roi: ico(<><path d="M4 18V9M10 18V5M16 18v-6M22 18H2" /></>),
  chart: ico(<><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>),
  users: ico(<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 8.5a3 3 0 0 1 0 5M18 20c0-2.4-.9-4.2-2.3-5.3" /></>),
  ledger: ico(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  award: ico(<><circle cx="12" cy="9" r="5" /><path d="M9 13.5 8 21l4-2 4 2-1-7.5" /></>),
  settings: ico(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>),
};

/** True when `href` is the active section — exact match for index routes,
 * prefix match for nested ones, so /customer/payments/receipt still lights
 * up Payments. */
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

/* ─────────────────────────── Bottom navigation (mobile) ───────────────────────────
 * Android-first. Fixed, thumb-reachable, with safe-area padding so it clears
 * gesture bars. Five items maximum — beyond that, targets get too small. */

export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-900/[0.08] bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 transition ${
                  active ? "text-navy-900" : "text-navy-400"
                }`}
              >
                <span className={active ? "text-gold-600" : ""}>{item.icon}</span>
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ─────────────────────────── Side navigation (desktop) ─────────────────────────── */

export function SideNav({
  items,
  groups,
}: {
  items?: NavItem[];
  /** Admin has ~18 destinations; the brief requires grouping rather than a
   * flat list of twenty. */
  groups?: { label: string; items: NavItem[] }[];
}) {
  const pathname = usePathname() ?? "";
  const render = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
            active ? "bg-navy-900 font-semibold text-ivory-50" : "text-navy-600 hover:bg-navy-900/[0.05]"
          }`}
        >
          <span className={active ? "text-gold-400" : "text-navy-400"}>{item.icon}</span>
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Primary" className="hidden md:block">
      {items && <ul className="space-y-1">{items.map(render)}</ul>}
      {groups && (
        <div className="space-y-7">
          {groups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-2 text-eyebrow uppercase text-navy-400">{g.label}</p>
              <ul className="space-y-1">{g.items.map(render)}</ul>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}

/* ─────────────────────────── Portal top bar ─────────────────────────── */

export function PortalHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div>
        <h1 className="font-display text-display-md text-navy-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-navy-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

/** Wordmark. Used in headers and the public site — one component so the
 * lockup (name + Devanagari tagline) never drifts between surfaces. */
export function Wordmark({ tone = "navy", withTagline = true }: { tone?: "navy" | "ivory"; withTagline?: boolean }) {
  return (
    <Link href="/" className="inline-block leading-none">
      <span
        className={`block font-display text-[19px] font-bold tracking-[0.18em] ${
          tone === "ivory" ? "text-ivory-50" : "text-navy-900"
        }`}
      >
        MERA MAKAN
      </span>
      {withTagline && (
        <span className={`mt-1.5 block font-deva text-[12px] ${tone === "ivory" ? "text-gold-300" : "text-gold-600"}`}>
          अपनी ज़मीन, अपनी पहचान
        </span>
      )}
    </Link>
  );
}
