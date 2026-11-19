// Minimal ArcGIS REST client for the public open-data layers we query.
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).
import type { LatLng } from "./geo";

export type ArcgisFeature<A = Record<string, unknown>> = {
  attributes: A;
  geometry?: {
    x?: number;
    y?: number;
    paths?: number[][][];
    rings?: number[][][];
  };
};

export class ArcgisError extends Error {}

/** Runs a layer query and returns its features. */
export async function queryLayer<A = Record<string, unknown>>(
  layerUrl: string,
  params: Record<string, string | number | boolean>,
  { timeoutMs = 20_000 }: { timeoutMs?: number } = {},
): Promise<ArcgisFeature<A>[]> {
  const body = new URLSearchParams({ f: "json" });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  // POST: some queries (field lists, statistics) exceed GET URL limits.
  const res = await fetch(`${layerUrl}/query`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new ArcgisError(`${layerUrl}: HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: ArcgisFeature<A>[];
    error?: { message?: string };
  };
  if (json.error) {
    throw new ArcgisError(
      `${layerUrl}: ${json.error.message ?? "query failed"}`,
    );
  }
  return json.features ?? [];
}

/** Query params for "features at / near this point" (WGS84 in and out). */
export const atPoint = (point: LatLng, distanceMeters?: number) => ({
  geometry: `${point.lng},${point.lat}`,
  geometryType: "esriGeometryPoint",
  inSR: 4326,
  outSR: 4326,
  spatialRel: "esriSpatialRelIntersects",
  ...(distanceMeters
    ? { distance: distanceMeters, units: "esriSRUnit_Meter" }
    : {}),
});
