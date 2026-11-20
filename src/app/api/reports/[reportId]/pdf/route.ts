import { auth } from "@clerk/nextjs/server";
import { parseTravelMode } from "@/lib/travel";
import { pdfFileName, renderReportPdf } from "@/server/pdf/render";
import { reportStore } from "@/server/report-store";

// Fetching photos and maps, then laying out every page, takes a few seconds.
export const maxDuration = 60;

/** The report as a PDF file (?mode= picks the travel mode of the AI copy). */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/pdf">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  if (!report) return new Response("Not found", { status: 404 });

  const mode = parseTravelMode(new URL(request.url).searchParams.get("mode"));
  try {
    const pdf = await renderReportPdf(report, mode);
    const street = (
      report.property?.formattedAddress ?? report.inputAddress
    ).split(",")[0];
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName(street)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[pdf]", error);
    return new Response("Couldn't create the PDF", { status: 500 });
  }
}
