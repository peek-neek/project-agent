import "server-only";
import Stripe from "stripe";

// One Stripe client instance for the server. The key comes from the
// environment (never from source); prefer a restricted key (rk_…) here.
const globalForStripe = globalThis as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2026-11-18.endive",
    appInfo: { name: "project-agent" },
  });

if (process.env.NODE_ENV !== "production") globalForStripe.stripe = stripe;
