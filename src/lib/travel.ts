// Travel modes for every "time to get there" in a report. Shared by the
// extractors (which store real times) and the UI (which shows one mode).

export const TRAVEL_MODES = {
  walk: { label: "Walk", verb: "walk", routesMode: "WALK" },
  bike: { label: "Cycle", verb: "bike", routesMode: "BICYCLE" },
  drive: { label: "Car", verb: "drive", routesMode: "DRIVE" },
} as const;
export type TravelMode = keyof typeof TRAVEL_MODES;
export const travelModes = Object.keys(TRAVEL_MODES) as TravelMode[];

/** Cookie mirroring the saved mode, so server renders use it too. */
export const TRAVEL_MODE_COOKIE = "travel-mode";

export const parseTravelMode = (value: unknown): TravelMode =>
  typeof value === "string" && value in TRAVEL_MODES
    ? (value as TravelMode)
    : "walk";

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

/** A trip to a commute destination, as stored (walk/bike may be absent). */
export type DestinationTimes = {
  driveMinutes: number | null;
  driveKm: number | null;
  walkMinutes?: number | null;
  walkKm?: number | null;
  bikeMinutes?: number | null;
  bikeKm?: number | null;
};

/**
 * A destination's trip in one mode. Walk/bike missing (older reports or no
 * route): estimated from the driving distance, flagged as estimated.
 */
export function destinationTime(
  d: DestinationTimes,
  mode: TravelMode,
): { minutes: number | null; km: number | null; estimated: boolean } {
  if (mode === "drive") {
    return { minutes: d.driveMinutes, km: d.driveKm, estimated: false };
  }
  const minutes = mode === "walk" ? d.walkMinutes : d.bikeMinutes;
  const km = mode === "walk" ? d.walkKm : d.bikeKm;
  if (minutes != null) return { minutes, km: km ?? null, estimated: false };
  if (d.driveKm == null) return { minutes: null, km: null, estimated: false };
  // The driving route already includes detours: undo estimateMinutes' own.
  return {
    minutes: estimateMinutes((d.driveKm * 1000) / 1.3, mode),
    km: d.driveKm,
    estimated: true,
  };
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
