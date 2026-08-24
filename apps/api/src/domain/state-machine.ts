import { InvalidStateTransitionError } from "./errors.js";

/**
 * Generic transition-table guard used by every state machine in the system
 * (Booking, Payment, Payout, ClosingCycle, TierAchievement, RewardAchievement).
 * A service NEVER writes a status field without going through `assertTransition`
 * first — this is what makes "no invalid state transitions" a structural
 * property instead of a convention.
 */
export function assertTransition<S extends string>(
  entityName: string,
  transitions: Record<S, readonly S[]>,
  from: S,
  to: S
): void {
  if (from === to) return; // idempotent no-op re-application is allowed
  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError(entityName, from, to, Array.from(allowed) as string[]);
  }
}
