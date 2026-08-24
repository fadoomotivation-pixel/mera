"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/* ─────────────────────────── Button ───────────────────────────
 * Four variants, no more. `primary` is navy (the default action),
 * `gold` is reserved for the single most important commitment on a
 * screen (Book a site visit, Become a partner) — never two on one view. */

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition " +
  "disabled:opacity-50 disabled:pointer-events-none select-none";

const BUTTON_SIZES = {
  // Touch targets: 44px minimum on mobile, per the accessibility requirement.
  lg: "min-h-[52px] px-7 text-base",
  md: "min-h-[44px] px-5 text-sm",
  sm: "min-h-[36px] px-4 text-sm",
} as const;

const BUTTON_VARIANTS = {
  primary: "bg-navy-900 text-ivory-50 hover:bg-navy-800 active:bg-navy-900",
  gold: "bg-gold-500 text-navy-900 hover:bg-gold-400 active:bg-gold-600",
  outline: "border border-navy-900/15 bg-white text-navy-900 hover:border-navy-900/30 hover:bg-ivory-50",
  ghost: "text-navy-700 hover:bg-navy-900/[0.05]",
  onNavy: "border border-ivory-50/25 text-ivory-50 hover:bg-ivory-50/10",
} as const;

type ButtonVariant = keyof typeof BUTTON_VARIANTS;
type ButtonSize = keyof typeof BUTTON_SIZES;

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <Link href={href} className={`${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

/* ─────────────────────────── Card ───────────────────────────
 * Cards are material, not outlines: a near-invisible hairline plus a soft
 * shadow. `navy` is for hero/financial emphasis, `plain` for everything else. */

export function Card({
  children,
  tone = "plain",
  className = "",
  as: As = "div",
}: {
  children: ReactNode;
  tone?: "plain" | "navy" | "gold" | "quiet";
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  const tones = {
    plain: "bg-white border border-navy-900/[0.07] shadow-card",
    quiet: "bg-ivory-50 border border-navy-900/[0.06]",
    navy: "bg-navy-900 text-ivory-50 border border-navy-900",
    gold: "bg-gold-100 border border-gold-500/25",
  } as const;
  return <As className={`rounded-card ${tones[tone]} ${className}`}>{children}</As>;
}

/* ─────────────────────────── Eyebrow / SectionTitle ─────────────────────────── */

export function Eyebrow({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "muted" | "onNavy" }) {
  const tones = { gold: "text-gold-600", muted: "text-navy-400", onNavy: "text-gold-400" } as const;
  return <p className={`text-eyebrow uppercase ${tones[tone]}`}>{children}</p>;
}

export function SectionTitle({
  eyebrow,
  title,
  lead,
  tone = "default",
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  tone?: "default" | "onNavy";
  className?: string;
}) {
  return (
    <header className={`max-w-2xl ${className}`}>
      {eyebrow && <Eyebrow tone={tone === "onNavy" ? "onNavy" : "gold"}>{eyebrow}</Eyebrow>}
      <h2
        className={`mt-3 font-display text-display-md ${tone === "onNavy" ? "text-ivory-50" : "text-navy-900"}`}
      >
        {title}
      </h2>
      {lead && (
        <p className={`mt-4 text-[15px] leading-relaxed ${tone === "onNavy" ? "text-navy-200" : "text-navy-500"}`}>
          {lead}
        </p>
      )}
    </header>
  );
}

/* ─────────────────────────── StatusPill ───────────────────────────
 * Status is never communicated by colour alone — every pill carries its label,
 * and the shape/dot gives a second, non-colour signal (accessibility rule). */

const STATUS_TONES: Record<string, string> = {
  // Payout / financial lifecycle
  PENDING: "bg-navy-900/[0.06] text-navy-600",
  ELIGIBLE: "bg-navy-100 text-navy-700",
  APPROVED: "bg-gold-100 text-gold-700",
  PROCESSING: "bg-warning-soft text-warning-strong",
  PAID: "bg-success-soft text-success-strong",
  HELD: "bg-warning-soft text-warning-strong",
  REVERSED: "bg-danger-soft text-danger-strong",
  CANCELLED: "bg-navy-900/[0.06] text-navy-500",
  // Booking / plot lifecycle
  AVAILABLE: "bg-success-soft text-success-strong",
  DRAFT: "bg-navy-900/[0.06] text-navy-500",
  RESERVED: "bg-warning-soft text-warning-strong",
  BOOKED: "bg-navy-100 text-navy-700",
  PAYMENT_IN_PROGRESS: "bg-warning-soft text-warning-strong",
  FULLY_COLLECTED: "bg-success-soft text-success-strong",
  REGISTERED: "bg-success-soft text-success-strong",
  COMPLETED: "bg-success-soft text-success-strong",
  BLOCKED: "bg-danger-soft text-danger-strong",
  REFUND_INITIATED: "bg-danger-soft text-danger-strong",
  REFUNDED: "bg-danger-soft text-danger-strong",
};

/** Turns FULLY_COLLECTED into "Fully collected" — screaming snake case is a
 * database detail, not something a customer should ever read. */
export function humanizeStatus(status: string): string {
  const s = status.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusPill({ status, className = "" }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? "bg-navy-900/[0.06] text-navy-600";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${tone} ${className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {humanizeStatus(status)}
    </span>
  );
}

/* ─────────────────────────── Progress ─────────────────────────── */

export function Progress({
  value,
  max = 100,
  tone = "navy",
  label,
  className = "",
}: {
  value: number;
  max?: number;
  tone?: "navy" | "gold" | "success";
  label?: string;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const tones = { navy: "bg-navy-700", gold: "bg-gold-500", success: "bg-success" } as const;
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-pill bg-navy-900/[0.08] ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-full rounded-pill transition-[width] duration-500 ${tones[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ─────────────────────────── States ───────────────────────────
 * Empty, loading and error states are first-class components, not
 * afterthoughts — a blank screen is a bug. */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-navy-900/15 px-6 py-14 text-center">
      {icon && <div className="mb-4 text-navy-300">{icon}</div>}
      <p className="font-display text-lg font-semibold text-navy-900">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-500">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "", onNavy = false }: { className?: string; onNavy?: boolean }) {
  return <div aria-hidden className={`${onNavy ? "skeleton-on-navy" : "skeleton"} ${className}`} />;
}

/** Error state. Never surfaces a raw 500 or a stack trace. The reference ID is
 * what support actually needs, so it is selectable and prominent. */
export function ErrorState({
  title = "Something went wrong.",
  body,
  referenceId,
  onRetry,
  financialAssurance,
}: {
  title?: string;
  body?: string;
  referenceId?: string;
  onRetry?: () => void;
  /** For any failure during a money operation, state plainly that nothing was
   * created. Ambiguity here costs trust that is very hard to win back. */
  financialAssurance?: string;
}) {
  return (
    <div className="rounded-card border border-danger/20 bg-danger-soft/60 p-6">
      <p className="font-display text-lg font-semibold text-danger-strong">{title}</p>
      {body && <p className="mt-2 text-sm leading-relaxed text-navy-700">{body}</p>}
      {financialAssurance && (
        <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-sm font-medium text-navy-900">{financialAssurance}</p>
      )}
      {referenceId && (
        <p className="mt-3 text-caption text-navy-500">
          Reference ID <span className="tnum select-all font-semibold text-navy-700">{referenceId}</span>
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
        <ButtonLink size="sm" variant="outline" href="/support">
          Contact support
        </ButtonLink>
      </div>
    </div>
  );
}

/** Stable, human-readable reference for support. Deliberately short and
 * unambiguous to read aloud over a phone call. */
export function makeReferenceId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `MM-${out}`;
}
