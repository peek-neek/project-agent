import "server-only";

import { idempotencyKeys, runs, tasks } from "@trigger.dev/sdk";
import { JOB_KINDS, type JobKind } from "@/lib/report-sections";
import type { propertyIdentityTask } from "@/trigger/property-identity";
import type { reportGenerateTask } from "@/trigger/report-generate";
import type {
  aiInsightsTask,
  amenitiesTask,
  commuteTask,
  demographicsTask,
  safetyTask,
  schoolsTask,
  upsideTask,
} from "@/trigger/report-steps";
import type { TravelMode } from "@/lib/travel";
import { type VideoSection, videoVersion } from "@/lib/video";
import type { reportVideoTask } from "@/trigger/report-video";
import type { reportVideoRenderTask } from "@/trigger/report-video-render";
import { reportStore } from "./report-store";
import { saveRender, saveVideo } from "./video-store";

type StepTask =
  | typeof propertyIdentityTask
  | typeof amenitiesTask
  | typeof commuteTask
  | typeof schoolsTask
  | typeof demographicsTask
  | typeof safetyTask
  | typeof upsideTask
  | typeof aiInsightsTask;

const NOT_CONFIGURED =
  "Background jobs aren't configured (TRIGGER_SECRET_KEY is missing).";

async function markQueued(
  reportId: string,
  kinds: JobKind[],
  runId: string | null,
) {
  await Promise.all(
    kinds.map((kind) =>
      reportStore.updateJob(reportId, kind, {
        status: "queued",
        triggerRunId: runId,
        error: null,
        startedAt: null,
        finishedAt: null,
      }),
    ),
  );
}

async function markFailed(reportId: string, kinds: JobKind[], error: string) {
  await Promise.all(
    kinds.map((kind) =>
      reportStore.updateJob(reportId, kind, { status: "failed", error }),
    ),
  );
}

/** Starts the full pipeline for a new report. */
export async function queueReportGeneration(
  reportId: string,
  { sessionToken }: { sessionToken?: string } = {},
) {
  const kinds = Object.values(JOB_KINDS);
  if (!process.env.TRIGGER_SECRET_KEY) {
    await markFailed(reportId, kinds, NOT_CONFIGURED);
    return null;
  }
  try {
    const idempotencyKey = await idempotencyKeys.create(
      `report-generate:${reportId}`,
      { scope: "global" },
    );
    const handle = await tasks.trigger<typeof reportGenerateTask>(
      "report-generate",
      { reportId, sessionToken },
      { idempotencyKey, tags: [`report:${reportId}`] },
    );
    await markQueued(reportId, kinds, handle.id);
    return handle.id;
  } catch (error) {
    console.error("[jobs.queueReportGeneration]", error);
    await markFailed(
      reportId,
      kinds,
      "Couldn't start the report. Try again shortly.",
    );
    return null;
  }
}

/** Re-runs one step (a failed section, or regenerating the AI copy). */
export async function queueReportJob(reportId: string, kind: JobKind) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    await markFailed(reportId, [kind], NOT_CONFIGURED);
    return null;
  }
  try {
    const idempotencyKey = await idempotencyKeys.create(
      `${kind}:${reportId}:${Date.now()}`,
      { scope: "global" },
    );
    const options = { idempotencyKey, tags: [`report:${reportId}`] };
    // Every step task's id is its job kind and takes { reportId }.
    const handle = await tasks.trigger<StepTask>(kind, { reportId }, options);
    await markQueued(reportId, [kind], handle.id);
    return handle.id;
  } catch (error) {
    console.error("[jobs.queueReportJob]", error);
    await markFailed(
      reportId,
      [kind],
      "Couldn't start the job. Try again shortly.",
    );
    return null;
  }
}

/**
 * Writes (or rewrites) the report's map video. Its progress lives in the
 * "video" section, not a ReportJob, so it never counts as a report step.
 */
export async function queueReportVideo(reportId: string, travelMode: TravelMode) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    await saveVideo(reportId, { status: "failed", travelMode, error: NOT_CONFIGURED });
    return null;
  }
  try {
    await saveVideo(reportId, { status: "writing", travelMode, error: null });
    const idempotencyKey = await idempotencyKeys.create(
      `report-video:${reportId}:${Date.now()}`,
      { scope: "global" },
    );
    const handle = await tasks.trigger<typeof reportVideoTask>(
      "report-video",
      { reportId, travelMode },
      { idempotencyKey, tags: [`report:${reportId}`] },
    );
    return handle.id;
  } catch (error) {
    console.error("[jobs.queueReportVideo]", error);
    await saveVideo(reportId, {
      status: "failed",
      error: "Couldn't start the video. Try again shortly.",
    });
    return null;
  }
}

/**
 * Exports the video's current script to an MP4. The render keeps the
 * previous file's pathname until it finishes, so that file can be deleted.
 */
export async function queueVideoRender(reportId: string, video: VideoSection) {
  const version = videoVersion(video);
  if (!process.env.TRIGGER_SECRET_KEY) {
    await saveRender(reportId, { status: "failed", version, error: NOT_CONFIGURED });
    return null;
  }
  try {
    await saveRender(reportId, {
      status: "rendering",
      version,
      progress: 0,
      error: null,
      startedAt: new Date().toISOString(),
      renderedAt: null,
    });
    const idempotencyKey = await idempotencyKeys.create(
      `report-video-render:${reportId}:${version}:${Date.now()}`,
      { scope: "global" },
    );
    const handle = await tasks.trigger<typeof reportVideoRenderTask>(
      "report-video-render",
      { reportId, version },
      { idempotencyKey, tags: [`report:${reportId}`] },
    );
    return handle.id;
  } catch (error) {
    console.error("[jobs.queueVideoRender]", error);
    await saveRender(reportId, {
      status: "failed",
      error: "Couldn't start the export. Try again shortly.",
    });
    return null;
  }
}

/**
 * Best-effort cancel of a report's queued or running background runs, before
 * the report is deleted. Steps that still start will stop on their own (see
 * runReportJob), so failures here are logged, not thrown.
 */
export async function cancelReportRuns(
  jobs: { status: string; triggerRunId: string | null }[],
) {
  if (!process.env.TRIGGER_SECRET_KEY) return;
  const runIds = new Set(
    jobs
      .filter((j) => j.status === "queued" || j.status === "running")
      .map((j) => j.triggerRunId)
      .filter((id): id is string => Boolean(id)),
  );
  await Promise.all(
    [...runIds].map((id) =>
      runs.cancel(id).catch((error) => {
        console.warn("[jobs.cancelReportRuns]", id, error);
      }),
    ),
  );
}
