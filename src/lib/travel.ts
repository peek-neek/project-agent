// Travel modes for every "time to get there" in a report. Shared by the
// extractors (which store real times) and the UI (which shows one mode).

export const TRAVEL_MODES = {
  walk: { label: "Walk", verb: "walk", routesMode: "WALK" },
  bike: { label: "Cycle", verb: "bike", routesMode: "BICYCLE" },
  drive: { label: "Car", verb: "drive", routesMode: "DRIVE" },
} as const;
export type TravelMode = keyof typeof TRAVEL_MODES;
export const travelModes = Object.keys(TRAVEL_MODES) as TravelMode[];

/**
 * Minutes estimated from distance, when the Routes API has no time (or the
 * report predates bike/drive times). `meters` is the walking route distance
 * when known, else straight-line, so a small detour factor is applied.
 *   walk 5 km/h · bike 15 km/h · drive ~30 km/h in town, plus parking.
 */
export function estimateMinutes(meters: number, mode: TravelMode) {
  switch (mode) {
    case "walk":
      return Math.max(1, Math.round((meters * 1.3) / 83));
    case "bike":
      return Math.max(1, Math.round((meters * 1.3) / 250));
    case "drive":
      return Math.max(1, Math.round((meters * 1.4) / 500) + 1);
  }
}

/** Stored travel times on a place (bike/drive are absent on older reports). */
export type TravelTimes = {
  distanceMeters: number;
  walkMinutes: number;
  walkEstimated: boolean;
  bikeMinutes?: number | null;
  bikeEstimated?: boolean | null;
  driveMinutes?: number | null;
  driveEstimated?: boolean | null;
};

/** A place's time in one mode: stored when we have it, else estimated. */
export function travelTime(
  place: TravelTimes,
  mode: TravelMode,
): { minutes: number; estimated: boolean } {
  if (mode === "walk") {
    return { minutes: place.walkMinutes, estimated: place.walkEstimated };
  }
  const minutes = mode === "bike" ? place.bikeMinutes : place.driveMinutes;
  const estimated =
    mode === "bike" ? place.bikeEstimated : place.driveEstimated;
  return minutes != null
    ? { minutes, estimated: Boolean(estimated) }
    : { minutes: estimateMinutes(place.distanceMeters, mode), estimated: true };
}
