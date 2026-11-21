// Runs inside the Trigger.dev "commute" task.
import {
  type CommuteData,
  type DestinationKind,
  SECTION_KEYS,
  type TransitKind,
} from "../../lib/report-sections";
import { distanceMeters, type LatLng, nextWeekdayMorning } from "../geo";
import {
  type NearbyResult,
  searchNearby,
  searchTextNearby,
} from "../google-places";
import {
  routeDuration,
  routeMatrix,
  RoutesUnavailableError,
} from "../google-routes";
import { reportStore } from "../report-store";
import { withTravelTimes } from "./amenities";

type Hub = LatLng & { id: string; label: string; kind: DestinationKind };

const DOWNTOWNS: Hub[] = (
  [
    {
      id: "toronto",
      label: "Downtown Toronto (Union Station)",
      lat: 43.6453,
      lng: -79.3806,
    },
    {
      id: "ottawa",
      label: "Downtown Ottawa (Parliament Hill)",
      lat: 45.4236,
      lng: -75.7009,
    },
    { id: "hamilton", label: "Downtown Hamilton", lat: 43.2557, lng: -79.8711 },
    {
      id: "mississauga",
      label: "Mississauga City Centre",
      lat: 43.5933,
      lng: -79.6427,
    },
    {
      id: "kitchener",
      label: "Downtown Kitchener",
      lat: 43.4517,
      lng: -80.4925,
    },
    { id: "london", label: "Downtown London", lat: 42.9849, lng: -81.2453 },
    { id: "kingston", label: "Downtown Kingston", lat: 44.2312, lng: -76.486 },
    { id: "barrie", label: "Downtown Barrie", lat: 44.3894, lng: -79.6903 },
    { id: "windsor", label: "Downtown Windsor", lat: 42.3149, lng: -83.0364 },
    // Across Canada (locations from Google Places, Nov 2026).
    { id: "vancouver", label: "Downtown Vancouver (Waterfront Station)", lat: 49.286, lng: -123.1116 },
    { id: "victoria", label: "Downtown Victoria (Inner Harbour)", lat: 48.4196, lng: -123.3703 },
    { id: "kelowna", label: "Downtown Kelowna", lat: 49.888, lng: -119.4961 },
    { id: "kamloops", label: "Downtown Kamloops", lat: 50.676, lng: -120.3392 },
    { id: "prince-george", label: "Downtown Prince George", lat: 53.9128, lng: -122.7454 },
    { id: "nanaimo", label: "Downtown Nanaimo", lat: 49.1638, lng: -123.938 },
    { id: "calgary", label: "Downtown Calgary", lat: 51.0443, lng: -114.0631 },
    { id: "edmonton", label: "Downtown Edmonton", lat: 53.546, lng: -113.4902 },
    { id: "red-deer", label: "Downtown Red Deer", lat: 52.2686, lng: -113.8095 },
    { id: "lethbridge", label: "Downtown Lethbridge", lat: 49.694, lng: -112.8331 },
    { id: "saskatoon", label: "Downtown Saskatoon", lat: 52.1307, lng: -106.6603 },
    { id: "regina", label: "Downtown Regina", lat: 50.4482, lng: -104.6159 },
    { id: "winnipeg", label: "Downtown Winnipeg (Portage & Main)", lat: 49.895, lng: -97.1366 },
    { id: "brandon", label: "Downtown Brandon", lat: 49.8433, lng: -99.9504 },
    { id: "montreal", label: "Downtown Montréal", lat: 45.5014, lng: -73.57 },
    { id: "quebec", label: "Downtown Québec City", lat: 46.8138, lng: -71.208 },
    { id: "gatineau", label: "Downtown Gatineau", lat: 45.4281, lng: -75.7107 },
    { id: "sherbrooke", label: "Downtown Sherbrooke", lat: 45.4042, lng: -71.8931 },
    { id: "trois-rivieres", label: "Downtown Trois-Rivières", lat: 46.3436, lng: -72.543 },
    { id: "saguenay", label: "Downtown Chicoutimi (Saguenay)", lat: 48.4282, lng: -71.0622 },
    { id: "moncton", label: "Downtown Moncton", lat: 46.0896, lng: -64.7754 },
    { id: "saint-john", label: "Uptown Saint John", lat: 45.2735, lng: -66.063 },
    { id: "fredericton", label: "Downtown Fredericton", lat: 45.9635, lng: -66.6431 },
    { id: "halifax", label: "Downtown Halifax", lat: 44.649, lng: -63.5754 },
    { id: "sydney-ns", label: "Downtown Sydney (Cape Breton)", lat: 46.137, lng: -60.1958 },
    { id: "charlottetown", label: "Downtown Charlottetown", lat: 46.2353, lng: -63.1296 },
    { id: "st-johns", label: "Downtown St. John's", lat: 47.5615, lng: -52.7126 },
    { id: "whitehorse", label: "Downtown Whitehorse", lat: 60.7208, lng: -135.0526 },
    { id: "yellowknife", label: "Downtown Yellowknife", lat: 62.4546, lng: -114.3765 },
    { id: "iqaluit", label: "Iqaluit", lat: 63.7498, lng: -68.5289 },
    { id: "sudbury", label: "Downtown Sudbury", lat: 46.4898, lng: -80.9899 },
    { id: "thunder-bay", label: "Downtown Thunder Bay", lat: 48.382, lng: -89.246 },
    { id: "sault", label: "Downtown Sault Ste. Marie", lat: 46.5066, lng: -84.3341 },
    { id: "north-bay", label: "Downtown North Bay", lat: 46.3092, lng: -79.4605 },
    { id: "oshawa", label: "Downtown Oshawa", lat: 43.8958, lng: -78.8659 },
    { id: "st-catharines", label: "Downtown St. Catharines", lat: 43.1593, lng: -79.247 },
    { id: "guelph", label: "Downtown Guelph", lat: 43.5433, lng: -80.2484 },
    { id: "peterborough", label: "Downtown Peterborough", lat: 44.309, lng: -78.3199 },
  ] satisfies Omit<Hub, "kind">[]
).map((hub) => ({ ...hub, kind: "downtown" as const }));

