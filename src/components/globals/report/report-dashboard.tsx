"use client";

import { cn } from "cn";
import {
  AlertCircleIcon,
  CheckIcon,
  GraduationCapIcon,
  LoaderCircleIcon,
  type LucideIcon,
  MapPinIcon,
  RefreshCwIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  StoreIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  aiMetaSchema,
  AMENITY_CATEGORIES,
  amenitiesSchema,
  commuteSchema,
  demographicsSchema,
  insightsSchema,
  JOB_KINDS,
  type JobKind,
  listingSchema,
  marketingSchema,
  campaignSchema,
  showingSchema,
  SECTION_KEYS,
  safetySchema,
  TRANSIT_KINDS,
  type TransitKind,
  schoolsSchema,
  upsideSchema,
} from "@/lib/report-sections";
import { type AmenityFilter, AmenitiesTab } from "./amenities-tab";
import { AMENITY_ICONS } from "./amenity-icons";
import { CommuteTab, type StopFilter } from "./commute-tab";
import { NeighbourhoodTab } from "./neighbourhood-tab";
import { MarketingTab } from "./marketing-tab";
import { HomeFacts } from "./home-facts";
import { OverviewTab, type ReportSectionsData } from "./overview-tab";
import { PlaybookTab } from "./playbook-tab";
import { DownloadPdfButton } from "./download-pdf-button";
import { formatDate, formatDistance, type ReportData } from "./report-format";
import {
  getCopySection,
  getJob,
  getSection,
  hasCopyForMode,
  isJobActive,
  useRerunJob,
} from "./report-hooks";
import { TRANSIT_ICONS } from "./transit-icons";
import { useTravelMode } from "@/components/globals/travel-mode";
import type { TravelTimes } from "@/lib/travel";
import { parseTab, REPORT_TABS, type TabId } from "./report-tabs";
import { SafetyTab } from "./safety-tab";
import { UpsideTab } from "./upside-tab";
import { CalculatorsTab } from "./calculators/calculators-tab";
import { savedCalculatorsSchema } from "@/lib/finance/scenario";
import { SchoolsTab } from "./schools-tab";
import { SectionGate } from "./section-gate";
import {
  AmenitiesSkeleton,
  CommuteSkeleton,
  MarketingSkeleton,
  NeighbourhoodSkeleton,
  PlaybookSkeleton,
  SafetySkeleton,
  SchoolsSkeleton,
  UpsideSkeleton,
} from "./report-skeletons";
import { WIDGET } from "./widget-styles";

