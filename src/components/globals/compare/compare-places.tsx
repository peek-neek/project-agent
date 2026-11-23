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
 * Map pins for one property's places, in that property's colour and
 * numbered nearest first ("A1", "B2"), so both homes share one map.
 */
export function sidePins(
  p: CompareProperty,
  places: Place[],
  {
    icon,
    eyebrow,
    travel,
    photoPath,
  }: {
    icon: LucideIcon;
    eyebrow: string;
    travel: Travel;
    /** Place-photo route segment (amenities only). */
    photoPath?: "place-photo";
  },
): MapPin[] {
  const letter = SIDE[p.side].letter;
  return places.map((place, i) => ({
    id: `${p.side}:${place.id}`,
    lat: place.lat,
    lng: place.lng,
    badge: `${letter}${i + 1}`,
    color: SIDE[p.side].color,
    textColor: SIDE[p.side].onColor,
    icon,
    title: place.name,
    eyebrow: `${eyebrow} · near ${letter}`,
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
