// How easy a property's location and price point make it to sell or rent,
// 1 (hard) to 5 (easy). A transparent rule-based score from the report's
// data: errands, transit, commute, schools, safety, environment, upside and,
// once a list price is entered, how many buyers can afford that price. It
// deliberately ignores census facts about residents (Human Rights Code). It
// can't judge a price against recent sales (no sales data), or condition.
// Errands, transit, commute and schools follow the selected travel mode,
// judged against what's normal for it (thresholds shared with the Overview
// section scores).
import type {
  AmenitiesData,
  CommuteData,
  SafetyData,
  School,
  SchoolsData,
  UpsideData,
} from "./report-sections";
import { provinceOr, TYPICAL_PROPERTY_TAX } from "./finance/provinces";
import { incomeToQualify } from "./finance/affordability";
import { DEFAULTS } from "./finance/defaults";
import {
  ONTARIO_MEDIAN_TAX_RATE,
  propertyTaxRateFor,
} from "./finance/property-tax-rates";
import { THRESHOLDS } from "./section-scores";
import {
  destinationTime,
  TRAVEL_MODES,
  type TravelMode,
  type TravelTimes,
  travelTime,
} from "./travel";

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

/** Quickest place's minutes in a mode, or undefined if none. */
const quickest = (places: TravelTimes[], mode: TravelMode) => {
  const times = places.map((p) => travelTime(p, mode).minutes);
  return times.length ? Math.min(...times) : undefined;
};

function errands(
  amenities: AmenitiesData | null,
  mode: TravelMode,
): MarketFactor | null {
  if (!amenities) return null;
  const nearest = ERRANDS.map((e) => ({
    ...e,
    minutes: quickest(amenities.categories[e.id] ?? [], mode),
  }));
  // Missing within the search radius counts as far.
  const scores = nearest.map((n) =>
    n.minutes == null ? 0 : scale(n.minutes, ...THRESHOLDS[mode].essential),
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
        ? `Groceries ${grocery} min ${TRAVEL_MODES[mode].verb} · ${within15.length} of ${ERRANDS.length} essentials within 15 min`
        : "No grocery store within 1.5 km",
  };
}

const RAPID = new Set(["subway", "light_rail", "train"]);

function transit(
  commute: CommuteData | null,
  mode: TravelMode,
): MarketFactor | null {
  if (!commute) return null;
  const minutes = (s: TravelTimes) => travelTime(s, mode).minutes;
  const verb = TRAVEL_MODES[mode].verb;
  const byTime = [...commute.stations].sort((a, b) => minutes(a) - minutes(b));
  const rapid = byTime.find((s) => RAPID.has(s.kind));
  const bus = byTime.find((s) => s.kind === "bus" || s.kind === "go_bus");
  const rapidScore = rapid
    ? scale(minutes(rapid), ...THRESHOLDS[mode].rapid)
    : 0;
  const busScore = bus ? scale(minutes(bus), ...THRESHOLDS[mode].bus) * 0.6 : 0;
  return {
    id: "transit",
    label: "Transit",
    weight: 20,
    score: Math.max(rapidScore, busScore),
    detail: rapid
      ? `${rapid.name} ${minutes(rapid)} min ${verb}`
      : bus
        ? `Bus stop ${minutes(bus)} min ${verb}, no rapid transit nearby`
        : "No transit stops nearby",
  };
}

const BY_MODE = { walk: "on foot", bike: "by bike", drive: "by car" } as const;

function commuteFactor(
  commute: CommuteData | null,
  mode: TravelMode,
): MarketFactor | null {
  const d = commute?.destinations[0];
  if (!d) return null;
  // The faster of transit and the selected mode.
  const own = destinationTime(d, mode).minutes;
  const options = [d.transitMinutes, own].filter((m): m is number => m != null);
  if (options.length === 0) return null;
  const best = Math.min(...options);
  return {
    id: "commute",
    label: "Commute",
    weight: 15,
    score: scale(best, 25, 75),
    detail: `${d.label}: ${best} min ${best === d.transitMinutes ? "by transit" : BY_MODE[mode]}`,
  };
}

