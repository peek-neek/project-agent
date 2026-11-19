// How easy a property's location makes it to sell or rent, 1 (hard) to 5
// (easy). A transparent rule-based score from the report's location data:
// errands, transit, commute, schools, safety, environment and upside. It
// deliberately ignores census facts about residents (Human Rights Code) and
// knows nothing about price, condition or the market, which matter as much.
// Uses walking times: location fundamentals, whatever mode is selected.
import type {
  AmenitiesData,
  CommuteData,
  SafetyData,
  School,
  SchoolsData,
  UpsideData,
} from "./report-sections";

export type MarketFactor = {
  id: string;
  label: string;
  /** 0 (hurts) … 1 (helps). */
  score: number;
  weight: number;
  /** One-line reason, e.g. "Groceries 4 min walk". */
  detail: string;
};

export type MarketScore = {
  /** 1 hard … 5 easy. */
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Weighted 0–1 "ease" behind the level. */
  ease: number;
  factors: MarketFactor[];
};

export const MARKET_LEVELS = {
  1: { label: "Hard", color: "#d10001" },
  2: { label: "Challenging", color: "#ea580c" },
  3: { label: "Moderate", color: "#ca8a04" },
  4: { label: "Easy", color: "#65a30d" },
  5: { label: "Very easy", color: "#16a34a" },
} as const;

/** 1 at `good` or better, 0 at `bad` or worse, linear between. */
const scale = (value: number, good: number, bad: number) =>
  Math.max(0, Math.min(1, (bad - value) / (bad - good)));
const clamp = (v: number) => Math.max(0, Math.min(1, v));

const ERRANDS = [
  { id: "groceries", label: "Groceries" },
  { id: "pharmacies", label: "Pharmacy" },
  { id: "cafes", label: "Café" },
  { id: "restaurants", label: "Restaurants" },
  { id: "parks", label: "Park" },
] as const;

function errands(amenities: AmenitiesData | null): MarketFactor | null {
  if (!amenities) return null;
  const nearest = ERRANDS.map((e) => ({
    ...e,
    minutes: [...(amenities.categories[e.id] ?? [])].sort(
      (a, b) => a.walkMinutes - b.walkMinutes,
    )[0]?.walkMinutes,
  }));
  // Missing within the search radius counts as far.
  const scores = nearest.map((n) =>
    n.minutes == null ? 0 : scale(n.minutes, 5, 25),
  );
  const grocery = nearest[0].minutes;
  const within15 = nearest.filter((n) => n.minutes != null && n.minutes <= 15);
  return {
    id: "errands",
    label: "Daily errands",
    weight: 20,
    // Groceries count double: the errand buyers and renters ask about first.
    score: (scores[0] * 2 + scores.slice(1).reduce((a, b) => a + b, 0)) / 6,
    detail:
      grocery != null
        ? `Groceries ${grocery} min walk · ${within15.length} of ${ERRANDS.length} essentials within 15 min`
        : "No grocery store within 1.5 km",
  };
}

const RAPID = new Set(["subway", "light_rail", "train"]);

function transit(commute: CommuteData | null): MarketFactor | null {
  if (!commute) return null;
  const byTime = [...commute.stations].sort(
    (a, b) => a.walkMinutes - b.walkMinutes,
  );
  const rapid = byTime.find((s) => RAPID.has(s.kind));
  const bus = byTime.find((s) => s.kind === "bus" || s.kind === "go_bus");
  const rapidScore = rapid ? scale(rapid.walkMinutes, 8, 40) : 0;
  const busScore = bus ? scale(bus.walkMinutes, 4, 15) * 0.6 : 0;
  return {
    id: "transit",
    label: "Transit",
    weight: 20,
    score: Math.max(rapidScore, busScore),
    detail: rapid
      ? `${rapid.name} ${rapid.walkMinutes} min walk`
      : bus
        ? `Bus stop ${bus.walkMinutes} min walk, no rapid transit nearby`
        : "No transit stops nearby",
  };
}

function commuteFactor(commute: CommuteData | null): MarketFactor | null {
  const d = commute?.destinations[0];
  if (!d) return null;
  const options = [d.transitMinutes, d.driveMinutes].filter(
    (m): m is number => m != null,
  );
  if (options.length === 0) return null;
  const best = Math.min(...options);
  return {
    id: "commute",
    label: "Commute",
    weight: 15,
    score: scale(best, 25, 75),
    detail: `${d.label}: ${best} min by ${best === d.transitMinutes ? "transit" : "car"}`,
  };
}

