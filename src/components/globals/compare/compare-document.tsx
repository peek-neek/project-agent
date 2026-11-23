"use client";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  GitCompareArrowsIcon,
  LoaderCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { motion, AnimatePresence } from "motion/react";
import { notFound, useSearchParams } from "next/navigation";
import { useMemo, useRef } from "react";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTravelMode } from "@/components/globals/travel-mode";
import { JOB_KINDS, type JobKind } from "@/lib/report-sections";
import { ReportDashboard } from "@/components/globals/report/report-dashboard";
import {
  formatDate,
  type ReportData,
} from "@/components/globals/report/report-format";
import { getJob, isJobActive } from "@/components/globals/report/report-hooks";
import {
  parseTab,
  REPORT_TABS,
  type TabId,
} from "@/components/globals/report/report-tabs";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { useTRPC } from "@/trpc/client";
import { CompareAmenities } from "./compare-amenities";
import { CompareCalculators } from "./compare-calculators";
import { CompareCommute } from "./compare-commute";
import { CompareCopy } from "./compare-copy";
import { CompareNeighbourhood } from "./compare-neighbourhood";
import { CompareOverview, compareLeader } from "./compare-overview";
import { CompareSafety } from "./compare-safety";
import { CompareSchools } from "./compare-schools";
import {
  type CompareProperty,
  CrownedChip,
  SideChip,
  type Side,
  SIDES,
  toProperty,
} from "./compare-shared";
import { CompareUpside } from "./compare-upside";
import { StickyNote } from "@/components/globals/report/sticky-note";

/** Height of the sticky dashboard header the tab bar sits under. */
const STICKY_OFFSET = 56;

type View = Side | "both";
const parseView = (value: string | null): View =>
  value === "a" || value === "b" ? value : "both";

/** Polls a report while any of its steps is still running. */
const poll = {
  refetchInterval: (query: { state: { data?: ReportData | null } }) =>
    query.state.data?.jobs.some((j) => isJobActive(j)) ? 2500 : false,
};

