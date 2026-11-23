"use client";

import {
  BuildingIcon,
  CarIcon,
  ConstructionIcon,
  CircleCheckIcon,
  GraduationCapIcon,
  HardHatIcon,
  KeyRoundIcon,
  type LucideIcon,
  PlaneIcon,
  RouteIcon,
  ShieldCheckIcon,
  StoreIcon,
  TrainFrontIcon,
  TrainTrackIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  WavesIcon,
  WindIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { useTravelMode } from "@/components/globals/travel-mode";
import { crimeTile } from "./safety-tab";
import { MARKET_LEVELS } from "@/lib/market-score";
import {
  amenitiesScore,
  commuteScore,
  eqaoMean,
  neighbourhoodScore,
  safetyScore,
  type SectionScore,
  schoolsScore,
  upsideScore,
} from "@/lib/section-scores";
import { ListSkeleton, ParagraphSkeleton } from "./report-skeletons";
import {
  destinationTime,
  TRAVEL_MODES,
  type TravelMode,
  type TravelTimes,
  travelTime,
} from "@/lib/travel";
import {
  AMENITY_CATEGORIES,
  type AmenitiesData,
  type CommuteData,
  type DemographicsData,
  type InsightsData,
  JOB_KINDS,
  type JobKind,
  type ListingData,
  type SafetyData,
  type School,
  type SchoolsData,
  type UpsideData,
} from "@/lib/report-sections";
import { DashCard, GlanceRow, KpiTile } from "./dash-card";
import { LocationMedia } from "./location-media";
import { formatDistance, formatPrice, type ReportData } from "./report-format";
import { getJob, isJobActive } from "./report-hooks";
import {
  allSchools,
  dominantHomeType,
  eqaoAverage,
  versus,
} from "./report-insights";
import type { TabId } from "./report-tabs";

export type ReportSectionsData = {
  amenities: AmenitiesData | null;
  commute: CommuteData | null;
  schools: SchoolsData | null;
  demographics: DemographicsData | null;
  safety: SafetyData | null;
  insights: InsightsData | null;
  listing: ListingData | null;
  upside: UpsideData | null;
};

/**
 * Five segments filled to the score, coloured like the market score.
 * Comparison tiles use it too (the A/B chip carries the side's colour).
 */
export function ScoreBar({ score }: { score: number }) {
  const color =
    MARKET_LEVELS[
      Math.min(5, Math.max(1, Math.round(score))) as 1 | 2 | 3 | 4 | 5
    ].color;
  return (
    <span className="grid h-1.5 grid-cols-5 gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, score - (i - 1)));
        return (
          <span key={i} className="bg-muted">
            <span
              className="block h-full"
              style={{ width: `${fill * 100}%`, backgroundColor: color }}
            />
          </span>
        );
      })}
    </span>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-foreground/55">{children}</p>
);

export type SectionTile = {
  id: "amenities" | "commute" | "schools" | "safety" | "neighbourhood" | "upside";
  label: string;
  icon: LucideIcon;
  accent: string;
  tab: TabId;
  job: JobKind;
  score: SectionScore | null;
  caption: string;
  empty: string;
};

/**
 * The Overview's section tiles: one 1–5 score per section with a caption.
 * Score and caption both follow the travel mode. Shared with comparisons.
 */
