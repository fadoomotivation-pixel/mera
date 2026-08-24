/** Money rendering — the single most important primitive in this product.
 *
 * Three rules encoded here, all of them financial-safety rules rather than
 * visual ones:
 *
 * 1. Amounts arrive from the API as paise strings (BigInt-safe). We never do
 *    floating-point arithmetic on money in the browser; we only format.
 * 2. Indian digit grouping (1,00,00,000 — not 100,000,000). A partner reading
 *    "₹1 crore" must see it grouped the way they'd say it.
 * 3. Tabular figures, so a column of amounts aligns and a value never shifts
 *    width as digits change.
 *
 * There is deliberately no "animated count-up" variant. The brief calls for it
 * on decorative numbers only, and a balance that visibly counts up reads as a
 * changing balance — which would be a lie about the state of someone's money. */

const SIZES = {
  xl: "text-money-xl",
  lg: "text-money-lg",
  md: "text-money-md",
  sm: "text-base font-semibold",
  xs: "text-sm font-semibold",
} as const;

export type MoneySize = keyof typeof SIZES;

/** Formats paise into grouped rupees. Whole rupees by default — paise are
 * shown only when non-zero, because "₹35,000.00" is noise on a page of
 * round numbers but "₹32,550.50" must never be silently rounded. */
export function formatPaise(paise: string | bigint | null | undefined, opts?: { showPaise?: boolean }): string {
  if (paise === null || paise === undefined) return "—";
  let value: bigint;
  try {
    value = typeof paise === "bigint" ? paise : BigInt(paise);
  } catch {
    return "—";
  }

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const rupees = abs / 100n;
  const fraction = abs % 100n;

  // Indian grouping: last 3 digits, then pairs.
  const digits = rupees.toString();
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}` : tail;

  const showPaise = opts?.showPaise ?? fraction > 0n;
  const body = showPaise ? `${grouped}.${fraction.toString().padStart(2, "0")}` : grouped;
  return `${negative ? "−" : ""}₹${body}`;
}

export function Money({
  paise,
  size = "md",
  tone = "default",
  showPaise,
  className = "",
}: {
  paise: string | bigint | null | undefined;
  size?: MoneySize;
  /** `gold` is for headline/earned amounts, `danger` for deductions. */
  tone?: "default" | "gold" | "muted" | "danger" | "success" | "onNavy";
  showPaise?: boolean;
  className?: string;
}) {
  const tones = {
    default: "text-navy-900",
    gold: "text-gold-600",
    muted: "text-navy-500",
    danger: "text-danger",
    success: "text-success",
    onNavy: "text-ivory-50",
  } as const;

  return (
    <span className={`tnum font-display ${SIZES[size]} ${tones[tone]} ${className}`}>
      {formatPaise(paise, showPaise === undefined ? undefined : { showPaise })}
    </span>
  );
}

/** A deduction line (admin charge, TDS). Always rendered as an explicit
 * negative so a partner can follow gross → net without doing the arithmetic. */
export function Deduction({ paise, label }: { paise: string | bigint; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span className="text-navy-500">{label}</span>
      <span className="tnum font-medium text-danger">−{formatPaise(paise).replace("₹", "₹")}</span>
    </div>
  );
}
