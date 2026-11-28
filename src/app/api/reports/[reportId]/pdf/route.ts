import { auth } from "@clerk/nextjs/server";
import { parsePdfSections } from "@/lib/pdf-sections";
import { parseTravelMode } from "@/lib/travel";
import { brandingFor, readLogo } from "@/server/branding";
import type { PdfBrand } from "@/server/pdf/primitives";
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

  const query = new URL(request.url).searchParams;
  const mode = parseTravelMode(query.get("mode"));
  // ?sections=a,b,c: only those (the download dialog); absent: everything.
  const sections = parsePdfSections(query.get("sections"));
  if (sections?.size === 0) {
    return new Response("Choose at least one section", { status: 400 });
  }
  try {
    const pdf = await renderReportPdf(
      report,
      mode,
      sections,
      await pdfBrand(userId),
    );
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

/**
 * The footer brand: the Pro agent's (logo loaded from Blob; a missing or
 * unreadable logo just leaves it out), else Areaview's.
 */
async function pdfBrand(userId: string): Promise<PdfBrand> {
  const branding = await brandingFor(userId, (pathname) => pathname);
  if (branding.kind === "areaview") return branding;
  const { logoSrc, ...details } = branding;
  const logo = logoSrc ? await readLogo(logoSrc) : null;
  return {
    ...details,
    logo: logo
      ? { data: logo.data, format: logo.contentType === "image/png" ? "png" : "jpg" }
      : undefined,
  };
}
