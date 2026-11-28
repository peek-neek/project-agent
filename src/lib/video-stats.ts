// The numbers the video's stat scenes show (overview, safety,
// neighbourhood) and the upside pins. Shared by the server (script and
// render) and the client Player, so both build identical videos. Built
// from the report only: the AI writes the voiceover, never the figures.
//
// Neighbourhood uses housing stock and tenure only: never facts about who
// lives there (age, family, income), per provincial human rights codes,
// like the Overview's neighbourhood score.
import { MARKET_LEVELS, marketScore } from "./market-score";
import {
  type AmenitiesData,
  type CensusFieldId,
  CENSUS_FIELDS,
  type CommuteData,
  type DemographicsData,
  PROJECT_CATEGORIES,
  type SafetyData,
  type SchoolsData,
  type UpsideData,
} from "./report-sections";
import {
  amenitiesScore,
  commuteScore,
  neighbourhoodScore,
  safetyScore,
  schoolsScore,
  upsideScore,
} from "./section-scores";
import type { TravelMode } from "./travel";

export type StatTone = "good" | "warn" | "bad" | "neutral";

export type VideoStats = {
  /** Sell / rent ease and each section's 1–5 score. */
  overview: {
    label: string;
    color: string;
    level: number;
    rows: { label: string; score: number }[];
  } | null;
  /** Crime, flood, noise and air: one line each. */
  safety: { items: { label: string; value: string; tone: StatTone }[] } | null;
  /** Housing mix (top types) and tenure. */
  neighbourhood: {
    homes: { label: string; share: number }[];
    owners: number | null;
    renters: number | null;
  } | null;
  /** The nearest planned projects and development applications. */
  upside: {
    pins: {
      id: string;
      name: string;
      label: string;
      lat: number;
      lng: number;
      color: string;
    }[];
  } | null;
};

const HOME_TYPES: CensusFieldId[] = [
  "singleDetached",
  "semiDetached",
  "rowHouse",
  "duplex",
  "lowRise",
  "highRise",
];
const censusLabel = (id: CensusFieldId) =>
  CENSUS_FIELDS.find((f) => f.id === id)!.label;

const km = (meters: number) =>
  meters < 1000 ? `${Math.round(meters / 10) * 10} m` : `${(meters / 1000).toFixed(1)} km`;

/** Most pins the upside scene shows, so labels stay readable. */
const MAX_UPSIDE_PINS = 4;

export function videoStats(
  data: {
    amenities: AmenitiesData | null;
    commute: CommuteData | null;
    schools: SchoolsData | null;
    safety: SafetyData | null;
    demographics: DemographicsData | null;
    upside: UpsideData | null;
    listPrice?: number | null;
    city?: string | null;
    province?: string | null;
  },
  mode: TravelMode,
): VideoStats {
  return {
    overview: overview(data, mode),
    safety: safety(data.safety),
    neighbourhood: neighbourhood(data.demographics),
    upside: upside(data.upside),
  };
}

function overview(data: Parameters<typeof videoStats>[0], mode: TravelMode) {
  const market = marketScore(data, mode);
  if (!market) return null;
  const rows = [
    { label: "Amenities", s: amenitiesScore(data.amenities, mode) },
    { label: "Commute", s: commuteScore(data.commute, mode) },
    { label: "Schools", s: schoolsScore(data.schools, mode) },
    { label: "Safety", s: safetyScore(data.safety) },
    { label: "Neighbourhood", s: neighbourhoodScore(data.demographics) },
    { label: "Upside", s: upsideScore(data.upside) },
  ].flatMap(({ label, s }) => (s ? [{ label, score: s.score }] : []));
  return {
    label: market.label,
    color: MARKET_LEVELS[market.level].color,
    level: market.level,
    rows,
  };
}