export function CompareDocument({ comparisonId }: { comparisonId: string }) {
  const trpc = useTRPC();
  // Suspends until the server prefetch arrives; errors go to QueryBoundary.
  const { data: comparison } = useSuspenseQuery(
    trpc.comparison.byId.queryOptions({ id: comparisonId }),
  );
  if (!comparison) notFound();
  const [{ data: reportA }, { data: reportB }] = useSuspenseQueries({
    queries: [comparison.reportAId, comparison.reportBId].map((id) =>
      trpc.report.byId.queryOptions({ id }, poll),
    ),
  });
  if (!reportA || !reportB) notFound();

  const travel = useTravelMode();
  const a = useMemo(
    () => toProperty("a", reportA, travel.mode),
    [reportA, travel.mode],
  );
  const b = useMemo(
    () => toProperty("b", reportB, travel.mode),
    [reportB, travel.mode],
  );
  const props = { a, b };
  const leader = compareLeader(a, b, travel.mode);

  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  // Native history API, like the report tabs: no server round trip.
  const setView = (next: View, tab?: TabId) => {
    const url = new URL(window.location.href);
    if (next === "both") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    if (tab) {
      if (tab === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", tab);
    }
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-4">
      <header className="space-y-4">
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/55">
            <GitCompareArrowsIcon aria-hidden className="size-3.5" />
            {comparison.name ?? "Comparison"} ·{" "}
            {formatDate(comparison.createdAt)}
          </p>
          {/* Each property is a block: chip + street, its place right under
              the street. "vs" lines up with the streets, and on narrow
              screens B wraps below A as a whole block. */}
          <h1 className="flex flex-wrap items-start gap-x-3 gap-y-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {SIDES.map((side, i) => (
              <span key={side} className="contents">
                {i > 0 && (
                  <span className="flex h-8 items-center text-base font-medium text-foreground/40 sm:h-9 sm:text-lg">
                    vs
                  </span>
                )}
                <span className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
                  <CrownedChip
                    side={side}
                    crowned={leader === side}
                    label="Leads overall"
                    className="size-6 text-sm"
                  />
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{props[side].street}</span>
                    <StickyNote
                      report={props[side].report}
                      street={props[side].street}
                    />
                  </span>
                  <span className="col-start-2 truncate text-sm font-normal tracking-normal text-foreground/60">
                    {props[side].place}
                  </span>
                </span>
              </span>
            ))}
          </h1>
        </div>

        {/* Both: the comparison. A or B: that property's full report. */}
        <ToggleGroup
          aria-label="Show"
          value={[view]}
          onValueChange={(value) => {
            const next = value[0] as View | undefined;
            if (next) setView(next);
          }}
          spacing={1}
          className="flex w-full flex-wrap justify-start"
        >
          {(["a", "both", "b"] as const).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              className="h-9 max-w-[16rem] gap-2 border bg-card px-3 data-pressed:border-foreground data-pressed:bg-foreground data-pressed:text-background"
            >
              {v === "both" ? (
                <>
                  <GitCompareArrowsIcon aria-hidden />
                  Compare
                </>
              ) : (
                <>
                  <CrownedChip
                    side={v}
                    crowned={leader === v}
                    label="Leads overall"
                    className="ring-1 ring-background/60"
                  />
                  <span className="truncate">{props[v].street}</span>
                </>
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>

      {/* An address that couldn't be placed: say so once, up front, rather
          than leaving its column empty in every tab. */}
      {view === "both" &&
        SIDES.map((side) => {
          const report = props[side].report;
          const identity = getJob(report, JOB_KINDS.identity);
          if (identity?.status !== "failed" || props[side].home) return null;
          return (
            <Alert key={side} className="border-destructive/30 px-4 py-3">
              <AlertCircleIcon className="text-destructive" />
              <AlertTitle className="flex items-center gap-2">
                <SideChip side={side} />
                We couldn&apos;t locate {props[side].street}
              </AlertTitle>
              <AlertDescription>
                {identity.error ??
                  "Check the street number and town, or drop a pin on the map."}{" "}
                Its column stays empty until it&apos;s fixed; start a new
                comparison with the corrected address.
              </AlertDescription>
              <AlertAction className="top-1/2 right-3 -translate-y-1/2">
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/dashboard" />}
                >
                  New search
                </Button>
              </AlertAction>
            </Alert>
          );
        })}

      {view === "both" ? (
        <CompareDashboard
          a={a}
          b={b}
          onOpen={(side, tab) => setView(side, tab)}
        />
      ) : (
        // Keyed: switching property starts that report fresh.
        <ReportDashboard key={view} report={props[view].report} />
      )}
    </div>
  );
}

function CompareDashboard({
  a,
  b,
  onOpen,
}: {
  a: CompareProperty;
  b: CompareProperty;
  /** Opens one property's own report on a tab. */
  onOpen: (side: Side, tab: TabId) => void;
}) {
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const tabsTopRef = useRef<HTMLDivElement>(null);
  const props = { a, b };

  const goTo = (next: TabId) => {
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    // Only scroll if the reader is already past the tab bar.
    const marker = tabsTopRef.current;
    if (marker && marker.getBoundingClientRect().top < STICKY_OFFSET) {
      window.scrollTo({
        top:
          window.scrollY + marker.getBoundingClientRect().top - STICKY_OFFSET,
        behavior: "instant",
      });
    }
  };

  const kinds = Object.values(JOB_KINDS);
  const progress = SIDES.map((side) => {
    const jobs = kinds.map((k) => getJob(props[side].report, k));
    return {
      side,
      working: jobs.some((j) => isJobActive(j)),
      done: jobs.filter((j) => j?.status === "completed").length,
    };
  });
  const working = progress.some((p) => p.working);

  const tabState = (tabKinds: readonly JobKind[]) => {
    const jobs = SIDES.flatMap((s) =>
      tabKinds.map((k) => getJob(props[s].report, k)),
    );
    if (jobs.some((j) => isJobActive(j))) return "active";
    if (jobs.some((j) => j?.status === "failed")) return "failed";
    return null;
  };

  return (
    <>
      {/* Both reports' progress while either is still being made. */}
      <AnimatePresence initial={false}>
        {working && (
          <motion.div
            key="progress"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                WIDGET,
                "grid gap-3 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6",
              )}
              aria-live="polite"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <LoaderCircleIcon
                  aria-hidden
                  className="size-4 animate-spin text-primary"
                />
                Preparing the comparison
              </span>
              {progress.map((p) => (
                <span key={p.side} className="flex items-center gap-2">
                  <SideChip side={p.side} />
                  <Progress
                    value={(p.done / kinds.length) * 100}
                    aria-label={`Property ${p.side.toUpperCase()}: ${p.done} of ${kinds.length} steps`}
                    className="flex-1"
                  />
                  <span className="text-xs text-foreground/55 tabular-nums">
                    {p.done}/{kinds.length}
                  </span>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={tabsTopRef}>
        <Tabs
          value={tab}
          onValueChange={(value) => goTo(value as TabId)}
          className="gap-4"
        >
          {/* Sticky like a report's tab bar: every section one click away. */}
          <div className="sticky top-14 z-[15] -mx-4 bg-background sm:-mx-8">
            <div className="border-b bg-muted/50 px-4 pt-1 sm:px-8">
              <TabsList className="relative h-auto w-full scroll-fade-x no-scrollbar justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain bg-transparent p-0 group-data-horizontal/tabs:h-auto">
                {REPORT_TABS.map((t) => {
                  const state = tabState(t.kinds);
                  return (
                    <TabsTrigger
                      key={t.id}
                      value={t.id}
                      className="relative h-11 flex-none gap-2 border-0 px-3 text-foreground/60 transition-colors after:hidden hover:bg-transparent hover:text-foreground data-active:bg-transparent data-active:text-foreground data-active:shadow-none group-data-[variant=default]/tabs-list:data-active:shadow-none"
                    >
                      <t.icon aria-hidden />
                      <span className="hidden sm:inline">{t.label}</span>
                      <span className="sr-only sm:hidden">{t.label}</span>
                      {state === "active" && (
                        <LoaderCircleIcon
                          aria-label="Preparing"
                          className="size-3.5 animate-spin"
                        />
                      )}
                      {state === "failed" && (
                        <span
                          aria-label="Needs attention"
                          className="size-1.5 bg-destructive"
                        />
                      )}
                    </TabsTrigger>
                  );
                })}
                <TabsPrimitive.Indicator
                  renderBeforeHydration
                  className="absolute bottom-0 left-0 h-[3px] w-[calc(var(--active-tab-width)-16px)] translate-x-[calc(var(--active-tab-left)+8px)] bg-primary transition-[translate,width] duration-300 ease-out motion-reduce:transition-none"
                />
              </TabsList>
            </div>
          </div>

          {REPORT_TABS.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {t.id === "overview" && (
                  <CompareOverview a={a} b={b} onNavigate={goTo} />
                )}
                {t.id === "amenities" && <CompareAmenities a={a} b={b} />}
                {t.id === "commute" && <CompareCommute a={a} b={b} />}
                {t.id === "schools" && <CompareSchools a={a} b={b} />}
                {t.id === "safety" && <CompareSafety a={a} b={b} />}
                {t.id === "neighbourhood" && (
                  <CompareNeighbourhood a={a} b={b} />
                )}
                {t.id === "upside" && <CompareUpside a={a} b={b} />}
                {t.id === "calculators" && (
                  <CompareCalculators
                    a={a}
                    b={b}
                    onOpen={(side) => onOpen(side, "calculators")}
                  />
                )}
                {t.id === "marketing" && (
                  <CompareCopy a={a} b={b} kind="marketing" />
                )}
                {t.id === "playbook" && (
                  <CompareCopy a={a} b={b} kind="playbook" />
                )}
              </motion.div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <p className="pb-6 text-xs leading-relaxed text-foreground/50">
        Data from Google Maps, Statistics Canada, Ontario Ministry of Education,
        Ontario Builds, the Ontario Road and Railway Networks, municipal open
        data, Toronto Police Service and TRCA. AI copy may contain errors:
        review before sharing. Each property&apos;s PDF lists the full sources.
      </p>
    </>
  );
}
