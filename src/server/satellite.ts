// Satellite photos of a property (Google Maps Static API, satellite imagery),
// centred on the home with a small pin. Replaces Street View for property
// photos: sharper (2x), current, and never blocked by trees or parked cars.
// School cards still use Street View (street-view.ts).
import type { LatLng } from "./geo";

/**
 * Zoom levels, closest first. 19 is the sharpest that's available almost
 * everywhere: at 20, many cities (e.g. Saskatoon) only have 19's imagery
 * enlarged, which looks blurry.
 */
export const SATELLITE_VIEWS = {
  home: { zoom: 19, label: "The home" },
  street: { zoom: 18, label: "Street" },
  block: { zoom: 17, label: "Block" },
  area: { zoom: 16, label: "Neighbourhood" },
} as const;
export type SatelliteView = keyof typeof SATELLITE_VIEWS;

/** The site's red, as the pin colour. */
const PIN = "0xd10001";

export async function satelliteImage(
  target: LatLng,
  view: SatelliteView = "home",
  /** "WxH" in pixels (max 640x640); delivered at 2x. */
  size = "640x400",
): Promise<Response> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("Maps not configured", { status: 503 });

  const center = `${target.lat},${target.lng}`;
  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", center);
  url.searchParams.set("zoom", String(SATELLITE_VIEWS[view].zoom));
  url.searchParams.set("size", size);
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "satellite");
  // Photos: JPEG is a fraction of PNG's size with no visible difference.
  url.searchParams.set("format", "jpg");
  url.searchParams.set("markers", `size:mid|color:${PIN}|${center}`);
  url.searchParams.set("key", key);

  const upstream = await fetch(url, { cache: "no-store" });
  if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) {
    console.error("[satellite] image", upstream.status);
    return new Response("Satellite image unavailable", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}

export const parseSatelliteView = (value: string | null): SatelliteView =>
  value && value in SATELLITE_VIEWS ? (value as SatelliteView) : "home";
