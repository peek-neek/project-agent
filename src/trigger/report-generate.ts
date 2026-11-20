import { batch, logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { reportStore } from "../server/report-store";
import { propertyIdentityTask } from "./property-identity";
import {
  aiInsightsTask,
  amenitiesTask,
  commuteTask,
  demographicsTask,
  safetyTask,
  schoolsTask,
  upsideTask,
} from "./report-steps";

/**
 * Builds a whole report: identity first (it provides the coordinates), then
 * the location steps in parallel, then the AI sections from all of it.
 * Each step records its own status, so the report UI shows progress.
 */
export const reportGenerateTask = schemaTask({
  id: "report-generate",
  description: "Generate every section of a property report",
  schema: z.object({
    reportId: z.string().uuid(),
    sessionToken: z.string().optional(),
  }),
  maxDuration: 900,
  retry: { maxAttempts: 1 },
  run: async ({ reportId, sessionToken }) => {
    const identity = await propertyIdentityTask.triggerAndWait({
      reportId,
      sessionToken,
    });
    if (!identity.ok) {
      logger.error("Identity failed; skipping location sections", { reportId });
      // Every other step needs the location: end them now with one clear
      // reason instead of leaving the report loading forever.
      await reportStore.failUnfinishedJobs(
        reportId,
        "Skipped: this address couldn't be located.",
      );
      return { identity: false };
    }

    const { runs } = await batch.triggerByTaskAndWait([
      { task: amenitiesTask, payload: { reportId } },
      { task: commuteTask, payload: { reportId } },
      { task: schoolsTask, payload: { reportId } },
      { task: demographicsTask, payload: { reportId } },
      { task: safetyTask, payload: { reportId } },
      { task: upsideTask, payload: { reportId } },
    ]);

    // The AI works with whatever location data succeeded.
    const ai = await aiInsightsTask.triggerAndWait({ reportId });

    return {
      identity: true,
      amenities: runs[0].ok,
      commute: runs[1].ok,
      schools: runs[2].ok,
      demographics: runs[3].ok,
      safety: runs[4].ok,
      upside: runs[5].ok,
      ai: ai.ok,
    };
  },
});
