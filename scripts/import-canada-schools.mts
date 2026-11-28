// Imports public K–12 schools outside Ontario into CanadaSchool. In
// production this runs as the Trigger.dev task "import-canada-schools"
// (src/trigger/datasets.ts).
//
//   npm run data:canada-schools
//
// Source and notes: src/server/datasets/canada-schools.ts.
import "dotenv/config";
import { importCanadaSchools, SOURCE_URL } from "../src/server/datasets/canada-schools";
import { db } from "../src/server/db";

try {
  console.log(`Downloading ${SOURCE_URL}`);
  console.log(await importCanadaSchools());
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
