// One 1–5 score per report section (5 = best), each the average of that
// section's parts, for the Overview tiles. Amenities, commute and schools
// follow the selected travel mode, each judged against what's normal for
// that mode (a 10-minute drive isn't a 10-minute walk); safety,
// neighbourhood and upside don't depend on how you get around.
//
// Neighbourhood uses housing stock and tenure only: never facts about who
// lives there (age, family, income), per provincial human rights codes.
import type {
  AmenitiesData,
  CensusFieldId,
  CommuteData,
  DemographicsData,
  SafetyData,
  School,
  SchoolsData,
  UpsideData,
} from "./report-sections";
import { AMENITY_CATEGORIES } from "./report-sections";
import { destinationTime, type TravelMode, travelTime } from "./travel";

/**
 * [best, worst] minutes per mode: full marks at best, none at worst.
 * Shared with the header market score so the two always agree.
 */
export const THRESHOLDS: Record<
  TravelMode,
  Record<"essential" | "other" | "rapid" | "bus" | "school", [number, number]>
> = {
  walk: {
    essential: [5, 25],
    other: [10, 45],
    rapid: [8, 40],
    bus: [4, 15],
    school: [10, 45],
  },
  bike: {
    essential: [3, 15],
    other: [5, 25],
    rapid: [4, 20],
    bus: [2, 8],
    school: [5, 20],
  },
  drive: {
    essential: [3, 12],
    other: [5, 20],
    // Park and ride: driving to a GO or subway station is normal.
    rapid: [4, 15],
    bus: [2, 6],
    school: [4, 15],
  },
};

export type SectionScore = {
  /** 1–5, one decimal. */
  score: number;
  /** The 0–1 average behind it. */
  ease: number;
};

/** 1 at `good` or better, 0 at `bad` or worse, linear between. */
const scale = (value: number, good: number, bad: number) =>
  Math.max(0, Math.min(1, (bad - value) / (bad - good)));
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const mean = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const weighted = (parts: { score: number; weight: number }[]) => {
  const total = parts.reduce((s, p) => s + p.weight, 0);
  return total
    ? parts.reduce((s, p) => s + p.score * p.weight, 0) / total
    : null;
};

export const toScore = (ease: number): SectionScore => ({
  ease,
  score: Math.round((1 + ease * 4) * 10) / 10,
});

// --- Amenities -----------------------------------------------------------------

/** Everyday needs: expected within a short walk. Others: a longer one. */
const ESSENTIAL = new Set([
  "groceries",
  "pharmacies",
  "cafes",
  "restaurants",
  "parks",
  "gyms",
]);

export function amenitiesScore(
  amenities: AmenitiesData | null,
  mode: TravelMode,
) {
  if (!amenities) return null;
  const t = THRESHOLDS[mode];
  const parts = AMENITY_CATEGORIES.map((c) => {
    const nearest = Math.min(
      ...(amenities.categories[c.id] ?? []).map(
        (p) => travelTime(p, mode).minutes,
      ),
    );
    const essential = ESSENTIAL.has(c.id);
    return {
      weight: c.id === "groceries" ? 2 : essential ? 1 : 0.5,
      score: Number.isFinite(nearest)
        ? scale(nearest, ...(essential ? t.essential : t.other))
        : 0,
    };
  });
  const ease = weighted(parts);
  return ease == null ? null : toScore(ease);
}

// --- Commute ---------------------------------------------------------------------

const RAPID = new Set(["subway", "light_rail", "train"]);

export function commuteScore(commute: CommuteData | null, mode: TravelMode) {
  if (!commute) return null;
  const t = THRESHOLDS[mode];
  // Destinations: the faster of transit and the selected mode.
  const trips = commute.destinations.flatMap((d) => {
    const best = Math.min(
      ...[d.transitMinutes, destinationTime(d, mode).minutes].filter(
        (m): m is number => m != null,
      ),
    );
    if (!Number.isFinite(best)) return [];
    const airport = d.kind === "airport" || /airport/i.test(d.label);
    return [airport ? scale(best, 30, 90) : scale(best, 25, 75)];
  });
  // Getting on transit near home, in the selected mode.
  const minutes = (s: (typeof commute.stations)[number]) =>
    travelTime(s, mode).minutes;
  const stops = [...commute.stations].sort((a, b) => minutes(a) - minutes(b));
  const rapid = stops.find((s) => RAPID.has(s.kind));
  const bus = stops.find((s) => s.kind === "bus" || s.kind === "go_bus");
  const access = Math.max(
    rapid ? scale(minutes(rapid), ...t.rapid) : 0,
    bus ? scale(minutes(bus), ...t.bus) * 0.6 : 0,
  );
  const tripScore = mean(trips);
  const ease = weighted([
    { score: access, weight: 1 },
    ...(tripScore != null ? [{ score: tripScore, weight: 1 }] : []),
  ]);
  return ease == null ? null : toScore(ease);
}