/** Header shortcuts show places reachable within this many minutes. */
const REACH_MINUTES = 15;
const REACH_PHRASE = {
  walk: "walk",
  bike: "by bike",
  drive: "by car",
} as const;
/** Shortcut icons ease in and out as the travel mode changes. */
const SHORTCUT_MOTION = {
  layout: "position",
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.85 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;

const MODE_GERUND = {
  walk: "walking",
  bike: "cycling",
  drive: "driving",
} as const;

/** Height of the sticky dashboard header the tab bar sits under. */
const STICKY_OFFSET = 56;

const STEP_ICONS: Record<JobKind, { icon: LucideIcon; label: string }> = {
  [JOB_KINDS.identity]: { icon: MapPinIcon, label: "Address" },
  [JOB_KINDS.amenities]: { icon: StoreIcon, label: "Amenities" },
  [JOB_KINDS.commute]: { icon: RouteIcon, label: "Commute" },
  [JOB_KINDS.schools]: { icon: GraduationCapIcon, label: "Schools" },
  [JOB_KINDS.demographics]: { icon: UsersIcon, label: "Census" },
  [JOB_KINDS.safety]: { icon: ShieldCheckIcon, label: "Safety" },
  [JOB_KINDS.upside]: { icon: TrendingUpIcon, label: "Upside" },
  [JOB_KINDS.ai]: { icon: SparklesIcon, label: "AI copy" },
};

/** Header shortcut: the place icon over its travel time. */
const SHORTCUT_TILE =
  "size-9 flex-col gap-0.5 bg-card p-0 [&_svg:not([class*='size-'])]:size-3.5";

/** The travel mode's icon and the minutes, together under the place icon. */
function ShortcutTime({
  icon: ModeIcon,
  minutes,
}: {
  icon: LucideIcon;
  minutes: number;
}) {
  return (
    <span className="flex items-center gap-0.5 text-[9px] leading-none font-semibold text-foreground/60 tabular-nums">
      <ModeIcon aria-hidden className="size-2 text-foreground/45" />
      {Math.max(1, Math.round(minutes))}
    </span>
  );
}

export function ReportDashboard({ report }: { report: ReportData }) {
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));
  const [amenityFilter, setAmenityFilter] = useState<AmenityFilter>("all");
  const [stopFilter, setStopFilter] = useState<StopFilter>("all");
  const travel = useTravelMode();
  const [detailsChanged, setDetailsChanged] = useState(false);
  const tabsTopRef = useRef<HTMLDivElement>(null);
  const rerun = useRerunJob(report.id);

  // Native history API: Next keeps useSearchParams in sync, with no
  // server round trip (the report data is already on the client).
  const goTo = (next: TabId, focus?: string) => {
    const url = new URL(window.location.href);
    if (next === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);

    if (focus) {
      // Header shortcut: open that amenity category or transit stop kind.
      if (next === "commute") setStopFilter(focus as StopFilter);
      else setAmenityFilter(focus as AmenityFilter);
      return;
    }
    // Plain tab switch: only scroll if the reader is already past the tab
    // bar, back to where the content starts.
    const marker = tabsTopRef.current;
    if (marker && marker.getBoundingClientRect().top < STICKY_OFFSET) {
      window.scrollTo({
        top:
          window.scrollY + marker.getBoundingClientRect().top - STICKY_OFFSET,
        behavior: "instant",
      });
    }
  };

  const data: ReportSectionsData = {
    amenities: getSection(report, SECTION_KEYS.amenities, amenitiesSchema),
    commute: getSection(report, SECTION_KEYS.commute, commuteSchema),
    schools: getSection(report, SECTION_KEYS.schools, schoolsSchema),
    demographics: getSection(
      report,
      SECTION_KEYS.demographics,
      demographicsSchema,
    ),
    safety: getSection(report, SECTION_KEYS.safety, safetySchema),
    upside: getSection(report, SECTION_KEYS.upside, upsideSchema),
    // AI copy follows the travel mode (each mode has its own copy).
    insights: getCopySection(
      report,
      SECTION_KEYS.insights,
      insightsSchema,
      travel.mode,
    ),
    listing: getSection(report, SECTION_KEYS.listing, listingSchema),
  };
  const marketing = getCopySection(
    report,
    SECTION_KEYS.marketing,
    marketingSchema,
    travel.mode,
  );
  const campaign = getCopySection(
    report,
    SECTION_KEYS.campaign,
    campaignSchema,
    travel.mode,
  );
  const showing = getCopySection(
    report,
    SECTION_KEYS.showing,
    showingSchema,
    travel.mode,
  );

  const jobs = Object.values(JOB_KINDS).map((kind) => ({
    kind,
    job: getJob(report, kind),
  }));
  const working = jobs.some(({ job }) => isJobActive(job));
  const done = jobs.filter(({ job }) => job?.status === "completed").length;
  const aiJob = getJob(report, JOB_KINDS.ai);
  const identityJob = getJob(report, JOB_KINDS.identity);
  const unlocated =
    identityJob?.status === "failed" && report.property?.latitude == null;

  // Reports from before place photos existed: refresh amenities once in the
  // background so the photo gallery fills in on its own. (New data always has
  // a `photo` key, null when Google has none.)
  const amenitiesJob = getJob(report, JOB_KINDS.amenities);
  const backfilled = useRef(false);
  const amenityPlaces = data.amenities
    ? Object.values(data.amenities.categories).flat()
    : [];
  // Also refresh reports made before newer categories existed (every
  // fetched category is stored, even when empty).
  const needsPhotos =
    (amenityPlaces.length > 0 &&
      amenityPlaces.every((p) => p.photo === undefined)) ||
    (data.amenities != null &&
      AMENITY_CATEGORIES.some((c) => !(c.id in data.amenities!.categories)));
  useEffect(() => {
    if (!needsPhotos || backfilled.current || isJobActive(amenitiesJob)) return;
    backfilled.current = true;
    rerun.mutate({ id: report.id, kind: JOB_KINDS.amenities });
  }, [needsPhotos, amenitiesJob, rerun, report.id]);

  // Reports from before Ontario-wide crime and noise data: refresh safety once.
  const safetyJob = getJob(report, JOB_KINDS.safety);
  const safetyBackfilled = useRef(false);
  // Also older reports without province-wide highway/rail distances.
  const needsAreaCrime =
    data.safety != null &&
    (data.safety.areaCrime === undefined || !data.safety.noise.roadsCovered);
  useEffect(() => {
    if (!needsAreaCrime || safetyBackfilled.current || isJobActive(safetyJob))
      return;
    safetyBackfilled.current = true;
    rerun.mutate({ id: report.id, kind: JOB_KINDS.safety });
  }, [needsAreaCrime, safetyJob, rerun, report.id]);

  // Reports from when development applications were Toronto-only: refresh
  // upside once so connected municipalities fill in.
  const upsideJob = getJob(report, JOB_KINDS.upside);
  const upsideBackfilled = useRef(false);
  const needsDevelopment =
    data.upside != null &&
    data.upside.development == null &&
    /Toronto only/i.test(data.upside.developmentNote ?? "");
  useEffect(() => {
    if (!needsDevelopment || upsideBackfilled.current || isJobActive(upsideJob))
      return;
    upsideBackfilled.current = true;
    rerun.mutate({ id: report.id, kind: JOB_KINDS.upside });
  }, [needsDevelopment, upsideJob, rerun, report.id]);

  const regenerate = () => {
    setDetailsChanged(false);
    rerun.mutate({ id: report.id, kind: JOB_KINDS.ai });
  };
  const regenerating = isJobActive(aiJob) || rerun.isPending;
  // AI copy written for another travel mode (older copy: walk).
  // Older copy written for one mode only: offer to write it for this one.
  const copyMeta = getSection(report, SECTION_KEYS.marketing, aiMetaSchema);
  const copyModeStale =
    copyMeta != null &&
    !hasCopyForMode(report, SECTION_KEYS.marketing, travel.mode) &&
    (copyMeta.travelMode ?? "walk") !== travel.mode;

  // Header shortcuts: only what's reachable within REACH_MINUTES in the
  // selected mode, so walking shows a few, cycling more, driving most.
  const quickest = <T extends TravelTimes>(places: T[]) =>
    places.reduce<T | undefined>(
      (best, p) =>
        !best || travel.time(p).minutes < travel.time(best).minutes ? p : best,
      undefined,
    );
  const reachable = <T extends TravelTimes>(places: T[]) => {
    const best = quickest(places);
    return best && travel.time(best).minutes <= REACH_MINUTES ? best : null;
  };
  /** How many of these places are within REACH_MINUTES (for the tooltip). */
  const countInReach = (places: TravelTimes[]) =>
    places.filter((p) => travel.time(p).minutes <= REACH_MINUTES).length;
  const amenityShortcuts = AMENITY_CATEGORIES.flatMap((category) => {
    const places = data.amenities?.categories[category.id] ?? [];
    const nearest = reachable(places);
    return nearest ? [{ category, nearest, count: countInReach(places) }] : [];
  });
  const transitShortcuts = (
    Object.keys(TRANSIT_KINDS) as TransitKind[]
  ).flatMap((kind) => {
    const places = data.commute?.stations.filter((s) => s.kind === kind) ?? [];
    const nearest = reachable(places);
    return nearest ? [{ kind, nearest, count: countInReach(places) }] : [];
  });
  const shortcutsLoading =
    (!data.amenities && isJobActive(getJob(report, JOB_KINDS.amenities))) ||
    (!data.commute && isJobActive(getJob(report, JOB_KINDS.commute)));

  const full = report.property?.formattedAddress ?? report.inputAddress;
  const [street, ...rest] = full.split(",").map((s) => s.trim());
  const place = rest.filter((s) => s !== "Canada").join(", ");

  const tabState = (kinds: readonly JobKind[]) => {
    const states = kinds.map((k) => getJob(report, k));
    if (states.some((j) => isJobActive(j))) return "active";
    if (states.some((j) => j?.status === "failed")) return "failed";
    return null;
  };

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-4">
      {/* Address with the home's details, actions; amenities underneath. */}
      <header className="space-y-4">
        {/* Two columns: address and the home's details on the left, the
            actions pinned top-right (they never wrap under the details when
            the sidebar narrows the page). Stacked on phones. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                {street}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-foreground/60">
                <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
                <span className="truncate">{place || "Ontario"}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">{formatDate(report.createdAt)}</span>
              </p>
            </div>
            <HomeFacts
              report={report}
              listing={data.listing}
              onSaved={() => setDetailsChanged(true)}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2 max-sm:order-first max-sm:self-end">
            {detailsChanged || (copyModeStale && !regenerating) ? (
              <Button
                onClick={regenerate}
                disabled={regenerating}
                className="h-10 px-4"
              >
                <RefreshCwIcon data-icon="inline-start" />
                {detailsChanged
                  ? "Regenerate copy"
                  : `Rewrite copy for ${MODE_GERUND[travel.mode]}`}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={regenerate}
                      disabled={regenerating}
                      aria-label="Regenerate AI copy"
                      className="size-10 bg-card"
                    />
                  }
                >
                  <RefreshCwIcon
                    className={regenerating ? "animate-spin" : undefined}
                  />
                </TooltipTrigger>
                <TooltipContent>Regenerate AI copy</TooltipContent>
              </Tooltip>
            )}
            {/* Fixed width: "PDF" / "Preparing…" / "Try again" don't shift the row. */}
            <DownloadPdfButton
              reportId={report.id}
              disabled={working}
              className="h-10 w-32 px-4"
            />
          </div>
        </div>

        {/* Instant tooltips; moving along the row switches them at once. */}
        <TooltipProvider delay={0} closeDelay={0}>
          <ul
            aria-label={`Reachable within ${REACH_MINUTES} minutes ${REACH_PHRASE[travel.mode]}`}
            className="flex min-h-9 flex-wrap items-center gap-1.5"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {amenityShortcuts.map(({ category, nearest, count }) => {
                const Icon = AMENITY_ICONS[category.id];
                const tip = `${category.label} · ${travel.minutes(nearest)} ${travel.verb} · ${nearest.name}`;
                return (
                  <motion.li key={category.id} {...SHORTCUT_MOTION}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={tip}
                            onClick={() => goTo("amenities", category.id)}
                            className={SHORTCUT_TILE}
                          />
                        }
                      >
                        <Icon aria-hidden style={{ color: category.color }} />
                        <ShortcutTime
                          icon={travel.icon}
                          minutes={travel.time(nearest).minutes}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="p-0">
                        <ShortcutTip
                          icon={Icon}
                          color={category.color}
                          label={category.label}
                          place={nearest}
                          time={`${travel.minutes(nearest)} ${travel.verb}`}
                          count={count}
                          reach={`${REACH_MINUTES} min ${REACH_PHRASE[travel.mode]}`}
                          rating={nearest.rating}
                          action="See all on the Amenities tab"
                        />
                      </TooltipContent>
                    </Tooltip>
                  </motion.li>
                );
              })}

              {/* Transit overview; the Commute tab has the detail. */}
              {amenityShortcuts.length > 0 && transitShortcuts.length > 0 && (
                <motion.li
                  key="divider"
                  aria-hidden
                  className="flex h-9 px-1"
                  {...SHORTCUT_MOTION}
                >
                  <Separator orientation="vertical" />
                </motion.li>
              )}
              {transitShortcuts.map(({ kind, nearest, count }) => {
                const meta = TRANSIT_KINDS[kind];
                const Icon = TRANSIT_ICONS[kind];
                const tip = `${meta.label} · ${travel.minutes(nearest)} ${travel.verb} · ${nearest.name}`;
                return (
                  <motion.li key={kind} {...SHORTCUT_MOTION}>
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={tip}
                            onClick={() => goTo("commute", kind)}
                            className={SHORTCUT_TILE}
                          />
                        }
                      >
                        <Icon aria-hidden style={{ color: meta.color }} />
                        <ShortcutTime
                          icon={travel.icon}
                          minutes={travel.time(nearest).minutes}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="p-0">
                        <ShortcutTip
                          icon={Icon}
                          color={meta.color}
                          label={meta.label}
                          place={nearest}
                          time={`${travel.minutes(nearest)} ${travel.verb}`}
                          count={count}
                          reach={`${REACH_MINUTES} min ${REACH_PHRASE[travel.mode]}`}
                          action="See all on the Commute tab"
                        />
                      </TooltipContent>
                    </Tooltip>
                  </motion.li>
                );
              })}

              <motion.li
                key="reach"
                layout="position"
                className="pl-1 text-xs text-foreground/50"
              >
                {shortcutsLoading &&
                amenityShortcuts.length + transitShortcuts.length === 0 ? (
                  <span
                    className="flex gap-1.5"
                    aria-label="Finding places nearby"
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <Skeleton key={i} className="size-9" />
                    ))}
                  </span>
                ) : amenityShortcuts.length + transitShortcuts.length === 0 ? (
                  `Nothing within ${REACH_MINUTES} min ${REACH_PHRASE[travel.mode]}`
                ) : (
                  `Within ${REACH_MINUTES} min ${REACH_PHRASE[travel.mode]}`
                )}
              </motion.li>
            </AnimatePresence>
          </ul>
        </TooltipProvider>
      </header>

      {/* The address couldn't be placed: say so once, with the way forward,
          rather than leaving every tab to fail on its own. */}
      {unlocated && (
        <Alert className="border-destructive/30 px-4 py-3">
          <AlertCircleIcon className="text-destructive" />
          <AlertTitle>We couldn&apos;t locate this address</AlertTitle>
          <AlertDescription>
            {identityJob?.error ??
              "Check the street number and town, or drop a pin on the map."}
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
      )}

      {/* Generation progress, as icons. */}
      {/* Opens and closes smoothly (height and the gap below it), so the
          page eases instead of jumping when generation starts or ends. */}
      <AnimatePresence initial={false}>
        {working && (
          <motion.div
            key="progress"
            initial={{ height: 0, opacity: 0, marginBottom: 0 }}
            animate={{ height: "auto", opacity: 1, marginBottom: "1rem" }}
            exit={{ height: 0, opacity: 0, marginBottom: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                WIDGET,
                "flex flex-wrap items-center gap-3 px-4 py-3",
              )}
              aria-live="polite"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <LoaderCircleIcon
                  aria-hidden
                  className="size-4 animate-spin text-primary"
                />
                Preparing report · {done}/{jobs.length}
              </span>
              <ul className="flex flex-wrap gap-1.5">
                {jobs.map(({ kind, job }) => {
                  const { icon: Icon, label } = STEP_ICONS[kind];
                  const active = isJobActive(job);
                  const failed = job?.status === "failed";
                  const complete = job?.status === "completed";
                  return (
                    <li
                      key={kind}
                      title={`${label}: ${job?.status ?? "not started"}`}
                      className={
                        "relative grid size-8 place-items-center border " +
                        (complete
                          ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700"
                          : failed
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : active
                              ? "border-primary/40 text-primary"
                              : "text-foreground/35")
                      }
                    >
                      <Icon aria-hidden className="size-4" />
                      {complete && (
                        <CheckIcon
                          aria-hidden
                          className="absolute -top-1.5 -right-1.5 size-3.5 bg-emerald-600 p-0.5 text-white"
                        />
                      )}
                      {failed && (
                        <AlertCircleIcon
                          aria-hidden
                          className="absolute -top-1.5 -right-1.5 size-3.5 bg-card text-destructive"
                        />
                      )}
                      <span className="sr-only">
                        {label}: {job?.status ?? "not started"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The ref marks where the tab bar starts (for scroll-on-switch). */}
      <div ref={tabsTopRef}>
        <Tabs
          value={tab}
          onValueChange={(value) => goTo(value as TabId)}
          className="gap-4"
        >
          {/* Sticky, so every section stays one click away. */}
          {/* z-[15]: above page content (focused chips and map pins use
              z-10) as it scrolls under, below the app header (z-20). */}
          <div className="sticky top-14 z-[15] -mx-4 bg-background sm:-mx-8">
            {/* Same tint as the page behind, so the bar doesn't show as a band. */}
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
                {/* Underline: Base UI positions it with CSS variables, so it
                    only slides sideways. It stays inside the list (the
                    hairline is on the wrapper). Nothing may poke out below
                    the list (hence after:hidden on the triggers: shadcn's
                    unused line-variant underline sits 5px under each tab).
                    A list that can scroll vertically, even by a few px,
                    jumps when the browser scrolls a focused tab into view. */}
                <TabsPrimitive.Indicator
                  renderBeforeHydration
                  className="absolute bottom-0 left-0 h-[3px] w-[calc(var(--active-tab-width)-16px)] translate-x-[calc(var(--active-tab-left)+8px)] bg-primary transition-[translate,width] duration-300 ease-out motion-reduce:transition-none"
                />
              </TabsList>
            </div>
          </div>

          {REPORT_TABS.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              {/* Enter-only: Base UI unmounts inactive panels immediately. */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {t.id === "overview" && (
                  <OverviewTab report={report} data={data} onNavigate={goTo} />
                )}

                {t.id === "amenities" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.amenities}
                      skeleton={<AmenitiesSkeleton />}
                      data={data.amenities}
                      labels={{
                        pending: "Finding nearby amenities…",
                        failed: "We couldn't load nearby amenities",
                        empty:
                          "Nearby amenities will appear once the address is resolved.",
                      }}
                    >
                      {(amenities) => (
                        <AmenitiesTab
                          reportId={report.id}
                          amenities={amenities}
                          home={{
                            lat: report.property!.latitude!,
                            lng: report.property!.longitude!,
                          }}
                          filter={amenityFilter}
                          onFilterChange={setAmenityFilter}
                        />
                      )}
                    </SectionGate>
                  </>
                )}

                {t.id === "schools" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.schools}
                      skeleton={<SchoolsSkeleton />}
                      data={data.schools}
                      labels={{
                        pending: "Finding nearby schools…",
                        failed: "We couldn't load nearby schools",
                        empty:
                          "Nearby schools will appear once the address is resolved.",
                        missing: "school results",
                      }}
                    >
                      {(schools) => (
                        <SchoolsTab
                          reportId={report.id}
                          schools={schools}
                          home={{
                            lat: report.property!.latitude!,
                            lng: report.property!.longitude!,
                          }}
                        />
                      )}
                    </SectionGate>
                  </>
                )}

                {t.id === "safety" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.safety}
                      skeleton={<SafetySkeleton />}
                      data={data.safety}
                      labels={{
                        pending:
                          "Checking crime, flood, noise and air quality…",
                        failed: "We couldn't load safety and environment data",
                        empty:
                          "Safety data will appear once the address is resolved.",
                        missing: "safety and environment checks",
                      }}
                    >
                      {(safety) => <SafetyTab safety={safety} />}
                    </SectionGate>
                  </>
                )}

                {t.id === "neighbourhood" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.demographics}
                      skeleton={<NeighbourhoodSkeleton />}
                      data={data.demographics}
                      labels={{
                        pending: "Reading the census profile…",
                        failed: "We couldn't load census data",
                        empty:
                          "Census figures will appear once the address is resolved.",
                        missing: "census figures",
                      }}
                    >
                      {(demographics) => (
                        <NeighbourhoodTab data={demographics} />
                      )}
                    </SectionGate>
                  </>
                )}

                {t.id === "commute" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.commute}
                      skeleton={<CommuteSkeleton />}
                      data={data.commute}
                      labels={{
                        pending: "Calculating commute times…",
                        failed: "We couldn't calculate commute times",
                        empty:
                          "Commute times will appear once the address is resolved.",
                      }}
                    >
                      {(commute) => (
                        <CommuteTab
                          reportId={report.id}
                          commute={commute}
                          home={{
                            lat: report.property!.latitude!,
                            lng: report.property!.longitude!,
                          }}
                          stopFilter={stopFilter}
                          onStopFilterChange={setStopFilter}
                        />
                      )}
                    </SectionGate>
                  </>
                )}

                {t.id === "upside" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.upside}
                      skeleton={<UpsideSkeleton />}
                      data={data.upside}
                      labels={{
                        pending: "Checking projects and development nearby…",
                        failed: "We couldn't load nearby projects",
                        empty:
                          "Nearby projects will appear once the address is resolved.",
                        missing: "nearby projects and development",
                      }}
                    >
                      {(upside) => (
                        <UpsideTab
                          upside={upside}
                          home={{
                            lat: report.property!.latitude!,
                            lng: report.property!.longitude!,
                          }}
                        />
                      )}
                    </SectionGate>
                  </>
                )}

                {t.id === "calculators" && (
                  <CalculatorsTab
                    reportId={report.id}
                    listPrice={data.listing?.listPrice ?? null}
                    city={report.property?.city ?? null}
                    propertyType={data.listing?.propertyType ?? null}
                    saved={getSection(
                      report,
                      SECTION_KEYS.calculators,
                      savedCalculatorsSchema,
                    )}
                  />
                )}

                {t.id === "marketing" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.ai}
                      skeleton={<MarketingSkeleton />}
                      data={
                        data.insights && marketing
                          ? { insights: data.insights, marketing }
                          : null
                      }
                      labels={{
                        pending: "Writing the marketing kit…",
                        failed: "We couldn't write the marketing kit",
                        empty:
                          "The marketing kit appears once the location data is ready.",
                      }}
                    >
                      {(ai) => (
                        <MarketingTab
                          reportId={report.id}
                          insights={ai.insights}
                          marketing={ai.marketing}
                          campaign={campaign}
                          campaignPending={regenerating}
                          onGenerate={regenerate}
                        />
                      )}
                    </SectionGate>
                  </>
                )}

                {t.id === "playbook" && (
                  <>
                    <SectionGate
                      report={report}
                      kind={JOB_KINDS.ai}
                      skeleton={<PlaybookSkeleton />}
                      data={marketing}
                      labels={{
                        pending: "Writing the agent playbook…",
                        failed: "We couldn't write the agent playbook",
                        empty:
                          "The playbook appears once the location data is ready.",
                      }}
                    >
                      {(m) => (
                        <PlaybookTab
                          reportId={report.id}
                          insights={data.insights}
                          playbook={m.playbook}
                          showing={showing}
                          showingPending={regenerating}
                          onGenerate={regenerate}
                          data={data}
                          home={
                            report.property?.latitude != null &&
                            report.property.longitude != null
                              ? {
                                  lat: report.property.latitude,
                                  lng: report.property.longitude,
                                }
                              : null
                          }
                        />
                      )}
                    </SectionGate>
                  </>
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
        review before sharing. Full sources are listed in the PDF.
      </p>
    </div>
  );
}

