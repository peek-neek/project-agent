import { auth } from "@clerk/nextjs/server";
import { VIDEO_SECTION_KEY, videoSectionSchema } from "@/lib/video";
import { reportStore } from "@/server/report-store";
import { rangeResponse } from "@/server/http-range";
import { readVoiceClip } from "@/server/video-store";

/**
 * One scene's voiceover clip for the report owner's video Player. Clips
 * are private in Blob storage, so they're served through here, with byte
 * ranges (Safari needs them to play audio at all).
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/reports/[reportId]/video/audio/[scene]">,
) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { reportId, scene } = await params;
  const report = await reportStore.findForUser(reportId, userId);
  const row = report?.sections.find((s) => s.key === VIDEO_SECTION_KEY);
  const video = row ? videoSectionSchema.safeParse(row.data) : null;
  const clip = video?.success ? video.data.audio?.[Number(scene)] : undefined;
  if (!clip) return new Response("Not found", { status: 404 });

  const file = await readVoiceClip(clip.pathname);
  if (!file || file.statusCode !== 200) {
    return new Response("Not found", { status: 404 });
  }
  // Clips are small (a few hundred KB), so read the whole one and answer
  // byte ranges from memory: Safari won't play audio without 206 responses.
  const data = new Uint8Array(await new Response(file.stream).arrayBuffer());
  return rangeResponse(request, data, {
    "Content-Type": "audio/wav",
    // Each new voiceover gets new pathnames; the URL carries a version.
    "Cache-Control": "private, max-age=3600",
  });
}
