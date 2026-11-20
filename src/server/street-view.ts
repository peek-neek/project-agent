// Google Street View Static API: the nearest outdoor panorama, with the
// camera turned toward the target so the building is in frame.
// Metadata lookups are free; only the image request is billed.
import { bearingDegrees, type LatLng } from "./geo";

/**
 * Camera presets, relative to facing the property from the nearest
 * panorama: `turn` swings the heading, `fov` zooms (smaller = closer),
 * `pitch` tilts up.
 */
export const STREET_VIEW_ANGLES = {
  front: { turn: 0, fov: 80, pitch: 5 },
  closeUp: { turn: 0, fov: 45, pitch: 8 },
  frontLeft: { turn: -35, fov: 85, pitch: 5 },
  frontRight: { turn: 35, fov: 85, pitch: 5 },
  left: { turn: -80, fov: 90, pitch: 3 },
  right: { turn: 80, fov: 90, pitch: 3 },
  across: { turn: 180, fov: 90, pitch: 3 },
  wide: { turn: 0, fov: 120, pitch: 5 },
} as const;
export type StreetViewAngle = keyof typeof STREET_VIEW_ANGLES;

type Metadata = { status: string; pano_id?: string; location?: LatLng };

export async function streetViewImage(
  target: LatLng,
  angle: StreetViewAngle = "front",
  /** "WxH" in pixels (max 640x640); smaller for thumbnails. */
  size = "640x400",
): Promise<Response> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("Maps not configured", { status: 503 });

  const base = "https://maps.googleapis.com/maps/api/streetview";
  const metaUrl = new URL(`${base}/metadata`);
  metaUrl.searchParams.set("location", `${target.lat},${target.lng}`);
  metaUrl.searchParams.set("radius", "80");
  metaUrl.searchParams.set("source", "outdoor");
  metaUrl.searchParams.set("key", key);
  const meta = (await fetch(metaUrl, { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({ status: "ERROR" }))) as Metadata;

  if (meta.status !== "OK" || !meta.pano_id || !meta.location) {
    const missing =
      meta.status === "ZERO_RESULTS" || meta.status === "NOT_FOUND";
    if (!missing) console.error("[street-view] metadata", meta.status);
    return new Response(
      missing ? "No Street View here" : "Street View unavailable",
      {
        status: missing ? 404 : 502,
      },
    );
  }

  const preset = STREET_VIEW_ANGLES[angle];
  const heading =
    (bearingDegrees(meta.location, target) + preset.turn + 360) % 360;
  const imageUrl = new URL(base);
  imageUrl.searchParams.set("size", size);
  imageUrl.searchParams.set("pano", meta.pano_id);
  imageUrl.searchParams.set("heading", heading.toFixed(0));
  imageUrl.searchParams.set("pitch", String(preset.pitch));
  imageUrl.searchParams.set("fov", String(preset.fov));
  imageUrl.searchParams.set("return_error_code", "true");
  imageUrl.searchParams.set("key", key);

  const upstream = await fetch(imageUrl, { cache: "no-store" });
  if (
    !upstream.ok ||
    !upstream.headers.get("content-type")?.startsWith("image/")
  ) {
    console.error("[street-view] image", upstream.status);
    return new Response("Street View unavailable", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export const parseAngle = (value: string | null): StreetViewAngle =>
  value && value in STREET_VIEW_ANGLES ? (value as StreetViewAngle) : "front";
