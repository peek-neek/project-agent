// Refreshes the Phase 3 "upside" datasets. In production these run on
// Trigger.dev schedules (src/trigger/datasets.ts); use this locally.
//
//   npm run data:projects      # Ontario Builds infrastructure projects
//   npm run data:projects:ab   # Alberta Major Projects
//   npm run data:projects:bc   # BC Major Projects Inventory
//   npm run data:projects:federal  # Infrastructure Canada (by municipality)
//   npm run data:development   # City of Toronto development applications
import "dotenv/config";
import { importOntarioBuilds } from "../src/server/datasets/ontario-builds";
import {
  importAlbertaProjects,
  importBcProjects,
} from "../src/server/datasets/provincial-projects";
import { importFederalProjects } from "../src/server/datasets/federal-projects";
import { importTorontoDevelopment } from "../src/server/datasets/toronto-development";
import { db } from "../src/server/db";

const which = process.argv[2];
try {
  if (which === "projects") console.log(await importOntarioBuilds());
  else if (which === "projects-ab") console.log(await importAlbertaProjects());
  else if (which === "projects-bc") console.log(await importBcProjects());
  else if (which === "projects-federal") console.log(await importFederalProjects());
  else if (which === "development")
    console.log(await importTorontoDevelopment());
  else throw new Error('Usage: import-datasets.mts "projects" | "projects-ab" | "projects-bc" | "projects-federal" | "development"');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
