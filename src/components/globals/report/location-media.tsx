"use client";

import { FadeImg } from "./fade-img";
import { useTravelMode } from "@/components/globals/travel-mode";
import {
  CameraIcon,
  ImagesIcon,
  LoaderCircleIcon,
  Maximize2Icon,
  SatelliteIcon,
} from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  AMENITY_CATEGORIES,
  type AmenitiesData,
  type AmenityCategoryId,
  type NearbyPlace,
} from "@/lib/report-sections";
import { AMENITY_ICONS } from "./amenity-icons";
import { DashCard } from "./dash-card";
import { Lightbox, type LightboxItem } from "./lightbox";
import { MapImage } from "./map-image";
import { googleMapsUrl, type ReportData } from "./report-format";

type View = "street" | "photos";

/** Satellite zoom levels (server/satellite.ts), default first. */
const ANGLES = [
  { id: "home", label: "The home" },
  { id: "street", label: "Street" },
  { id: "block", label: "Block" },
  { id: "area", label: "Neighbourhood" },
] as const;
type Angle = (typeof ANGLES)[number]["id"];

/** A place shown in the gallery, with all of its photos. */
type PlaceTile = {
  id: string;
  title: string;
  subtitle: string;
  address: string | null;
  /** Opens the place in Google Maps. */
  mapsUrl: string;
  categoryId: AmenityCategoryId;
  photos: {
    src: string;
    credit: { author: string | null; authorUri: string | null };
  }[];
};

/** Places to show: the nearest with a photo in each category first. */
function placeTiles(
  reportId: string,
  amenities: AmenitiesData,
  /** e.g. "4 min walk", in the selected travel mode. */
  timeLabel: (place: NearbyPlace) => string,
  limit = 23,
): PlaceTile[] {
  const withPhoto = AMENITY_CATEGORIES.map((c) => ({
    category: c,
    places: (amenities.categories[c.id] ?? []).filter((p) => Boolean(p.photo)),
  }));
  const picked: {
    place: NearbyPlace;
    categoryId: AmenityCategoryId;
    label: string;
  }[] = [];
  for (let round = 0; picked.length < limit && round < 5; round++) {
    for (const { category, places } of withPhoto) {
      const place = places[round];
      if (
        place &&
        picked.length < limit &&
        !picked.some((p) => p.place.id === place.id)
      ) {
        picked.push({ place, categoryId: category.id, label: category.label });
      }
    }
  }
  return picked.map(({ place, categoryId, label }) => {
    const base = `/api/reports/${reportId}/place-photo/${encodeURIComponent(place.id)}`;
    // Newer reports keep up to 4 photos per place; older ones just `photo`.
    const list = place.photos?.length
      ? place.photos
      : place.photo
        ? [place.photo]
        : [];
    return {
      id: place.id,
      title: place.name,
      subtitle: `${label} · ${timeLabel(place)}`,
      address: place.address,
      mapsUrl: googleMapsUrl({
        name: place.name,
        address: place.address,
        placeId: place.id,
        lat: place.lat,
        lng: place.lng,
      }),
      categoryId,
      photos: list.map((ph, i) => ({
        src: i === 0 ? base : `${base}?i=${i}`,
        credit: { author: ph.author, authorUri: ph.authorUri },
      })),
    };
  });
}

