import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  createExtraReportsCheckout,
  EXTRA_REPORTS_MAX_PER_PURCHASE,
  getBillingAccount,
  hasActiveSubscription,
} from "@/server/billing";

/**
 * GET /billing/extra-reports?quantity=N → Stripe Checkout for extra reports
 * at C$15 each (quantity can be changed on the Checkout page). Plan holders
 * only; anyone else is sent to the dashboard to pick a plan first.
 */
export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const origin = request.nextUrl.origin;
  const account = await getBillingAccount(userId);
  if (!hasActiveSubscription(account)) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  const requested = Number(request.nextUrl.searchParams.get("quantity"));
  const quantity = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), EXTRA_REPORTS_MAX_PER_PURCHASE)
    : 1;

  const url = await createExtraReportsCheckout({
    customerId: account.stripeCustomerId,
    userId,
    quantity,
    origin,
  });
  return NextResponse.redirect(url, 303);
}
