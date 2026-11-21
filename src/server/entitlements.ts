import { CHAT_REFUSAL } from "@/lib/billing";
import { db } from "@/server/db";
import type { BillingAccount, Plan } from "../generated/prisma/client";

// Shared by Next.js and the Trigger.dev chat agent, so no "server-only" or
// Stripe import here (see db.ts). Stripe-side billing is in billing.ts.

/** Monthly allowances per plan, on both monthly and annual billing. */
export const PLAN_LIMITS = {
  starter: { reports: 3, chat: 30 },
  pro: { reports: 10, chat: 100 },
} as const satisfies Record<Plan, { reports: number; chat: number }>;

/**
 * Statuses that grant access. past_due keeps access while Stripe retries the
 * renewal (Smart Retries); the subscription moves to canceled/unpaid if
 * every retry fails, which removes access.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function hasActiveSubscription(
  account: Pick<BillingAccount, "status" | "plan"> | null,
): account is BillingAccount & { plan: Plan } {
  return !!account?.plan && ACTIVE_STATUSES.has(account.status ?? "");
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // Jan 31 + 1 month → Feb 28/29, not Mar 3.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/**
 * The monthly quota window containing `now`, counted in whole months from the
 * billing period start. For a monthly plan that's the billing period itself;
 * for an annual plan it's the current month of the year.
 */
export function quotaWindow(periodStart: Date, now = new Date()) {
  let months = 0;
  while (addMonths(periodStart, months + 1) <= now) months++;
  return { start: addMonths(periodStart, months), end: addMonths(periodStart, months + 1) };
}

export function countChatMessages(userId: string, window: { start: Date; end: Date }) {
  return db.chatMessageUsage.count({
    where: { userId, createdAt: { gte: window.start, lt: window.end } },
  });
}

export type ChatAllowance =
  | { allowed: true; used: number; limit: number; resetsAt: Date }
  | { allowed: false; reason: "no_plan" }
  | { allowed: false; reason: "limit"; used: number; limit: number; resetsAt: Date };

/** Whether the agent can send another AI chat message this month. */
export async function getChatAllowance(userId: string): Promise<ChatAllowance> {
  const account = await db.billingAccount.findUnique({ where: { userId } });
  if (!hasActiveSubscription(account) || !account.currentPeriodStart) {
    return { allowed: false, reason: "no_plan" };
  }
  const window = quotaWindow(account.currentPeriodStart);
  const limit = PLAN_LIMITS[account.plan].chat;
  const used = await countChatMessages(userId, window);
  return used < limit
    ? { allowed: true, used, limit, resetsAt: window.end }
    : { allowed: false, reason: "limit", used, limit, resetsAt: window.end };
}

/** What to tell the agent when a chat message is refused. */
export function chatRefusalMessage(allowance: Extract<ChatAllowance, { allowed: false }>) {
  if (allowance.reason === "no_plan") {
    return `${CHAT_REFUSAL.noPlan} Choose one on your dashboard.`;
  }
  const resets = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    allowance.resetsAt,
  );
  return `${CHAT_REFUSAL.limit} ${allowance.limit} AI chat messages for this month. More on ${resets}.`;
}

/** Counts one answered chat turn. Idempotent per assistant message. */
export async function recordChatMessage(opts: {
  messageId: string;
  userId: string;
  reportId: string;
}) {
  await db.chatMessageUsage.upsert({
    where: { messageId: opts.messageId },
    create: opts,
    update: {},
  });
}
