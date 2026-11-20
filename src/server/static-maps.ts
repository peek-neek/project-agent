// Google Static Maps for a report: the property ("H") plus numbered markers
// for one section. Used by the maps route (web/print) and the PDF.
import {
  AMENITY_CATEGORIES,
  FEATURED_AMENITY_CATEGORIES,
  amenitiesSchema,
  commuteSchema,
  SCHOOL_SYSTEMS,
  SECTION_KEYS,
  schoolMapLabels,
  schoolsSchema,
  APPLICATION_STAGES,
  PROJECT_CATEGORIES,
  type ProjectCategory,
  TRANSIT_COLORS,
  upsideMapLabels,
  upsideSchema,
} from "@/lib/report-sections";

type ReportForMap = {
  property: { latitude: number | null; longitude: number | null } | null;
  sections: { key: string; data: unknown }[];
};

const hex = (color: string) => `0x${color.replace("#", "")}`;
const pointText = (lat: number, lng: number) =>
  `${lat.toFixed(6)},${lng.toFixed(6)}`;

// Muted base map with other points of interest hidden, so our markers stand out.
const STYLES = [
  "feature:poi|visibility:off",
  "feature:poi.park|visibility:simplified",
  "feature:transit|visibility:simplified",
  "element:geometry|saturation:-60",
  "feature:road|element:labels.icon|visibility:off",
];

/**
 * The Static Maps URL for one map ("overview", an amenity category id,
 * "transit", "schools", "upside"), or null when there's nothing to draw or
 * Maps isn't configured.
 */
export function staticMapUrl(
  report: ReportForMap,
  map: string,
  options: {
    /** "WxH" before the 2× scale; match the frame it's shown in. */
    size?: string;
    /** Zoom out so every pin (and its head) sits inside the frame. */
    pad?: boolean;
  } = {},
): URL | null {
  const lat = report.property?.latitude;
  const lng = report.property?.longitude;
  if (lat == null || lng == null) return null;

  // Every marker position, for the padded view.
  const pts: [number, number][] = [];
  const point = (la: number, ln: number) => {
    pts.push([la, ln]);
    return pointText(la, ln);
  };

  const section = (key: string) =>
    report.sections.find((s) => s.key === key)?.data;
  const markers: string[] = [
    `size:mid|color:0x111111|label:H|${point(lat, lng)}`,
  ];

  if (map === "upside") {
    const upside = upsideSchema.safeParse(section(SECTION_KEYS.upside));
    if (!upside.success) return null;
    const labels = upsideMapLabels(upside.data);
    for (const a of upside.data.development?.applications ?? []) {
      const label = labels.get(a.id);
      if (!label) continue;
      markers.push(
        `size:mid|color:${hex(APPLICATION_STAGES[a.stage].color)}|label:${label}|${point(a.lat, a.lng)}`,
      );
    }
    for (const p of upside.data.projects) {
      const label = labels.get(p.id);
      if (!label) continue;
      const color =
        PROJECT_CATEGORIES[p.category as ProjectCategory]?.color ?? "#525252";
      markers.push(
        `size:mid|color:${hex(color)}|label:${label}|${point(p.lat, p.lng)}`,
      );
    }
  } else if (map === "schools") {
    const schools = schoolsSchema.safeParse(section(SECTION_KEYS.schools));
    if (!schools.success) return null;
    const labels = schoolMapLabels(schools.data);
    for (const system of schools.data.systems) {
      const color = SCHOOL_SYSTEMS.find((s) => s.id === system.id)!.color;
      for (const school of [...system.elementary, ...system.secondary]) {
        const label = labels.get(school.id);
        if (!label) continue;
        markers.push(
          `size:mid|color:${hex(color)}|label:${label}|${point(school.lat, school.lng)}`,
        );
      }
    }
  } else if (map === "transit") {
    const commute = commuteSchema.safeParse(section(SECTION_KEYS.commute));
    if (!commute.success) return null;
    commute.data.stations.forEach((s, i) => {
      markers.push(
        `size:mid|color:${hex(TRANSIT_COLORS[s.kind])}|label:${i + 1}|${point(s.lat, s.lng)}`,
      );
    });
  } else {
    const amenities = amenitiesSchema.safeParse(
      section(SECTION_KEYS.amenities),
    );
    if (!amenities.success) return null;
    if (map === "overview") {
      // Everyday categories only, to keep the overview readable.
      for (const category of FEATURED_AMENITY_CATEGORIES) {
        const places = (amenities.data.categories[category.id] ?? []).slice(
          0,
          3,
        );
        if (places.length === 0) continue;
        markers.push(
          [
            `size:small|color:${hex(category.color)}`,
            ...places.map((p) => point(p.lat, p.lng)),
          ].join("|"),
        );
      }
    } else {
      const category = AMENITY_CATEGORIES.find((c) => c.id === map);
      if (!category) return null;
      (amenities.data.categories[category.id] ?? []).forEach((p, i) => {
        markers.push(
          `size:mid|color:${hex(category.color)}|label:${i + 1}|${point(p.lat, p.lng)}`,
        );
      });
    }
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", options.size ?? "640x360");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("language", "en");
  for (const m of markers) url.searchParams.append("markers", m);
  if (options.pad && pts.length > 1) {
    // Google fits markers edge to edge; widen the box so pins aren't
    // clipped (extra room on top for the pin heads).
    const lats = pts.map((p) => p[0]);
    const lngs = pts.map((p) => p[1]);
    const [s, n] = [Math.min(...lats), Math.max(...lats)];
    const [w, e] = [Math.min(...lngs), Math.max(...lngs)];
    const dLat = Math.max(n - s, 0.004);
    const dLng = Math.max(e - w, 0.006);
    url.searchParams.set(
      "visible",
      `${(s - dLat * 0.12).toFixed(6)},${(w - dLng * 0.1).toFixed(6)}|${(n + dLat * 0.28).toFixed(6)},${(e + dLng * 0.1).toFixed(6)}`,
    );
  }
  for (const s of STYLES) url.searchParams.append("style", s);
  url.searchParams.set("key", key);

  return url;
}
