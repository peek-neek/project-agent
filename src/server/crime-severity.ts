// Crime Severity Index for any Ontario address: the property's municipality
// (Ontario municipal boundaries) matched to the police service that serves
// it, from the bundled StatCan data (npm run data:crime to refresh).
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import type { SafetyData } from "../lib/report-sections";
import { atPoint, queryLayer } from "./arcgis";
import data from "./datasets/ontario-crime-severity.json";
import type { LatLng } from "./geo";

const MUNICIPALITIES =
  "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open03/MapServer/14";

type Series = {
  csi: (number | null)[];
  violent: (number | null)[];
  nonViolent: (number | null)[];
};

export type Municipality = { name: string; upperTier: string | null };

/** "CITY OF MARKHAM" / "St. Thomas" → "markham" / "st thomas". */
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(
      /^(city|town|township|municipality|village|county|regional municipality|united counties|district municipality) of /,
      "",
    )
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Service = {
  geo: string;
  /** "Dufferin (Orangeville)" */
  label: string;
  /** "dufferin" */
  base: string;
  /** Municipalities named in brackets: ["orangeville"]. */
  covers: string[];
  policing: "municipal" | "opp";
  rural: boolean;
  series: Series;
};

const SERVICES: Service[] = Object.entries(
  data.services as Record<string, Series>,
).map(([geo, series]) => {
  // "Dufferin (Orangeville), Ontario, Ontario Provincial Police, municipal"
  // Split on the first ", Ontario" only: OPP names repeat it.
  const cut = geo.indexOf(", Ontario");
  const label = cut === -1 ? geo : geo.slice(0, cut);
  const rest = cut === -1 ? "" : geo.slice(cut + ", Ontario".length);
  const inner = label.match(/\(([^)]*)\)/)?.[1] ?? "";
  return {
    geo,
    label,
    base: norm(label.replace(/\([^)]*\)/, "")),
    covers: inner ? inner.split(/\/| and /).map(norm) : [],
    policing: /Provincial Police/.test(rest) ? "opp" : "municipal",
    rural: /rural$/.test(rest),
    series,
  };
});

/** Municipalities policed under contract by a neighbour's service. */
const ALIASES: Record<string, string> = {
  amherstburg: "windsor", // Windsor Police Service since 2019
};

/**
 * The police service for a municipality, best match first:
 * its own service, a service naming it in brackets, an OPP detachment named
 * for it, then its region's or county's service (e.g. York Region).
 */
export function matchService(m: Municipality): Service | null {
  const short = norm(m.name);
  const name = ALIASES[short] ?? short;
  const upper = m.upperTier ? norm(m.upperTier) : null;
  const score = (s: Service) => {
    let points = 0;
    if (s.base === name && s.covers.length === 0) {
      points = s.policing === "municipal" ? 100 : 95;
    } else if (s.covers.includes(name)) {
      points = 90;
    } else if (s.base === name) {
      points = 85; // e.g. "Bracebridge (Muskoka Lakes…)": same detachment area
    } else if (upper && s.base === `${upper} region`) {
      points = 80; // regional police cover the whole region
    } else if (upper && s.covers.length === 0 && s.base.startsWith(upper)) {
      points = 60; // a county-wide detachment, e.g. "Wellington County"
    }
    return points && points - (s.rural ? 3 : 0);
  };
  let best: Service | null = null;
  let bestScore = 0;
  for (const s of SERVICES) {
    const points = score(s);
    if (points > bestScore) [best, bestScore] = [s, points];
  }
  return best;
}

export async function municipalityAt(
  point: LatLng,
): Promise<Municipality | null> {
  const [f] = await queryLayer<{
    MUNICIPAL_NAME_SHORTFORM?: string;
    UPPER_TIER_MUNICIPALITY?: string | null;
  }>(MUNICIPALITIES, {
    ...atPoint(point),
    outFields: "MUNICIPAL_NAME_SHORTFORM,UPPER_TIER_MUNICIPALITY",
    returnGeometry: false,
  });
  const name = f?.attributes.MUNICIPAL_NAME_SHORTFORM;
  return name
    ? { name, upperTier: f.attributes.UPPER_TIER_MUNICIPALITY ?? null }
    : null;
}

/** "MARKHAM" → "Markham", "WHITCHURCH-STOUFFVILLE" → "Whitchurch-Stouffville". */
const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-/.(])([a-z])/g, (_, p, c) => p + c.toUpperCase());

const latest = (values: (number | null)[]) => values[values.length - 1] ?? null;

/** Area-level crime severity for a point anywhere in Ontario. */
export async function areaCrimeAt(
  point: LatLng,
): Promise<NonNullable<SafetyData["areaCrime"]>> {
  const municipality = await municipalityAt(point);
  const service = municipality ? matchService(municipality) : null;
  const series: Series = service?.series ?? data.ontario;
  const years = data.years;
  return {
    source: data.source,
    level: service ? "service" : "province",
    service: service?.label ?? "Ontario",
    policing: service?.policing ?? null,
    municipality: municipality ? titleCase(municipality.name) : null,
    year: years[years.length - 1],
    firstYear: years[0],
    csi: latest(series.csi),
    violentCsi: latest(series.violent),
    nonViolentCsi: latest(series.nonViolent),
    trend: series.csi,
    ontario: {
      csi: latest(data.ontario.csi),
      violentCsi: latest(data.ontario.violent),
      nonViolentCsi: latest(data.ontario.nonViolent),
    },
    canadaCsi: latest(data.canada.csi),
  };
}
