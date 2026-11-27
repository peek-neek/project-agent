import { auth } from "@clerk/nextjs/server";
import { currentRender, VIDEO_SECTION_KEY, videoSectionSchema } from "@/lib/video";
import { reportStore } from "@/server/report-store";
import { presignedUrl } from "@/server/video-store";

/**
 * Downloads the report's exported MP4. The file is private in Blob; the
 * owner is sent to a short-lived signed URL (function responses are capped
 * at 4.5 MB, so it isn't streamed through here).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/video/download">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const row = report?.sections.find((s) => s.key === VIDEO_SECTION_KEY);
  const video = row ? videoSectionSchema.safeParse(row.data) : null;
  const render = video?.success ? currentRender(video.data) : null;
  if (render?.status !== "ready" || !render.pathname) {
    return new Response("Not found", { status: 404 });
  }

  const url = await presignedUrl(render.pathname, {
    validForMs: 5 * 60_000,
    download: true,
  });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}
