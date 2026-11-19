"use client";

import {
  BuildingIcon,
  CarIcon,
  ConstructionIcon,
  CircleCheckIcon,
  GraduationCapIcon,
  HardHatIcon,
  KeyRoundIcon,
  PlaneIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
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
import type { TravelTimes } from "@/lib/travel";
import { Skeleton } from "@/components/ui/skeleton";
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
  type SchoolsData,
  TRANSIT_KINDS,
  type UpsideData,
} from "@/lib/report-sections";
import {
  CompareMeter,
  DashCard,
  DotTrack,
  Gauge,
  GlanceRow,
  KpiTile,
} from "./dash-card";
import { LocationMedia } from "./location-media";
import { formatDistance, formatPrice, type ReportData } from "./report-format";
import { getJob, isJobActive } from "./report-hooks";
import {
  allSchools,
  dominantHomeType,
  downtownCommute,
  eqaoAverage,
  nearestPlace,
  nearestTransit,
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

function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          className="h-5"
          style={{ width: `${90 - i * 12}%` }}
        />
      ))}
    </div>
  );
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-foreground/55">{children}</p>
);

export function OverviewTab({
  report,
  data,
  onNavigate,
}: {
  report: ReportData;
  data: ReportSectionsData;
  onNavigate: (tab: TabId, focus?: string) => void;
}) {
  const {
    amenities,
    commute,
    schools,
    demographics,
    safety,
    insights,
    upside,
  } = data;
  const busy = (kind: JobKind) => isJobActive(getJob(report, kind));
  const travel = useTravelMode();
  const mins = (p: TravelTimes) => travel.time(p).minutes;
  const unit = `min ${travel.verb}`;
  /** Time in the selected mode, or distance when walking is too far. */
  const timeOrDistance = (s: TravelTimes) =>
    travel.showsTime(s)
      ? { value: mins(s), unit }
      : { value: (s.distanceMeters / 1000).toFixed(1), unit: "km" };
  // Dot tracks span at least this many minutes.
  const trackMin = travel.mode === "walk" ? 20 : 10;

  const grocery = nearestPlace(amenities, "groceries");
  const groceries = (amenities?.categories.groceries ?? []).slice(0, 5);
  const transitTimes = (commute?.stations ?? []).map(mins).slice(0, 6);
  const downtownDrive = commute?.destinations[0]?.driveMinutes ?? null;
  const transit = nearestTransit(commute);
  const school = allSchools(schools).find((s) => s.level === "Elementary");
  const schoolEqao = school ? eqaoAverage(school.results) : null;
  const ontarioEqao =
    school && schools
      ? eqaoAverage(
          Object.fromEntries(
            Object.keys(school.results).map((k) => [
              k,
              schools.provincialAverage[
                k as keyof typeof schools.provincialAverage
              ] ?? null,
            ]),
          ),
        )
      : null;
  const downtown = downtownCommute(commute);
  const crimeKpi = safety ? crimeTile(safety) : null;
  const nearbySchools = allSchools(schools).slice(0, 4);
  const homeType = dominantHomeType(demographics);
  const area = demographics?.area.values;
  const city = demographics?.city?.values;

  return (
    <div className="space-y-4">
      {/* Glance: the five things buyers ask about first. */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      >
        <KpiTile
          icon={ShoppingCartIcon}
          accent={AMENITY_CATEGORIES[0].color}
          label="Groceries"
          value={grocery ? mins(grocery) : "—"}
          unit={grocery ? unit : undefined}
          caption={grocery?.name ?? "None within 1.5 km"}
          loading={!amenities && busy(JOB_KINDS.amenities)}
          onClick={() => onNavigate("amenities", "groceries")}
          visual={
            groceries.length > 0 && (
              <DotTrack
                minutes={groceries.map(mins)}
                max={Math.max(trackMin, ...groceries.map(mins))}
                unit={unit}
                color={AMENITY_CATEGORIES[0].color}
              />
            )
          }
        />
        <KpiTile
          icon={TrainFrontIcon}
          accent={transit ? TRANSIT_KINDS[transit.kind].color : undefined}
          label={transit ? TRANSIT_KINDS[transit.kind].label : "Transit"}
          value={transit ? mins(transit) : "—"}
          unit={transit ? unit : undefined}
          caption={transit?.name ?? "No stops nearby"}
          loading={!commute && busy(JOB_KINDS.commute)}
          onClick={() => onNavigate("commute")}
          visual={
            transitTimes.length > 0 && (
              <DotTrack
                minutes={transitTimes}
                max={Math.max(trackMin, ...transitTimes)}
                unit={unit}
                color={transit ? TRANSIT_KINDS[transit.kind].color : "#2563eb"}
              />
            )
          }
        />
        <KpiTile
          icon={GraduationCapIcon}
          accent={school?.color}
          label="Elementary school"
          {...(school
            ? timeOrDistance(school)
            : { value: "—", unit: undefined })}
          caption={school?.name ?? "No school data"}
          loading={!schools && busy(JOB_KINDS.schools)}
          onClick={() => onNavigate("schools")}
          visual={
            schoolEqao != null &&
            school && (
              <CompareMeter
                area={schoolEqao}
                city={ontarioEqao}
                max={100}
                color={school.color}
                labels={["EQAO", "Ontario"]}
              />
            )
          }
        />
        <KpiTile
          icon={ShieldCheckIcon}
          label={crimeKpi?.label ?? "Crime"}
          value={crimeKpi?.value ?? "—"}
          caption={crimeKpi?.caption}
          loading={!safety && busy(JOB_KINDS.safety)}
          onClick={() => onNavigate("safety")}
          aside={
            crimeKpi?.gauge != null && (
              <Gauge
                value={crimeKpi.gauge}
                color={crimeKpi.color ?? "#16a34a"}
              />
            )
          }
        />
        <KpiTile
          icon={downtown?.mode === "drive" ? CarIcon : TrainFrontIcon}
          tone={downtown ? "solid" : "default"}
          accent={downtown ? "#1d4ed8" : undefined}
          visual={
            downtownDrive != null &&
            downtown?.mode === "transit" && (
              <span className="flex items-center gap-1.5 text-sm text-white/80 tabular-nums">
                <CarIcon aria-hidden className="size-4" />
                {downtownDrive} min by car
              </span>
            )
          }
          label="To downtown"
          value={downtown ? downtown.minutes : "—"}
          unit={downtown ? "min" : undefined}
          caption={
            downtown
              ? `${downtown.mode === "transit" ? "Transit" : "Drive"} · ${downtown.label}`
              : "Not available"
          }
          loading={!commute && busy(JOB_KINDS.commute)}
          onClick={() => onNavigate("commute")}
        />
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
            <CardSkeleton rows={5} />
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
            <CardSkeleton />
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
            <div className="py-3">
              <CardSkeleton rows={4} />
            </div>
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
            <div className="py-3">
              <CardSkeleton rows={4} />
            </div>
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
            <div className="py-3">
              <CardSkeleton rows={4} />
            </div>
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
                <Muted>Nothing major planned close by.</Muted>
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
            <div className="py-3">
              <CardSkeleton rows={4} />
            </div>
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
