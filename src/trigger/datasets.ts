import { logger, schedules } from "@trigger.dev/sdk";
import { importOntarioBuilds } from "../server/datasets/ontario-builds";
import { importTorontoDevelopment } from "../server/datasets/toronto-development";

/** The City publishes development applications daily. */
export const refreshTorontoDevelopment = schedules.task({
  id: "refresh-toronto-development",
  cron: { pattern: "30 6 * * *", timezone: "America/Toronto" },
  maxDuration: 300,
  retry: { maxAttempts: 3 },
  run: async () => {
    const result = await importTorontoDevelopment();
    logger.info("Toronto development applications refreshed", result);
    return result;
  },
});

/** Ontario Builds is updated every few weeks; check weekly. */
export const refreshOntarioBuilds = schedules.task({
  id: "refresh-ontario-builds",
  cron: { pattern: "0 6 * * 1", timezone: "America/Toronto" },
  maxDuration: 300,
  retry: { maxAttempts: 3 },
  run: async () => {
    const result = await importOntarioBuilds();
    logger.info("Ontario Builds projects refreshed", result);
    return result;
  },
});
