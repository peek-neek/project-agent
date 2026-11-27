import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";
import { AbortTaskRunError, logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { videoVersion } from "../lib/video";
import { reportVideoProps } from "../server/ai/video-script";
import { reportStore } from "../server/report-store";
import {
  deleteBlobs,
  getVideo,
  presignedUrl,
  putVideoFile,
  saveRender,
} from "../server/video-store";

/**
 * The Remotion site, bundled ahead of time by `npm run video:bundle` and
 * shipped with the task (additionalFiles in trigger.config.ts).
 */
const SERVE_URL = path.join(process.cwd(), "build/remotion");
const COMPOSITION_ID = "PropertyVideo";

/** "12-239 Gustin Crescent" → "12-239-gustin-crescent-map-video" */
const fileName = (street: string) =>
  `${street
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "property"}-map-video`;

/**
 * Renders the report's map video to an MP4 and stores it privately in
 * Blob. The file is kept only if the script didn't change mid-render.
 */
export const reportVideoRenderTask = schemaTask({
  id: "report-video-render",
  description: "Render a report's map video to MP4",
  schema: z.object({
    reportId: z.string().uuid(),
    /** videoVersion() of the script this export was requested for. */
    version: z.string(),
  }),
  // Headless Chrome draws WebGL maps on the CPU; give it room.
  machine: "large-1x",
  maxDuration: 900,
  retry: { maxAttempts: 2 },
  run: async ({ reportId, version }) => {
    const report = await reportStore.findWithDetails(reportId);
    if (!report) throw new AbortTaskRunError(`Report ${reportId} was deleted`);
    const video = await getVideo(reportId);
    if (!video?.script || videoVersion(video) !== version) {
      await saveRender(reportId, {
        status: "failed",
        error: "The script changed before the export started. Export again.",
      });
      return { rendered: false };
    }
    if (!existsSync(SERVE_URL)) {
      throw new Error("The Remotion bundle is missing: run `npm run video:bundle`.");
    }

    // The renderer fetches each voiceover clip itself: signed URLs, 1 hour.
    const clipUrls = await Promise.all(
      (video.audio ?? []).map((clip) => presignedUrl(clip.pathname)),
    );
    const inputProps = reportVideoProps(report, video, (i) => clipUrls[i]!);
    if (!inputProps) throw new AbortTaskRunError("Nothing to render for this report");

    await ensureBrowser({
      onBrowserDownload: () => {
        logger.info("Downloading Chrome Headless Shell");
        return { version: null, onProgress: () => undefined };
      },
    });
    // No GPU on Linux workers: SwiftShader through ANGLE renders WebGL on CPU.
    const chromiumOptions = {
      gl: process.platform === "linux" ? ("swangle" as const) : ("angle" as const),
    };
    const composition = await selectComposition({
      serveUrl: SERVE_URL,
      id: COMPOSITION_ID,
      inputProps,
      chromiumOptions,
      logLevel: "warn",
    });

    const dir = await mkdtemp(path.join(os.tmpdir(), "video-"));
    const outputLocation = path.join(dir, "video.mp4");
    // Progress saves run one at a time, so a late one can't overwrite "ready".
    let saving = Promise.resolve();
    let lastSaved = 0;
    try {
      await renderMedia({
        composition,
        serveUrl: SERVE_URL,
        codec: "h264",
        inputProps,
        chromiumOptions,
        outputLocation,
        concurrency: 2,
        // Map tiles can be slow on a cold machine.
        timeoutInMilliseconds: 90_000,
        logLevel: "warn",
        onProgress: ({ progress }) => {
          if (progress - lastSaved < 0.1) return;
          lastSaved = progress;
          saving = saving
            .then(() => saveRender(reportId, { progress }))
            .then(() => undefined, () => undefined);
        },
      });
      await saving;
      const file = await readFile(outputLocation);
      logger.info("Rendered", {
        frames: composition.durationInFrames,
        megabytes: (file.length / 1e6).toFixed(1),
      });

      const latest = await getVideo(reportId);
      if (!latest || videoVersion(latest) !== version) {
        await saveRender(reportId, {
          status: "failed",
          error: "The script changed while exporting. Export again.",
        });
        return { rendered: false };
      }
      const previous = latest.render?.pathname ?? null;
      const pathname = await putVideoFile(reportId, fileName(inputProps.street), file);
      await saveRender(reportId, {
        status: "ready",
        progress: 1,
        pathname,
        sizeBytes: file.length,
        error: null,
        renderedAt: new Date().toISOString(),
      });
      if (previous && previous !== pathname) await deleteBlobs([previous]);
      return { rendered: true, bytes: file.length };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
  onFailure: async ({ payload, error }) => {
    if (!(await reportStore.findById(payload.reportId))) return;
    console.error("[report-video-render]", error);
    await saveRender(payload.reportId, {
      status: "failed",
      error: "The MP4 couldn't be exported. Try again shortly.",
    });
  },
});
