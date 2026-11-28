"use client";

import {
  Building2Icon,
  CarIcon,
  ClockIcon,
  LayoutGridIcon,
  type LucideIcon,
  PlaneIcon,
  TrainFrontIcon,
} from "lucide-react";
import { cn } from "cn";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type CommuteData,
  DESTINATION_KINDS,
  type DestinationKind,
  TRANSIT_KINDS,
  type TransitKind,
} from "@/lib/report-sections";
import { chipClass, MapsLink, Thumb } from "./amenities-tab";
import { TileGrid } from "./dash-card";
import { InteractiveMap, type MapPin } from "./interactive-map";
import {
  formatDistance,
  formatMinutes,
  formatMinutesShort,
  googleMapsUrl,
} from "./report-format";
import { useTravelMode } from "@/components/globals/travel-mode";
import { destinationTime, TRAVEL_MODES } from "@/lib/travel";
import { TRANSIT_ICONS } from "./transit-icons";
import { WIDGET, WIDGET_SELECTED } from "./widget-styles";

type Destination = CommuteData["destinations"][number];
type Station = CommuteData["stations"][number];

/** Older reports don't store a destination's kind. Shared with comparisons. */
export const destinationKind = (d: Destination): DestinationKind =>
  d.kind ?? (/airport/i.test(d.label) ? "airport" : "downtown");

export const DESTINATION_ICONS: Record<DestinationKind, LucideIcon> = {
  downtown: Building2Icon,
  airport: PlaneIcon,
};

export type StopFilter = TransitKind | "all";

/** Single-choice chip row ("All" plus one chip per option). Shared with comparisons. */
export function FilterChips<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | "all";
  onChange: (value: T | "all") => void;
  options: {
    value: T;
    label: string;
    icon: LucideIcon;
    color?: string;
    meta?: string;
  }[];
}) {
  return (
    <ToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={(next) => {
        const v = next[0] as T | "all" | undefined;
        if (v) onChange(v);
      }}
      spacing={1}
      className="flex w-full flex-wrap justify-start"
    >
      <ToggleGroupItem value="all" className={chipClass}>
        <LayoutGridIcon aria-hidden />
        All
      </ToggleGroupItem>
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={chipClass}>
          <o.icon
            aria-hidden
            style={o.color ? { color: o.color } : undefined}
          />
          <span>{o.label}</span>
          {o.meta && (
            <span className="text-xs text-foreground/50 tabular-nums">
              {o.meta}
            </span>
          )}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function DestinationTile({
  destination,
  solid,
}: {
  destination: Destination;
  solid?: boolean;
}) {
  const Icon = DESTINATION_ICONS[destinationKind(destination)];
  // Transit always; the second figure follows the walk / car choice.
  const travel = useTravelMode();
  const trip = destinationTime(destination, travel.mode);
  const stat = (
    icon: typeof CarIcon,
    label: string,
    minutes: number | null,
    extra?: string,
    estimated = false,
  ) => {
    const StatIcon = icon;
    return (
      <span className="min-w-0">
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            solid ? "text-white/75" : "text-foreground/50",
          )}
        >
          <StatIcon aria-hidden className="size-3.5" /> {label}
        </span>
        <span className="mt-1 block text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
          {minutes != null ? (
            <>
              {/* By the tile's own width (container query): "45m" when
                  narrow (3 across, or beside the sidebar), "45 min" when
                  there's room. */}
              <span className="@min-[19rem]:hidden">
                {estimated ? "~" : ""}
                {formatMinutesShort(minutes)}
              </span>
              <span className="hidden @min-[19rem]:inline">
                {estimated ? "~" : ""}
                {formatMinutes(minutes)}
              </span>
            </>
          ) : (
            "—"
          )}
        </span>
        {extra && (
          <span
            className={cn(
              "mt-1 block text-xs tabular-nums",
              solid ? "text-white/70" : "text-foreground/45",
            )}
          >
            {extra}
          </span>
        )}
      </span>
    );
  };
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: { duration: 0.3, ease: "easeOut" },
        },
      }}
      style={solid ? { backgroundColor: "#1d4ed8" } : undefined}
      className={cn(
        WIDGET,
        "@container flex min-h-[8.5rem] min-w-0 flex-col p-4",
        solid && "text-white",
      )}
    >
      <span
        className={cn(
          "flex items-start gap-1.5 text-[13px] font-medium",
          solid ? "text-white/85" : "text-primary",
        )}
        title={destination.label}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 pt-px leading-tight break-words">
          {destination.label}
        </span>
      </span>
      <span className="mt-auto grid grid-cols-2 gap-4 pt-3">
        {stat(TrainFrontIcon, "Transit", destination.transitMinutes)}
        {stat(
          travel.icon,
          TRAVEL_MODES[travel.mode].label,
          trip.minutes,
          trip.km != null ? `${trip.km} km` : undefined,
          trip.estimated,
        )}
      </span>
    </motion.div>
  );
}

