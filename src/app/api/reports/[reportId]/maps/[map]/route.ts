import { auth } from "@clerk/nextjs/server";
import { reportStore } from "@/server/report-store";
import { staticMapUrl } from "@/server/static-maps";

/** Static map image for the report (see staticMapUrl for the map names). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/maps/[map]">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId, map } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const url = report ? staticMapUrl(report, map) : null;
  if (!url) return new Response("Not found", { status: 404 });

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
