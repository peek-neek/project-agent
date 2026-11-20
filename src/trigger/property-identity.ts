import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  ADDRESS_NOT_FOUND,
  ADDRESS_OUTSIDE_ONTARIO,
  extractPropertyIdentity,
} from "../server/extractors/property-identity";
import { PROPERTY_IDENTITY_JOB, reportStore } from "../server/report-store";

/** Messages written for the agent; any other error gets a generic one. */
const AGENT_MESSAGES = [ADDRESS_NOT_FOUND, ADDRESS_OUTSIDE_ONTARIO];
const messageOf = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : String(error);

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
      // Our own messages are written for the agent; anything else isn't.
      error: AGENT_MESSAGES.includes(messageOf(error))
        ? messageOf(error)
        : "We couldn't look up this address right now. Try again in a minute.",
    });
  },
});