export function sectionTiles(
  data: ReportSectionsData,
  mode: TravelMode,
): SectionTile[] {
  const { amenities, commute, schools, demographics, safety, upside } = data;
  const mins = (p: TravelTimes) => travelTime(p, mode).minutes;
  const unit = `min ${TRAVEL_MODES[mode].verb}`;
  const crimeKpi = safety ? crimeTile(safety) : null;
  const nearbySchools = allSchools(schools).slice(0, 4);
  const homeType = dominantHomeType(demographics);
  const area = demographics?.area.values;
  const fastest = (places: TravelTimes[]) =>
    places.length ? Math.min(...places.map(mins)) : null;
  const amenityTimes = amenities
    ? AMENITY_CATEGORIES.map((c) =>
        fastest(amenities.categories[c.id] ?? []),
      ).filter((m): m is number => m != null)
    : [];
  // Faster of transit and the selected mode, per destination.
  const tripTimes = (commute?.destinations ?? []).flatMap((d) => {
    const options = [
      d.transitMinutes,
      destinationTime(d, mode).minutes,
    ].filter((m): m is number => m != null);
    return options.length ? [Math.min(...options)] : [];
  });
  const schoolEqaos = nearbySchools
    .map((s) => eqaoMean(s.results))
    .filter((v): v is number => v != null);
  const ontarioEqao = schools
    ? eqaoMean(schools.provincialAverage as School["results"])
    : null;
  const average = (values: number[]) =>
    Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  const applications = upside?.development?.applications.length ?? 0;

  return [
    {
      id: "amenities",
      label: "Amenities",
      icon: StoreIcon,
      accent: "#2563eb",
      tab: "amenities",
      job: JOB_KINDS.amenities,
      score: amenitiesScore(amenities, mode),
      caption: amenityTimes.length
        ? `avg ${average(amenityTimes)} ${unit} · ${amenityTimes.filter((m) => m <= 15).length} of ${AMENITY_CATEGORIES.length} within 15`
        : "Nothing found nearby",
      empty: "No amenity data",
    },
    {
      id: "commute",
      label: "Commute",
      icon: RouteIcon,
      accent: "#0f766e",
      tab: "commute",
      job: JOB_KINDS.commute,
      score: commuteScore(commute, mode),
      caption: tripTimes.length
        ? `avg ${average(tripTimes)} min to ${tripTimes.length} destinations`
        : "Transit access nearby",
      empty: "No commute data",
    },
    {
      id: "schools",
      label: "Schools",
      icon: GraduationCapIcon,
      accent: "#7c3aed",
      tab: "schools",
      job: JOB_KINDS.schools,
      score: schoolsScore(schools, mode),
      caption: schoolEqaos.length
        ? `EQAO avg ${average(schoolEqaos)}%${ontarioEqao != null ? ` · Ontario ${Math.round(ontarioEqao)}%` : ""}`
        : `${nearbySchools.length} schools nearby`,
      empty: "No school data",
    },
    {
      id: "safety",
      label: "Safety",
      icon: ShieldCheckIcon,
      accent: "#16a34a",
      tab: "safety",
      job: JOB_KINDS.safety,
      score: safetyScore(safety),
      caption: crimeKpi
        ? `${crimeKpi.label === "Lower crime than" ? `Less crime than ${crimeKpi.value}` : `Crime ${crimeKpi.caption.toLowerCase()}`}`
        : "Crime, flood and noise",
      empty: "No safety data",
    },
    {
      id: "neighbourhood",
      label: "Neighbourhood",
      icon: UsersIcon,
      accent: "#a16207",
      tab: "neighbourhood",
      job: JOB_KINDS.demographics,
      score: neighbourhoodScore(demographics),
      caption: [
        area?.owners != null ? `${Math.round(area.owners)}% owners` : null,
        homeType ? `mostly ${homeType.label.toLowerCase()}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      empty: "No census data",
    },
    {
      id: "upside",
      label: "Upside",
      icon: TrendingUpIcon,
      accent: "#ea580c",
      tab: "upside",
      job: JOB_KINDS.upside,
      score: upsideScore(upside),
      caption: `${upside?.projects.length ?? 0} projects · ${applications} applications`,
      empty: "No project data",
    },
  ];
}

export function OverviewTab({
  report,
  data,
  onNavigate,
}: {
  report: ReportData;
  data: ReportSectionsData;
  onNavigate: (tab: TabId, focus?: string) => void;
}) {
  const { amenities, schools, demographics, safety, insights, upside } = data;
  const busy = (kind: JobKind) => isJobActive(getJob(report, kind));
  const travel = useTravelMode();
  const mins = (p: TravelTimes) => travel.time(p).minutes;
  const unit = `min ${travel.verb}`;
  /** Time in the selected mode, or distance when walking is too far. */
  const timeOrDistance = (s: TravelTimes) =>
    travel.showsTime(s)
      ? { value: mins(s), unit }
      : { value: (s.distanceMeters / 1000).toFixed(1), unit: "km" };
  const nearbySchools = allSchools(schools).slice(0, 4);
  const homeType = dominantHomeType(demographics);
  const area = demographics?.area.values;
  const city = demographics?.city?.values;

  const tiles = sectionTiles(data, travel.mode);

  return (
    <div className="space-y-4">
      {/* Glance: one 1–5 score per section, each an average of its parts. */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
      >
        {tiles.map((t) => (
          <KpiTile
            key={t.id}
            icon={t.icon}
            accent={t.accent}
            label={t.label}
            value={t.score ? t.score.score.toFixed(1) : "—"}
            unit={t.score ? "/ 5" : undefined}
            caption={t.score ? t.caption : t.empty}
            loading={!t.score && busy(t.job)}
            onClick={() => onNavigate(t.tab)}
            visual={t.score && <ScoreBar score={t.score.score} />}
          />
        ))}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* The visual anchor: buyers look at photos first. */}
        <LocationMedia
          report={report}
          amenities={amenities}
          amenitiesBusy={busy(JOB_KINDS.amenities)}
          onOpenAmenities={() => onNavigate("amenities")}
        />

        {/* Selling points: titles first; detail is one muted line. */}
        <DashCard
          title="Selling points"
          icon={CircleCheckIcon}
          onOpen={() => onNavigate("marketing")}
          className="lg:col-span-7"
        >
          {insights ? (
            <>
              <p className="text-base leading-snug font-semibold text-balance">
                {insights.headline}
              </p>
              <ul className="mt-3 divide-y">
                {insights.highlights.slice(0, 5).map((h) => (
                  <li key={h.title} className="flex gap-3 py-2.5">
                    <CircleCheckIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-emerald-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {h.title}
                      </span>
                      <span
                        className="block truncate text-xs text-foreground/55"
                        title={h.detail}
                      >
                        {h.detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : busy(JOB_KINDS.ai) ? (
            <>
              <ParagraphSkeleton lines={2} />
              <div className="mt-3">
                <ListSkeleton rows={5} />
              </div>
            </>
          ) : (
            <Muted>Selling points appear once the AI copy is written.</Muted>
          )}
        </DashCard>

        <DashCard
          title="Buyers may ask"
          icon={TriangleAlertIcon}
          onOpen={() => onNavigate("playbook")}
          className="lg:col-span-5"
        >
          {insights ? (
            <ul className="divide-y">
              {insights.watchOuts.slice(0, 3).map((w) => (
                <li key={w.title} className="py-2.5">
                  <span className="flex items-start gap-3">
                    <TriangleAlertIcon
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-amber-600"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {w.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-foreground/60">
                        <span className="font-medium text-foreground/75">
                          Say:{" "}
                        </span>
                        {w.reframe}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : busy(JOB_KINDS.ai) ? (
            <ListSkeleton rows={3} />
          ) : (
            <Muted>Likely questions appear once the AI copy is written.</Muted>
          )}
        </DashCard>

        {/* Quick looks: one card per section, each opens the full tab. */}
        <DashCard
          title="Neighbourhood"
          icon={UsersIcon}
          onOpen={() => onNavigate("neighbourhood")}
          className="lg:col-span-6 xl:col-span-3"
          bodyClassName="py-1"
        >
          {demographics && area ? (
            <div className="divide-y">
              <GlanceRow
                icon={WalletIcon}
                label="Household income"
                hint="Median, before tax"
                value={
                  area.medianIncome != null
                    ? formatPrice(area.medianIncome)
                    : "—"
                }
                delta={versus(area.medianIncome, city?.medianIncome)}
              />
              <GlanceRow
                icon={KeyRoundIcon}
                label="Owners"
                value={
                  area.owners != null ? `${Math.round(area.owners)}%` : "—"
                }
                delta={versus(area.owners, city?.owners)}
              />
              <GlanceRow
                icon={UserIcon}
                label="Median age"
                value={area.medianAge != null ? area.medianAge.toFixed(0) : "—"}
                delta={versus(area.medianAge, city?.medianAge)}
              />
              {homeType && (
                <GlanceRow
                  icon={BuildingIcon}
                  label="Most common home"
                  hint={homeType.label}
                  value={`${Math.round(homeType.share)}%`}
                />
              )}
            </div>
          ) : busy(JOB_KINDS.demographics) ? (
            <ListSkeleton rows={4} trailing />
          ) : (
            <div className="py-3">
              <Muted>Census figures unavailable.</Muted>
            </div>
          )}
        </DashCard>

        <DashCard
          title="Schools"
          icon={GraduationCapIcon}
          onOpen={() => onNavigate("schools")}
          className="lg:col-span-6 xl:col-span-3"
          bodyClassName="py-1"
        >
          {nearbySchools.length > 0 ? (
            <ul className="divide-y">
              {nearbySchools.map((s) => {
                const eqao = eqaoAverage(s.results);
                const dist = timeOrDistance(s);
                return (
                  <li key={s.id} className="flex items-center gap-3 py-2.5">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{s.name}</span>
                      <span className="block truncate text-xs text-foreground/55">
                        {s.systemLabel} · {s.gradeRange?.replace("-", "–")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular-nums">
                        {dist.value} {dist.unit === "km" ? "km" : "min"}
                      </span>
                      {eqao != null && (
                        <span className="block text-[11px] text-foreground/55 tabular-nums">
                          EQAO {eqao}%
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : busy(JOB_KINDS.schools) ? (
            <ListSkeleton rows={4} trailing />
          ) : (
            <div className="py-3">
              <Muted>No school data yet.</Muted>
            </div>
          )}
        </DashCard>

        <DashCard
          title="Environment"
          icon={WavesIcon}
          onOpen={() => onNavigate("safety")}
          className="lg:col-span-6 xl:col-span-3"
          bodyClassName="py-1"
        >
          {safety ? (
            <div className="divide-y">
              <GlanceRow
                icon={WavesIcon}
                label="Flood & erosion"
                hint={safety.flood.authority ?? undefined}
                value={
                  <Badge
                    variant="outline"
                    className={
                      safety.flood.status === "inside" ||
                      safety.flood.status === "nearby"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
                        : "text-foreground/70"
                    }
                  >
                    {
                      {
                        inside: "Regulated",
                        nearby: "Nearby",
                        clear: "Clear",
                        unknown: "Not checked",
                      }[safety.flood.status]
                    }
                  </Badge>
                }
              />
              <GlanceRow
                icon={CarIcon}
                label="Highway"
                value={
                  safety.noise.highway
                    ? formatDistance(safety.noise.highway.meters)
                    : safety.noise.roadsCovered
                      ? "500 m +"
                      : "—"
                }
              />
              <GlanceRow
                icon={TrainTrackIcon}
                label="Rail line"
                value={
                  safety.noise.railway
                    ? formatDistance(safety.noise.railway.meters)
                    : safety.noise.roadsCovered
                      ? "500 m +"
                      : "—"
                }
              />
              {safety.noise.airport ? (
                <GlanceRow
                  icon={PlaneIcon}
                  label="Airport"
                  hint={safety.noise.airport.name}
                  value={`${safety.noise.airport.km} km`}
                />
              ) : (
                <GlanceRow
                  icon={WindIcon}
                  label="Air quality"
                  value={
                    safety.airQuality
                      ? `${safety.airQuality.aqi} · ${safety.airQuality.category}`
                      : "—"
                  }
                />
              )}
            </div>
          ) : busy(JOB_KINDS.safety) ? (
            <ListSkeleton rows={4} trailing />
          ) : (
            <div className="py-3">
              <Muted>Environment checks unavailable.</Muted>
            </div>
          )}
        </DashCard>

        <DashCard
          title="Coming soon"
          icon={TrendingUpIcon}
          onOpen={() => onNavigate("upside")}
          className="lg:col-span-6 xl:col-span-3"
          bodyClassName="py-1"
        >
          {upside ? (
            upside.projects.length === 0 &&
            !upside.development?.applications.length ? (
              <div className="py-3">
                <Muted>
                  {upside.projectsNote
                    ? "Project and development data cover Ontario only so far."
                    : "Nothing major planned close by."}
                </Muted>
              </div>
            ) : (
              <div className="divide-y">
                {upside.projects.slice(0, 3).map((p) => (
                  <GlanceRow
                    key={p.id}
                    icon={
                      p.category === "Transit"
                        ? TrainFrontIcon
                        : ConstructionIcon
                    }
                    label={p.name}
                    hint={`${p.status}${p.targetCompletion ? ` · ${p.targetCompletion}` : ""}`}
                    value={formatDistance(p.distanceMeters)}
                  />
                ))}
                {upside.development &&
                  upside.development.applications.length > 0 && (
                    <GlanceRow
                      icon={HardHatIcon}
                      label={`${upside.development.applications.length} development applications`}
                      hint={
                        upside.development.totalUnits
                          ? `${upside.development.totalUnits.toLocaleString("en-CA")} homes proposed`
                          : "Within 500 m"
                      }
                      value="500 m"
                    />
                  )}
              </div>
            )
          ) : busy(JOB_KINDS.upside) ? (
            <ListSkeleton rows={4} trailing />
          ) : (
            <div className="py-3">
              <Muted>Nearby projects unavailable.</Muted>
            </div>
          )}
        </DashCard>
      </div>
    </div>
  );
}
