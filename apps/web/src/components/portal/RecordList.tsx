"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPill } from "@/components/ui/primitives";
import { Money } from "@/components/ui/Money";

/** Records, not tables.
 *
 * Every list in this console used to be a `<table>`. A table with five columns
 * needs roughly 640px to stay legible; the phones this product is used on are
 * 360-412px wide. The columns collapsed into each other, the amount wrapped
 * mid-number, and the row you wanted was off the right edge.
 *
 * So a record is a card. On a phone it stacks: the thing it is about, then its
 * state, then its figures as labelled pairs — each pair readable on its own,
 * because a value with no visible header is just a number. From `md` up the
 * same record lays out along one line, which is what a table was for.
 *
 * Nothing is hidden on the narrow layout. A column dropped on mobile is a
 * column someone can only see at a desk, and this console is used from a
 * site visit as often as from a desk. */

export type RecordField = {
  label: string;
  /** Rendered as-is; use `paise` instead when the value is money. */
  value?: ReactNode;
  /** Money in paise. Rendered with Indian grouping and tabular figures. */
  paise?: string | bigint | null;
  /** Emphasised — used for the one figure that matters most in the row. */
  emphasis?: boolean;
};

export type RecordItem = {
  id: string;
  /** The heading. What the record is about. */
  title: ReactNode;
  /** One quiet line under the title — plot size, code, email. */
  subtitle?: ReactNode;
  status?: string;
  fields?: RecordField[];
  /** Turns the whole card into a link. Whole-card targets matter far more on
   * a touch screen than a 12px "view" link at the end of a row. */
  href?: string;
  /** A closing note under the fields, e.g. an eligibility hint. */
  footnote?: ReactNode;
};

function Fields({ fields }: { fields: RecordField[] }) {
  return (
    // The one-line layout starts at `lg`, not `md`. At md the 248px rail
    // leaves the content column under 500px, which is not enough for a title
    // plus three money columns — measured at 768px, the card ran 64px past the
    // viewport and took the whole page with it.
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:mt-0 lg:flex lg:shrink-0 lg:items-baseline lg:gap-6">
      {fields.map((f) => (
        <div key={f.label} className="min-w-0 lg:text-right">
          <dt className="text-caption text-navy-400">{f.label}</dt>
          <dd className="mt-0.5">
            {f.paise !== undefined ? (
              <Money paise={f.paise} size="xs" tone={f.emphasis ? "gold" : "default"} />
            ) : (
              <span className={`text-sm ${f.emphasis ? "font-semibold text-navy-900" : "text-navy-800"}`}>
                {f.value ?? "—"}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Body({ item }: { item: RecordItem }) {
  return (
    <>
      {/* The row layout is scoped to this inner wrapper so the footnote below
          it stays a full-width line instead of being pulled in as a third
          flex item and forcing the card wider than the screen. */}
      <div className="lg:flex lg:items-center lg:justify-between lg:gap-8">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            {/* break-words: plot references and emails are unbreakable strings
                that otherwise push the card wider than the screen. */}
            <p className="break-words font-semibold leading-snug text-navy-900">{item.title}</p>
            {item.subtitle && <p className="mt-1 break-words text-caption text-navy-500">{item.subtitle}</p>}
          </div>
          {item.status && <StatusPill status={item.status} className="shrink-0" />}
        </div>
        {item.fields && item.fields.length > 0 && <Fields fields={item.fields} />}
      </div>
      {item.footnote && <p className="mt-3 text-caption text-gold-700">{item.footnote}</p>}
    </>
  );
}

export function RecordList({ items, className = "" }: { items: RecordItem[]; className?: string }) {
  return (
    <ul className={`space-y-3 ${className}`}>
      {items.map((item) => {
        const shell = "block rounded-card border border-navy-900/[0.07] bg-white p-4 shadow-card sm:p-5";
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className={`${shell} transition hover:border-navy-900/20 hover:shadow-raised active:bg-ivory-50`}
              >
                <Body item={item} />
              </Link>
            ) : (
              <div className={shell}>
                <Body item={item} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ─────────────────────────── Loading ───────────────────────────
 * Shown instead of a blank screen while a list is in flight. The previous
 * pages returned null until data arrived, so a slow request looked exactly
 * like a broken page — which is most of why the console "felt" slow even
 * when the request itself was fine. */

export function RecordListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="rounded-card border border-navy-900/[0.07] bg-white p-4 shadow-card sm:p-5">
          <div className="skeleton h-4 w-1/2 rounded" />
          <div className="skeleton mt-2 h-3 w-1/3 rounded" />
          <div className="mt-4 flex gap-6">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-3 w-20 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────── Stat ───────────────────────────
 * The KPI tile. Two per row at 360px — three would put a lakh figure onto two
 * lines, and a money value that wraps mid-number is unreadable. */

export function Stat({
  label,
  paise,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  paise?: string | bigint | null;
  value?: ReactNode;
  tone?: "default" | "gold" | "navy";
  hint?: ReactNode;
}) {
  const onNavy = tone === "navy";
  return (
    <div
      className={`rounded-card p-4 sm:p-5 ${
        onNavy ? "bg-navy-900 text-ivory-50" : "border border-navy-900/[0.07] bg-white shadow-card"
      }`}
    >
      <p className={`text-caption ${onNavy ? "text-navy-200" : "text-navy-400"}`}>{label}</p>
      <p className="mt-1.5">
        {paise !== undefined ? (
          <Money paise={paise} size="md" tone={onNavy ? "onNavy" : tone === "gold" ? "gold" : "default"} />
        ) : (
          <span
            className={`tnum font-display text-money-md ${
              onNavy ? "text-ivory-50" : tone === "gold" ? "text-gold-600" : "text-navy-900"
            }`}
          >
            {value}
          </span>
        )}
      </p>
      {hint && <p className={`mt-1 text-caption ${onNavy ? "text-navy-200" : "text-navy-500"}`}>{hint}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{children}</div>;
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <StatGrid>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-card border border-navy-900/[0.07] bg-white p-4 shadow-card sm:p-5" aria-hidden>
          <div className="skeleton h-3 w-20 rounded" />
          <div className="skeleton mt-3 h-6 w-28 rounded" />
        </div>
      ))}
    </StatGrid>
  );
}

/* ─────────────────────────── Section ─────────────────────────── */

export function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-navy-900">{title}</h2>
          {note && <p className="mt-1 max-w-prose text-caption text-navy-500">{note}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