// --- Schools ------------------------------------------------------------------

export const eqaoMean = (results: School["results"]) =>
  mean(
    Object.values(results).filter((v): v is number => typeof v === "number"),
  );

export function schoolsScore(schools: SchoolsData | null, mode: TravelMode) {
  if (!schools) return null;
  const nearby = schools.systems
    .flatMap((s) => [...s.elementary, ...s.secondary])
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 4);
  if (nearby.length === 0) return null;
  const ontario = eqaoMean(schools.provincialAverage as School["results"]);
  // Each school: its results vs Ontario (±15 points spans the scale), and
  // how close it is. Missing results count as average.
  const each = nearby.map((s) => {
    const eqao = eqaoMean(s.results);
    const results =
      eqao != null && ontario != null
        ? clamp(0.5 + (eqao - ontario) / 30)
        : 0.5;
    const proximity = scale(
      travelTime(s, mode).minutes,
      ...THRESHOLDS[mode].school,
    );
    return (results + proximity) / 2;
  });
  return toScore(mean(each)!);
}

// --- Safety ---------------------------------------------------------------------

export function safetyScore(safety: SafetyData | null) {
  if (!safety) return null;
  const parts: number[] = [];
  // Crime: Toronto's neighbourhood ranking, else severity vs the province.
  if (safety.crime?.lowerRateThanShare != null) {
    parts.push(safety.crime.lowerRateThanShare);
  } else if (safety.areaCrime?.csi != null && safety.areaCrime.province.csi) {
    parts.push(
      clamp(1.5 - safety.areaCrime.csi / safety.areaCrime.province.csi),
    );
  }
  // Environment: flood regulation, noise and air.
  let env = 1;
  if (safety.flood.status === "inside") env -= 0.45;
  else if (safety.flood.status === "nearby") env -= 0.15;
  const { highway, railway, airport } = safety.noise;
  if (highway && highway.meters <= 250)
    env -= highway.meters <= 100 ? 0.3 : 0.15;
  if (railway && railway.meters <= 250)
    env -= railway.meters <= 100 ? 0.25 : 0.1;
  if (airport) env -= 0.15;
  if (safety.airQuality && safety.airQuality.aqi < 50) env -= 0.1;
  parts.push(clamp(env));
  return toScore(mean(parts)!);
}

// --- Neighbourhood (housing stock and tenure only) --------------------------------

const HOME_TYPES: CensusFieldId[] = [
  "singleDetached",
  "semiDetached",
  "rowHouse",
  "duplex",
  "lowRise",
  "highRise",
];

export function neighbourhoodScore(demographics: DemographicsData | null) {
  const v = demographics?.area.values;
  if (!v) return null;
  const parts: number[] = [];
  // Variety: a mix of home types draws a wider pool of buyers and renters.
  const shares = HOME_TYPES.map((id) => v[id]).filter(
    (s): s is number => typeof s === "number",
  );
  const total = shares.reduce((a, b) => a + b, 0);
  if (total > 0) {
    const top = Math.max(...shares) / total;
    parts.push(scale(top, 0.45, 0.95));
  }
  // Tenure: both owners and an active rental market (peaks near 40% renting).
  if (typeof v.renters === "number") {
    parts.push(clamp(1 - Math.abs(v.renters - 40) / 50));
  }
  const ease = mean(parts);
  return ease == null ? null : toScore(ease);
}

// --- Upside ----------------------------------------------------------------------

export function upsideScore(upside: UpsideData | null) {
  if (!upside) return null;
  const transitBuilds = upside.projects.filter(
    (p) => p.category === "Transit" && p.status === "Under construction",
  ).length;
  const applications = upside.development?.applications.length ?? 0;
  // Neutral with nothing planned; investment nearby raises it.
  return toScore(
    clamp(
      0.4 +
        transitBuilds * 0.25 +
        upside.projects.length * 0.04 +
        Math.min(applications, 10) * 0.02,
    ),
  );
}
