// Crime Severity Index for any Canadian address: the property's municipality
// (StatCan census subdivision) matched to the police service that serves it,
// within its province, from the bundled StatCan data (npm run data:crime to
// refresh). Falls back to the province-wide figure when StatCan doesn't
// publish the municipality's service separately.
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import type { SafetyData } from "../lib/report-sections";
import { type Municipality, municipalityAt, type ProvinceCode, provinceName } from "./census-geo";
import data from "./datasets/canada-crime-severity.json";
import type { LatLng } from "./geo";

type Series = {
  csi: (number | null)[];
  violent: (number | null)[];
  nonViolent: (number | null)[];
};

type Policing = NonNullable<NonNullable<SafetyData["areaCrime"]>["policing"]>;

/** "CITY OF MARKHAM" / "St. Thomas" / "Montréal" → "markham" / "st thomas" / "montreal". */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /^(city|town|township|municipality|village|county|regional municipality|united counties|district municipality) of /,
      "",
    )
    .replace(/\bsaint\b/g, "st")
    .replace(/\bsainte\b/g, "ste")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Service = {
  geo: string;
  province: ProvinceCode;
  /** "Dufferin (Orangeville)" */
  label: string;
  /** "dufferin" */
  base: string;
  /** Municipalities named in brackets: ["orangeville"]. */
  covers: string[];
  policing: Policing;
  rural: boolean;
  series: Series;
};

const SERVICES: Service[] = data.services.map((s) => {
  const province = s.province as ProvinceCode;
  // "Dufferin (Orangeville), Ontario, Ontario Provincial Police, municipal"
  // Split on the first ", <Province>" only: OPP names repeat "Ontario".
  const marker = `, ${provinceName(province)}`;
  const cut = s.geo.indexOf(marker);
  const label = cut === -1 ? s.geo : s.geo.slice(0, cut);
  const rest = cut === -1 ? "" : s.geo.slice(cut + marker.length);
  const inner = label.match(/\(([^)]*)\)/)?.[1] ?? "";
  return {
    geo: s.geo,
    province,
    label,
    base: norm(label.replace(/\([^)]*\)/, "")),
    covers: inner ? inner.split(/\/| and /).map(norm) : [],
    policing: /Ontario Provincial Police/.test(rest)
      ? "opp"
      : /Quebec Provincial Police/.test(rest)
        ? "sq"
        : /Royal Canadian Mounted Police/.test(rest)
          ? "rcmp"
          : "municipal",
    rural: /rural$/.test(rest),
    series: { csi: s.csi, violent: s.violent, nonViolent: s.nonViolent },
  };
});

/** Municipalities policed under contract by a neighbour's service. */
const ALIASES: Record<string, string> = {
  amherstburg: "windsor", // Windsor Police Service since 2019
  // Codiac Regional RCMP (NB)
  moncton: "codiac regional",
  dieppe: "codiac regional",
  riverview: "codiac regional",
  // Kennebecasis Regional Police Force (NB)
  rothesay: "kennebecasis region",
  quispamsis: "kennebecasis region",
};

/**
 * The police service for a municipality, best match first, within its
 * province: its own service, a service naming it in brackets, a provincial
 * police or RCMP detachment named for it, then its region's or county's
 * service (e.g. York Region; a Sûreté du Québec MRC like "Acton Region").
 */
export function matchService(m: Municipality): Service | null {
  if (!m.province) return null;
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
      points = 80; // regional police (or an SQ MRC) cover the whole region
    } else if (upper && s.covers.length === 0 && s.base.startsWith(upper)) {
      points = 60; // a county-wide detachment, e.g. "Wellington County"
    }
    return points && points - (s.rural ? 3 : 0);
  };
  let best: Service | null = null;
  let bestScore = 0;
  for (const s of SERVICES) {
    if (s.province !== m.province) continue;
    const points = score(s);
    if (points > bestScore) [best, bestScore] = [s, points];
  }
  return best;
}

const latest = (values: (number | null)[]) => values[values.length - 1] ?? null;

/**
 * Area-level crime severity for a point anywhere in Canada. `fallbackProvince`
 * (from the address) is used when the census lookup can't place the point.
 */
export async function areaCrimeAt(
  point: LatLng,
  fallbackProvince?: string | null,
): Promise<NonNullable<SafetyData["areaCrime"]>> {
  const municipality = await municipalityAt(point);
  const service = municipality ? matchService(municipality) : null;
  const code = (municipality?.province ?? fallbackProvince ?? null) as ProvinceCode | null;
  const provinceSeries: Series | null =
    code && code in data.provinces ? data.provinces[code as keyof typeof data.provinces] : null;
  const series: Series = service?.series ?? provinceSeries ?? data.canada;
  const name = provinceName(code) ?? "Canada";
  const years = data.years;
  const comparison = provinceSeries ?? data.canada;
  return {
    source: data.source,
    level: service ? "service" : "province",
    service: service?.label ?? name,
    policing: service?.policing ?? null,
    municipality: municipality?.name ?? null,
    year: years[years.length - 1],
    firstYear: years[0],
    csi: latest(series.csi),
    violentCsi: latest(series.violent),
    nonViolentCsi: latest(series.nonViolent),
    trend: series.csi,
    province: {
      code,
      name,
      csi: latest(comparison.csi),
      violentCsi: latest(comparison.violent),
      nonViolentCsi: latest(comparison.nonViolent),
    },
    canadaCsi: latest(data.canada.csi),
  };
}