/** Airports with scheduled passenger service, nearest picked per report. */
const AIRPORTS: Hub[] = (
  [
    {
      id: "yyz",
      label: "Toronto Pearson Airport",
      lat: 43.6777,
      lng: -79.6248,
    },
    {
      id: "ytz",
      label: "Billy Bishop Toronto City Airport",
      lat: 43.6275,
      lng: -79.3962,
    },
    { id: "yhm", label: "Hamilton Airport", lat: 43.1736, lng: -79.935 },
    { id: "ykf", label: "Waterloo Airport", lat: 43.4608, lng: -80.3786 },
    { id: "yow", label: "Ottawa Airport", lat: 45.3225, lng: -75.6692 },
    { id: "yxu", label: "London Airport", lat: 43.0356, lng: -81.1539 },
    { id: "ygk", label: "Kingston Airport", lat: 44.2253, lng: -76.5969 },
    { id: "yqg", label: "Windsor Airport", lat: 42.2756, lng: -82.9556 },
    // Across Canada (locations from Google Places, Nov 2026).
    { id: "yvr", label: "Vancouver Airport", lat: 49.1934, lng: -123.1751 },
    { id: "yyj", label: "Victoria Airport", lat: 48.6481, lng: -123.4288 },
    { id: "yxx", label: "Abbotsford Airport", lat: 49.0239, lng: -122.3642 },
    { id: "ylw", label: "Kelowna Airport", lat: 49.9568, lng: -119.3787 },
    { id: "yka", label: "Kamloops Airport", lat: 50.7052, lng: -120.4418 },
    { id: "yxs", label: "Prince George Airport", lat: 53.884, lng: -122.6743 },
    { id: "ycd", label: "Nanaimo Airport", lat: 49.0531, lng: -123.8726 },
    { id: "yyc", label: "Calgary Airport", lat: 51.1217, lng: -114.0081 },
    { id: "yeg", label: "Edmonton Airport", lat: 53.3027, lng: -113.5769 },
    { id: "yql", label: "Lethbridge Airport", lat: 49.6293, lng: -112.7965 },
    { id: "yxe", label: "Saskatoon Airport", lat: 52.1715, lng: -106.7004 },
    { id: "yqr", label: "Regina Airport", lat: 50.4321, lng: -104.6639 },
    { id: "ywg", label: "Winnipeg Airport", lat: 49.9097, lng: -97.2364 },
    { id: "yul", label: "Montréal–Trudeau Airport", lat: 45.4658, lng: -73.7454 },
    { id: "yqb", label: "Québec City Airport", lat: 46.7909, lng: -71.3886 },
    { id: "ybg", label: "Saguenay–Bagotville Airport", lat: 48.336, lng: -70.9889 },
    { id: "yqm", label: "Moncton Airport", lat: 46.1145, lng: -64.6729 },
    { id: "ysj", label: "Saint John Airport", lat: 45.3293, lng: -65.8906 },
    { id: "yfc", label: "Fredericton Airport", lat: 45.8728, lng: -66.5297 },
    { id: "yhz", label: "Halifax Airport", lat: 44.8825, lng: -63.5152 },
    { id: "yqy", label: "Sydney Airport (Cape Breton)", lat: 46.1673, lng: -60.0472 },
    { id: "yyg", label: "Charlottetown Airport", lat: 46.2904, lng: -63.1244 },
    { id: "yyt", label: "St. John's Airport", lat: 47.62, lng: -52.7494 },
    { id: "yqx", label: "Gander Airport", lat: 48.9466, lng: -54.5757 },
    { id: "ydf", label: "Deer Lake Airport", lat: 49.2101, lng: -57.3992 },
    { id: "yxy", label: "Whitehorse Airport", lat: 60.7141, lng: -135.0761 },
    { id: "yzf", label: "Yellowknife Airport", lat: 62.4661, lng: -114.4392 },
    { id: "yfb", label: "Iqaluit Airport", lat: 63.757, lng: -68.545 },
    { id: "ysb", label: "Sudbury Airport", lat: 46.6256, lng: -80.7991 },
    { id: "yqt", label: "Thunder Bay Airport", lat: 48.372, lng: -89.3121 },
    { id: "yam", label: "Sault Ste. Marie Airport", lat: 46.483, lng: -84.5062 },
    { id: "yyb", label: "North Bay Airport", lat: 46.3574, lng: -79.4269 },
  ] satisfies Omit<Hub, "kind">[]
).map((hub) => ({ ...hub, kind: "airport" as const }));

