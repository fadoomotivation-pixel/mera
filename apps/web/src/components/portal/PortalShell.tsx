"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BottomNav, SideNav, Wordmark, type NavItem } from "@/components/ui/nav";
import { getRole, clearSession } from "@/lib/api";
import { labelForRole } from "@/lib/roles";

/** The chrome every signed-in surface sits inside.
 *
 * One component rather than three so the three portals cannot drift apart, and
 * so the mobile behaviour is decided once. Two layouts, one breakpoint:
 *
 *   < md   fixed top bar, content, fixed bottom nav — thumb-reachable, which
 *          is how essentially every user of this product will hold the device.
 *   >= md  a persistent left rail, no bottom nav.
 *
 * The previous console had a single horizontal nav row that simply ran off the
 * side of a 360px screen: the links past the third were unreachable, and no
 * amount of zooming brought them back.
 *
 * Both bars respect safe-area insets so nothing hides behind an Android
 * gesture bar or a notch. */

export function PortalShell({
  nav,
  navGroups,
  children,
}: {
  /** Flat list — customer and partner. Max five, or the targets get too small. */
  nav?: NavItem[];
  /** Grouped — admin, which has too many destinations for a flat list. */
  navGroups?: { label: string; items: NavItem[] }[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  // The role lives in localStorage, which the server cannot see. Reading it
  // during render makes the server's markup ("Signed in") disagree with the
  // client's ("Super Admin") and React throws away the whole tree with a
  // hydration error. Read it after mount instead: the label arrives a frame
  // late, which nobody notices, and the markup matches.
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => setRole(getRole()), []);

  const flat = nav ?? navGroups?.flatMap((g) => g.items) ?? [];
  // A bar with one cell in it is not navigation — it is a button that goes
  // where you already are. The customer and partner portals are single
  // destinations today, so they get no bottom bar and the page keeps the
  // vertical space.
  const showBottomNav = flat.length > 1;
  // Five cells is the most a bar can hold before the targets get too small.
  // Up to five destinations all fit; past that the fifth cell becomes "More"
  // and everything from the fifth onwards moves into the sheet — so nothing is
  // ever silently dropped off the end.
  const bottomItems = flat.length > 5 ? flat.slice(0, 4) : flat;
  const overflow = flat.length > 5 ? flat.slice(4) : [];

  function onSignOut() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="min-h-dvh">
      {/* ── Mobile top bar ───────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 border-b border-navy-900/[0.08] bg-ivory-100/95 backdrop-blur md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex min-h-[56px] items-center justify-between gap-3 px-4">
          <Wordmark withTagline={false} className="flex min-h-[44px] items-center" />
          <div className="flex min-w-0 items-center gap-1">
            {/* truncate, not wrap: "Compliance & Audit" next to the wordmark
                on a 360px bar otherwise takes two lines and pushes the bar to
                double height. The full label is on the desktop rail. */}
            <span className="truncate text-caption text-navy-500">{labelForRole(role)}</span>
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              className="grid h-11 w-11 place-items-center rounded-full text-navy-500 active:bg-navy-900/[0.06]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M15 17v1.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2V7" />
                <path d="M10 12h10m0 0-3-3m3 3-3 3" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="md:flex">
        {/* ── Desktop rail ──────────────────────────────────────────────── */}
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-navy-900/[0.08] bg-ivory-50 px-4 py-7 md:flex lg:w-[264px]">
          <div className="px-3">
            <Wordmark className="flex min-h-[44px] flex-col justify-center" />
          </div>
          <div className="mt-9 flex-1 overflow-y-auto">
            <SideNav items={nav} groups={navGroups} />
          </div>
          <div className="border-t border-navy-900/[0.08] pt-4">
            <p className="px-3 text-caption text-navy-400">Signed in as</p>
            <p className="px-3 text-sm font-semibold text-navy-900">{labelForRole(role)}</p>
            <button
              onClick={onSignOut}
              className="mt-2 flex min-h-[44px] w-full items-center rounded-lg px-3 text-left text-sm text-navy-500 transition hover:bg-navy-900/[0.05] hover:text-navy-900"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* ── Content ───────────────────────────────────────────────────── */}
        <main className="min-w-0 flex-1">
          {/* Extra bottom padding only when there is a fixed bar to clear. */}
          <div
            className={`mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 md:px-8 md:pb-16 md:pt-10 ${
              showBottomNav ? "pb-28" : "pb-16"
            }`}
          >
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────
          Four primary destinations plus "More" when there are extras, so the
          fifth cell is a real menu rather than a truncated link. */}
      {!showBottomNav ? null : overflow.length === 0 ? (
        <BottomNav items={flat} />
      ) : (
        <>
          <BottomNav items={[...bottomItems, { href: "#more", label: "More", icon: MoreIcon }]} />
          {/* The "More" cell is a link for keyboard/markup simplicity; this
              overlay sits exactly over it and opens the sheet instead. It
              mirrors BottomNav's own `mx-auto max-w-lg` so the hit area stays
              on the fifth cell at every width, not just narrow phones. */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="mx-auto flex max-w-lg">
              <div className="flex-[4]" />
              <button
                aria-label="More"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="pointer-events-auto h-[56px] flex-1"
              />
            </div>
          </div>
          {menuOpen && (
            <MoreSheet items={overflow} onClose={() => setMenuOpen(false)} onSignOut={onSignOut} />
          )}
        </>
      )}
    </div>
  );
}

const MoreIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-[22px] w-[22px]">
    <path d="M5 12h.01M12 12h.01M19 12h.01" />
  </svg>
);

/** Bottom sheet for the destinations that don't fit the bar. Rises from the
 * bottom because that is where the thumb already is. */
function MoreSheet({
  items,
  onClose,
  onSignOut,
}: {
  items: NavItem[];
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-navy-900/40 backdrop-blur-[2px]" />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-sheet bg-white shadow-sheet animate-fade-up"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-navy-900/[0.08] bg-white px-5 py-4">
          <p className="font-display text-lg font-semibold text-navy-900">All sections</p>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full text-navy-500 active:bg-navy-900/[0.06]" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-5 w-5">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <ul className="p-2">
          {items.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={onClose}
                className="flex min-h-[52px] items-center gap-3 rounded-xl px-3 text-[15px] text-navy-800 active:bg-navy-900/[0.05]"
              >
                <span className="text-navy-400">{item.icon}</span>
                {item.label}
              </a>
            </li>
          ))}
          <li className="mt-2 border-t border-navy-900/[0.08] pt-2">
            <button
              onClick={onSignOut}
              className="flex min-h-[52px] w-full items-center px-3 text-left text-[15px] text-navy-500 active:bg-navy-900/[0.05]"
            >
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** Page heading inside a portal. Separate from the marketing `SectionTitle`
 * because it needs to survive a 360px width: the title wraps, the action drops
 * below it rather than squeezing the title into a two-character column. */
export function PageHead({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-navy-900 sm:text-display-md">
            {title}
          </h1>
          {lead && <p className="mt-2 max-w-prose text-sm leading-relaxed text-navy-500">{lead}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
