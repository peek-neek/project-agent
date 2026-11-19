import { StarIcon } from "lucide-react";
import { useTravelMode } from "@/components/globals/travel-mode";
import type { NearbyPlace } from "@/lib/report-sections";
import { formatDistance } from "./report-format";

/** Numbered list matching the numbered map markers. */
export function PlaceList({
  places,
  color,
  badge,
}: {
  places: NearbyPlace[];
  color: string | ((index: number) => string);
  badge?: (index: number) => React.ReactNode;
}) {
  const travel = useTravelMode();
  return (
    <ol className="divide-y divide-foreground/10">
      {places.map((place, i) => (
        <li key={place.id} className="flex break-inside-avoid gap-3 py-2.5">
          <span
            className="mt-0.5 grid size-6 shrink-0 place-items-center text-xs font-semibold text-white"
            style={{
              backgroundColor: typeof color === "function" ? color(i) : color,
            }}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
              <span className="truncate">{place.name}</span>
              {badge?.(i)}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-foreground/60">
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
                  {place.ratingCount
                    ? ` (${place.ratingCount.toLocaleString("en-CA")})`
                    : ""}
                </span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
