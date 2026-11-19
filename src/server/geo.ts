// Small geo/time helpers shared by the extractors.

export type LatLng = { lat: number; lng: number };

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Next weekday at 8:00 a.m. Toronto time, as an RFC 3339 timestamp. */
export function nextWeekdayMorning(timeZone = "America/Toronto") {
  const now = new Date();
  for (let add = 1; add <= 7; add++) {
    const day = new Date(now.getTime() + add * 86_400_000);
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        weekday: "short",
        timeZoneName: "longOffset",
      })
        .formatToParts(day)
        .map((p) => [p.type, p.value]),
    );
    if (parts.weekday === "Sat" || parts.weekday === "Sun") continue;
    const offset =
      (parts.timeZoneName as string).replace("GMT", "") || "+00:00";
    return `${parts.year}-${parts.month}-${parts.day}T08:00:00${offset}`;
  }
  return new Date(now.getTime() + 86_400_000).toISOString();
}

/**
 * Shortest distance in metres from a point to polylines given as ArcGIS
 * `paths` ([[lng, lat], …] per path, WGS84). Uses a local flat projection,
 * accurate to well under 1% at neighbourhood scale.
 */
export function distanceToPathsMeters(origin: LatLng, paths: number[][][]) {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const project = ([lng, lat]: number[]) => [
    (lng - origin.lng) * mPerDegLng,
    (lat - origin.lat) * mPerDegLat,
  ];
  let best = Infinity;
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = project(path[i - 1]);
      const [bx, by] = project(path[i]);
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      // Projection of the origin (0, 0) onto segment AB, clamped to it.
      const t =
        len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

/** Compass bearing in degrees (0 = north) from one point to another. */
export function bearingDegrees(from: LatLng, to: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
