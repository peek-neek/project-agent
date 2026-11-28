// City of Toronto development applications (Open Government Licence –
// Toronto). One row per application; coordinates converted from MTM 10.
import proj4 from "proj4";
import type { Prisma } from "../../generated/prisma/client";
import { parseCsvRecords } from "../csv";
import { db } from "../db";
import { BULK_TRANSACTION, chunks } from "./bulk";

const DUMP_URL =
  "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/8907d8ed-c515-4ce9-b674-9f8c6eefcf0d";

// NAD27 / MTM zone 10. Checked against Google geocodes: within a few metres
// (the NAD83 variant lands ~225 m off).
const MTM10_NAD27 =
  "+proj=tmerc +lat_0=0 +lon_0=-79.5 +k=0.9999 +x_0=304800 +y_0=0 +ellps=clrk66 +towgs84=-10,158,187 +units=m +no_defs";
const toWgs84 = proj4(MTM10_NAD27, "WGS84");

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());

export { parseStoreys, parseUnits } from "./parse-development";
import { parseStoreys, parseUnits } from "./parse-development";

export async function importTorontoDevelopment() {
  const res = await fetch(DUMP_URL, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok)
    throw new Error(`Toronto development applications: HTTP ${res.status}`);
  const records = parseCsvRecords(await res.text());

  // Several rows per application (one per address); keep the first located one.
  const byApplication = new Map<
    string,
    Prisma.DevelopmentApplicationCreateManyInput
  >();
  for (const r of records) {
    const id = r["APPLICATION#"];
    const x = Number(r["X"]);
    const y = Number(r["Y"]);
    if (!id || byApplication.has(id) || !x || !y) continue;
    const [longitude, latitude] = toWgs84.forward([x, y]);
    const description = r["DESCRIPTION"]?.replace(/\s+/g, " ").trim() || null;
    const street = [
      r["STREET_NUM"],
      r["STREET_NAME"],
      r["STREET_TYPE"],
      r["STREET_DIRECTION"],
    ]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(" ");
    const submitted = r["DATE_SUBMITTED"]
      ? new Date(r["DATE_SUBMITTED"])
      : null;
    byApplication.set(id, {
      id,
      type: r["APPLICATION_TYPE"],
      status: r["STATUS"].trim(),
      submittedAt:
        submitted && !Number.isNaN(submitted.getTime()) ? submitted : null,
      address: titleCase(street),
      description,
      url: r["APPLICATION_URL"] || null,
      units: description ? parseUnits(description) : null,
      storeys: description ? parseStoreys(description) : null,
      latitude,
      longitude,
    });
  }

  const applications = [...byApplication.values()];
  await db.$transaction(
    async (tx) => {
      await tx.developmentApplication.deleteMany();
      // In slices: one huge INSERT needs too much memory on a small machine.
      for (const slice of chunks(applications)) {
        await tx.developmentApplication.createMany({ data: slice });
      }
    },
    BULK_TRANSACTION,
  );
  return { applications: applications.length };
}
