"use client";

import { useTravelMode } from "@/components/globals/travel-mode";
import { CameraIcon, ImagesIcon, LoaderCircleIcon } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { MapImage } from "./map-image";
import { type ReportData } from "./report-format";

type View = "street" | "photos";

const ANGLES = [
  { id: "front", label: "Front" },
  { id: "left", label: "Up the street" },
  { id: "right", label: "Down the street" },
  { id: "wide", label: "Wide" },
] as const;
type Angle = (typeof ANGLES)[number]["id"];

type Photo = {
  id: string;
  src: string;
  title: string;
  subtitle?: string;
  categoryId?: AmenityCategoryId;
  credit?: { author: string | null; authorUri: string | null };
};

/** One photo per category first (nearest with a photo), then the rest. */
function placePhotos(
  reportId: string,
  amenities: AmenitiesData,
  /** e.g. "4 min walk", in the selected travel mode. */
  timeLabel: (place: NearbyPlace) => string,
  limit = 11,
) {
  const withPhoto = AMENITY_CATEGORIES.map((c) => ({
    category: c,
    places: (amenities.categories[c.id] ?? []).filter(
      (p): p is NearbyPlace & { photo: NonNullable<NearbyPlace["photo"]> } =>
        Boolean(p.photo),
    ),
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
  return picked.map<Photo>(({ place, categoryId, label }) => ({
    id: place.id,
    src: `/api/reports/${reportId}/place-photo/${encodeURIComponent(place.id)}`,
    title: place.name,
    subtitle: `${label} · ${timeLabel(place)}`,
    categoryId,
    credit: place.photo
      ? { author: place.photo.author, authorUri: place.photo.authorUri }
      : undefined,
  }));
}

/** Google requires showing the photographer's name, linked when available. */
function Credit({ credit }: { credit?: Photo["credit"] }) {
  if (!credit?.author) return null;
  return (
    <span className="text-[11px] text-foreground/50">
      Photo:{" "}
      {credit.authorUri ? (
        <a
          href={credit.authorUri}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {credit.author}
        </a>
      ) : (
        credit.author
      )}
    </span>
  );
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
  const [angle, setAngle] = useState<Angle>("front");
  const [open, setOpen] = useState<Photo | null>(null);
  const travel = useTravelMode();

  const property = report.property;
  const version = encodeURIComponent(String(property?.updatedAt ?? ""));
  const streetSrc = (a: Angle) =>
    `/api/reports/${report.id}/street-view?angle=${a}&v=${version}`;
  const address = property?.formattedAddress ?? report.inputAddress;

  const photos: Photo[] = [
    ...(property?.latitude != null
      ? [
          {
            id: "street",
            src: streetSrc("front"),
            title: "The property",
            subtitle: "Google Street View",
          },
        ]
      : []),
    ...(amenities
      ? placePhotos(
          report.id,
          amenities,
          (p) => `${travel.minutes(p)} ${travel.verb}`,
        )
      : []),
  ];
  const hasPlacePhotos = photos.length > 1;

  const titles: Record<View, { title: string; icon: typeof CameraIcon }> = {
    street: { title: "Street view", icon: CameraIcon },
    photos: { title: "Photos", icon: ImagesIcon },
  };

  return (
    <DashCard
      title={titles[view].title}
      icon={titles[view].icon}
      action={
        <ToggleGroup
          aria-label="Street view or photos"
          value={[view]}
          onValueChange={(value) => {
            const next = value[0] as View | undefined;
            if (next) setView(next);
          }}
          spacing={1}
        >
          <ToggleGroupItem value="street" aria-label="Street view" size="sm">
            <CameraIcon />
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
        (property?.latitude != null ? (
          <div className="grid lg:h-[30rem] lg:grid-cols-[minmax(0,1fr)_13rem]">
            <MapImage
              key={angle}
              src={streetSrc(angle)}
              alt={`Street View of ${address}, ${ANGLES.find((a) => a.id === angle)!.label.toLowerCase()}`}
              fallback="No Street View photo here, or the Street View Static API isn't enabled for your Google key."
              className="aspect-[16/10] ring-0 lg:aspect-auto lg:h-full"
            />
            {/* Angles: a row under the photo, a column beside it on wide screens. */}
            <div className="grid grid-cols-4 gap-px border-t bg-border lg:grid-cols-1 lg:grid-rows-4 lg:border-t-0 lg:border-l">
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated proxy image */}
                    <img
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
          {photos.length === 0 ? (
            <Skeleton className="aspect-[16/10] w-full" />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((photo, i) => {
                const Icon = photo.categoryId
                  ? AMENITY_ICONS[photo.categoryId]
                  : CameraIcon;
                return (
                  <li
                    key={photo.id}
                    className={cn(i === 0 && "col-span-2 row-span-2")}
                  >
                    <button
                      type="button"
                      onClick={() => setOpen(photo)}
                      className="group relative block size-full min-h-28 overflow-hidden bg-muted text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- authenticated proxy image */}
                      <img
                        src={photo.src}
                        alt={photo.title}
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        onError={(e) =>
                          (e.currentTarget.style.visibility = "hidden")
                        }
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-2 text-white">
                        <span className="flex items-center gap-1.5">
                          <Icon aria-hidden className="size-3.5 shrink-0" />
                          <span className="truncate text-xs font-medium">
                            {photo.title}
                          </span>
                        </span>
                        {photo.credit?.author && (
                          <span className="mt-0.5 block truncate text-[10px] text-white/70">
                            Photo: {photo.credit.author}
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
          Google Street View: the nearest street-level photo, which may not show
          the exact home or its current condition.
        </p>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="gap-3 sm:max-w-3xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.title}</DialogTitle>
                {open.subtitle && (
                  <DialogDescription className="flex items-center gap-1.5">
                    {open.categoryId && (
                      <travel.icon aria-hidden className="size-3.5" />
                    )}
                    {open.subtitle}
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- authenticated proxy image */}
                <img
                  src={open.src}
                  alt={open.title}
                  className="absolute inset-0 size-full object-cover"
                />
              </div>
              <Credit credit={open.credit} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashCard>
  );
}
