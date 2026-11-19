import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { extractPropertyIdentity } from "../server/extractors/property-identity";
import { PROPERTY_IDENTITY_JOB, reportStore } from "../server/report-store";

export const propertyIdentityTask = schemaTask({
  id: PROPERTY_IDENTITY_JOB,
  description: "Resolve the report address and store its identification fields",
  schema: z.object({
    reportId: z.string().uuid(),
    sessionToken: z.string().optional(),
  }),
  maxDuration: 120,
  retry: { maxAttempts: 3 },
  run: async (payload) => {
    const result = await extractPropertyIdentity(payload);
    logger.info("Property identity extracted", { ...result, ...payload });
    return result;
  },
  onFailure: async ({ payload, error }) => {
    if (!(await reportStore.findById(payload.reportId))) return; // deleted
    await reportStore.updateJob(payload.reportId, PROPERTY_IDENTITY_JOB, {
      status: "failed",
      finishedAt: new Date(),
      error: error instanceof Error ? error.message : String(error),
    });
  },
});
