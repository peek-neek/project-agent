import { auth } from "@clerk/nextjs/server";
import { reportStore } from "@/server/report-store";
import { parseAngle, streetViewImage } from "@/server/street-view";

/** Street View photo of the property (?angle=front|left|right|wide). */
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
  return streetViewImage(
    { lat, lng },
    parseAngle(new URL(request.url).searchParams.get("angle")),
  );
}
