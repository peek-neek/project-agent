import { auth } from "@clerk/nextjs/server";
import { SECTION_KEYS, schoolsSchema } from "@/lib/report-sections";
import { reportStore } from "@/server/report-store";
import { streetViewImage } from "@/server/street-view";

/** Street View photo of a school listed in this report. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/school-photo/[schoolId]">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId, schoolId } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const schools = schoolsSchema.safeParse(
    report?.sections.find((s) => s.key === SECTION_KEYS.schools)?.data,
  );
  const school = schools.success
    ? schools.data.systems
        .flatMap((s) => [...s.elementary, ...s.secondary])
        .find((s) => s.id === schoolId)
    : null;
  if (!school) return new Response("Not found", { status: 404 });

  return streetViewImage({ lat: school.lat, lng: school.lng });
}
