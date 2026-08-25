"use client";

import type { ReactNode } from "react";

/** Form controls sized for a thumb.
 *
 * The console's inputs were `px-3 py-2` — about 38px tall, under the 44px
 * minimum, and set at 14px which makes Android's autofill and zoom behaviour
 * worse. These are 48px and 16px. On a form the user fills once and hands to a
 * customer, being slightly harder to mis-tap is worth the vertical space. */

const CONTROL =
  "w-full min-h-[48px] rounded-xl border border-navy-900/15 bg-white px-3.5 text-base text-navy-900 " +
  "placeholder:text-navy-300 transition focus:border-navy-400 disabled:bg-ivory-100 disabled:text-navy-400";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-navy-800">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1.5 block text-caption text-navy-500">{hint}</span>}
    </label>
  );
}

export function Input({ className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    // appearance-none + our own chevron: the native control renders at wildly
    // different heights across Android browsers, which broke the row rhythm.
    <div className="relative">
      <select
        className={`${CONTROL} appearance-none pr-10 ${className}`}
        {...rest}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}

/** A form that appears in place of, or above, a list. Full-bleed on mobile so
 * it does not read as a cramped box inside a cramped screen. */
export function FormCard({
  title,
  children,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="mb-6 space-y-4 rounded-card border border-navy-900/[0.07] bg-white p-4 shadow-card sm:p-6 animate-fade-up"
    >
      <h2 className="font-display text-lg font-bold text-navy-900">{title}</h2>
      {children}
    </form>
  );
}

/** Inline form error. Never colour alone — it carries an icon and a label. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger-strong">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="mt-0.5 h-4 w-4 shrink-0">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4.5M12 16h.01" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

/** Credentials just created for a customer or partner. Deliberately loud and
 * deliberately explicit that it is shown once — an admin who scrolls past this
 * has to reset the password to recover it. */
export function CredentialNotice({
  lines,
  onDismiss,
}: {
  lines: { label: string; value: string }[];
  onDismiss: () => void;
}) {
  return (
    <div className="mb-6 rounded-card border border-gold-500/30 bg-gold-100 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-base font-bold text-navy-900">Login created</p>
        <button onClick={onDismiss} aria-label="Dismiss" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-navy-500 active:bg-navy-900/[0.06]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <dl className="mt-3 space-y-2">
        {lines.map((l) => (
          <div key={l.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <dt className="text-caption text-navy-500">{l.label}</dt>
            {/* select-all so it can be copied in one tap on a phone. */}
            <dd className="select-all break-all font-semibold text-navy-900">{l.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-caption text-navy-600">
        Share these now — the password is not stored in readable form and cannot be shown again.
      </p>
    </div>
  );
}
