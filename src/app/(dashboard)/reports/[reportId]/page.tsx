import type { Metadata } from "next";
import { connection } from "next/server";
import { QueryBoundary } from "@/components/globals/query-boundary";
import { ReportDocument } from "@/components/globals/report/report-document";
import { cn } from "cn";
import { REPORT_TABS } from "@/components/globals/report/report-tabs";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { Skeleton } from "@/components/ui/skeleton";
import { AMENITY_CATEGORIES } from "@/lib/report-sections";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Property report",
  robots: { index: false, follow: false },
};

export default function ReportPage({
  params,
}: PageProps<"/reports/[reportId]">) {
  return (
    <div className="flex-1 bg-muted/50 px-4 py-6 sm:px-8 sm:py-10 print:bg-transparent print:p-0">
      <QueryBoundary
        fallback={<ReportSkeleton />}
        errorTitle="We couldn't load this report"
      >
        <ReportPrefetch params={params} />
      </QueryBoundary>
    </div>
  );
}

/**
 * Starts the report query on the server without waiting for it, and streams
 * the result to the client, where ReportDocument picks it up with
 * useSuspenseQuery (no client-side request waterfall).
 */
async function ReportPrefetch({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  await connection();
  prefetch(trpc.report.byId.queryOptions({ id: reportId }));

  return (
    <HydrateClient>
      <ReportDocument reportId={reportId} />
    </HydrateClient>
  );
}

/** Mirrors the report dashboard: header, shortcuts, tabs, tiles and cards. */
function ReportSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[90rem] space-y-4"
      aria-busy="true"
      aria-label="Loading report"
    >
      {/* Address, home details and actions; amenity and transit shortcuts. */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 sm:h-9 sm:w-80" />
            <Skeleton className="h-4 w-52" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-16" />
          </div>
          <div className="ml-auto flex gap-2">
            <Skeleton className="size-10" />
            <Skeleton className="h-10 w-20" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: SHORTCUTS }, (_, i) => (
            <Skeleton key={i} className="size-9" />
          ))}
        </div>
      </header>

      {/* Tab bar. */}
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

      {/* Overview: headline tiles. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={cn(WIDGET, "space-y-3 p-4")}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      {/* Overview: photos, map and section cards. */}
      <div className="grid gap-4 lg:grid-cols-12">
        <CardSkeleton className="lg:col-span-7" body="h-64 lg:h-[30rem]" />
        <CardSkeleton className="lg:col-span-5" body="h-64 lg:h-[30rem]" />
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton
            key={i}
            className="lg:col-span-6 xl:col-span-3"
            rows={4}
          />
        ))}
      </div>
    </div>
  );
}

/** Amenity categories plus the transit shortcuts after them. */
const SHORTCUTS = AMENITY_CATEGORIES.length + 3;

function CardSkeleton({
  className,
  body,
  rows,
}: {
  className?: string;
  /** A single block of this size, e.g. for photos or a map. */
  body?: string;
  /** Or a list of this many rows. */
  rows?: number;
}) {
  return (
    <section className={cn(WIDGET, "flex flex-col", className)}>
      <div className="flex h-12 items-center gap-2 px-4">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="flex-1 px-4 pb-4">
        {body ? (
          <Skeleton className={cn("w-full", body)} />
        ) : (
          <div className="space-y-3">
            {Array.from({ length: rows ?? 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-2.5" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
