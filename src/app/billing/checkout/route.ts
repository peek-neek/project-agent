import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isBillingInterval } from "@/lib/billing";
import {
  createSubscriptionCheckout,
  getBillingAccount,
  getOrCreateCustomer,
  hasActiveSubscription,
  isPlan,
} from "@/server/billing";

/**
 * GET /billing/checkout?plan=starter|pro&interval=monthly|annual → Stripe
 * Checkout (interval defaults to monthly).
 * Linked from the dashboard, and used as the redirect after sign-up when a
 * visitor picks a plan on the pricing table. Already-subscribed users go to
 * the Customer Portal instead, so nobody ends up with two subscriptions.
 */
export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const origin = request.nextUrl.origin;
  const plan = request.nextUrl.searchParams.get("plan");
  if (!isPlan(plan)) return NextResponse.redirect(new URL("/dashboard", origin));
  const intervalParam = request.nextUrl.searchParams.get("interval");
  const interval = isBillingInterval(intervalParam) ? intervalParam : "monthly";

  const account = await getBillingAccount(userId);
  if (hasActiveSubscription(account)) {
    return NextResponse.redirect(new URL("/billing/portal", origin));
  }

  const user = await currentUser();
  const customerId = await getOrCreateCustomer(
    userId,
    user?.primaryEmailAddress?.emailAddress,
  );
  const url = await createSubscriptionCheckout({
    customerId,
    userId,
    plan,
    interval,
    origin,
  });
  return NextResponse.redirect(url, 303);
}
