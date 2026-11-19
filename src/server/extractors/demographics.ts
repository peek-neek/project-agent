// Runs inside the Trigger.dev "demographics" task.
// Statistics Canada 2021 Census: finds the census tract (or, outside cities,
// the dissemination area) and the city around the property, then reads both
// census profiles for comparison.
import {
  CENSUS_FIELDS,
  type CensusFieldId,
  type DemographicsData,
  SECTION_KEYS,
} from "../../lib/report-sections";
import { atPoint, queryLayer } from "../arcgis";
import { parseCsv } from "../csv";
import type { LatLng } from "../geo";
import { reportStore } from "../report-store";

const CENSUS_YEAR = 2021;
const BOUNDARIES =
  "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Digital_boundary_files/MapServer";
const LAYERS = { csd: 9, ct: 11, da: 12 } as const;
const PROFILE_API =
  "https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/data/STC_CP";

type Boundary = {
  DGUID: string;
  CTNAME?: string;
  DAUID?: string;
  CSDNAME?: string;
};

async function boundaryAt(layer: number, point: LatLng) {
  const [feature] = await queryLayer<Boundary>(`${BOUNDARIES}/${layer}`, {
    ...atPoint(point),
    outFields: "*",
    returnGeometry: false,
  });
  return feature?.attributes ?? null;
}

/**
 * Reads the census profile values we report for one geography.
 * `ref` is the SDMX area code: the DGUID, with "." replaced by "_" for tracts.
 */
async function censusProfile(
  dataflow: "DF_CT" | "DF_DA" | "DF_CSD",
  ref: string,
) {
  const characteristics = [
    ...new Set(CENSUS_FIELDS.map((f) => f.characteristic)),
  ];
  const url = `${PROFILE_API},${dataflow}/A5.${ref}.1.${characteristics.join("+")}.`;
  // The census API returns occasional 5xx; retry quickly before failing.
  let res: Response | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      // Node's default "Accept-Language: *" makes this API return HTTP 500.
      headers: {
        Accept: "application/vnd.sdmx.data+csv; labels=both",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status < 500) break;
    await new Promise((r) => setTimeout(r, attempt * 1500));
  }
  if (!res) throw new Error("Census profile request failed");
  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(`Census profile request failed (HTTP ${res.status})`);

  const [header, ...rows] = parseCsv(await res.text());
  const col = (prefix: string) => header.findIndex((h) => h.startsWith(prefix));
  const iChar = col("CHARACTERISTIC");
  const iStat = col("STATISTIC");
  const iValue = col("OBS_VALUE");
  if (iChar < 0 || iStat < 0 || iValue < 0) {
    throw new Error("Unexpected census profile format");
  }

  // "229: Median total income…" → 229
  const code = (v: string) => Number.parseInt(v, 10);
  const lookup = new Map<string, number>();
  for (const r of rows) {
    if (!r[iValue]) continue;
    const value = Number(r[iValue]);
    if (Number.isFinite(value)) {
      lookup.set(`${code(r[iChar])}:${code(r[iStat])}`, value);
    }
  }
  return Object.fromEntries(
    CENSUS_FIELDS.map((f) => [
      f.id,
      lookup.get(`${f.characteristic}:${f.statistic}`) ?? null,
    ]),
  ) as Record<CensusFieldId, number | null>;
}

export async function extractDemographics(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  const { latitude: lat, longitude: lng } = report?.property ?? {};
  if (lat == null || lng == null) {
    throw new Error("The property's location isn't available yet.");
  }
  const point = { lat, lng };

  const [ct, da, csd] = await Promise.all([
    boundaryAt(LAYERS.ct, point),
    boundaryAt(LAYERS.da, point),
    boundaryAt(LAYERS.csd, point),
  ]);
  if (!ct && !da) {
    throw new Error("No census data covers this location.");
  }

  // Census tracts (~2,500–8,000 people) are the closest thing to a
  // "neighbourhood"; dissemination areas cover places without tracts.
  let area: DemographicsData["area"] | null = null;
  if (ct) {
    const values = await censusProfile("DF_CT", ct.DGUID.replace(".", "_"));
    if (values?.population) {
      area = { label: `Census tract ${ct.CTNAME}`, level: "tract", values };
    }
  }
  if (!area && da) {
    const values = await censusProfile("DF_DA", da.DGUID);
    if (values?.population) {
      area = { label: `Dissemination area ${da.DAUID}`, level: "area", values };
    }
  }
  if (!area) throw new Error("Census figures aren't published for this area.");

  const cityValues = csd ? await censusProfile("DF_CSD", csd.DGUID) : null;
  const data: DemographicsData = {
    area,
    city:
      csd && cityValues
        ? { label: csd.CSDNAME ?? "City", values: cityValues }
        : null,
    censusYear: CENSUS_YEAR,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.demographics, data);
  return { area: area.label, city: data.city?.label ?? null };
}