const average = (results: School["results"]) => {
  const v = Object.values(results).filter(
    (x): x is number => typeof x === "number",
  );
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

function schoolsFactor(
  schools: SchoolsData | null,
  mode: TravelMode,
): MarketFactor | null {
  if (!schools) return null;
  const elementary = schools.systems
    .flatMap((s) => s.elementary)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
  if (!elementary) return null;
  const eqao = average(elementary.results);
  const ontario = average(schools.provincialAverage as School["results"]);
  // Results vs Ontario (±15 points spans the scale), nudged by how easy
  // the school is to reach in the selected mode.
  const results =
    eqao != null && ontario != null ? clamp(0.5 + (eqao - ontario) / 30) : 0.5;
  const [best, worst] = THRESHOLDS[mode].school;
  const minutes = travelTime(elementary, mode).minutes;
  const walkable = minutes <= best + 5 ? 0.15 : minutes > worst ? -0.15 : 0;
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
  if (area?.csi != null && area.province.csi) {
    const ratio = area.csi / area.province.csi;
    return {
      id: "safety",
      label: "Safety",
      weight: 15,
      // Half the province's crime severity → 1; one and a half times → 0.
      score: clamp(1.5 - ratio),
      detail: `Crime severity ${Math.round(area.csi)} vs ${area.province.name} ${Math.round(area.province.csi)}${area.level === "province" ? ` (${area.province.name}-wide figure)` : ""}`,
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

/**
 * Price point: the household income needed to qualify at the list price
 * (20% down, stress test, local property tax). Full marks at $120K or less,
 * which many two-income households earn (Ontario's median household income
 * was about $91K in the 2021 census); none at $320K or more, which only a
 * small share of buyers earn. The higher the price, the smaller the pool.
 */
export const PRICE_INCOME_RANGE: [number, number] = [120_000, 320_000];

/** "$849K", "$1.25M". */
const shortMoney = (v: number) =>
  v >= 1_000_000
    ? `$${Number((v / 1_000_000).toFixed(2))}M`
    : `$${Math.round(v / 1_000)}K`;

function pricePoint(
  listPrice: number | null | undefined,
  city: string | null | undefined,
  province: string | null | undefined,
): MarketFactor | null {
  // Municipal rates are on file for Ontario only; elsewhere a typical
  // provincial rate (a same-named Ontario town must not match).
  const code = provinceOr(province);
  const taxRate =
    code === "ON"
      ? (propertyTaxRateFor(city)?.rate ?? ONTARIO_MEDIAN_TAX_RATE)
      : TYPICAL_PROPERTY_TAX[code];
  if (!listPrice || listPrice <= 0) return null;
  const income = incomeToQualify({
    price: listPrice,
    annualRate: DEFAULTS.rate,
    amortizationYears: DEFAULTS.amortization,
    propertyTaxRate: taxRate,
    heatingMonthly: DEFAULTS.heating,
  });
  return {
    id: "price",
    label: "Price point",
    weight: 15,
    score: scale(income, ...PRICE_INCOME_RANGE),
    detail: `${shortMoney(listPrice)} needs about ${shortMoney(Math.round(income / 5_000) * 5_000)} household income to qualify (20% down)`,
  };
}

const levelFor = (ease: number): MarketScore["level"] =>
  ease >= 0.78 ? 5 : ease >= 0.63 ? 4 : ease >= 0.48 ? 3 : ease >= 0.33 ? 2 : 1;

/**
 * The score, or null until enough of the report is in (at least three
 * factors, including errands or transit).
 */
export function marketScore(
  data: {
    amenities: AmenitiesData | null;
    commute: CommuteData | null;
    schools: SchoolsData | null;
    safety: SafetyData | null;
    upside: UpsideData | null;
    /** The agent's list price, when entered: adds the price point factor. */
    listPrice?: number | null;
    /** For the local property tax rate in the price point factor. */
    city?: string | null;
    /** Two-letter province code; Ontario when missing (older callers). */
    province?: string | null;
  },
  mode: TravelMode,
): MarketScore | null {
  const factors = [
    errands(data.amenities, mode),
    transit(data.commute, mode),
    commuteFactor(data.commute, mode),
    schoolsFactor(data.schools, mode),
    safetyFactor(data.safety),
    environment(data.safety),
    upsideFactor(data.upside),
    pricePoint(data.listPrice, data.city, data.province),
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
