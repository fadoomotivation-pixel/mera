/**
 * Money-safe arithmetic. All amounts are BigInt paise (₹1 = 100 paise).
 * All rates are integer basis points (1 bps = 0.01%; 10% = 1000 bps).
 *
 * Rounding happens exactly once, at the point a percentage is applied,
 * using half-up rounding on integer paise. Nothing downstream re-rounds.
 */

export const BPS_DENOMINATOR = 10_000n;

export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * 100));
}

export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}

/** Applies a basis-point rate to a paise amount, rounding half-up to the nearest paisa. */
export function applyBps(amountPaise: bigint, bps: number): bigint {
  if (bps < 0) throw new Error(`bps must be >= 0, got ${bps}`);
  const numerator = amountPaise * BigInt(bps);
  const half = BPS_DENOMINATOR / 2n;
  // half-up rounding for positive amounts (all money in this system is non-negative
  // at the point a rate is applied; signed adjustments are handled separately)
  return (numerator + half) / BPS_DENOMINATOR;
}

export function sumPaise(amounts: bigint[]): bigint {
  return amounts.reduce((acc, a) => acc + a, 0n);
}

export function formatPaiseAsInr(paise: bigint): string {
  const rupees = paise / 100n;
  const paiseRemainder = paise % 100n;
  const rupeesStr = rupees.toString();
  // Indian digit grouping (lakh/crore)
  const lastThree = rupeesStr.slice(-3);
  const rest = rupeesStr.slice(0, -3);
  const grouped = rest.length
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
    : lastThree;
  return `₹${grouped}.${paiseRemainder.toString().padStart(2, "0")}`;
}

/** Splits a pool amount equally among N recipients, distributing the rounding
 * remainder deterministically (first recipients in the given order get the
 * extra paisa) so that the sum of shares always exactly equals the pool. */
export function splitEqually(poolPaise: bigint, count: number): bigint[] {
  if (count <= 0) throw new Error("count must be > 0");
  const base = poolPaise / BigInt(count);
  const remainder = poolPaise % BigInt(count);
  return Array.from({ length: count }, (_, i) => base + (BigInt(i) < remainder ? 1n : 0n));
}
