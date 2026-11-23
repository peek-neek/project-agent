export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export function isBillingInterval(value: unknown): value is BillingInterval {
  return BILLING_INTERVALS.includes(value as BillingInterval);
}

/** Reasons report creation is blocked; also the dashboard's ?billing= values. */
export const BILLING_ERRORS = {
  required: "subscription_required",
  limit: "report_limit_reached",
  /** A comparison needs more new reports than are left (it makes none). */
  compareLimit: "compare_needs_more_reports",
} as const;

export type BillingError = (typeof BILLING_ERRORS)[keyof typeof BILLING_ERRORS];

export function isBillingError(value: unknown): value is BillingError {
  return Object.values(BILLING_ERRORS).includes(value as BillingError);
}

/** Start of every AI chat refusal message (see server/entitlements.ts). */
export const CHAT_REFUSAL = {
  noPlan: "AI chat needs an active plan.",
  limit: "You've used all",
} as const;

/**
 * Whether a chat error is a plan/allowance refusal rather than a failure:
 * the agent-side refusal carries the message, the first-message (Head Start)
 * refusal arrives as an HTTP 402 whose body the transport drops.
 */
export function isChatRefusal(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if ((error as { status?: number }).status === 402 || /\b402\b/.test(error.message)) {
    return true;
  }
  return Object.values(CHAT_REFUSAL).some((p) => error.message.startsWith(p));
}
