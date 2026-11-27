// Runs inside the Trigger.dev "safety" task: crime rates, flood/erosion
// regulation, noise sources and air quality. Crime severity (StatCan, by
// police service) covers all of Canada; Toronto adds neighbourhood rates
// from Toronto Police. Highways and rail: in Ontario the Ontario Road and
// Railway Networks; elsewhere (and if those are down) Transport Canada's
// National Highway System and the North American Rail Network. Flood
// regulation from TRCA; air quality from Google.
import {
  CRIME_TYPES,
  type SafetyData,
  SECTION_KEYS,
} from "../../lib/report-sections";
import { atPoint, queryLayer } from "../arcgis";
import { areaCrimeAt } from "../crime-severity";
import { distanceMeters, distanceToPathsMeters, type LatLng } from "../geo";
import { reportStore } from "../report-store";

const SOURCES = {
  crime:
    "https://services.arcgis.com/S9th0jAJ7bqgIRjw/arcgis/rest/services/Neighbourhood_Crime_Rates_Open_Data/FeatureServer/0",
  conservationAuthorities:
    "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open03/MapServer/11",
  trcaRegulated:
    "https://services1.arcgis.com/d0ZCwU7eGKVeNiEE/arcgis/rest/services/TRCA_Regulation_2025/FeatureServer/37",
  /** Ontario Road Network segments (province-wide, with road class). */
  roads:
    "https://services1.arcgis.com/TJH5KDher0W13Kgo/arcgis/rest/services/Ontario_Road_Network_Composite_Service/FeatureServer/5",
  /** Ontario Railway Network track (province-wide). */
  rail: "https://ws.lioservices.lrc.gov.on.ca/arcgis2/rest/services/LIO_OPEN_DATA/LIO_Open04/MapServer/18",
  /**
   * Transport Canada's National Highway System (all of Canada, NRN road
   * classes). Intercity and major urban highways; some smaller provincial
   * highways and city expressways aren't part of it.
   */
  canadaHighways:
    "https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canada_national_highway_system_en/MapServer/0",
  /**
   * North American Rail Network (US DOT / BTS, with Canada): every Canadian
   * line, with NET "M" for main lines (yards, sidings, industrial leads and
   * abandoned track have their own codes).
   */
  canadaRail:
    "https://services.arcgis.com/xOi1kZaI0eWDREZv/ArcGIS/rest/services/NTAD_North_American_Rail_Network_Lines/FeatureServer/0",
} as const;

const ONTARIO_NOISE_SOURCE = "Ontario Road Network and Ontario Railway Network";
const CANADA_NOISE_SOURCE =
  "Transport Canada National Highway System and the North American Rail Network (US DOT)";

const TRCA = "Toronto and Region Conservation Authority";
/** Distance at which a highway or rail line is worth mentioning. */
const NOISE_RADIUS_M = 500;
const FLOOD_NEARBY_M = 100;

/** `radiusKm`: rough distance within which aircraft noise may be noticeable. */
const AIRPORTS = [
  { name: "Toronto Pearson", lat: 43.6777, lng: -79.6248, radiusKm: 15 },
  {
    name: "Billy Bishop Toronto City",
    lat: 43.6275,
    lng: -79.3962,
    radiusKm: 4,
  },
  { name: "Ottawa International", lat: 45.3225, lng: -75.6692, radiusKm: 10 },
  { name: "Hamilton International", lat: 43.1736, lng: -79.935, radiusKm: 8 },
  {
    name: "Region of Waterloo International",
    lat: 43.4605,
    lng: -80.3786,
    radiusKm: 6,
  },
  { name: "London International", lat: 43.0356, lng: -81.1539, radiusKm: 6 },
  { name: "Oshawa Executive", lat: 43.9228, lng: -78.895, radiusKm: 4 },
  // Across Canada (locations from Google Places, Nov 2026).
  { name: "Vancouver International", lat: 49.1934, lng: -123.1751, radiusKm: 12 },
  { name: "Calgary International", lat: 51.1217, lng: -114.0081, radiusKm: 12 },
  { name: "Edmonton International", lat: 53.3027, lng: -113.5769, radiusKm: 10 },
  { name: "Montréal–Trudeau International", lat: 45.4658, lng: -73.7454, radiusKm: 12 },
  { name: "Winnipeg Richardson International", lat: 49.9097, lng: -97.2364, radiusKm: 10 },
  { name: "Québec City Jean Lesage International", lat: 46.7909, lng: -71.3886, radiusKm: 8 },
  { name: "Halifax Stanfield International", lat: 44.8825, lng: -63.5152, radiusKm: 8 },
  { name: "Victoria International", lat: 48.6481, lng: -123.4288, radiusKm: 6 },
  { name: "Saskatoon International", lat: 52.1715, lng: -106.7004, radiusKm: 6 },
  { name: "Regina International", lat: 50.4321, lng: -104.6639, radiusKm: 6 },
  { name: "Kelowna International", lat: 49.9568, lng: -119.3787, radiusKm: 6 },
  { name: "Abbotsford International", lat: 49.0239, lng: -122.3642, radiusKm: 6 },
  { name: "St. John's International", lat: 47.62, lng: -52.7494, radiusKm: 6 },
  { name: "Greater Moncton International", lat: 46.1145, lng: -64.6729, radiusKm: 5 },
  { name: "Fredericton International", lat: 45.8728, lng: -66.5297, radiusKm: 4 },
  { name: "Saint John", lat: 45.3293, lng: -65.8906, radiusKm: 4 },
  { name: "Charlottetown", lat: 46.2904, lng: -63.1244, radiusKm: 4 },
  { name: "Whitehorse International", lat: 60.7141, lng: -135.0761, radiusKm: 4 },
  { name: "Yellowknife", lat: 62.4661, lng: -114.4392, radiusKm: 4 },
  { name: "Iqaluit International", lat: 63.757, lng: -68.545, radiusKm: 3 },
  { name: "Thunder Bay International", lat: 48.372, lng: -89.3121, radiusKm: 5 },
  { name: "Greater Sudbury", lat: 46.6256, lng: -80.7991, radiusKm: 4 },
] as const;

