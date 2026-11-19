import { connection } from "next/server";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ReportHistory } from "./dashboard-sidebar";

/**
 * Server half of the sidebar history: starts the report-list query at request
 * time (without blocking the stream) and hands it to the client component.
 * Render inside a QueryBoundary.
 */
export async function ReportHistoryPrefetch() {
  await connection();
  prefetch(trpc.report.list.queryOptions());
  return (
    <HydrateClient>
      <ReportHistory />
    </HydrateClient>
  );
}