const AIRPORT_REACH_METERS = 80_000;
const MAX_AIRPORTS = 3;

/** Big-city cores worth a commute line from anywhere within reach. */
const METRO_CORES = new Set(["toronto", "vancouver", "montreal", "calgary", "edmonton", "ottawa"]);
const METRO_REACH_METERS = 90_000;

/**
 * Destinations, downtowns first (the first is always the nearest downtown):
 * the nearest downtown, the nearest big-city core when within reach (e.g.
 * Union Station from Oshawa, Waterfront Station from Surrey), then the
 * nearest airports within reach.
 */
export function pickDestinations(origin: LatLng): Hub[] {
  const byDistance = (hubs: Hub[]) =>
    [...hubs].sort(
      (a, b) => distanceMeters(origin, a) - distanceMeters(origin, b),
    );
  const downtowns = byDistance(DOWNTOWNS);
  const picks: Hub[] = [downtowns[0]];
  const metro = downtowns.find((d) => METRO_CORES.has(d.id));
  if (
    metro &&
    metro.id !== picks[0].id &&
    distanceMeters(origin, metro) < METRO_REACH_METERS
  ) {
    picks.push(metro);
  }
  const airports = byDistance(AIRPORTS)
    .filter((a) => distanceMeters(origin, a) < AIRPORT_REACH_METERS)
    .slice(0, MAX_AIRPORTS);
  // Always offer at least the nearest airport, however far.
  return [
    ...picks,
    ...(airports.length ? airports : byDistance(AIRPORTS).slice(0, 1)),
  ];
}

const RAPID_KIND: Record<string, TransitKind> = {
  subway_station: "subway",
  light_rail_station: "light_rail",
};

/** One entry per stop: a stop is often listed per platform or direction. */
function uniqueByName(places: NearbyResult[]) {
  const seen = new Set<string>();
  return places.filter((p) => {
    const key = p.name.toLowerCase().replace(/\s+/g, " ").trim();
    return !seen.has(key) && Boolean(seen.add(key));
  });
}

/**
 * Drops places within `meters` of one already kept (input nearest first):
 * the same stop on each corner or platform of one intersection or station.
 */
function spreadOut(places: NearbyResult[], meters: number) {
  const kept: NearbyResult[] = [];
  for (const p of places) {
    if (kept.every((k) => distanceMeters(k, p) > meters)) kept.push(p);
  }
  return kept;
}

/**
 * GO bus stops. Google doesn't tag stops by agency, so search "GO bus" and
 * keep names with "GO", minus local stops named after a GO station
 * ("Bramalea GO Station - Route 11", "Main St at Station St - Markham GO
 * Station").
 */
async function goBusStops(origin: LatLng) {
  const lists = await Promise.all(
    ["bus_stop", "bus_station"].map((type) =>
      searchTextNearby({ ...origin, query: "GO bus", type, radius: 8000 }),
    ),
  );
  return lists
    .flat()
    .filter(
      (p) =>
        /\bGO\b/i.test(p.name) &&
        !/\broutes?\b|\bstop #|\bat\b.+\s-\s/i.test(p.name),
    )
    .sort((a, b) => distanceMeters(origin, a) - distanceMeters(origin, b));
}

