import "server-only";
import { cacheLife } from "next/cache";
import type Stripe from "stripe";
import { BILLING_INTERVALS, type BillingInterval } from "@/lib/billing";
import { db } from "@/server/db";
import {
  countChatMessages,
  hasActiveSubscription,
  PLAN_LIMITS,
  quotaWindow,
} from "@/server/entitlements";
import { stripe } from "@/server/stripe";
import type { Plan } from "../generated/prisma/client";

export { hasActiveSubscription, quotaWindow };

/**
 * Plans on the pricing table. Prices live in Stripe and are found by lookup
 * key, one per billing interval. Quotas are per month on both intervals.
 */
export const PLANS = {
  starter: {
    name: "Starter",
    lookupKeys: { monthly: "starter_monthly", annual: "starter_annual" },
    ...PLAN_LIMITS.starter,
  },
  pro: {
    name: "Pro",
    lookupKeys: { monthly: "pro_monthly", annual: "pro_annual" },
    ...PLAN_LIMITS.pro,
  },
} as const satisfies Record<
  Plan,
  { lookupKeys: Record<BillingInterval, string> } & Record<string, unknown>
>;

const ALL_LOOKUP_KEYS = Object.values(PLANS).flatMap((p) =>
  Object.values(p.lookupKeys),
);

export function isPlan(value: unknown): value is Plan {
  return value === "starter" || value === "pro";
}

/** Which plan and interval a Stripe price is, from its lookup key. */
function describePrice(
  price: Pick<Stripe.Price, "lookup_key" | "metadata"> | undefined,
): { plan: Plan; interval: BillingInterval } | null {
  if (!price) return null;
  for (const [plan, config] of Object.entries(PLANS) as [Plan, (typeof PLANS)[Plan]][]) {
    for (const interval of BILLING_INTERVALS) {
      if (price.lookup_key === config.lookupKeys[interval]) return { plan, interval };
    }
  }
  return null;
}

export function getBillingAccount(userId: string) {
  return db.billingAccount.findUnique({ where: { userId } });
}

/** The user's Stripe customer, created on first checkout. */
export async function getOrCreateCustomer(
  userId: string,
  email: string | undefined,
): Promise<string> {
  const existing = await getBillingAccount(userId);
  if (existing) return existing.stripeCustomerId;

  const customer = await stripe.customers.create(
    { email, metadata: { clerk_user_id: userId } },
    // Two quick clicks create one customer, not two.
    { idempotencyKey: `customer-create-${userId}` },
  );
  const account = await db.billingAccount.upsert({
    where: { userId },
    create: { userId, stripeCustomerId: customer.id },
    update: {},
  });
  return account.stripeCustomerId;
}

type PlanPrice = { id: string; amount: number; currency: string };
export type PlanPrices = Record<Plan, Record<BillingInterval, PlanPrice>>;

/** Every plan's monthly and annual price, read from Stripe (cached hourly). */
export async function getPlanPrices(): Promise<PlanPrices> {
  "use cache";
  cacheLife("hours");
  const { data } = await stripe.prices.list({
    lookup_keys: ALL_LOOKUP_KEYS,
    active: true,
  });
  const byKey = new Map(data.map((p) => [p.lookup_key, p]));
  const price = (plan: Plan, interval: BillingInterval): PlanPrice => {
    const p = byKey.get(PLANS[plan].lookupKeys[interval]);
    if (!p?.unit_amount) throw new Error(`No ${interval} price for ${plan}`);
    return { id: p.id, amount: p.unit_amount / 100, currency: p.currency.toUpperCase() };
  };
  return {
    starter: { monthly: price("starter", "monthly"), annual: price("starter", "annual") },
    pro: { monthly: price("pro", "monthly"), annual: price("pro", "annual") },
  };
}

// Label for this flow in the Dashboard's Checkout analytics.
const INTEGRATION_IDENTIFIER = "pricing-subscription-qwhmtrzk";

export async function createSubscriptionCheckout(opts: {
  customerId: string;
  userId: string;
  plan: Plan;
  interval: BillingInterval;
  origin: string;
}): Promise<string> {
  const prices = await getPlanPrices();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: opts.customerId,
    client_reference_id: opts.userId,
    // No payment_method_types: Stripe picks methods from Dashboard settings.
    line_items: [{ price: prices[opts.plan][opts.interval].id, quantity: 1 }],
    billing_address_collection: "auto",
    customer_update: { address: "auto", name: "auto" },
    integration_identifier: INTEGRATION_IDENTIFIER,
    success_url: `${opts.origin}/dashboard?checkout=success`,
    cancel_url: `${opts.origin}/dashboard?checkout=canceled`,
  });
  if (!session.url) throw new Error("Checkout session has no URL");
  return session.url;
}

