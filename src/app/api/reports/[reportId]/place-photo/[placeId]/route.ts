import { auth } from "@clerk/nextjs/server";
import {
  amenitiesSchema,
  commuteSchema,
  SECTION_KEYS,
} from "@/lib/report-sections";
import { reportStore } from "@/server/report-store";

/**
 * Google Places photo of a nearby place in this report. Only serves photos
 * the report's own amenities and transit stations reference, so it can't proxy arbitrary photos.
 */
export async function GET(
  _request: Request,
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
  const photo = places.find((p) => p.id === placeId)?.photo;
  if (!photo) return new Response("Not found", { status: 404 });

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new Response("Maps not configured", { status: 503 });

  const url = new URL(`https://places.googleapis.com/v1/${photo.name}/media`);
  url.searchParams.set("maxWidthPx", "800");
  url.searchParams.set("key", key);
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
