import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import {
  createExtraReportsCheckout,
  EXTRA_REPORTS_MAX_PER_PURCHASE,
  getOrCreateCustomer,
} from "@/server/billing";

/**
 * GET /billing/extra-reports?quantity=N → Stripe Checkout for extra reports
 * at C$15 each (quantity can be changed on the Checkout page). Open to every
 * signed-in agent, Basic (free) included: their Stripe customer is created
 * here if they don't have one yet.
 */
export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const origin = request.nextUrl.origin;
  const user = await currentUser();
  const customerId = await getOrCreateCustomer(
    userId,
    user?.primaryEmailAddress?.emailAddress,
  );

  const requested = Number(request.nextUrl.searchParams.get("quantity"));
  const quantity = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), EXTRA_REPORTS_MAX_PER_PURCHASE)
    : 1;

  const url = await createExtraReportsCheckout({
    customerId,
    userId,
    quantity,
    origin,
  });
  return NextResponse.redirect(url, 303);
}
