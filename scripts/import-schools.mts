// Imports Ontario's school dataset into the School table. In production this
// runs as the Trigger.dev task "import-ontario-schools" (src/trigger/datasets.ts).
//
//   npm run data:schools                 # download the latest published file
//   npm run data:schools -- ./sif.xlsx   # or use a local copy
//
// Source and yearly update notes: src/server/datasets/ontario-schools.ts.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import {
  DATA_YEAR,
  importOntarioSchools,
  SOURCE_URL,
} from "../src/server/datasets/ontario-schools";
import { db } from "../src/server/db";

const path = process.argv[2];
try {
  if (!path) console.log(`Downloading ${SOURCE_URL}`);
  const result = await importOntarioSchools(
    path ? await readFile(path) : undefined,
  );
  console.log(
    `Imported ${result.imported} schools (${DATA_YEAR}); skipped ${result.skipped} special, closed or unlocated schools.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
