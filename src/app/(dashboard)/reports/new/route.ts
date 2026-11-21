import { auth } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isBillingError } from "@/lib/billing";
import { caller } from "@/trpc/server";
import { createReportInput } from "@/trpc/routers/report";

export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const parsed = createReportInput.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) redirect("/dashboard");

  let reportId: string;
  try {
    reportId = (await caller.report.create(parsed.data)).id;
  } catch (error) {
    // No plan, or this month's reports are used up: back to the dashboard,
    // which explains why and offers the fix.
    if (error instanceof TRPCError && isBillingError(error.message)) {
      redirect(`/dashboard?billing=${error.message}`);
    }
    throw error;
  }
  redirect(`/reports/${reportId}`);
}
