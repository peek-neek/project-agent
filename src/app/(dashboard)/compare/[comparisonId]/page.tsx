import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cn } from "cn";
import { CompareDocument } from "@/components/globals/compare/compare-document";
import { QueryBoundary } from "@/components/globals/query-boundary";
import { REPORT_TABS } from "@/components/globals/report/report-tabs";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { LoadingSignal } from "@/components/globals/top-progress";
import { TravelModeProvider } from "@/components/globals/travel-mode";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTravelMode, TRAVEL_MODE_COOKIE } from "@/lib/travel";
import { getQueryClient, HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Comparison",
  robots: { index: false, follow: false },
};

export default function ComparePage({
  params,
}: PageProps<"/compare/[comparisonId]">) {
  return (
    <div className="flex-1 bg-muted/50 px-4 py-6 sm:px-8 sm:py-10 print:bg-transparent print:p-0">
      <QueryBoundary
        fallback={<CompareSkeleton />}
        errorTitle="We couldn't load this comparison"
      >
        <ComparePrefetch params={params} />
      </QueryBoundary>
    </div>
  );
}

/**
 * Looks up which two reports are compared, then starts both report queries
 * without waiting for them; CompareDocument picks everything up with
 * useSuspenseQuery (no client-side waterfall).
 */
async function ComparePrefetch({
  params,
}: {
  params: Promise<{ comparisonId: string }>;
}) {
  const { comparisonId } = await params;
  await connection();
  const comparison = await getQueryClient().fetchQuery(
    trpc.comparison.byId.queryOptions({ id: comparisonId }),
  );
  if (comparison) {
    prefetch(trpc.report.byId.queryOptions({ id: comparison.reportAId }));
    prefetch(trpc.report.byId.queryOptions({ id: comparison.reportBId }));
  }
  const travelMode = parseTravelMode(
    (await cookies()).get(TRAVEL_MODE_COOKIE)?.value,
  );

  return (
    <HydrateClient>
      <TravelModeProvider mode={travelMode}>
        <CompareDocument comparisonId={comparisonId} />
      </TravelModeProvider>
    </HydrateClient>
  );
}

/** Mirrors the comparison: "A vs B", the view switch, tabs and duel tiles. */
function CompareSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[90rem] space-y-4"
      aria-busy="true"
      aria-label="Loading comparison"
    >
      <LoadingSignal />
      <header className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-8 w-[min(36rem,100%)] sm:h-9" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-40" />
        </div>
      </header>

      <div className="-mx-4 border-b bg-muted/50 px-4 pt-1 sm:-mx-8 sm:px-8">
        <div className="flex gap-1 overflow-hidden">
          {REPORT_TABS.map((t) => (
            <span
              key={t.id}
              className="flex h-11 flex-none items-center gap-2 px-3 text-sm text-foreground/30"
            >
              <t.icon aria-hidden className="size-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className={cn(WIDGET, "h-32")} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={cn(WIDGET, "space-y-3 p-4")}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
