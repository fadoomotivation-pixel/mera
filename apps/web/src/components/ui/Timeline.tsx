import type { ReactNode } from "react";

/** Timeline — the product's answer to "don't build a boring accounting table".
 *
 * Used for the 90-day payment plan, customer payment history, milestone
 * journeys and payout history. Vertical on mobile, optionally horizontal on
 * desktop, because a 3-step plan reads better across than down on a wide
 * screen — but a 12-row payment history never should. */

export type TimelineState = "done" | "current" | "upcoming" | "blocked";

export type TimelineStep = {
  key: string;
  /** Short marker: "1", "01", "Month 1". Kept tiny — the node is a wayfinding
   * device, not a headline. */
  marker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  /** The money or headline value for this step. */
  value?: ReactNode;
  trailing?: ReactNode;
  state: TimelineState;
};

const NODE: Record<TimelineState, string> = {
  done: "bg-success text-white border-success",
  current: "bg-gold-500 text-navy-900 border-gold-500",
  upcoming: "bg-white text-navy-400 border-navy-900/15",
  blocked: "bg-danger-soft text-danger-strong border-danger/30",
};

const RAIL: Record<TimelineState, string> = {
  done: "bg-success/35",
  current: "bg-gold-500/35",
  upcoming: "bg-navy-900/10",
  blocked: "bg-danger/25",
};

function Node({ step }: { step: TimelineStep }) {
  return (
    <span
      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
        NODE[step.state]
      } ${step.state === "current" ? "shadow-goldGlow" : ""}`}
    >
      {step.state === "done" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-4 w-4" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        (step.marker ?? "")
      )}
    </span>
  );
}

export function Timeline({
  steps,
  orientation = "vertical",
  className = "",
}: {
  steps: TimelineStep[];
  /** `responsive` = vertical on mobile, horizontal from md up. Use it for the
   * 3-step payment plan; keep long histories `vertical`. */
  orientation?: "vertical" | "responsive";
  className?: string;
}) {
  if (orientation === "responsive") {
    return (
      <>
        <div className={`md:hidden ${className}`}>
          <VerticalTimeline steps={steps} />
        </div>
        <div className={`hidden md:block ${className}`}>
          <HorizontalTimeline steps={steps} />
        </div>
      </>
    );
  }
  return (
    <div className={className}>
      <VerticalTimeline steps={steps} />
    </div>
  );
}

function VerticalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-7 last:pb-0">
            {!last && (
              <span aria-hidden className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 ${RAIL[step.state]}`} />
            )}
            <Node step={step} />
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-semibold text-navy-900">{step.title}</p>
                {step.value}
              </div>
              {step.meta && <div className="mt-1 text-caption text-navy-500">{step.meta}</div>}
              {step.trailing && <div className="mt-3">{step.trailing}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function HorizontalTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex items-start">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.key} className="relative flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span aria-hidden className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : RAIL[step.state]}`} />
              <Node step={step} />
              <span aria-hidden className={`h-0.5 flex-1 ${last ? "bg-transparent" : RAIL[steps[i + 1]!.state]}`} />
            </div>
            <div className="mt-4 px-2">
              <p className="text-eyebrow uppercase text-navy-400">{step.title}</p>
              {step.value && <div className="mt-2">{step.value}</div>}
              {step.meta && <div className="mt-1.5 text-caption text-navy-500">{step.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ─────────────────────────── Achievement ladder ───────────────────────────
 * The royalty tiers and reward milestones share one structure: an ordered
 * climb where exactly one rung is "yours". Only that rung gets gold — the
 * brief is explicit that the whole ladder must not glow. */

export type LadderRung = {
  key: string;
  rank: string;
  tier: string;
  requirement: string;
  value: ReactNode;
  state: "achieved" | "current" | "locked";
};

export function AchievementLadder({ rungs, className = "" }: { rungs: LadderRung[]; className?: string }) {
  return (
    <ol className={`space-y-2 ${className}`}>
      {rungs.map((rung) => {
        const isCurrent = rung.state === "current";
        const isAchieved = rung.state === "achieved";
        return (
          <li
            key={rung.key}
            aria-current={isCurrent ? "step" : undefined}
            className={`flex items-center gap-4 rounded-card border p-4 transition sm:gap-5 sm:p-5 ${
              isCurrent
                ? "border-gold-500/40 bg-gold-100 shadow-goldGlow"
                : isAchieved
                  ? "border-navy-900/[0.07] bg-white"
                  : "border-navy-900/[0.06] bg-ivory-50/60"
            }`}
          >
            <span
              className={`tnum w-8 shrink-0 text-center font-display text-sm font-bold ${
                isCurrent ? "text-gold-600" : isAchieved ? "text-navy-700" : "text-navy-300"
              }`}
            >
              {rung.rank}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <p className={`font-semibold ${isCurrent || isAchieved ? "text-navy-900" : "text-navy-400"}`}>
                  {rung.tier}
                </p>
                {isCurrent && (
                  <span className="rounded-pill bg-gold-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-900">
                    Current
                  </span>
                )}
                {isAchieved && (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-success">Achieved</span>
                )}
              </div>
              <p className={`tnum mt-0.5 text-caption ${isCurrent || isAchieved ? "text-navy-500" : "text-navy-400"}`}>
                {rung.requirement}
              </p>
            </div>

            <div className={`shrink-0 text-right ${isCurrent || isAchieved ? "" : "opacity-55"}`}>{rung.value}</div>
          </li>
        );
      })}
    </ol>
  );
}
