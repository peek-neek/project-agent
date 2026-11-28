import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { fetchScriptRoutes, generateVideoScript } from "../server/ai/video-script";
import { speak, VoiceoverUnavailableError } from "../server/ai/voiceover";
import { reportStore } from "../server/report-store";
import {
  blobConfigured,
  deleteBlobs,
  getVideo,
  putVoiceClip,
  saveVideo,
} from "../server/video-store";

/**
 * Writes the map video's script, then voices each scene. A voiceover
 * failure doesn't fail the video: it's saved with captions only and a note
 * the agent sees, so they can retry once text-to-speech works.
 */
export const reportVideoTask = schemaTask({
  id: "report-video",
  description: "Write and voice a report's map video",
  schema: z.object({
    reportId: z.string().uuid(),
    travelMode: z.enum(["walk", "drive"]),
  }),
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async ({ reportId, travelMode }) => {
    const report = await reportStore.findWithDetails(reportId);
    if (!report) throw new AbortTaskRunError(`Report ${reportId} was deleted`);
    const previous = await getVideo(reportId);

    await saveVideo(reportId, { status: "writing", travelMode, error: null });
    const { script, generatedBy } = await generateVideoScript(report, travelMode);
    logger.info("Video script written", { scenes: script.scenes.length, generatedBy });
    // Street routes for the progress bars (best effort: curved lines if not).
    const routes = await fetchScriptRoutes(report, script, travelMode);
    logger.info("Routes", { found: routes ? Object.keys(routes).length : 0 });

    if (!blobConfigured()) {
      await saveVideo(reportId, {
        status: "ready",
        script,
        routes,
        generatedBy,
        audio: null,
        audioNote: "Voiceover needs file storage, which isn't set up yet.",
      });
      return { scenes: script.scenes.length, voiced: false };
    }

    await saveVideo(reportId, {
      status: "voicing",
      script,
      routes,
      generatedBy,
      audio: null,
    });
    try {
      const clips = await Promise.all(
        script.scenes.map(async (scene, i) => {
          const { wav, durationSec } = await speak(scene.voiceover);
          return { pathname: await putVoiceClip(reportId, i, wav), durationSec };
        }),
      );
      await saveVideo(reportId, { status: "ready", audio: clips, audioNote: null });
      await deleteBlobs(previous?.audio?.map((c) => c.pathname) ?? []);
      return { scenes: script.scenes.length, voiced: true };
    } catch (error) {
      // Text-to-speech or storage trouble: keep the script, play captions.
      logger.warn("Voiceover failed; saved captions only", {
        error: error instanceof Error ? error.message : String(error),
      });
      await saveVideo(reportId, {
        status: "ready",
        audio: null,
        audioNote:
          error instanceof VoiceoverUnavailableError
            ? "The voiceover couldn't be generated (text-to-speech is unavailable). The video plays with captions."
            : "The voiceover couldn't be saved. The video plays with captions.",
      });
      return { scenes: script.scenes.length, voiced: false };
    }
  },
  onFailure: async ({ payload, error }) => {
    if (!(await reportStore.findById(payload.reportId))) return;
    console.error("[report-video]", error);
    await saveVideo(payload.reportId, {
      status: "failed",
      error: "The video couldn't be written. Try again shortly.",
    });
  },
});