/**
 * Hover card for a header shortcut: the nearest place, how far it is in the
 * selected mode, and how many more are within reach.
 */
function ShortcutTip({
  icon: Icon,
  color,
  label,
  place,
  time,
  count,
  reach,
  rating,
  action,
}: {
  icon: LucideIcon;
  color: string;
  label: string;
  place: { name: string; distanceMeters: number };
  /** "~5 min walk" */
  time: string;
  count: number;
  /** "15 min walk" */
  reach: string;
  rating?: number | null;
  action: string;
}) {
  return (
    <div className="w-60 space-y-1.5 px-3 py-2.5 text-left">
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-background/60 uppercase">
        <Icon aria-hidden className="size-3.5" style={{ color }} />
        {label}
        <span className="ml-auto font-normal tracking-normal normal-case tabular-nums">
          {count} within {reach}
        </span>
      </p>
      <p className="text-sm leading-snug font-semibold text-pretty">
        {place.name}
      </p>
      <p className="flex items-center gap-1.5 text-xs text-background/75 tabular-nums">
        {time}
        <span aria-hidden>·</span>
        {formatDistance(place.distanceMeters)}
        {rating != null && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-0.5">
              {rating.toFixed(1)}
              <StarIcon
                aria-hidden
                className="size-3 fill-amber-400 text-amber-400"
              />
            </span>
          </>
        )}
      </p>
      <p className="text-[11px] text-background/50">{action}</p>
    </div>
  );
}
