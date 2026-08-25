"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/ui/nav";
import { ButtonLink } from "@/components/ui/primitives";

const LINKS = [
  { href: "/#property", label: "The Property" },
  { href: "/#plan", label: "Payment Plan" },
  { href: "/#location", label: "Location" },
  { href: "/partner-programme", label: "Channel Partner" },
];

/** Public site header. Transparent over the navy hero, solid once scrolled
 * past it — one primary action only, per the "don't put ten buttons above the
 * fold" rule. Login lives behind a quiet text link because the overwhelming
 * majority of visitors are prospective customers, not existing ones. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="shell flex items-center justify-between py-5">
        <Wordmark tone="ivory" />

        <nav aria-label="Main" className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-ivory-50/80 transition hover:text-ivory-50">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-ivory-50/70 transition hover:text-ivory-50 sm:block"
          >
            Sign in
          </Link>
          <ButtonLink href="/#visit" variant="gold" size="sm" className="hidden sm:inline-flex">
            Book a site visit
          </ButtonLink>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-ivory-50 lg:hidden"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-6 w-6">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade-up border-t border-ivory-50/10 bg-navy-900/95 backdrop-blur lg:hidden">
          <nav aria-label="Mobile" className="shell flex flex-col py-4">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-ivory-50/10 py-3.5 text-[15px] font-medium text-ivory-50/90 last:border-0"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3">
              <ButtonLink href="/#visit" variant="gold" size="md">
                Book a site visit
              </ButtonLink>
              <ButtonLink href="/login" variant="onNavy" size="md">
                Sign in
              </ButtonLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-navy-900 pt-section text-ivory-50/70">
      <div className="shell">
        <div className="grid gap-10 pb-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Wordmark tone="ivory" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              Fully developed society plots with a transparent 90-day payment plan.
            </p>
          </div>

          <FooterCol
            title="Property"
            links={[
              { href: "/#property", label: "Plot details" },
              { href: "/#plan", label: "Payment plan" },
              { href: "/#location", label: "Location" },
              { href: "/#benefit", label: "Cash Plot benefit" },
            ]}
          />
          <FooterCol
            title="Portals"
            links={[
              { href: "/login", label: "Sign in" },
              { href: "/partner-programme", label: "Become a partner" },
            ]}
          />
          <FooterCol
            title="Legal"
            links={[
              { href: "/legal/terms", label: "Terms & conditions" },
              { href: "/legal/privacy", label: "Privacy policy" },
            ]}
          />
        </div>

        {/* Kept verbatim from the reviewed copy — this wording is deliberate
            and should not be edited without approval. */}
        <div className="border-t border-ivory-50/10 py-8">
          <p className="max-w-4xl text-xs leading-relaxed text-ivory-50/45">
            Cash Plot ROI, Referral, Balance Sheet, Royalty and Reward programs are internal business/channel-partner
            arrangements governed by MERA MAKAN&apos;s published business rules and are not represented here as
            guaranteed returns. Plot pricing, payment plans and registration are identical for every customer.
          </p>
          <p className="mt-5 text-xs text-ivory-50/40">© {new Date().getFullYear()} MERA MAKAN. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="text-eyebrow uppercase text-gold-400">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href + l.label}>
            <Link href={l.href} className="text-sm transition hover:text-ivory-50">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
