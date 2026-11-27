// Travel modes for every "time to get there" in a report. Shared by the
// extractors (which store real times) and the UI (which shows one mode).

export const TRAVEL_MODES = {
  walk: { label: "Walk", verb: "walk", routesMode: "WALK" },
  drive: { label: "Car", verb: "drive", routesMode: "DRIVE" },
} as const;
export type TravelMode = keyof typeof TRAVEL_MODES;
export const travelModes = Object.keys(TRAVEL_MODES) as TravelMode[];

/** Cookie mirroring the saved mode, so server renders use it too. */
export const TRAVEL_MODE_COOKIE = "travel-mode";

/** Unknown values, including the retired "bike" mode, fall back to walk. */
export const parseTravelMode = (value: unknown): TravelMode =>
  typeof value === "string" && value in TRAVEL_MODES
    ? (value as TravelMode)
    : "walk";

/**
 * Minutes estimated from distance, when the Routes API has no time (or the
 * report predates drive times). `meters` is the walking route distance when
 * known, else straight-line, so a small detour factor is applied.
 *   walk 5 km/h · drive ~30 km/h in town, plus parking.
 */
export function estimateMinutes(meters: number, mode: TravelMode) {
  switch (mode) {
    case "walk":
      return Math.max(1, Math.round((meters * 1.3) / 83));
    case "drive":
      return Math.max(1, Math.round((meters * 1.4) / 500) + 1);
  }
}

/** A trip to a commute destination, as stored (walk may be absent). */
export type DestinationTimes = {
  driveMinutes: number | null;
  driveKm: number | null;
  walkMinutes?: number | null;
  walkKm?: number | null;
};

/**
 * A destination's trip in one mode. Walk missing (older reports or no
 * route): estimated from the driving distance, flagged as estimated.
 */
export function destinationTime(
  d: DestinationTimes,
  mode: TravelMode,
): { minutes: number | null; km: number | null; estimated: boolean } {
  if (mode === "drive") {
    return { minutes: d.driveMinutes, km: d.driveKm, estimated: false };
  }
  if (d.walkMinutes != null) {
    return { minutes: d.walkMinutes, km: d.walkKm ?? null, estimated: false };
  }
  if (d.driveKm == null) return { minutes: null, km: null, estimated: false };
  // The driving route already includes detours: undo estimateMinutes' own.
  return {
    minutes: estimateMinutes((d.driveKm * 1000) / 1.3, mode),
    km: d.driveKm,
    estimated: true,
  };
}

/** Stored travel times on a place (drive is absent on older reports). */
export type TravelTimes = {
  distanceMeters: number;
  walkMinutes: number;
  walkEstimated: boolean;
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
  return place.driveMinutes != null
    ? { minutes: place.driveMinutes, estimated: Boolean(place.driveEstimated) }
    : { minutes: estimateMinutes(place.distanceMeters, mode), estimated: true };
}
