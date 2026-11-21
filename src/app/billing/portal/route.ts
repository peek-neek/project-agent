import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { createPortalSession, getBillingAccount } from "@/server/billing";

/** GET /billing/portal → Stripe Customer Portal (change plan, card, cancel). */
export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const origin = request.nextUrl.origin;
  const account = await getBillingAccount(userId);
  if (!account) return NextResponse.redirect(new URL("/dashboard", origin));

  const url = await createPortalSession(account.stripeCustomerId, origin);
  return NextResponse.redirect(url, 303);
}
