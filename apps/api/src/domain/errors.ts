export class DomainError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(entity: string, from: string, to: string, allowed: string[]) {
    super(
      "INVALID_STATE_TRANSITION",
      `${entity} cannot transition from ${from} to ${to}. Allowed next states: [${allowed.join(", ")}]`
    );
  }
}

export class UnresolvedCalendarRuleError extends DomainError {
  constructor(message: string) {
    super("UNRESOLVED_CALENDAR_RULE", message);
  }
}

export class MaxRoiDurationExceededError extends DomainError {
  constructor(bookingId: string, monthNumber: number, maxMonths: number) {
    super(
      "MAX_ROI_DURATION_EXCEEDED",
      `Booking ${bookingId}: ROI month ${monthNumber} exceeds max allowed duration of ${maxMonths} months`
    );
  }
}

export class RulePendingApprovalError extends DomainError {
  constructor(ruleKey: string) {
    super(
      "RULE_PENDING_APPROVAL",
      `Business rule '${ruleKey}' is PENDING_CEO_APPROVAL and cannot be used to move a payout past ELIGIBLE`
    );
  }
}

export class NotEligibleError extends DomainError {
  constructor(message: string) {
    super("NOT_ELIGIBLE", message);
  }
}

export class DuplicateEventError extends DomainError {
  constructor(message: string) {
    super("DUPLICATE_EVENT", message);
  }
}

export class NotFoundDomainError extends DomainError {
  constructor(entity: string, id: string) {
    super("NOT_FOUND", `${entity} ${id} not found`);
  }
}

export class PermissionDeniedError extends DomainError {
  constructor(message = "Permission denied") {
    super("PERMISSION_DENIED", message);
  }
}

/** 401, not 403: the caller has not proved who they are — no token, a
 * malformed one, an expired one, or a refresh token that is spent.
 *
 * The distinction is not pedantry. Everything authentication-related used to
 * answer 403, the same as a role denial, so the browser client could not tell
 * "your fifteen minutes are up, renew and carry on" from "you are not allowed
 * to do this, renewing would change nothing". Unable to tell them apart, it
 * renewed on neither — and every session simply ended after fifteen minutes
 * with "Invalid or expired access token" on screen.
 *
 * 401 means: authenticate again, then retry.
 * 403 means: we know who you are; this is not yours. */
export class UnauthenticatedError extends DomainError {
  constructor(message = "Not authenticated") {
    super("UNAUTHENTICATED", message);
  }
}
