/**
 * 90-Day Plot Payment plan — FINAL per the business spec (not flagged
 * unresolved; the exact percentages/months were given explicitly).
 * Kept as a named constant (not a DB-versioned rule) because the spec gives
 * no indication a second plan will ever exist; if/when it does, promote this
 * to a `PaymentPlanRule` table following the same versioning shape as the
 * other rule tables. Referenced from exactly one place: `BookingService`.
 */
export const NINETY_DAY_PLAN = [
  { installmentNumber: 1, percentBps: 3000, dueOffsetDays: 30 }, // Month 1 = 30%
  { installmentNumber: 2, percentBps: 3000, dueOffsetDays: 60 }, // Month 2 = 30%
  { installmentNumber: 3, percentBps: 4000, dueOffsetDays: 90 }, // Month 3 = 40%
] as const;
