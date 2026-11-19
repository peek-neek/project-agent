import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { JOB_KINDS } from "../lib/report-sections";
import { extractAiInsights } from "../server/extractors/ai-insights";
import { extractAmenities } from "../server/extractors/amenities";
import { extractCommute } from "../server/extractors/commute";
import { extractDemographics } from "../server/extractors/demographics";
import { extractSafety } from "../server/extractors/safety";
import { extractSchools } from "../server/extractors/schools";
import { extractUpside } from "../server/extractors/upside";
import { markReportJobFailed, runReportJob } from "../server/job-runner";

const payload = z.object({ reportId: z.string().uuid() });

export const amenitiesTask = schemaTask({
  id: JOB_KINDS.amenities,
  description: "Find nearby amenities by category with walking times",
  schema: payload,
  maxDuration: 120,
  retry: { maxAttempts: 3 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.amenities, () =>
      extractAmenities(reportId),
    );
    logger.info("Amenities extracted", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.amenities, error),
});

export const commuteTask = schemaTask({
  id: JOB_KINDS.commute,
  description: "Commute times to key destinations and nearby transit",
  schema: payload,
  maxDuration: 120,
  retry: { maxAttempts: 3 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.commute, () =>
      extractCommute(reportId),
    );
    logger.info("Commute extracted", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.commute, error),
});

export const schoolsTask = schemaTask({
  id: JOB_KINDS.schools,
  description: "Nearest schools in each system, with EQAO results",
  schema: payload,
  maxDuration: 120,
  retry: { maxAttempts: 3 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.schools, () =>
      extractSchools(reportId),
    );
    logger.info("Schools extracted", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.schools, error),
});

export const demographicsTask = schemaTask({
  id: JOB_KINDS.demographics,
  description: "Census profile of the neighbourhood compared with the city",
  schema: payload,
  maxDuration: 180,
  retry: { maxAttempts: 3 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.demographics, () =>
      extractDemographics(reportId),
    );
    logger.info("Demographics extracted", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.demographics, error),
});

export const safetyTask = schemaTask({
  id: JOB_KINDS.safety,
  description: "Crime rates, flood regulation, noise sources and air quality",
  schema: payload,
  maxDuration: 120,
  retry: { maxAttempts: 3 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.safety, () =>
      extractSafety(reportId),
    );
    logger.info("Safety & environment extracted", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.safety, error),
});

export const upsideTask = schemaTask({
  id: JOB_KINDS.upside,
  description: "Infrastructure projects and development applications nearby",
  schema: payload,
  maxDuration: 60,
  retry: { maxAttempts: 3 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.upside, () =>
      extractUpside(reportId),
    );
    logger.info("Upside extracted", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.upside, error),
});

export const aiInsightsTask = schemaTask({
  id: JOB_KINDS.ai,
  description:
    "Write the neighbourhood story, marketing kit and agent playbook",
  schema: payload,
  // Up to two parallel calls, each falling back through three providers.
  maxDuration: 420,
  retry: { maxAttempts: 2 },
  run: async ({ reportId }) => {
    const result = await runReportJob(reportId, JOB_KINDS.ai, () =>
      extractAiInsights(reportId),
    );
    logger.info("AI insights generated", result);
    return result;
  },
  onFailure: async ({ payload, error }) =>
    markReportJobFailed(payload.reportId, JOB_KINDS.ai, error),
});