/** Extra reports beyond the monthly allowance: one-time price, bought in bulk. */
const EXTRA_REPORT_LOOKUP_KEY = "extra_report";
export const EXTRA_REPORTS_MAX_PER_PURCHASE = 20;
const EXTRA_REPORTS_INTEGRATION_IDENTIFIER = "extra-reports-vbnqzrxk";

export async function getExtraReportPrice(): Promise<PlanPrice> {
  "use cache";
  cacheLife("hours");
  const { data } = await stripe.prices.list({
    lookup_keys: [EXTRA_REPORT_LOOKUP_KEY],
    active: true,
    limit: 1,
  });
  const p = data[0];
  if (!p?.unit_amount) throw new Error("No active extra_report price");
  return { id: p.id, amount: p.unit_amount / 100, currency: p.currency.toUpperCase() };
}

export async function createExtraReportsCheckout(opts: {
  customerId: string;
  userId: string;
  quantity: number;
  origin: string;
}): Promise<string> {
  const price = await getExtraReportPrice();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: opts.customerId,
    client_reference_id: opts.userId,
    // No payment_method_types: Stripe picks methods from Dashboard settings.
    line_items: [
      {
        price: price.id,
        quantity: opts.quantity,
        adjustable_quantity: {
          enabled: true,
          minimum: 1,
          maximum: EXTRA_REPORTS_MAX_PER_PURCHASE,
        },
      },
    ],
    customer_update: { address: "auto", name: "auto" },
    // Invoice + receipt the agent can expense.
    invoice_creation: { enabled: true },
    integration_identifier: EXTRA_REPORTS_INTEGRATION_IDENTIFIER,
    success_url: `${opts.origin}/dashboard?extra=success`,
    cancel_url: `${opts.origin}/dashboard`,
  });
  if (!session.url) throw new Error("Checkout session has no URL");
  return session.url;
}

/**
 * Adds the credits from a paid extra-reports Checkout Session. Safe to call
 * for every checkout event: it ignores other sessions, waits for payment
 * (bank debits settle later), and adds each session's credits once.
 */
export async function fulfillExtraReportPurchase(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price"],
  });
  if (session.mode !== "payment" || session.payment_status === "unpaid") return;

  const line = session.line_items?.data.find(
    (l) => l.price?.lookup_key === EXTRA_REPORT_LOOKUP_KEY,
  );
  if (!line?.quantity) return;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  const account = customerId
    ? await db.billingAccount.findUnique({ where: { stripeCustomerId: customerId } })
    : null;
  if (!account) {
    throw new Error(`No BillingAccount for extra-reports session ${session.id}`);
  }

  const quantity = line.quantity;
  try {
    await db.$transaction([
      db.extraReportPurchase.create({
        data: {
          checkoutSessionId: session.id,
          userId: account.userId,
          quantity,
          amountSubtotal: session.amount_subtotal ?? 0,
        },
      }),
      db.billingAccount.update({
        where: { userId: account.userId },
        data: { extraReportCredits: { increment: quantity } },
      }),
    ]);
  } catch (error) {
    // Already fulfilled (unique session ID): nothing to do.
    if ((error as { code?: string }).code === "P2002") return;
    throw error;
  }
}

/**
 * Takes back extra-report credits when their payment is refunded. Runs for
 * every charge.refunded event: finds the Checkout Session behind the charge
 * (Stripe object graph, not metadata) and ignores anything that isn't an
 * extra-reports purchase.
 *
 * amount_refunded is a running total, so a partial refund removes credits in
 * proportion (rounded down: C$15 of C$45 back → 1 of 3 credits), and a later
 * refund on the same charge removes only the difference. Credits already
 * spent can't be taken back; the balance stops at 0 and the shortfall is
 * logged.
 */
