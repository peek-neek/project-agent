import { MapIcon } from "lucide-react";
import { useTravelMode } from "@/components/globals/travel-mode";
import { TRAVEL_MODES } from "@/lib/travel";
import {
  AMENITY_CATEGORIES,
  type AmenitiesData,
  FEATURED_AMENITY_CATEGORIES,
} from "@/lib/report-sections";
import { AMENITY_ICONS } from "./amenity-icons";
import { MapImage } from "./map-image";
import { PlaceList } from "./place-list";
import { formatDistance } from "./report-format";
import { ReportSubsection } from "./report-layout";

export function AmenitiesSection({
  reportId,
  amenities,
}: {
  reportId: string;
  amenities: AmenitiesData;
}) {
  const mapSrc = (map: string) =>
    `/api/reports/${reportId}/maps/${map}?v=${encodeURIComponent(amenities.fetchedAt)}`;
  const travel = useTravelMode();
  const estimated = Object.values(amenities.categories).some((places) =>
    places.some((p) => travel.time(p).estimated),
  );

  return (
    <>
      <ReportSubsection title="Everything nearby" icon={MapIcon}>
        <MapImage
          src={mapSrc("overview")}
          alt="Map of nearby amenities, colour-coded by category"
        />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/70">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 bg-[#111]" />
            The property
          </li>
          {FEATURED_AMENITY_CATEGORIES.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              <span className="size-2.5" style={{ backgroundColor: c.color }} />
              {c.label}
            </li>
          ))}
        </ul>
      </ReportSubsection>

      {AMENITY_CATEGORIES.map((category) => {
        const places = amenities.categories[category.id] ?? [];
        const Icon = AMENITY_ICONS[category.id];
        return (
          <div
            key={category.id}
            id={`amenity-${category.id}`}
            className="scroll-mt-32 break-inside-avoid p-4 ring-1 ring-border print:border print:border-border print:ring-0 sm:p-5"
          >
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <span
                className="grid size-7 place-items-center text-white"
                style={{ backgroundColor: category.color }}
              >
                <Icon aria-hidden className="size-4" />
              </span>
              {category.label}
              {places[0] && (
                <span className="ml-auto text-xs font-normal text-foreground/60">
                  Nearest: {travel.minutes(places[0])} {travel.verb}
                </span>
              )}
            </h3>
            {places.length === 0 ? (
              <p className="mt-3 text-sm text-foreground/60">
                None found within {formatDistance(category.radius)}.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <MapImage
                  src={mapSrc(category.id)}
                  alt={`Map of nearby ${category.label.toLowerCase()}`}
                />
                <PlaceList places={places} color={category.color} />
              </div>
            )}
          </div>
        );
      })}

      {estimated && (
        <p className="text-xs text-foreground/55">
          ~ {TRAVEL_MODES[travel.mode].label} times are estimated from distance.
          Regenerate the report (with the Google Routes API enabled) for exact
          times.
        </p>
      )}
    </>
  );
}