// ---------------------------------------------------------------------------
// Crime (Toronto Police Service, neighbourhood crime rates)
// ---------------------------------------------------------------------------

type Attrs = Record<string, string | number | null>;

async function crimeAt(point: LatLng): Promise<SafetyData["crime"]> {
  const [hood] = await queryLayer<Attrs>(SOURCES.crime, {
    ...atPoint(point),
    outFields: "*",
    returnGeometry: false,
  });
  if (!hood) return null;
  const a = hood.attributes;

  // Years present in the dataset, e.g. ASSAULT_2020 … ASSAULT_2025.
  const years = Object.keys(a)
    .map((k) => k.match(/^ASSAULT_(\d{4})$/)?.[1])
    .filter(Boolean)
    .map(Number)
    .sort();
  const year = years[years.length - 1];
  // Six-year trend: enough to show direction without stale history.
  const trendYears = years.slice(-6);
  const firstYear = trendYears[0];
  const num = (v: unknown) => (typeof v === "number" ? v : null);

  // Every neighbourhood's latest counts, for city rates and the ranking.
  const popField = `POPULATION_${year}`;
  const all = await queryLayer<Attrs>(SOURCES.crime, {
    where: "1=1",
    outFields: [popField, ...CRIME_TYPES.map((t) => `${t.id}_${year}`)].join(
      ",",
    ),
    returnGeometry: false,
  });
  const cityPop = all.reduce(
    (sum, f) => sum + (num(f.attributes[popField]) ?? 0),
    0,
  );
  const cityCount = (type: string) =>
    all.reduce(
      (sum, f) => sum + (num(f.attributes[`${type}_${year}`]) ?? 0),
      0,
    );
  const totalRate = (attrs: Attrs) => {
    const pop = num(attrs[popField]);
    if (!pop) return null;
    const total = CRIME_TYPES.reduce(
      (sum, t) => sum + (num(attrs[`${t.id}_${year}`]) ?? 0),
      0,
    );
    return (total / pop) * 100_000;
  };

  const ownRate = totalRate(a);
  const rates = all
    .map((f) => totalRate(f.attributes))
    .filter((r) => r != null);
  const population = num(a[popField]);

  return {
    source: "Toronto Police Service",
    neighbourhood: String(a.AREA_NAME ?? "This neighbourhood"),
    population,
    year,
    firstYear,
    types: CRIME_TYPES.map((t) => {
      const count = num(a[`${t.id}_${year}`]) ?? 0;
      const rate =
        num(a[`${t.id}_RATE_${year}`]) ??
        (population ? (count / population) * 100_000 : null);
      return {
        id: t.id,
        count,
        rate: rate == null ? null : Math.round(rate),
        cityRate: cityPop
          ? Math.round((cityCount(t.id) / cityPop) * 100_000)
          : null,
        trend: trendYears.map((y) => num(a[`${t.id}_${y}`])),
      };
    }),
    lowerRateThanShare:
      ownRate == null || rates.length === 0
        ? null
        : rates.filter((r) => r > ownRate).length / rates.length,
  };
}

// ---------------------------------------------------------------------------
// Flood & erosion hazards (conservation authority regulated areas)
// ---------------------------------------------------------------------------