export function LocationMedia({
  report,
  amenities,
  amenitiesBusy,
  onOpenAmenities,
}: {
  report: ReportData;
  amenities: AmenitiesData | null;
  amenitiesBusy: boolean;
  onOpenAmenities: () => void;
}) {
  const [view, setView] = useState<View>("street");
  const [angle, setAngle] = useState<Angle>("home");
  // The open lightbox: which list (street angles or place photos) and where.
  const [viewer, setViewer] = useState<{
    list: "street" | "photos";
    index: number;
  } | null>(null);
  const travel = useTravelMode();

  const property = report.property;
  const version = encodeURIComponent(String(property?.updatedAt ?? ""));
  const streetSrc = (a: Angle) =>
    `/api/reports/${report.id}/satellite?view=${a}&v=${version}`;
  const address = property?.formattedAddress ?? report.inputAddress;
  const hasStreet = property?.latitude != null;

  const tiles = amenities
    ? placeTiles(
        report.id,
        amenities,
        (p) => `${travel.minutes(p)} ${travel.verb}`,
      )
    : [];
  const hasPlacePhotos = tiles.length > 0;

  // Lightbox lists: every satellite zoom level; every photo of every place.
  const streetItems: LightboxItem[] = ANGLES.map((a) => ({
    key: `street-${a.id}`,
    src: streetSrc(a.id),
    title: "The property",
    subtitle: `Satellite · ${a.label}`,
    icon: CameraIcon,
    group: "street",
  }));
  const photoItems: LightboxItem[] = [
    ...(hasStreet ? [{ ...streetItems[0]!, group: undefined }] : []),
    ...tiles.flatMap((t) =>
      t.photos.map((ph, i) => ({
        key: `${t.id}-${i}`,
        // One URL per photo (the route serves a single size), so the grid,
        // thumbnails, main view and preloads all share one request.
        src: ph.src,
        title: t.title,
        subtitle: t.subtitle,
        address: t.address,
        addressHref: t.mapsUrl,
        icon: AMENITY_ICONS[t.categoryId],
        group: t.id,
        credit: ph.credit,
      })),
    ),
  ];
  /** Index of a place's first photo in photoItems. */
  const firstPhotoOf = (placeId: string) =>
    photoItems.findIndex((it) => it.group === placeId);

  const titles: Record<View, { title: string; icon: typeof CameraIcon }> = {
    street: { title: "Satellite view", icon: SatelliteIcon },
    photos: { title: "Photos", icon: ImagesIcon },
  };

  return (
    <DashCard
      title={titles[view].title}
      icon={titles[view].icon}
      action={
        <ToggleGroup
          aria-label="Satellite view or photos"
          value={[view]}
          onValueChange={(value) => {
            const next = value[0] as View | undefined;
            if (next) setView(next);
          }}
          spacing={1}
        >
          <ToggleGroupItem value="street" aria-label="Satellite view" size="sm">
            <SatelliteIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="photos" aria-label="Photos" size="sm">
            <ImagesIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      }
      onOpen={onOpenAmenities}
      openLabel="Open amenities"
      className="lg:col-span-12"
      bodyClassName="p-0"
    >
      {view === "street" &&
        (hasStreet ? (
          <div className="grid lg:h-[30rem] lg:grid-cols-[minmax(0,1fr)_17rem]">
            {/* The selected angle; click to view large and step through. */}
            <button
              type="button"
              onClick={() =>
                setViewer({
                  list: "street",
                  index: ANGLES.findIndex((a) => a.id === angle),
                })
              }
              aria-label="View satellite photos full size"
              className="group/sv relative block cursor-zoom-in text-left"
            >
              <MapImage
                key={angle}
                src={streetSrc(angle)}
                alt={`Satellite view of ${address}, ${ANGLES.find((a) => a.id === angle)!.label.toLowerCase()}`}
                fallback="No satellite image here, or the Maps Static API isn't enabled for your Google key."
                className="aspect-[16/10] ring-0 lg:aspect-auto lg:h-full"
              />
              <span className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover/sv:opacity-100">
                <Maximize2Icon aria-hidden className="size-3" />
                View {ANGLES.length} zoom levels
              </span>
            </button>
            {/* Zoom levels: 4 in a row under the photo; a 2 × 2 grid beside it on wide screens. */}
            <div className="grid grid-cols-4 gap-px border-t bg-border lg:grid-cols-2 lg:grid-rows-2 lg:border-t-0 lg:border-l">
              {ANGLES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAngle(a.id)}
                  aria-pressed={angle === a.id}
                  className={cn(
                    "group relative bg-card p-1.5 text-left transition-colors lg:flex lg:min-h-0 lg:flex-col",
                    angle === a.id ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <span className="relative block aspect-[16/10] overflow-hidden bg-muted lg:aspect-auto lg:min-h-0 lg:flex-1">
                    <FadeImg
                      src={streetSrc(a.id)}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = "hidden")
                      }
                    />
                  </span>
                  <span
                    className={cn(
                      "mt-1 block truncate text-[11px]",
                      angle === a.id
                        ? "font-semibold text-foreground"
                        : "text-foreground/60",
                    )}
                  >
                    {a.label}
                  </span>
                  {angle === a.id && (
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-[3px] bg-primary lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-auto lg:w-[3px]"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <Skeleton className="aspect-[16/10] w-full" />
          </div>
        ))}

      {view === "photos" && (
        <div className="p-3">
          {!hasStreet && !hasPlacePhotos ? (
            <Skeleton className="aspect-[16/10] w-full" />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {hasStreet && (
                <li className="col-span-2 row-span-2">
                  <button
                    type="button"
                    onClick={() => setViewer({ list: "photos", index: 0 })}
                    className="group relative block size-full min-h-28 cursor-zoom-in overflow-hidden bg-muted text-left"
                  >
                    <FadeImg
                      src={streetSrc("home")}
                      alt="The property"
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03]"
                      onError={(e) =>
                        (e.currentTarget.style.visibility = "hidden")
                      }
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2 text-white">
                      <span className="flex items-center gap-1.5">
                        <CameraIcon aria-hidden className="size-3.5 shrink-0" />
                        <span className="truncate text-xs font-medium">
                          The property · Satellite
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )}
              {tiles.map((t) => {
                const Icon = AMENITY_ICONS[t.categoryId];
                const cover = t.photos[0]!;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setViewer({ list: "photos", index: firstPhotoOf(t.id) })
                      }
                      className="group relative block aspect-[4/3] size-full cursor-zoom-in overflow-hidden bg-muted text-left"
                    >
                      <FadeImg
                        src={cover.src}
                        alt={t.title}
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03]"
                        onError={(e) =>
                          (e.currentTarget.style.visibility = "hidden")
                        }
                      />
                      {t.photos.length > 1 && (
                        <span className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          <ImagesIcon aria-hidden className="size-3" />
                          {t.photos.length}
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 pt-6 pb-1.5 text-white">
                        <span className="flex items-center gap-1.5">
                          <Icon aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate text-xs font-medium">
                            {t.title}
                          </span>
                        </span>
                        {cover.credit.author && (
                          <span className="mt-0.5 block truncate text-[10px] text-white/70">
                            Photo: {cover.credit.author}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {!hasPlacePhotos && amenitiesBusy && (
            <p className="mt-3 flex items-center gap-2 text-sm text-foreground/60">
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
              Loading photos of nearby places…
            </p>
          )}
        </div>
      )}

      {view === "street" && (
        <p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-xs text-foreground/55">
          <CameraIcon aria-hidden className="size-3.5 shrink-0" />
          Satellite imagery from Google Maps, centred on the home (pin). Imagery
          dates vary, so recent changes to the property may not show.
        </p>
      )}

      <Lightbox
        items={viewer?.list === "street" ? streetItems : photoItems}
        index={viewer?.index ?? null}
        onIndexChange={(index) => setViewer((v) => (v ? { ...v, index } : v))}
        onClose={() => setViewer(null)}
      />
    </DashCard>
  );
}
