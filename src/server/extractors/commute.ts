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
import { routeDuration, RoutesUnavailableError } from "../google-routes";
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
  ] satisfies Omit<Hub, "kind">[]
).map((hub) => ({ ...hub, kind: "airport" as const }));

const AIRPORT_REACH_METERS = 80_000;
const MAX_AIRPORTS = 3;

/**
 * Destinations, downtowns first (the first is always the nearest downtown):
 * the nearest downtown, Union Station when within reach, then the nearest
 * airports within reach.
 */
export function pickDestinations(origin: LatLng): Hub[] {
  const byDistance = (hubs: Hub[]) =>
    [...hubs].sort(
      (a, b) => distanceMeters(origin, a) - distanceMeters(origin, b),
    );
  const picks: Hub[] = [byDistance(DOWNTOWNS)[0]];
  const toronto = DOWNTOWNS[0];
  if (picks[0].id !== "toronto" && distanceMeters(origin, toronto) < 90_000) {
    picks.push(toronto);
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