/** Plain-language names for TRCA's regulation criteria layers. */
const CRITERIA_LABELS: [RegExp, string][] = [
  [/flood/i, "Flood hazard"],
  [/erosion/i, "Erosion hazard"],
  [/crest|slope|valley/i, "Valley slope"],
  [/meander/i, "Stream meander belt"],
  [/wetland/i, "Wetland"],
  [/shoreline|lake/i, "Shoreline hazard"],
  [/watercourse|stream/i, "Watercourse"],
];

/** "Total Criteria Layers: 2\nCrest of Slope\nFlood Hazard Engineered" → labels */
function parseCriteria(value: unknown) {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("Total Criteria"))
    .map((s) => CRITERIA_LABELS.find(([re]) => re.test(s))?.[1] ?? s);
}

async function floodAt(point: LatLng): Promise<SafetyData["flood"]> {
  const [ca] = await queryLayer<{ COMMON_NAME?: string; LEGAL_NAME?: string }>(
    SOURCES.conservationAuthorities,
    {
      ...atPoint(point),
      outFields: "COMMON_NAME,LEGAL_NAME",
      returnGeometry: false,
    },
  );
  const authority =
    ca?.attributes.COMMON_NAME ?? ca?.attributes.LEGAL_NAME ?? null;

  if (authority !== TRCA) {
    return {
      authority,
      status: "unknown",
      criteria: [],
      note: authority
        ? `Regulation mapping for ${authority} isn't connected yet. Check the authority's online mapping or ask them directly.`
        : "This property isn't within a conservation authority's area.",
    };
  }

  const query = (distance?: number) =>
    queryLayer<Attrs>(SOURCES.trcaRegulated, {
      ...atPoint(point, distance),
      outFields: "criteria_layers_contribution",
      returnGeometry: false,
    });

  const inside = await query();
  if (inside.length > 0) {
    return {
      authority,
      status: "inside",
      criteria: [
        ...new Set(
          inside.flatMap((f) =>
            parseCriteria(f.attributes.criteria_layers_contribution),
          ),
        ),
      ],
      note: "Inside TRCA's regulated area. Additions, pools, grading or new structures may need a TRCA permit; it doesn't mean the home floods. Confirm with TRCA.",
    };
  }
  const near = await query(FLOOD_NEARBY_M);
  if (near.length > 0) {
    return {
      authority,
      status: "nearby",
      criteria: [
        ...new Set(
          near.flatMap((f) =>
            parseCriteria(f.attributes.criteria_layers_contribution),
          ),
        ),
      ],
      note: `Within ${FLOOD_NEARBY_M} m of TRCA's regulated area (valley, stream or hazard land). Check whether any part of the lot is regulated.`,
    };
  }
  return {
    authority,
    status: "clear",
    criteria: [],
    note: "Outside TRCA's regulated area for flood and erosion hazards.",
  };
}

// ---------------------------------------------------------------------------
// Noise sources
// ---------------------------------------------------------------------------

async function nearestLine(layerUrl: string, point: LatLng, where = "1=1") {
  const features = await queryLayer(layerUrl, {
    ...atPoint(point, NOISE_RADIUS_M),
    where,
    outFields: "OBJECTID",
    returnGeometry: true,
  });
  // Polylines have paths; polygon layers (Toronto's road edges) have rings.
  const paths = features.flatMap(
    (f) => f.geometry?.paths ?? f.geometry?.rings ?? [],
  );
  if (paths.length === 0) return null;
  const meters = distanceToPathsMeters(point, paths);
  return Number.isFinite(meters)
    ? { meters: Math.round(meters / 10) * 10 }
    : null;
}

function nearestAirport(point: LatLng) {
  const nearest = AIRPORTS.map((a) => ({
    ...a,
    km: distanceMeters(point, a) / 1000,
  }))
    .filter((a) => a.km <= a.radiusKm)
    .sort((a, b) => a.km - b.km)[0];
  return nearest
    ? { name: nearest.name, km: Math.round(nearest.km * 10) / 10 }
    : null;
}

/** Ontario: 400-series and other provincial highways; operating main lines. */
async function ontarioLines(point: LatLng) {
  const [highway, railway] = await Promise.all([
    nearestLine(
      SOURCES.roads,
      point,
      "ROAD_CLASS IN ('Freeway','Expressway / Highway')",
    ),
    // Operating main lines; yards, sidings and spurs see little traffic.
    nearestLine(
      SOURCES.rail,
      point,
      "STATUS = 'Operational' AND TRACKCLASS = 'Main'",
    ),
  ]);
  return { highway, railway, source: ONTARIO_NOISE_SOURCE };
}

