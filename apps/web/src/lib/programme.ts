/** Single source of truth for the five income streams, royalty tiers and
 * reward milestones as they are *presented*.
 *
 * These values mirror the seeded business rules (apps/api/prisma/seed.ts) and
 * the Channel Partner deck. They live in one module so the public programme
 * page and the partner portal can never drift apart — and so that a rule
 * change has exactly one place to be reflected in copy.
 *
 * IMPORTANT: these are presentation constants only. No screen ever computes a
 * partner's actual money from them — every real figure is backend-derived and
 * arrives already netted, with its own status. */

export type Stream = {
  no: string;
  name: string;
  headline: string;
  qualifier?: string;
  blurb: string;
};

/** The five streams are always listed separately and never summed. Presenting
 * a combined percentage would misrepresent the plan, so there is deliberately
 * no "total" export anywhere in this module. */
export const STREAMS: Stream[] = [
  {
    no: "01",
    name: "Referral",
    headline: "10%",
    blurb: "Direct referral income on the plot amount, according to approved company payout terms.",
  },
  {
    no: "02",
    name: "Cash Plot ROI",
    headline: "1% / month",
    qualifier: "Up to 12 months",
    blurb: "On eligible Cash Plot bookings, under the applicable business rules.",
  },
  {
    no: "03",
    name: "Balance Sheet",
    headline: "8%",
    blurb: "Business generated generation to generation creates an eligible balance that can carry forward.",
  },
  {
    no: "04",
    name: "Royalty",
    headline: "2%",
    qualifier: "of monthly turnover",
    blurb: "Allocated to the Royalty Pool and shared equally among eligible achievers at the attained tier.",
  },
  {
    no: "05",
    name: "Rewards",
    headline: "3%",
    qualifier: "reward pool",
    blurb: "Milestone rewards become payable after the applicable property payment is fully collected.",
  },
];

/** Closing cycles. Referral is confirmed; Balance Sheet payout timing is
 * pending CEO approval (docs/07 §D1), so it is presented without dates. */
export const CLOSING_CYCLES = [
  { window: "1 – 10", days: "10 days", payout: "15th" },
  { window: "11 – 20", days: "10 days", payout: "25th" },
  { window: "21 – 30", days: "10 days", payout: "5th" },
] as const;

export type Tier = {
  code: string;
  name: string;
  left: number;
  right: number;
  /** Royalty duration in months; 12 is presented as "1 year". */
  months: number;
  reward: string;
  rewardValuePaise: string;
};

/** Mirrors ROYALTY_TIERS and REWARD_MILESTONES in prisma/seed.ts. Royalty and
 * Rewards are separate programmes that share the same achievement tiers — the
 * pairing here is presentational, not a combined benefit. */
export const TIERS: Tier[] = [
  { code: "01", name: "Adviser", left: 2, right: 2, months: 1, reward: "Mobile", rewardValuePaise: "2000000" },
  { code: "02", name: "Senior Adviser", left: 5, right: 5, months: 2, reward: "Laptop", rewardValuePaise: "5000000" },
  { code: "03", name: "Supervisor", left: 10, right: 10, months: 3, reward: "Bike", rewardValuePaise: "10000000" },
  { code: "04", name: "Senior Supervisor", left: 25, right: 25, months: 4, reward: "Car Fund", rewardValuePaise: "25000000" },
  { code: "05", name: "Manager", left: 100, right: 100, months: 5, reward: "Car Fund", rewardValuePaise: "1000000000" },
  { code: "06", name: "Senior Manager", left: 250, right: 250, months: 6, reward: "Plot", rewardValuePaise: "2500000000" },
  { code: "07", name: "Gold", left: 500, right: 500, months: 7, reward: "Fully Furnished Farmhouse", rewardValuePaise: "5000000000" },
  { code: "08", name: "Diamond", left: 1000, right: 1000, months: 12, reward: "Cash Reward", rewardValuePaise: "10000000000" },
];

/** "1 Month" / "2 Months" / "1 Year" — the deck says 1 Year for Diamond, not
 * 12 Months, and that distinction is part of how the milestone feels. */
export function royaltyDuration(months: number): string {
  if (months === 12) return "1 Year";
  return months === 1 ? "1 Month" : `${months} Months`;
}

/** Achievement requirement, e.g. "2 + 2". Never the word "pair". */
export function requirement(tier: Tier): string {
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return `${fmt(tier.left)} + ${fmt(tier.right)}`;
}
