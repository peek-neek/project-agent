import { logger, schedules } from "@trigger.dev/sdk";
import { importOntarioBuilds } from "../server/datasets/ontario-builds";
import { importCanadaSchools } from "../server/datasets/canada-schools";
import { importOntarioSchools } from "../server/datasets/ontario-schools";
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

/**
 * Ontario schools and EQAO results. The ministry publishes once a year
 * (usually in the fall), so check monthly; run it from the dashboard to load
 * a new database. Re-importing the same file just rewrites the same rows.
 */
export const importOntarioSchoolsTask = schedules.task({
  id: "import-ontario-schools",
  cron: { pattern: "0 5 1 * *", timezone: "America/Toronto" },
  maxDuration: 300,
  retry: { maxAttempts: 3 },
  run: async () => {
    const result = await importOntarioSchools();
    logger.info("Ontario schools imported", result);
    return result;
  },
});

/**
 * Public schools outside Ontario (Statistics Canada). The source is an
 * archived snapshot, but schools without coordinates are placed with Google
 * Geocoding, whose results may only be kept 30 days: so this runs monthly.
 */
export const importCanadaSchoolsTask = schedules.task({
  id: "import-canada-schools",
  cron: { pattern: "0 5 2 * *", timezone: "America/Toronto" },
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async () => {
    const result = await importCanadaSchools();
    logger.info("Canada schools imported", result);
    return result;
  },
});
