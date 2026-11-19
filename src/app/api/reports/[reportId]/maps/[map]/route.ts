import { auth } from "@clerk/nextjs/server";
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
import { reportStore } from "@/server/report-store";

const hex = (color: string) => `0x${color.replace("#", "")}`;
const point = (lat: number, lng: number) =>
  `${lat.toFixed(6)},${lng.toFixed(6)}`;

// Muted base map with other points of interest hidden, so our markers stand out.
const STYLES = [
  "feature:poi|visibility:off",
  "feature:poi.park|visibility:simplified",
  "feature:transit|visibility:simplified",
  "element:geometry|saturation:-60",
  "feature:road|element:labels.icon|visibility:off",
];

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/maps/[map]">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId, map } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const lat = report?.property?.latitude;
  const lng = report?.property?.longitude;
  if (!report || lat == null || lng == null) {
    return new Response("Not found", { status: 404 });
  }

  const section = (key: string) =>
    report.sections.find((s) => s.key === key)?.data;
  const markers: string[] = [
    `size:mid|color:0x111111|label:H|${point(lat, lng)}`,
  ];

  if (map === "upside") {
    const upside = upsideSchema.safeParse(section(SECTION_KEYS.upside));
    if (!upside.success) return new Response("Not found", { status: 404 });
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
    if (!schools.success) return new Response("Not found", { status: 404 });
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
    if (!commute.success) return new Response("Not found", { status: 404 });
    commute.data.stations.forEach((s, i) => {
      markers.push(
        `size:mid|color:${hex(TRANSIT_COLORS[s.kind])}|label:${i + 1}|${point(s.lat, s.lng)}`,
      );
    });
  } else {
    const amenities = amenitiesSchema.safeParse(
      section(SECTION_KEYS.amenities),
    );
    if (!amenities.success) return new Response("Not found", { status: 404 });
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
      if (!category) return new Response("Not found", { status: 404 });
      (amenities.data.categories[category.id] ?? []).forEach((p, i) => {
        markers.push(
          `size:mid|color:${hex(category.color)}|label:${i + 1}|${point(p.lat, p.lng)}`,
        );
      });
    }
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("Maps not configured", { status: 503 });

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("size", "640x360");
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("language", "en");
  for (const m of markers) url.searchParams.append("markers", m);
  for (const s of STYLES) url.searchParams.append("style", s);
  url.searchParams.set("key", key);

  const upstream = await fetch(url, { cache: "no-store" });
  if (
    !upstream.ok ||
    !upstream.headers.get("content-type")?.startsWith("image/")
  ) {
    console.error(
      "[maps] Static Maps error",
      upstream.status,
      await upstream.text().catch(() => ""),
    );
    return new Response("Map unavailable", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
