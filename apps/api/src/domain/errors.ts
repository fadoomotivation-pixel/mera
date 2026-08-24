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