export function CommuteTab({
  reportId,
  commute,
  home,
  stopFilter,
  onStopFilterChange,
}: {
  reportId: string;
  commute: CommuteData;
  home: { lat: number; lng: number };
  /** Lifted to the dashboard so header shortcuts can open one stop kind. */
  stopFilter: StopFilter;
  onStopFilterChange: (filter: StopFilter) => void;
}) {
  // Destinations: all, or only downtowns / airports.
  const [destFilter, setDestFilter] = useState<DestinationKind | "all">("all");
  const destKinds = (
    Object.keys(DESTINATION_KINDS) as DestinationKind[]
  ).filter((k) => commute.destinations.some((d) => destinationKind(d) === k));
  const destinations = commute.destinations.filter(
    (d) => destFilter === "all" || destinationKind(d) === destFilter,
  );

  // Stops: all, or one kind. Numbered nearest first within the filter, so
  // map pins and list cards match.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const travel = useTravelMode();
  const allStops = useMemo(
    () =>
      [...commute.stations].sort((a, b) => a.distanceMeters - b.distanceMeters),
    [commute.stations],
  );
  const stopKinds = (Object.keys(TRANSIT_KINDS) as TransitKind[]).filter((k) =>
    allStops.some((s) => s.kind === k),
  );
  const stops = allStops.filter(
    (s) => stopFilter === "all" || s.kind === stopFilter,
  );
  const photoUrl = (s: Station) =>
    s.photo
      ? `/api/reports/${reportId}/place-photo/${encodeURIComponent(s.id)}`
      : null;

  const pins: MapPin[] = stops.map((s, i) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    badge: String(i + 1),
    color: TRANSIT_KINDS[s.kind].color,
    icon: TRANSIT_ICONS[s.kind],
    title: s.name,
    eyebrow: TRANSIT_KINDS[s.kind].label,
    facts: [
      { icon: travel.icon, label: `${travel.minutes(s)} ${travel.verb}` },
      { label: formatDistance(s.distanceMeters) },
    ],
    address: s.address,
    photo: photoUrl(s),
    href: googleMapsUrl({
      name: s.name,
      address: s.address,
      placeId: s.id,
      lat: s.lat,
      lng: s.lng,
    }),
  }));

  return (
    <div className="space-y-4">
      {destKinds.length > 1 && (
        <FilterChips
          label="Destination type"
          value={destFilter}
          onChange={setDestFilter}
          options={destKinds.map((k) => ({
            value: k,
            label: DESTINATION_KINDS[k].label,
            icon: DESTINATION_ICONS[k],
            meta: String(
              commute.destinations.filter((d) => destinationKind(d) === k)
                .length,
            ),
          }))}
        />
      )}
      <TileGrid className="md:grid-cols-2 lg:grid-cols-3">
        {destinations.map((d, i) => (
          <DestinationTile key={d.id} destination={d} solid={i === 0} />
        ))}
      </TileGrid>
      <p className="flex items-center gap-1.5 text-xs text-foreground/55">
        <ClockIcon aria-hidden className="size-3.5" />
        {commute.routesAvailable
          ? `${commute.departureLabel}, with typical traffic.`
          : "Drive and transit times need the Google Routes API to be enabled."}
      </p>

      {allStops.length > 0 && (
        <>
          <h3 className="pt-4 text-sm font-semibold">Transit nearby</h3>
          <FilterChips
            label="Stop type"
            value={stopFilter}
            onChange={(next) => {
              setSelectedId(null);
              onStopFilterChange(next);
            }}
            options={stopKinds.map((k) => ({
              value: k,
              label: TRANSIT_KINDS[k].label,
              icon: TRANSIT_ICONS[k],
              color: TRANSIT_KINDS[k].color,
              meta: travel.minutes(allStops.find((s) => s.kind === k)!),
            }))}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-5">
              <div className="lg:sticky lg:top-32">
                <div
                  ref={mapRef}
                  className={cn(WIDGET, "scroll-mt-32 overflow-hidden")}
                >
                  <InteractiveMap
                    home={home}
                    pins={pins}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    className="h-[24rem] lg:h-[30rem]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t px-4 py-2.5 text-xs text-foreground/65">
                    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {stopKinds
                        .filter((k) => stopFilter === "all" || k === stopFilter)
                        .map((k) => (
                          <li key={k} className="flex items-center gap-1.5">
                            <span
                              className="size-2.5"
                              style={{
                                backgroundColor: TRANSIT_KINDS[k].color,
                              }}
                            />
                            {TRANSIT_KINDS[k].label}
                          </li>
                        ))}
                    </ul>
                    <span className="text-foreground/55">
                      ctrl/⌘ + scroll to zoom
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <ol key={stopFilter} className="min-w-0 space-y-2 lg:col-span-7">
              {stops.map((s, i) => {
                const kind = TRANSIT_KINDS[s.kind];
                return (
                  <motion.li
                    key={s.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{
                      duration: 0.25,
                      delay: Math.min(i, 8) * 0.04,
                    }}
                    onClick={() => {
                      setSelectedId(s.id);
                      mapRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                      });
                    }}
                    className={cn(
                      WIDGET,
                      "flex cursor-pointer gap-3 p-2.5 transition-shadow",
                      selectedId === s.id && WIDGET_SELECTED,
                    )}
                  >
                    <Thumb
                      src={photoUrl(s)}
                      label={String(i + 1)}
                      color={kind.color}
                      icon={TRANSIT_ICONS[s.kind]}
                    />
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className="truncate text-sm font-semibold"
                            title={s.name}
                          >
                            {s.name}
                          </p>
                          <Badge
                            variant="outline"
                            className="h-4 shrink-0 px-1.5 text-[10px]"
                            style={{
                              borderColor: kind.color,
                              color: kind.color,
                            }}
                          >
                            {kind.label}
                          </Badge>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground/65 tabular-nums">
                          <travel.icon aria-hidden className="size-3.5" />
                          {travel.minutes(s)} ·{" "}
                          {formatDistance(s.distanceMeters)}
                        </p>
                      </div>
                      <span onClick={(e) => e.stopPropagation()}>
                        <MapsLink
                          name={s.name}
                          address={s.address}
                          placeId={s.id}
                          lat={s.lat}
                          lng={s.lng}
                        />
                      </span>
                      {s.photo?.author && (
                        <p className="truncate text-[10px] text-foreground/45">
                          Photo: {s.photo.author}
                        </p>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
