import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { caller } from "@/trpc/server";
import { createReportInput } from "@/trpc/routers/report";

export async function GET(request: NextRequest) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });

  const parsed = createReportInput.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) redirect("/dashboard");

  const report = await caller.report.create(parsed.data);
  redirect(`/reports/${report.id}`);
}
