"use client";

import { FadeImg } from "./fade-img";
import {
  ExternalLinkIcon,
  LayoutGridIcon,
  MapPinIcon,
  RouteIcon,
  StarIcon,
} from "lucide-react";
import { cn } from "cn";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AMENITY_CATEGORIES,
  type AmenitiesData,
  type AmenityCategoryId,
  type NearbyPlace,
} from "@/lib/report-sections";
import { AMENITY_ICONS } from "./amenity-icons";
import { useTravelMode } from "@/components/globals/travel-mode";
import { TRAVEL_MODES } from "@/lib/travel";
import { InteractiveMap, type MapPin } from "./interactive-map";
import { formatDistance, googleMapsUrl } from "./report-format";
import { WIDGET, WIDGET_SELECTED } from "./widget-styles";

export type AmenityFilter = AmenityCategoryId | "all";

/** Filter chip style, shared with the commute tab. */
export const chipClass =
  "h-auto gap-2 border bg-card px-3 py-2 data-pressed:border-foreground data-pressed:bg-card";

/** Clickable address: opens the place in Google Maps. */
export function MapsLink({
  name,
  address,
  placeId,
  lat,
  lng,
}: {
  name: string;
  address: string | null;
  placeId?: string;
  lat: number;
  lng: number;
}) {
  return (
    <a
      href={googleMapsUrl({ name, address, placeId, lat, lng })}
      target="_blank"
      rel="noreferrer"
      className="group/link inline-flex max-w-full items-center gap-1 text-xs text-foreground/65 hover:text-primary"
      title="Open in Google Maps"
    >
      <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate underline-offset-2 group-hover/link:underline">
        {address ?? "Open in Google Maps"}
      </span>
      <ExternalLinkIcon
        aria-hidden
        className="size-3 shrink-0 opacity-0 transition-opacity group-hover/link:opacity-100"
      />
    </a>
  );
}