/** All of Canada: the same rules, on the national layers. */
async function canadaLines(point: LatLng) {
  const [highway, railway] = await Promise.all([
    nearestLine(
      SOURCES.canadaHighways,
      point,
      "roadclass IN ('Freeway','Expressway / Highway')",
    ),
    nearestLine(SOURCES.canadaRail, point, "NET = 'M'"),
  ]);
  return { highway, railway, source: CANADA_NOISE_SOURCE };
}

export async function noiseAt(
  point: LatLng,
  inOntario: boolean,
): Promise<SafetyData["noise"]> {
  const airport = nearestAirport(point);
  try {
    let lines;
    if (inOntario) {
      // The provincial networks are more detailed; the national ones are a
      // fallback when they're down.
      lines = await ontarioLines(point).catch((error) => {
        console.error("[safety] Ontario highway/rail lookup", error);
        return canadaLines(point);
      });
    } else {
      lines = await canadaLines(point);
    }
    return { ...lines, airport, roadsCovered: true };
  } catch (error) {
    console.error("[safety] highway/rail lookup", error);
    return { highway: null, railway: null, airport, roadsCovered: false };
  }
}

// ---------------------------------------------------------------------------
// Air quality (Google Air Quality API, current conditions)
// ---------------------------------------------------------------------------

type AirQualityResponse = {
  dateTime?: string;
  indexes?: {
    code: string;
    aqi: number;
    category: string;
    dominantPollutant?: string;
    color?: { red?: number; green?: number; blue?: number };
  }[];
};

const toHex = (c?: { red?: number; green?: number; blue?: number }) =>
  c
    ? `#${[c.red, c.green, c.blue]
        .map((v) =>
          Math.round((v ?? 0) * 255)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")}`
    : null;

async function airQualityAt(point: LatLng) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key)
    return { data: null, note: "Air quality needs a Google Maps API key." };

  const res = await fetch(
    `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: { latitude: point.lat, longitude: point.lng },
        universalAqi: true,
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (res.status === 403) {
    return {
      data: null,
      note: "Enable the Air Quality API for your Google key to show air quality.",
    };
  }
  if (!res.ok) throw new Error(`Air Quality API failed (HTTP ${res.status})`);
  const json = (await res.json()) as AirQualityResponse;
  const index =
    json.indexes?.find((i) => i.code === "uaqi") ?? json.indexes?.[0];
  if (!index)
    return { data: null, note: "No air quality reading for this location." };
  return {
    data: {
      aqi: index.aqi,
      category: index.category,
      dominantPollutant:
        index.dominantPollutant?.toUpperCase().replace("PM25", "PM2.5") ?? null,
      color: toHex(index.color),
      observedAt: json.dateTime ?? new Date().toISOString(),
    },
    note: null,
  };
}

// ---------------------------------------------------------------------------

/**
 * Outside Ontario: flood regulation (conservation authorities) and the road
 * and rail networks used for noise are Ontario datasets, so say so rather
 * than report "clear".
 */
const OUTSIDE_ONTARIO_FLOOD: SafetyData["flood"] = {
  authority: null,
  status: "unknown",
  criteria: [],
  note: "Flood and erosion regulation mapping is connected for Ontario only so far. Check the province's or municipality's flood hazard maps.",
};

export async function extractSafety(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  const { latitude: lat, longitude: lng } = report?.property ?? {};
  if (lat == null || lng == null) {
    throw new Error("The property's location isn't available yet.");
  }
  const point = { lat, lng };
  const province = report?.property?.province;
  const outsideOntario = province != null && province !== "ON";

  const [crime, areaCrime, flood, air, noise] = await Promise.all([
    crimeAt(point),
    // Area figures are a bonus next to Toronto's neighbourhood detail, and
    // the only crime data elsewhere: never fail the step over them.
    areaCrimeAt(point, report?.property?.province).catch((error) => {
      console.error("[safety] crime severity", error);
      return null;
    }),
    outsideOntario ? OUTSIDE_ONTARIO_FLOOD : floodAt(point),
    airQualityAt(point),
    noiseAt(point, !outsideOntario),
  ]);

  const data: SafetyData = {
    crime,
    crimeNote: crime
      ? null
      : areaCrime
        ? "Neighbourhood-level rates are published for Toronto only; this shows the local police service's crime severity."
        : "Crime data couldn't be loaded for this address. Try again shortly.",
    areaCrime,
    flood,
    noise,
    airQuality: air.data,
    airQualityNote: air.note,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.safety, data);
  return {
    crime: crime?.neighbourhood ?? null,
    flood: flood.status,
    airQuality: air.data != null,
  };
}
