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
 * Basic: every signed-in agent without a subscription. A one-time trial
 * allowance per account (never resets): counted over all time, so reports or
 * chats from an earlier subscription use it up too. Extra reports can still
 * be bought on Basic.
 */
export const BASIC_LIMITS = { reports: 1, chat: 5 } as const;

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

type Window = { start: Date; end: Date };
/** A window as a Prisma createdAt filter; none (Basic) counts all time. */
const inWindow = (window: Window | null) =>
  window ? { createdAt: { gte: window.start, lt: window.end } } : {};

/**
 * Plan reports created in a window, or ever with no window (Basic). Not
 * those paid with extra-report credits. Read from ReportUsage, so deleting a
 * report doesn't refund it.
 */
export function countPlanReports(userId: string, window: Window | null) {
  return db.reportUsage.count({
    where: { userId, usedCredit: false, ...inWindow(window) },
  });
}

/** Logs a newly created report against the allowance (idempotent). */
export async function recordReportUsage(opts: {
  reportId: string;
  userId: string;
  usedCredit: boolean;
}) {
  await db.reportUsage.upsert({
    where: { reportId: opts.reportId },
    create: opts,
    update: {},
  });
}

/** Chat messages in a window, or ever with no window (Basic). */
export function countChatMessages(userId: string, window: Window | null) {
  return db.chatMessageUsage.count({
    where: { userId, ...inWindow(window) },
  });
}

/** `resetsAt` is null on Basic: its free messages don't come back. */
export type ChatAllowance =
  | { allowed: true; used: number; limit: number; resetsAt: Date | null }
  | {
      allowed: false;
      reason: "limit";
      used: number;
      limit: number;
      resetsAt: Date | null;
    };

/**
 * Whether the agent can send another AI chat message: this month's plan
 * allowance, or Basic's free messages (all time).
 */
export async function getChatAllowance(userId: string): Promise<ChatAllowance> {
  const account = await db.billingAccount.findUnique({ where: { userId } });
  const subscribed = hasActiveSubscription(account) && account.currentPeriodStart;
  const window = subscribed ? quotaWindow(account.currentPeriodStart!) : null;
  const limit = subscribed ? PLAN_LIMITS[account.plan].chat : BASIC_LIMITS.chat;
  const used = await countChatMessages(userId, window);
  const resetsAt = window?.end ?? null;
  return used < limit
    ? { allowed: true, used, limit, resetsAt }
    : { allowed: false, reason: "limit", used, limit, resetsAt };
}

/** What to tell the agent when a chat message is refused. */
export function chatRefusalMessage(allowance: Extract<ChatAllowance, { allowed: false }>) {
  if (!allowance.resetsAt) {
    return `${CHAT_REFUSAL.limit} ${allowance.limit} free AI chat messages. Choose a plan on your dashboard for more.`;
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
