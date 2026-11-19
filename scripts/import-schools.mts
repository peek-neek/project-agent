// Imports Ontario's school dataset into the School table.
//
//   npm run data:schools                 # download the latest published file
//   npm run data:schools -- ./sif.xlsx   # or use a local copy
//
// Source: Ontario Ministry of Education, "School information and student
// demographics" (Open Government Licence – Ontario). Updated yearly; re-run
// when a new school year is published and update SOURCE_URL / DATA_YEAR.
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { readSheet } from "read-excel-file/node";
import type { Prisma } from "../src/generated/prisma/client";
import { db } from "../src/server/db";

const SOURCE_URL =
  "https://data.ontario.ca/dataset/d85f68c5-fcb0-4b4d-aec5-3047db47dcd5/resource/f75540ed-59eb-49ab-ac43-976d563b3a65/download/new_sif_data_2024_25_final_en_oct_2026.xlsx";
const DATA_YEAR = "2024-25";

/** Regular schools only: no adult, online, alternative or provincial schools. */
const INCLUDED_TYPES = new Set(["Public", "Catholic"]);
const INCLUDED_CONDITIONS = new Set(["Not applicable", "Junior High School"]);

const COLUMNS = {
  boardName: "Board Name",
  id: "School Number",
  name: "School Name",
  type: "School Type",
  condition: "School Special Condition Code",
  level: "School Level",
  language: "School Language",
  gradeRange: "Grade Range",
  street: "Street",
  city: "City",
  postalCode: "Postal Code",
  phone: "Phone Number",
  website: "School Website",
  boardWebsite: "Board Website",
  enrolment: "Enrolment",
  latitude: "Latitude",
  longitude: "Longitude",
  g3Reading:
    "Percentage of Grade 3 Students Achieving the Provincial Standard in Reading",
  g3Writing:
    "Percentage of Grade 3 Students Achieving the Provincial Standard in Writing",
  g3Math:
    "Percentage of Grade 3 Students Achieving the Provincial Standard in Mathematics",
  g6Reading:
    "Percentage of Grade 6 Students Achieving the Provincial Standard in Reading",
  g6Writing:
    "Percentage of Grade 6 Students Achieving the Provincial Standard in Writing",
  g6Math:
    "Percentage of Grade 6 Students Achieving the Provincial Standard in Mathematics",
  g9Math:
    "Percentage of Grade 9 Students Achieving the Provincial Standard in Mathematics",
  osslt:
    "Percentage of Students That Passed the Grade 10 OSSLT on Their First Attempt",
} as const;

type Cell = string | number | boolean | Date | null;

const text = (v: Cell) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "None" || s === "NA" ? null : s;
};

/** "78%" → 78; "NA", "N/R" (not reported), "N/D" (no data) → null. */
const percent = (v: Cell) => {
  if (typeof v === "number") return Math.round(v <= 1 ? v * 100 : v);
  const match = text(v)?.match(/^(\d+(?:\.\d+)?)%$/);
  return match ? Math.round(Number(match[1])) : null;
};

const integer = (v: Cell) => {
  const n = typeof v === "number" ? v : Number(text(v));
  return Number.isFinite(n) ? Math.round(n) : null;
};

const website = (v: Cell) => {
  const s = text(v);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

async function loadWorkbook(path?: string) {
  if (path) return readFile(path);
  console.log(`Downloading ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const rows = (await readSheet(
    await loadWorkbook(process.argv[2]),
  )) as Cell[][];
  const header = rows[0].map((h) => String(h ?? "").trim());
  const index = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, title]) => {
      const i = header.indexOf(title);
      if (i === -1) throw new Error(`Column not found: "${title}"`);
      return [key, i];
    }),
  ) as Record<keyof typeof COLUMNS, number>;

  const schools: Prisma.SchoolCreateManyInput[] = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const get = (key: keyof typeof COLUMNS) => row[index[key]] ?? null;
    const id = text(get("id"));
    const name = text(get("name"));
    const type = text(get("type"));
    const level = text(get("level"));
    const language = text(get("language"));
    const latitude = Number(get("latitude"));
    const longitude = Number(get("longitude"));
    if (
      !id ||
      !name ||
      !type ||
      !level ||
      !language ||
      !INCLUDED_TYPES.has(type) ||
      !INCLUDED_CONDITIONS.has(text(get("condition")) ?? "") ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude === 0
    ) {
      skipped++;
      continue;
    }
    schools.push({
      id,
      name,
      boardName: text(get("boardName")) ?? "",
      boardWebsite: website(get("boardWebsite")),
      type,
      level,
      language,
      gradeRange: text(get("gradeRange")),
      street: text(get("street")),
      city: text(get("city")),
      postalCode: text(get("postalCode")),
      phone: text(get("phone")),
      website: website(get("website")),
      enrolment: integer(get("enrolment")),
      latitude,
      longitude,
      g3Reading: percent(get("g3Reading")),
      g3Writing: percent(get("g3Writing")),
      g3Math: percent(get("g3Math")),
      g6Reading: percent(get("g6Reading")),
      g6Writing: percent(get("g6Writing")),
      g6Math: percent(get("g6Math")),
      g9Math: percent(get("g9Math")),
      osslt: percent(get("osslt")),
      dataYear: DATA_YEAR,
    });
  }

  await db.$transaction([
    db.school.deleteMany(),
    db.school.createMany({ data: schools }),
  ]);
  console.log(
    `Imported ${schools.length} schools (${DATA_YEAR}); skipped ${skipped} special, closed or unlocated schools.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
