import { auth } from "@clerk/nextjs/server";
import { reportStore } from "@/server/report-store";
import { parseSatelliteView, satelliteImage } from "@/server/satellite";

/**
 * Satellite photo of the property (?view=, see SATELLITE_VIEWS; ?size=thumb
 * for the small square used in the report history).
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/satellite">,
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
  return satelliteImage(
    { lat, lng },
    parseSatelliteView(search.get("view")),
    search.get("size") === "thumb" ? "160x160" : undefined,
  );
}
