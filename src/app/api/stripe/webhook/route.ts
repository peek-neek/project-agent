import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import {
  fulfillExtraReportPurchase,
  revokeRefundedExtraReports,
  syncCustomerSubscription,
} from "@/server/billing";
import { db } from "@/server/db";
import { stripe } from "@/server/stripe";

/**
 * POST /api/stripe/webhook — Stripe events that change what an agent can do.
 * Every handled event re-syncs the customer's subscription from Stripe
 * (syncCustomerSubscription), so order and duplicates don't matter.
 *
 * Subscribe the endpoint (Dashboard → Developers → Webhooks) to exactly the
 * event types in HANDLED below.
 */
const HANDLED = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  // Risk events: re-sync and log so someone can act on them.
  "charge.dispute.created",
  "charge.refunded",
  "radar.early_fraud_warning.created",
]);

type CustomerRef = string | Stripe.Customer | Stripe.DeletedCustomer | null;

function customerId(ref: CustomerRef | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

async function customerOfCharge(charge: string | Stripe.Charge) {
  const c = typeof charge === "string" ? await stripe.charges.retrieve(charge) : charge;
  return customerId(c.customer);
}

/** The Stripe customer an event belongs to, via Stripe's own object graph. */
async function resolveCustomer(event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
      return event.data.object.mode === "subscription"
        ? customerId(event.data.object.customer)
        : null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
    case "invoice.paid":
    case "invoice.payment_failed":
    case "charge.refunded":
      return customerId(event.data.object.customer);
    case "charge.dispute.created":
    case "radar.early_fraud_warning.created":
      return customerOfCharge(event.data.object.charge);
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Raw body: signature verification fails on re-serialized JSON.
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (!HANDLED.has(event.type)) return Response.json({ received: true });

  const seen = await db.stripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    const customer = await resolveCustomer(event);
    if (customer) await syncCustomerSubscription(customer);

    // Extra reports (one-time payment): add credits once the money is in.
    // completed covers cards; async_payment_succeeded covers bank debits,
    // where completed arrives while the session is still unpaid.
    if (
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      event.data.object.mode === "payment"
    ) {
      await fulfillExtraReportPurchase(event.data.object.id);
    }
    // Refunded extra reports: take back the unused credits.
    if (event.type === "charge.refunded") {
      await revokeRefundedExtraReports(event.data.object);
    }
    if (
      event.type === "checkout.session.async_payment_failed" &&
      event.data.object.mode === "payment"
    ) {
      console.warn(`[stripe] extra-reports payment failed ${event.data.object.id}`);
    }

    if (
      event.type === "charge.dispute.created" ||
      event.type === "charge.refunded" ||
      event.type === "radar.early_fraud_warning.created"
    ) {
      console.warn(`[stripe] ${event.type} ${event.data.object.id} customer=${customer}`);
    }
  } catch (error) {
    console.error(`[stripe] failed to handle ${event.type} ${event.id}`, error);
    // 500 → Stripe retries with backoff.
    return new Response("Handler failed", { status: 500 });
  }

  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    // A concurrent delivery recorded it first; the sync is idempotent anyway.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
      throw error;
    }
  }
  return Response.json({ received: true });
}