const average = (results: School["results"]) => {
  const v = Object.values(results).filter(
    (x): x is number => typeof x === "number",
  );
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function schoolsFactor(schools: SchoolsData | null): MarketFactor | null {
  if (!schools) return null;
  const elementary = schools.systems
    .flatMap((s) => s.elementary)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  if (!elementary) return null;
  const eqao = average(elementary.results);
  const ontario = average(schools.provincialAverage as School["results"]);
  // Results vs Ontario (±15 points spans the scale), nudged by walkability.
  const results =
    eqao != null && ontario != null ? clamp(0.5 + (eqao - ontario) / 30) : 0.5;
  const walkable =
    elementary.distanceMeters <= 1200
      ? 0.15
      : elementary.distanceMeters > 3000
        ? -0.15
        : 0;
  return {
    id: "schools",
    label: "Schools",
    weight: 15,
    score: clamp(results + walkable),
    detail: `${elementary.name}${eqao != null && ontario != null ? `: EQAO ${Math.round(eqao)}% vs Ontario ${Math.round(ontario)}%` : ""}`,
  };
}

function safetyFactor(safety: SafetyData | null): MarketFactor | null {
  if (!safety) return null;
  if (safety.crime?.lowerRateThanShare != null) {
    const share = safety.crime.lowerRateThanShare;
    return {
      id: "safety",
      label: "Safety",
      weight: 15,
      score: share,
      detail: `Lower crime than ${Math.round(share * 100)}% of Toronto areas`,
    };
  }
  const area = safety.areaCrime;
  if (area?.csi != null && area.ontario.csi) {
    const ratio = area.csi / area.ontario.csi;
    return {
      id: "safety",
      label: "Safety",
      weight: 15,
      // Half Ontario's crime severity → 1; one and a half times → 0.
      score: clamp(1.5 - ratio),
      detail: `Crime severity ${Math.round(area.csi)} vs Ontario ${Math.round(area.ontario.csi)}${area.level === "province" ? " (Ontario-wide figure)" : ""}`,
    };
  }
  return null;
}

function environment(safety: SafetyData | null): MarketFactor | null {
  if (!safety) return null;
  const notes: string[] = [];
  let score = 1;
  if (safety.flood.status === "inside") {
    score -= 0.45;
    notes.push("inside a flood/erosion regulated area");
  } else if (safety.flood.status === "nearby") {
    score -= 0.15;
    notes.push("near a regulated area");
  }
  const { highway, railway, airport } = safety.noise;
  if (highway && highway.meters <= 250) {
    score -= highway.meters <= 100 ? 0.3 : 0.15;
    notes.push(`highway ${highway.meters} m`);
  }
  if (railway && railway.meters <= 250) {
    score -= railway.meters <= 100 ? 0.25 : 0.1;
    notes.push(`rail line ${railway.meters} m`);
  }
  if (airport) {
    score -= 0.15;
    notes.push(`${airport.name} airport ${airport.km} km`);
  }
  // Universal AQI: higher is cleaner.
  if (safety.airQuality && safety.airQuality.aqi < 50) {
    score -= 0.1;
    notes.push(`air quality ${safety.airQuality.category.toLowerCase()}`);
  }
  return {
    id: "environment",
    label: "Flood & noise",
    weight: 10,
    score: clamp(score),
    detail: notes.length
      ? notes.join(" · ").replace(/^./, (c) => c.toUpperCase())
      : "No flood regulation, highway, rail or airport noise flagged",
  };
}

function upsideFactor(upside: UpsideData | null): MarketFactor | null {
  if (!upside) return null;
  const transitBuilds = upside.projects.filter(
    (p) => p.category === "Transit" && p.status === "Under construction",
  );
  // A bonus only: no projects nearby is neutral, not a drawback.
  const score = clamp(
    0.5 + transitBuilds.length * 0.3 + upside.projects.length * 0.05,
  );
  return {
    id: "upside",
    label: "Future upside",
    weight: 5,
    score,
    detail: transitBuilds.length
      ? `${transitBuilds[0].name} under construction nearby`
      : upside.projects.length
        ? `${upside.projects.length} public projects planned or underway nearby`
        : "No public projects nearby",
  };
}

const levelFor = (ease: number): MarketScore["level"] =>
  ease >= 0.78 ? 5 : ease >= 0.63 ? 4 : ease >= 0.48 ? 3 : ease >= 0.33 ? 2 : 1;

/**
 * The score, or null until enough of the report is in (at least three
 * factors, including errands or transit).
 */
export function marketScore(data: {
  amenities: AmenitiesData | null;
  commute: CommuteData | null;
  schools: SchoolsData | null;
  safety: SafetyData | null;
  upside: UpsideData | null;
}): MarketScore | null {
  const factors = [
    errands(data.amenities),
    transit(data.commute),
    commuteFactor(data.commute),
    schoolsFactor(data.schools),
    safetyFactor(data.safety),
    environment(data.safety),
    upsideFactor(data.upside),
  ].filter((f): f is MarketFactor => f != null);
  if (
    factors.length < 3 ||
    !factors.some((f) => f.id === "errands" || f.id === "transit")
  ) {
    return null;
  }
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const ease =
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight;
  const level = levelFor(ease);
  return { level, label: MARKET_LEVELS[level].label, ease, factors };
}
