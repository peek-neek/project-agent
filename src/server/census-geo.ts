// Which municipality and province a point is in, anywhere in Canada, from
// Statistics Canada's 2021 census boundaries (census subdivision = the
// municipality; census division = its county or region).
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import { atPoint, queryLayer } from "./arcgis";
import type { LatLng } from "./geo";

const BOUNDARIES =
  "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Digital_boundary_files/MapServer";
const LAYERS = { cd: 4, csd: 9 } as const;

/** StatCan province codes (PRUID) → postal abbreviations. */
export const PROVINCES = {
  "10": { code: "NL", name: "Newfoundland and Labrador" },
  "11": { code: "PE", name: "Prince Edward Island" },
  "12": { code: "NS", name: "Nova Scotia" },
  "13": { code: "NB", name: "New Brunswick" },
  "24": { code: "QC", name: "Quebec" },
  "35": { code: "ON", name: "Ontario" },
  "46": { code: "MB", name: "Manitoba" },
  "47": { code: "SK", name: "Saskatchewan" },
  "48": { code: "AB", name: "Alberta" },
  "59": { code: "BC", name: "British Columbia" },
  "60": { code: "YT", name: "Yukon" },
  "61": { code: "NT", name: "Northwest Territories" },
  "62": { code: "NU", name: "Nunavut" },
} as const;

export type ProvinceCode = (typeof PROVINCES)[keyof typeof PROVINCES]["code"];

export function provinceName(code: string | null | undefined): string | null {
  return Object.values(PROVINCES).find((p) => p.code === code)?.name ?? null;
}

export type Municipality = {
  /** "Vancouver", "Montréal", "Greater Sudbury" (English half of bilingual names). */
  name: string;
  /** County, region or district (census division), e.g. "York", "Wellington". */
  upperTier: string | null;
  province: ProvinceCode | null;
  /** StatCan census subdivision code, e.g. "5915022". */
  csdUid: string;
};

/** "Greater Sudbury / Grand Sudbury" → "Greater Sudbury". */
const firstName = (name: string) => name.split(" / ")[0].trim();

export async function municipalityAt(point: LatLng): Promise<Municipality | null> {
  const query = { ...atPoint(point), outFields: "*", returnGeometry: false } as const;
  const [[csd], [cd]] = await Promise.all([
    queryLayer<{ CSDNAME?: string; CSDUID?: string; PRUID?: string }>(
      `${BOUNDARIES}/${LAYERS.csd}`,
      query,
    ),
    queryLayer<{ CDNAME?: string }>(`${BOUNDARIES}/${LAYERS.cd}`, query).catch(() => []),
  ]);
  const a = csd?.attributes;
  if (!a?.CSDNAME || !a.CSDUID) return null;
  const province = a.PRUID ? PROVINCES[a.PRUID as keyof typeof PROVINCES] : undefined;
  return {
    name: firstName(a.CSDNAME),
    upperTier: cd?.attributes.CDNAME ? firstName(cd.attributes.CDNAME) : null,
    province: province?.code ?? null,
    csdUid: a.CSDUID,
  };
}
