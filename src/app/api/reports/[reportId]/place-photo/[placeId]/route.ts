import { auth } from "@clerk/nextjs/server";
import {
  amenitiesSchema,
  commuteSchema,
  SECTION_KEYS,
} from "@/lib/report-sections";
import { reportStore } from "@/server/report-store";

/**
 * One size for every use (cards, gallery, lightbox). Google bills each photo
 * request, so one URL per photo means the browser fetches it once and reuses
 * it everywhere; 1200px is sharp on cards at 2x and fine in the lightbox.
 * (Any old ?w= is ignored.)
 */
const PHOTO_WIDTH = 1200;

/**
 * Google Places photo of a nearby place in this report (?i= picks one of its
 * photos, default the first). Only serves photos the report's own amenities
 * and transit stations reference, so it can't proxy arbitrary photos.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/place-photo/[placeId]">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId, placeId } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const section = (key: string) =>
    report?.sections.find((s) => s.key === key)?.data;
  const amenities = amenitiesSchema.safeParse(section(SECTION_KEYS.amenities));
  const commute = commuteSchema.safeParse(section(SECTION_KEYS.commute));
  const places = [
    ...(amenities.success
      ? Object.values(amenities.data.categories).flat()
      : []),
    ...(commute.success ? commute.data.stations : []),
  ];
  const place = places.find((p) => p.id === placeId);
  const search = new URL(request.url).searchParams;
  const index = Number(search.get("i") ?? 0);
  const photo =
    (Number.isInteger(index) && index > 0 ? place?.photos?.[index] : null) ??
    place?.photo;
  if (!photo) return new Response("Not found", { status: 404 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("Maps not configured", { status: 503 });

  const url = new URL(`https://places.googleapis.com/v1/${photo.name}/media`);
  url.searchParams.set("maxWidthPx", String(PHOTO_WIDTH));
  url.searchParams.set("key", key);
  // One line per billed Google photo request (runtime logs: "[place-photo] fetch").
  console.log("[place-photo] fetch", { reportId, placeId, i: index || 0 });
  const upstream = await fetch(url, { cache: "no-store" });
  if (
    !upstream.ok ||
    !upstream.headers.get("content-type")?.startsWith("image/")
  ) {
    console.error("[place-photo]", upstream.status);
    return new Response("Photo unavailable", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
