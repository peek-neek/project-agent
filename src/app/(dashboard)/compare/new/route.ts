import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isBillingError } from "@/lib/billing";
import { caller } from "@/trpc/server";
import { createComparisonInput } from "@/trpc/routers/comparison";

export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const parsed = createComparisonInput.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) redirect("/dashboard");

  let comparisonId: string;
  try {
    comparisonId = (await caller.comparison.create(parsed.data)).id;
  } catch (error) {
    // No plan, or not enough reports left for both properties: back to the
    // dashboard, which explains why and offers the fix.
    if (error instanceof TRPCError && isBillingError(error.message)) {
      redirect(`/dashboard?billing=${error.message}`);
    }
    // The same property twice (the form stops this first).
    if (error instanceof TRPCError && error.code === "BAD_REQUEST") {
      redirect("/dashboard");
    }
    throw error;
  }
  redirect(`/compare/${comparisonId}`);
}