/** Photo (or icon) with the map marker number in the corner. */
export function Thumb({
  src,
  label,
  color,
  icon: Icon,
}: {
  src: string | null;
  label?: string;
  color: string;
  icon: typeof MapPinIcon;
}) {
  return (
    <span className="relative block aspect-[4/3] w-28 shrink-0 overflow-hidden bg-muted sm:w-32">
      <span className="absolute inset-0 grid place-items-center">
        <Icon aria-hidden className="size-6" style={{ color }} />
      </span>
      {src && (
        <FadeImg
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      {label && (
        <span
          className="absolute top-0 left-0 grid size-6 place-items-center text-xs font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

function PlaceCard({
  reportId,
  place,
  index,
  categoryId,
  selected,
  onSelect,
}: {
  reportId: string;
  place: NearbyPlace;
  index: number;
  categoryId: AmenityCategoryId;
  selected: boolean;
  onSelect: () => void;
}) {
  const category = AMENITY_CATEGORIES.find((c) => c.id === categoryId)!;
  const travel = useTravelMode();
  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
      onClick={onSelect}
      className={cn(
        WIDGET,
        "flex cursor-pointer gap-3 p-2.5 transition-shadow",
        selected && WIDGET_SELECTED,
      )}
    >
      <Thumb
        src={
          place.photo
            ? `/api/reports/${reportId}/place-photo/${encodeURIComponent(place.id)}`
            : null
        }
        label={String(index + 1)}
        color={category.color}
        icon={AMENITY_ICONS[categoryId]}
      />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" title={place.name}>
            {place.name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground/65">
            <span className="flex items-center gap-1 tabular-nums">
              <travel.icon aria-hidden className="size-3.5" />
              {travel.minutes(place)} · {formatDistance(place.distanceMeters)}
            </span>
            {place.rating != null && (
              <span className="flex items-center gap-1 tabular-nums">
                <StarIcon
                  aria-hidden
                  className="size-3.5 fill-amber-400 text-amber-400"
                />
                {place.rating.toFixed(1)}
                {place.ratingCount ? (
                  <span className="text-foreground/45">
                    ({place.ratingCount.toLocaleString("en-CA")})
                  </span>
                ) : null}
              </span>
            )}
          </p>
        </div>
        <span onClick={(e) => e.stopPropagation()}>
          <MapsLink
            name={place.name}
            address={place.address}
            placeId={place.id}
            lat={place.lat}
            lng={place.lng}
          />
        </span>
        {place.photo?.author && (
          <p className="truncate text-[10px] text-foreground/45">
            Photo: {place.photo.author}
          </p>
        )}
      </div>
    </motion.li>
  );
}

/** Pins shown for "All": the nearest few of every category. */
const ALL_PER_CATEGORY = 3;

export function AmenitiesTab({
  reportId,
  amenities,
  home,
  filter,
  onFilterChange,
}: {
  reportId: string;
  amenities: AmenitiesData;
  home: { lat: number; lng: number };
  filter: AmenityFilter;
  onFilterChange: (filter: AmenityFilter) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const travel = useTravelMode();
  const places = (id: AmenityCategoryId) => amenities.categories[id] ?? [];
  const selected =
    filter === "all" ? null : AMENITY_CATEGORIES.find((c) => c.id === filter)!;
  const estimated = Object.values(amenities.categories).some((list) =>
    list.some((p) => travel.time(p).estimated),
  );

  const pins = useMemo<MapPin[]>(() => {
    const list: MapPin[] = AMENITY_CATEGORIES.filter(
      (c) => filter === "all" || c.id === filter,
    ).flatMap((c) =>
      (amenities.categories[c.id] ?? [])
        .slice(0, filter === "all" ? ALL_PER_CATEGORY : undefined)
        .map((place, i) => ({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          badge: String(i + 1),
          color: c.color,
          icon: AMENITY_ICONS[c.id],
          title: place.name,
          eyebrow: c.label,
          facts: [
            {
              icon: travel.icon,
              label: `${travel.minutes(place)} ${travel.verb}`,
            },
            { icon: RouteIcon, label: formatDistance(place.distanceMeters) },
          ],
          rating:
            place.rating != null
              ? { value: place.rating, count: place.ratingCount }
              : null,
          address: place.address,
          photo: place.photo
            ? `/api/reports/${reportId}/place-photo/${encodeURIComponent(place.id)}`
            : null,
          href: googleMapsUrl({
            name: place.name,
            address: place.address,
            placeId: place.id,
            lat: place.lat,
            lng: place.lng,
          }),
        })),
    );
    // A place can be in two categories (e.g. a café that's also a
    // restaurant); show one pin per place, under its first category.
    const seen = new Set<string>();
    return list.filter((pin) => !seen.has(pin.id) && seen.add(pin.id));
  }, [amenities, filter, reportId, travel]);

  const choose = (next: AmenityFilter) => {
    setSelectedId(null);
    onFilterChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Every category, with its nearest walking time. */}
      <ToggleGroup
        aria-label="Amenity category"
        value={[filter]}
        onValueChange={(value) => {
          const next = value[0] as AmenityFilter | undefined;
          if (next) choose(next);
        }}
        spacing={1}
        className="flex w-full flex-wrap justify-start"
      >
        <ToggleGroupItem value="all" className={chipClass}>
          <LayoutGridIcon aria-hidden />
          All
        </ToggleGroupItem>
        {AMENITY_CATEGORIES.map((c) => {
          const Icon = AMENITY_ICONS[c.id];
          const nearest = places(c.id)[0];
          return (
            <ToggleGroupItem key={c.id} value={c.id} className={chipClass}>
              <Icon aria-hidden style={{ color: c.color }} />
              <span>{c.label}</span>
              <span className="text-xs text-foreground/50 tabular-nums">
                {nearest ? travel.minutes(nearest) : "—"}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div ref={mapRef} className={cn(WIDGET, "scroll-mt-32 overflow-hidden")}>
        <InteractiveMap
          home={home}
          pins={pins}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <p className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-foreground/55">
          <span>
            {selected
              ? `${pins.length} ${selected.label.toLowerCase()} nearby, numbered nearest first.`
              : `The ${ALL_PER_CATEGORY} nearest of each category. Pick one above to see them all.`}
          </span>
          <span>Click a pin for details · ctrl/⌘ + scroll to zoom</span>
        </p>
      </div>

      {selected &&
        (places(selected.id).length === 0 ? (
          <p className={cn(WIDGET, "p-6 text-sm text-foreground/60")}>
            No {selected.label.toLowerCase()} within{" "}
            {formatDistance(selected.radius)}.
          </p>
        ) : (
          <ol key={selected.id} className="grid gap-2 md:grid-cols-2">
            {places(selected.id).map((place, i) => (
              <PlaceCard
                key={place.id}
                reportId={reportId}
                place={place}
                index={i}
                categoryId={selected.id}
                selected={selectedId === place.id}
                onSelect={() => {
                  setSelectedId(place.id);
                  mapRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                  });
                }}
              />
            ))}
          </ol>
        ))}

      <p className={cn("text-xs text-foreground/50", !estimated && "hidden")}>
        ~ {TRAVEL_MODES[travel.mode].label} times are estimated from distance.
      </p>
    </div>
  );
}