export async function revokeRefundedExtraReports(charge: Stripe.Charge) {
  const paymentIntent =
    typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent || charge.amount <= 0) return;

  const { data: sessions } = await stripe.checkout.sessions.list({
    payment_intent: paymentIntent,
    limit: 1,
  });
  const session = sessions[0];
  if (!session || session.mode !== "payment") return;

  const purchase = await db.extraReportPurchase.findUnique({
    where: { checkoutSessionId: session.id },
  });
  if (!purchase) return; // not an extra-reports payment

  const target = Math.min(
    purchase.quantity,
    Math.floor((purchase.quantity * charge.amount_refunded) / charge.amount),
  );

  const result = await db.$transaction(async (tx) => {
    // Lock the purchase so two deliveries (or two partial refunds) can't both
    // take the same credits.
    const [locked] = await tx.$queryRaw<{ revoked: number }[]>`
      SELECT "creditsRevoked" AS revoked FROM "ExtraReportPurchase"
      WHERE "checkoutSessionId" = ${purchase.checkoutSessionId} FOR UPDATE`;
    const delta = target - (locked?.revoked ?? target);
    if (delta <= 0) return null;
    await tx.extraReportPurchase.update({
      where: { checkoutSessionId: purchase.checkoutSessionId },
      data: { creditsRevoked: target },
    });
    // Never below zero, atomically, even with reports being created.
    const [row] = await tx.$queryRaw<{ before: number; after: number }[]>`
      WITH old AS (
        SELECT "extraReportCredits" AS c FROM "BillingAccount"
        WHERE "userId" = ${purchase.userId} FOR UPDATE
      )
      UPDATE "BillingAccount" b
      SET "extraReportCredits" = GREATEST(old.c - ${delta}::int, 0)
      FROM old
      WHERE b."userId" = ${purchase.userId}
      RETURNING old.c AS before, b."extraReportCredits" AS after`;
    return { delta, removed: row ? row.before - row.after : 0 };
  });

  if (result && result.removed < result.delta) {
    console.warn(
      `[billing] refund on ${charge.id}: ${result.delta} extra-report credits refunded but only ` +
        `${result.removed} unused; ${result.delta - result.removed} were already spent (user ${purchase.userId})`,
    );
  }
  return result;
}

/** Takes one extra-report credit if there is one. Atomic, so two parallel
 *  reports can't spend the same credit. */
export async function consumeExtraReportCredit(userId: string): Promise<boolean> {
  const { count } = await db.billingAccount.updateMany({
    where: { userId, extraReportCredits: { gt: 0 } },
    data: { extraReportCredits: { decrement: 1 } },
  });
  return count === 1;
}

/** Gives a credit back (the report it paid for wasn't created after all). */
export async function returnExtraReportCredit(userId: string) {
  await db.billingAccount.update({
    where: { userId },
    data: { extraReportCredits: { increment: 1 } },
  });
}

export async function createPortalSession(customerId: string, origin: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard`,
  });
  return session.url;
}

/**
 * Copies the customer's latest subscription from Stripe into BillingAccount.
 * Webhooks call this instead of trusting each event's payload, so events that
 * arrive out of order or twice still leave the row matching Stripe.
 */
export async function syncCustomerSubscription(customerId: string) {
  const account = await db.billingAccount.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!account) {
    console.warn(`[billing] no BillingAccount for Stripe customer ${customerId}`);
    return;
  }

  const { data } = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 1,
  });
  const sub = data[0];
  const item = sub?.items.data[0];
  const price = describePrice(item?.price);
  if (item && !price) {
    console.warn(`[billing] unknown price ${item.price.id} on ${sub.id}`);
  }

  await db.billingAccount.update({
    where: { stripeCustomerId: customerId },
    data: sub
      ? {
          stripeSubscriptionId: sub.id,
          status: sub.status,
          plan: price?.plan ?? null,
          stripePriceId: item?.price.id ?? null,
          currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
          currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        }
      : {
          stripeSubscriptionId: null,
          status: null,
          plan: null,
          stripePriceId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        },
  });
}

/** Plan, status and this month's report usage, for gating and the UI. */
export async function getEntitlement(userId: string) {
  const account = await getBillingAccount(userId);
  if (!hasActiveSubscription(account)) {
    return {
      active: false as const,
      status: account?.status ?? null,
      hasCustomer: !!account,
    };
  }
  const limits = PLANS[account.plan];
  const window = account.currentPeriodStart ? quotaWindow(account.currentPeriodStart) : null;
  const [reportsUsed, chatUsed] = window
    ? await Promise.all([
        db.report.count({
          where: { userId, createdAt: { gte: window.start, lt: window.end } },
        }),
        countChatMessages(userId, window),
      ])
    : [0, 0];
  const prices = await getPlanPrices();
  const interval: BillingInterval =
    account.stripePriceId === prices[account.plan].annual.id ? "annual" : "monthly";
  return {
    active: true as const,
    hasCustomer: true,
    plan: account.plan,
    planName: limits.name,
    interval,
    status: account.status!,
    currentPeriodEnd: account.currentPeriodEnd,
    cancelAtPeriodEnd: account.cancelAtPeriodEnd,
    reportsUsed,
    reportsLimit: limits.reports,
    reportsResetAt: window?.end ?? account.currentPeriodEnd,
    extraReportCredits: account.extraReportCredits,
    chatUsed,
    chatLimit: limits.chat,
  };
}
