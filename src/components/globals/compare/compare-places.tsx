"use client";

import { RouteIcon, type LucideIcon } from "lucide-react";
import type { MapPin } from "@/components/globals/report/interactive-map";
import {
  formatDistance,
  googleMapsUrl,
} from "@/components/globals/report/report-format";
import type { TravelTimes } from "@/lib/travel";
import { type CompareProperty, SIDE, type Travel } from "./compare-shared";

type Place = TravelTimes & {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  photo?: unknown;
};

/**
 * Map pins for one property's places, numbered in the order given ("A1",
 * "B2"), so both homes share one map: the badge says which home. In the
 * property's colour, or with `colorFor` in each place's own colour (its
 * kind, as on a single report). `iconFor` / `eyebrowFor` vary the icon and
 * label per place (an "All" view mixing kinds).
 */
export function sidePins<P extends Place>(
  p: CompareProperty,
  places: P[],
  {
    icon,
    eyebrow,
    iconFor,
    eyebrowFor,
    colorFor,
    travel,
    photoPath,
  }: {
    icon: LucideIcon;
    eyebrow: string;
    iconFor?: (place: P) => LucideIcon;
    eyebrowFor?: (place: P) => string;
    colorFor?: (place: P) => string;
    travel: Travel;
    /** Place-photo route segment (amenities and transit stops). */
    photoPath?: "place-photo";
  },
): MapPin[] {
  const letter = SIDE[p.side].letter;
  const iconOf = iconFor ?? (() => icon);
  const eyebrowOf = eyebrowFor ?? (() => eyebrow);
  return places.map((place, i) => ({
    id: `${p.side}:${place.id}`,
    lat: place.lat,
    lng: place.lng,
    badge: `${letter}${i + 1}`,
    // A kind's colour takes white icons, like a single report's pins.
    color: colorFor ? colorFor(place) : SIDE[p.side].color,
    textColor: colorFor ? undefined : SIDE[p.side].onColor,
    icon: iconOf(place),
    title: place.name,
    eyebrow: `${eyebrowOf(place)} · near ${letter}`,
    facts: [
      { icon: travel.icon, label: `${travel.minutes(place)} ${travel.verb}` },
      { icon: RouteIcon, label: formatDistance(place.distanceMeters) },
    ],
    rating:
      place.rating != null
        ? { value: place.rating, count: place.ratingCount }
        : null,
    address: place.address ?? null,
    photo:
      photoPath && place.photo
        ? `/api/reports/${p.report.id}/${photoPath}/${encodeURIComponent(place.id)}?w=800`
        : null,
    href: googleMapsUrl({
      name: place.name,
      address: place.address,
      placeId: place.id,
      lat: place.lat,
      lng: place.lng,
    }),
  }));
}
