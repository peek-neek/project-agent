import { auth } from "@clerk/nextjs/server";
import { reportStore } from "@/server/report-store";
import { parseAngle, streetViewImage } from "@/server/street-view";

/**
 * Street View photo of the property (?angle=, see STREET_VIEW_ANGLES;
 * ?size=thumb for the small square used in the report history).
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/street-view">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const lat = report?.property?.latitude;
  const lng = report?.property?.longitude;
  if (!report || lat == null || lng == null) {
    return new Response("Not found", { status: 404 });
  }
  const search = new URL(request.url).searchParams;
  return streetViewImage(
    { lat, lng },
    parseAngle(search.get("angle")),
    search.get("size") === "thumb" ? "160x160" : undefined,
  );
}