/** Nearby stops of every kind, each tagged with its kind. */
async function findStops(origin: LatLng) {
  const [rapid, goTrain, goBus, bus] = await Promise.all([
    searchNearby({
      ...origin,
      types: ["subway_station", "light_rail_station"],
      radius: 3000,
      maxResults: 4,
    }),
    // GO (and other rail) stations: Text Search so they rank by distance
    // over a wide radius without subway stations crowding them out.
    searchTextNearby({
      ...origin,
      query: "GO station",
      type: "train_station",
      radius: 10_000,
    }),
    goBusStops(origin),
    searchNearby({
      ...origin,
      types: ["bus_stop"],
      radius: 800,
      maxResults: 20,
    }),
  ]);
  const groups: [TransitKind | null, NearbyResult[], number][] = [
    [null, rapid, 4],
    ["train", spreadOut(uniqueByName(goTrain), 300), 3],
    ["go_bus", spreadOut(uniqueByName(goBus), 350), 3],
    ["bus", spreadOut(uniqueByName(bus), 80), 5],
  ];
  const seen = new Set<string>();
  return groups.flatMap(([kind, places, max]) =>
    places
      .filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)))
      .slice(0, max)
      .map((place) => ({
        place,
        kind: kind ?? RAPID_KIND[place.primaryType ?? ""] ?? "subway",
      })),
  );
}

export async function extractCommute(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  const { latitude: lat, longitude: lng } = report?.property ?? {};
  if (lat == null || lng == null) {
    throw new Error("The property's location isn't available yet.");
  }
  const origin = { lat, lng };
  const departure = nextWeekdayMorning();

  const found = await findStops(origin);
  const timed = await withTravelTimes(
    origin,
    found.map((f) => f.place),
  );
  const stations = timed.map((place, i) => ({ ...place, kind: found[i].kind }));

  let routesAvailable = true;
  const destinations: CommuteData["destinations"] = [];
  for (const hub of pickDestinations(origin)) {
    let drive = null;
    let transit = null;
    if (routesAvailable) {
      try {
        [drive, transit] = await Promise.all([
          routeDuration(origin, hub, "DRIVE", departure),
          routeDuration(origin, hub, "TRANSIT", departure),
        ]);
      } catch (error) {
        if (!(error instanceof RoutesUnavailableError)) throw error;
        routesAvailable = false;
      }
    }
    destinations.push({
      id: hub.id,
      label: hub.label,
      kind: hub.kind,
      driveMinutes: drive ? Math.round(drive.seconds / 60) : null,
      driveKm: drive ? Math.round(drive.meters / 100) / 10 : null,
      transitMinutes: transit ? Math.round(transit.seconds / 60) : null,
    });
  }

  // Airports are picked by straight-line distance, which can cross water
  // (Nanaimo from Vancouver is a ferry ride): drop any whose drive is far
  // longer than the quickest airport's, always keeping one.
  const airportDrives = destinations
    .filter((d) => d.kind === "airport" && d.driveMinutes != null)
    .map((d) => d.driveMinutes!);
  if (airportDrives.length > 1) {
    const quickest = Math.min(...airportDrives);
    const limit = Math.max(90, quickest * 2.5);
    for (let i = destinations.length - 1; i >= 0; i--) {
      const d = destinations[i];
      if (d.kind === "airport" && d.driveMinutes != null && d.driveMinutes > limit) {
        destinations.splice(i, 1);
      }
    }
  }

  // Walking and cycling to each destination: one matrix call per mode.
  // A failure only means those times are estimated in the UI.
  if (routesAvailable && destinations.length) {
    const kept = new Set(destinations.map((d) => d.id));
    const hubs = pickDestinations(origin).filter((h) => kept.has(h.id));
    const [walk, bike] = await Promise.all(
      (["WALK", "BICYCLE"] as const).map((mode) =>
        routeMatrix(origin, hubs, mode).catch((error) => {
          console.error(`[commute] ${mode} to destinations`, error);
          return null;
        }),
      ),
    );
    destinations.forEach((d, i) => {
      const w = walk?.[i];
      const b = bike?.[i];
      d.walkMinutes = w ? Math.round(w.seconds / 60) : null;
      d.walkKm = w ? Math.round(w.meters / 100) / 10 : null;
      d.bikeMinutes = b ? Math.round(b.seconds / 60) : null;
      d.bikeKm = b ? Math.round(b.meters / 100) / 10 : null;
    });
  }

  const data: CommuteData = {
    destinations,
    stations: stations.sort((a, b) => a.distanceMeters - b.distanceMeters),
    departureLabel: "Weekday, 8:00 a.m. departure",
    routesAvailable,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.commute, data);
  return {
    destinations: destinations.length,
    stations: stations.length,
    routesAvailable,
  };
}
