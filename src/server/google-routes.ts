// Google Routes API helpers. Shared by Next.js and Trigger.dev tasks.

export type LatLng = { lat: number; lng: number };

/** Routes API not enabled / key not allowed: callers fall back to estimates. */
export class RoutesUnavailableError extends Error {}

const waypoint = ({ lat, lng }: LatLng) => ({
  location: { latLng: { latitude: lat, longitude: lng } },
});

async function routesFetch<T>(url: string, fieldMask: string, body: unknown) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey)
    throw new RoutesUnavailableError("GOOGLE_MAPS_API_KEY is not set");
  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });
  if (response.status === 403) {
    throw new RoutesUnavailableError("Routes API is not enabled for this key");
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Routes request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  return (await response.json()) as T;
}

const seconds = (duration?: string) =>
  duration ? Number(duration.replace("s", "")) : null;

/** Matrix elements per request: well under the API's 625-element limit. */
const MATRIX_CHUNK = 100;

/**
 * Travel time and distance from one origin to many destinations, for one
 * mode. Null where there's no route. Drive times are typical (no traffic).
 */
export async function routeMatrix(
  origin: LatLng,
  destinations: LatLng[],
  mode: "WALK" | "BICYCLE" | "DRIVE",
): Promise<({ seconds: number; meters: number } | null)[]> {
  if (destinations.length > MATRIX_CHUNK) {
    const chunks: LatLng[][] = [];
    for (let i = 0; i < destinations.length; i += MATRIX_CHUNK) {
      chunks.push(destinations.slice(i, i + MATRIX_CHUNK));
    }
    const parts = await Promise.all(
      chunks.map((c) => routeMatrix(origin, c, mode)),
    );
    return parts.flat();
  }
  if (destinations.length === 0) return [];
  const rows = await routesFetch<
    {
      destinationIndex?: number;
      duration?: string;
      distanceMeters?: number;
      condition?: string;
    }[]
  >(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    "destinationIndex,duration,distanceMeters,condition",
    {
      origins: [{ waypoint: waypoint(origin) }],
      destinations: destinations.map((d) => ({ waypoint: waypoint(d) })),
      travelMode: mode,
    },
  );
  const result: ({ seconds: number; meters: number } | null)[] =
    destinations.map(() => null);
  for (const row of rows) {
    const s = seconds(row.duration);
    if (
      row.destinationIndex == null ||
      s == null ||
      row.condition === "ROUTE_NOT_FOUND"
    )
      continue;
    result[row.destinationIndex] = {
      seconds: s,
      meters: row.distanceMeters ?? 0,
    };
  }
  return result;
}

/** One route's duration and distance for a travel mode. */
export async function routeDuration(
  origin: LatLng,
  destination: LatLng,
  mode: "DRIVE" | "TRANSIT",
  departureTime: string,
) {
  const data = await routesFetch<{
    routes?: { duration?: string; distanceMeters?: number }[];
  }>(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    "routes.duration,routes.distanceMeters",
    {
      origin: waypoint(origin),
      destination: waypoint(destination),
      travelMode: mode,
      departureTime,
      ...(mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}),
    },
  );
  const route = data.routes?.[0];
  const s = seconds(route?.duration);
  return s == null ? null : { seconds: s, meters: route?.distanceMeters ?? 0 };
}

/**
 * Travel to a free-form destination (address or place name), from the
 * property. Transit and driving use "now" unless a departure is given.
 */
export async function routeToAddress(
  origin: LatLng,
  address: string,
  mode: "WALK" | "BICYCLE" | "DRIVE" | "TRANSIT",
  departureTime?: string,
) {
  const data = await routesFetch<{
    routes?: { duration?: string; distanceMeters?: number }[];
  }>(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    "routes.duration,routes.distanceMeters",
    {
      origin: waypoint(origin),
      destination: { address },
      travelMode: mode,
      ...(departureTime && (mode === "DRIVE" || mode === "TRANSIT")
        ? { departureTime }
        : {}),
      ...(mode === "DRIVE" && departureTime
        ? { routingPreference: "TRAFFIC_AWARE" }
        : {}),
    },
  );
  const route = data.routes?.[0];
  const s = seconds(route?.duration);
  return s == null ? null : { seconds: s, meters: route?.distanceMeters ?? 0 };
}
