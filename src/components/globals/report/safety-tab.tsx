"use client";

import {
  CarIcon,
  PlaneIcon,
  ShieldCheckIcon,
  TrainTrackIcon,
  Volume2Icon,
  WavesIcon,
  WindIcon,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { CRIME_TYPES, type SafetyData } from "@/lib/report-sections";
import {
  DashCard,
  Gauge,
  ProximityMeter as ProximityBar,
  StatTile,
  TileGrid,
} from "./dash-card";
import { formatDistance, formatShortDate } from "./report-format";
import {
  AreaCrime,
  compare,
  compareIndex,
  FLOOD_BADGES,
  MIN_COUNT_TO_COMPARE,
  Sparkline,
} from "./safety-section";

const NOISE_RADIUS_M = 500;

/** Two bars on a shared scale: this neighbourhood vs Toronto. */
function RateBars({
  rate,
  cityRate,
  max,
}: {
  rate: number | null;
  cityRate: number | null;
  max: number;
}) {
  const width = (v: number | null) =>
    `${Math.min(100, ((v ?? 0) / Math.max(max, 1)) * 100)}%`;
  return (
    <span className="block space-y-1">
      <span className="flex items-center gap-2">
        <span className="h-2 flex-1 bg-muted">
          <span
            className="block h-full bg-primary"
            style={{ width: width(rate) }}
          />
        </span>
        <span className="w-12 text-right text-xs font-semibold tabular-nums">
          {rate ?? "—"}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span className="h-2 flex-1 bg-muted">
          <span
            className="block h-full bg-foreground/30"
            style={{ width: width(cityRate) }}
          />
        </span>
        <span className="w-12 text-right text-xs text-foreground/55 tabular-nums">
          {cityRate ?? "—"}
        </span>
      </span>
    </span>
  );
}

/** Closer = fuller bar, on a 0–500 m scale. */
function ProximityMeter({
  icon: Icon,
  label,
  meters,
  covered,
}: {
  icon: typeof CarIcon;
  label: string;
  meters: number | null;
  covered: boolean;
}) {
  const closeness =
    meters == null ? 0 : Math.max(0.04, 1 - meters / NOISE_RADIUS_M);
  return (
    <div className="flex flex-col gap-3 bg-muted/50 p-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon aria-hidden className="size-4 text-foreground/55" />
        {label}
      </span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {meters != null ? formatDistance(meters) : covered ? "500 m +" : "—"}
      </span>
      <span className="h-1.5 bg-muted" aria-hidden>
        <span
          className={cn(
            "block h-full",
            closeness > 0.5 ? "bg-amber-500" : "bg-foreground/40",
          )}
          style={{ width: `${closeness * 100}%` }}
        />
      </span>
      <span className="text-xs text-foreground/55">
        {meters != null
          ? closeness > 0.5
            ? "Close enough to hear at times"
            : "Within 500 m"
          : covered
            ? "None within 500 m"
            : "Couldn't be checked"}
      </span>
    </div>
  );
}

/**
 * Headline crime tile: Toronto's neighbourhood ranking where we have it,
 * else the local police service's Crime Severity Index against Ontario.
 */
export function crimeTile(safety: SafetyData) {
  const { crime, areaCrime } = safety;
  if (crime?.lowerRateThanShare != null) {
    const share = crime.lowerRateThanShare;
    return {
      label: "Lower crime than",
      value: `${Math.round(share * 100)}%`,
      caption: "of Toronto areas",
      color: share >= 0.5 ? "#16a34a" : "#d97706",
      gauge: share,
    };
  }
  if (areaCrime?.csi != null) {
    const vs = compareIndex(areaCrime.csi, areaCrime.ontario.csi);
    const province = areaCrime.level === "province";
    return {
      label: "Crime severity",
      value: String(Math.round(areaCrime.csi)),
      caption: province
        ? "Ontario overall"
        : `${vs ?? "vs"} Ontario (${areaCrime.ontario.csi?.toFixed(0) ?? "—"})`,
      color: province ? undefined : vs === "Higher" ? "#d97706" : "#16a34a",
      gauge: null,
    };
  }
  return {
    label: "Crime",
    value: "—",
    caption: "Not available",
    color: undefined,
    gauge: null,
  };
}

export function SafetyTab({ safety }: { safety: SafetyData }) {
  const { crime, areaCrime, flood, noise, airQuality } = safety;
  const tile = crimeTile(safety);
  const flag = FLOOD_BADGES[flood.status];
  const maxRate = crime
    ? Math.max(...crime.types.flatMap((t) => [t.rate ?? 0, t.cityRate ?? 0]))
    : 0;

  return (
    <div className="space-y-4">
      <TileGrid className="md:grid-cols-4">
        <StatTile
          icon={ShieldCheckIcon}
          label={tile.label}
          value={tile.value}
          caption={tile.caption}
          accent={tile.color}
          aside={
            tile.gauge != null && (
              <Gauge value={tile.gauge} color={tile.color ?? "#16a34a"} />
            )
          }
        />
        <StatTile
          icon={WavesIcon}
          label="Flood & erosion"
          value={
            {
              inside: "Regulated",
              nearby: "Nearby",
              clear: "Clear",
              unknown: "—",
            }[flood.status]
          }
          caption={flood.authority ?? "No conservation authority"}
          tone={
            flood.status === "inside" || flood.status === "nearby"
              ? "solid"
              : "default"
          }
          accent={
            flood.status === "inside" || flood.status === "nearby"
              ? "#d97706"
              : "#0891b2"
          }
        />
        <StatTile
          icon={CarIcon}
          label="Nearest highway"
          value={
            noise.highway
              ? formatDistance(noise.highway.meters)
              : noise.roadsCovered
                ? "500 m +"
                : "—"
          }
          caption={
            noise.roadsCovered
              ? "Straight-line distance"
              : "Couldn't be checked"
          }
          accent="#525252"
          visual={
            noise.roadsCovered && (
              <ProximityBar meters={noise.highway?.meters ?? null} />
            )
          }
        />
        <StatTile
          icon={WindIcon}
          label="Air quality"
          value={airQuality ? airQuality.aqi : "—"}
          unit={airQuality ? "/ 100" : undefined}
          caption={airQuality?.category ?? safety.airQualityNote ?? undefined}
          accent={airQuality?.color ?? undefined}
          aside={
            airQuality && (
              <Gauge
                value={airQuality.aqi / 100}
                color={airQuality.color ?? "#16a34a"}
              />
            )
          }
        />
      </TileGrid>

      <div className="grid gap-4 lg:grid-cols-12">
        <DashCard
          title={
            crime
              ? `Crime · ${crime.neighbourhood}`
              : areaCrime?.level === "service"
                ? `Crime · ${areaCrime.service}`
                : "Crime"
          }
          icon={ShieldCheckIcon}
          className="lg:col-span-8"
        >
          {crime ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
                {crime.population != null && (
                  <span>
                    {crime.population.toLocaleString("en-CA")} residents
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 bg-primary" /> This neighbourhood
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 bg-foreground/30" /> Toronto
                </span>
                <span>Per 100,000 residents, {crime.year}</span>
              </div>
              <ul className="divide-y">
                {crime.types.map((t) => {
                  const label = CRIME_TYPES.find((c) => c.id === t.id)!.label;
                  const vs = compare(t.count, t.rate, t.cityRate);
                  return (
                    <li
                      key={t.id}
                      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_4.5rem_3.5rem] items-center gap-3 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)_5rem_3.5rem]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {label}
                        </span>
                        <span className="text-xs text-foreground/50 tabular-nums">
                          {t.count} reported
                        </span>
                      </span>
                      <RateBars
                        rate={t.rate}
                        cityRate={t.cityRate}
                        max={maxRate}
                      />
                      <span>
                        {vs ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[11px]",
                              vs === "Higher"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
                                : "text-foreground/70",
                            )}
                          >
                            {vs}
                          </Badge>
                        ) : (
                          <span className="text-xs text-foreground/40">
                            Too few
                          </span>
                        )}
                      </span>
                      <Sparkline
                        values={t.trend}
                        label={`${label} per year, ${crime.firstYear}–${crime.year}: ${t.trend.map((v) => v ?? "n/a").join(", ")}`}
                      />
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-foreground/50">
                {crime.source}. Bars share one scale; trend shows yearly counts{" "}
                {crime.firstYear}–{crime.year}. Types with fewer than{" "}
                {MIN_COUNT_TO_COMPARE} incidents aren&apos;t compared. Areas
                with shops or nightlife can have high rates relative to
                residents.
              </p>
            </>
          ) : null}
          {areaCrime && (
            <div className={cn(crime && "mt-5 border-t pt-4")}>
              {crime && (
                <h4 className="mb-2 text-sm font-semibold">
                  Across the police service area
                </h4>
              )}
              <AreaCrime area={areaCrime} />
            </div>
          )}
          {!crime && !areaCrime && (
            <p className="text-sm text-foreground/60">{safety.crimeNote}</p>
          )}
        </DashCard>

        <div className="space-y-4 lg:col-span-4">
          <DashCard title="Flood & erosion" icon={WavesIcon}>
            <Badge variant="outline" className={cn("text-xs", flag.className)}>
              {flag.label}
            </Badge>
            <p className="mt-2 text-sm text-foreground/75">{flood.note}</p>
            {flood.criteria.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {flood.criteria.map((c) => (
                  <Badge key={c} variant="secondary" className="font-normal">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            {flood.authority && (
              <p className="mt-3 text-xs text-foreground/50">
                {flood.authority}
              </p>
            )}
          </DashCard>

          <DashCard title="Air quality" icon={WindIcon}>
            {airQuality ? (
              <div className="flex items-center gap-4">
                <span
                  className="grid size-16 shrink-0 place-items-center text-2xl font-semibold text-white tabular-nums"
                  style={{
                    backgroundColor: airQuality.color ?? "var(--color-primary)",
                  }}
                >
                  {airQuality.aqi}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{airQuality.category}</p>
                  {airQuality.dominantPollutant && (
                    <p className="text-xs text-foreground/60">
                      Main pollutant: {airQuality.dominantPollutant}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-foreground/50">
                    Universal AQI, higher is cleaner. Snapshot{" "}
                    {formatShortDate(airQuality.observedAt)}.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/60">
                {safety.airQualityNote}
              </p>
            )}
          </DashCard>
        </div>

        <DashCard
          title="Noise sources"
          icon={Volume2Icon}
          className="lg:col-span-12"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <ProximityMeter
              icon={CarIcon}
              label="Highway"
              meters={noise.highway?.meters ?? null}
              covered={noise.roadsCovered}
            />
            <ProximityMeter
              icon={TrainTrackIcon}
              label="Rail line"
              meters={noise.railway?.meters ?? null}
              covered={noise.roadsCovered}
            />
            <div className="flex flex-col gap-3 bg-muted/50 p-4">
              <span className="flex items-center gap-2 text-sm font-medium">
                <PlaneIcon aria-hidden className="size-4 text-foreground/55" />
                Airport
              </span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {noise.airport ? `${noise.airport.km} km` : "—"}
              </span>
              <span className="text-xs text-foreground/55">
                {noise.airport?.name ?? "No major airport close by"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-foreground/50">
            Straight-line distances. Visit at rush hour to judge noise; flight
            paths can matter more than distance.
          </p>
        </DashCard>
      </div>
    </div>
  );
}