function safety(s: SafetyData | null) {
  if (!s) return null;
  const items: { label: string; value: string; tone: StatTone }[] = [];

  // Crime: Toronto's neighbourhood ranking, else severity vs the province.
  if (s.crime?.lowerRateThanShare != null) {
    const pct = Math.round(s.crime.lowerRateThanShare * 100);
    items.push({
      label: "Crime rate",
      value: `Lower than ${pct}% of city neighbourhoods`,
      tone: pct >= 60 ? "good" : pct >= 35 ? "neutral" : "warn",
    });
  } else if (s.areaCrime?.csi != null && s.areaCrime.province.csi) {
    const diff = Math.round((s.areaCrime.csi / s.areaCrime.province.csi - 1) * 100);
    items.push({
      label: "Crime severity",
      value:
        diff === 0
          ? `Same as ${s.areaCrime.province.name}`
          : `${Math.abs(diff)}% ${diff < 0 ? "below" : "above"} ${s.areaCrime.province.name}`,
      tone: diff <= -10 ? "good" : diff <= 10 ? "neutral" : "warn",
    });
  }

  if (s.flood.status === "inside") {
    items.push({ label: "Flood", value: "In a regulated area", tone: "bad" });
  } else if (s.flood.status === "nearby") {
    items.push({ label: "Flood", value: "Near a regulated area", tone: "warn" });
  } else if (s.flood.status === "clear") {
    items.push({ label: "Flood", value: "Outside regulated areas", tone: "good" });
  }

  const { highway, railway, airport } = s.noise;
  if (s.noise.roadsCovered) {
    items.push(
      highway && highway.meters <= 500
        ? { label: "Highway", value: `${km(highway.meters)} away`, tone: highway.meters <= 250 ? "warn" : "neutral" }
        : { label: "Highway", value: "None within 500 m", tone: "good" },
    );
    if (railway && railway.meters <= 500) {
      items.push({
        label: "Railway",
        value: `${km(railway.meters)} away`,
        tone: railway.meters <= 250 ? "warn" : "neutral",
      });
    }
  }
  if (airport) {
    items.push({ label: "Airport", value: `${airport.name}, ${airport.km.toFixed(0)} km`, tone: "warn" });
  }
  if (s.airQuality) {
    items.push({
      label: "Air quality",
      value: s.airQuality.category,
      tone: s.airQuality.aqi >= 70 ? "good" : s.airQuality.aqi >= 50 ? "neutral" : "warn",
    });
  }
  return items.length > 0 ? { items: items.slice(0, 5) } : null;
}

function neighbourhood(d: DemographicsData | null) {
  const v = d?.area.values;
  if (!v) return null;
  const homes = HOME_TYPES.flatMap((id) => {
    const share = v[id];
    return typeof share === "number" && share > 0
      ? [{ label: censusLabel(id), share: Math.round(share) }]
      : [];
  })
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
  const owners = typeof v.owners === "number" ? Math.round(v.owners) : null;
  const renters = typeof v.renters === "number" ? Math.round(v.renters) : null;
  if (homes.length === 0 && owners == null && renters == null) return null;
  return { homes, owners, renters };
}

function upside(u: UpsideData | null) {
  if (!u) return null;
  const projects = [...u.projects]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .map((p) => {
      const meta = PROJECT_CATEGORIES[p.category as keyof typeof PROJECT_CATEGORIES];
      return {
        id: p.id,
        name: p.name,
        label: [meta?.label ?? p.category, p.status, p.targetCompletion]
          .filter(Boolean)
          .join(" · "),
        lat: p.lat,
        lng: p.lng,
        color: meta?.color ?? "#525252",
      };
    });
  const applications = [...(u.development?.applications ?? [])]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .map((a) => ({
      id: a.id,
      name: a.address,
      label: [
        "Development",
        a.units != null ? `${a.units} units` : null,
        a.storeys != null ? `${a.storeys} storeys` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      lat: a.lat,
      lng: a.lng,
      color: "#a16207",
    }));
  // Public projects first (the bigger story), then applications.
  const pins = [...projects.slice(0, 3), ...applications].slice(0, MAX_UPSIDE_PINS);
  return pins.length > 0 ? { pins } : null;
}
