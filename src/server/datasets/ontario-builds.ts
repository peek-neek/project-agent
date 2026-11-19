// Ontario Builds: provincial infrastructure projects (Open Government
// Licence – Ontario). Keeps projects in planning or under construction.
import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import { parseCsvRecords } from "../csv";
import { db } from "../db";

const PACKAGE_URL =
  "https://data.ontario.ca/api/3/action/package_show?id=ontario-builds-key-infrastructure-projects";
const ACTIVE = new Set(["Planning", "Under construction"]);
/**
 * Repairs and upkeep at existing sites (renewal-fund grants, waterproofing,
 * upgrades, servicing): real work, but not something that changes what a
 * buyer gets nearby, so it's left out.
 */
const MAINTENANCE =
  /\b(?:HIRF|CIRF)\b|\bgrant\b|waterproof|remediation|\brepairs?\b|\bupgrades?\b|\brenewal\b|\breplacement\b|\bservicing\b|\bretrofit|\brehabilitation\b|\bAODA\b|\bparking\b/i;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "27-Mar" → "Mar 2027"; "2028-2029" → "2028–2029"; TBD → null. */
export function normalizeCompletion(value: string) {
  const v = value.trim();
  if (!v || /determined|tbd/i.test(v)) return null;
  let m = v.match(/^(\d{2})-([A-Za-z]{3})$/);
  if (m && MONTHS.includes(m[2])) return `${m[2]} 20${m[1]}`;
  m = v.match(/^([A-Za-z]{3})-(\d{2})$/);
  if (m && MONTHS.includes(m[1])) return `${m[1]} 20${m[2]}`;
  m = v.match(/^(\d{4})\s*-\s*(\d{4})$/);
  if (m) return `${m[1]}–${m[2]}`;
  return v;
}

/** The "all projects" CSV, found via the dataset's CKAN metadata. */
async function latestCsvUrl() {
  const res = await fetch(PACKAGE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Ontario Builds metadata: HTTP ${res.status}`);
  const pkg = (await res.json()) as {
    result: { resources: { url: string; format: string }[] };
  };
  const url = pkg.result.resources.find(
    (r) => r.format === "CSV" && /ontbuilds-all-\d+\.csv$/.test(r.url),
  )?.url;
  if (!url) throw new Error("Ontario Builds: all-projects CSV not found");
  return url;
}

export async function importOntarioBuilds() {
  const url = await latestCsvUrl();
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Ontario Builds CSV: HTTP ${res.status}`);
  const records = parseCsvRecords(await res.text());

  const seen = new Set<string>();
  const projects: Prisma.InfrastructureProjectCreateManyInput[] = [];
  for (const r of records) {
    // Some rows list several points ("43.1|43.2"); the first is the site.
    const latitude = Number(r["Latitude"]?.split("|")[0]);
    const longitude = Number(r["Longitude"]?.split("|")[0]);
    if (
      !ACTIVE.has(r["Status"]) ||
      !r["Project"] ||
      MAINTENANCE.test(r["Project"]) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude === 0
    ) {
      continue;
    }
    const id = createHash("sha1")
      .update(`${r["Project"]}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`)
      .digest("hex")
      .slice(0, 24);
    if (seen.has(id)) continue;
    seen.add(id);
    const budget = Number(r["Estimated Total Budget ($)"]);
    projects.push({
      id,
      category: r["Category"] || "Other",
      name: r["Project"].replace(/\s+/g, " ").trim(),
      status: r["Status"],
      targetCompletion: normalizeCompletion(r["Target Completion Date"] ?? ""),
      community: r["Community"] || null,
      address: r["Address"]?.trim() || null,
      transitLine: r["Highway / Transit Line"] || null,
      budget: Number.isFinite(budget) && budget > 0 ? budget : null,
      website: r["Website"] || null,
      description: r["Description"]?.replace(/\s+/g, " ").trim() || null,
      latitude,
      longitude,
    });
  }

  await db.$transaction([
    db.infrastructureProject.deleteMany(),
    db.infrastructureProject.createMany({ data: projects }),
  ]);
  return { source: url, projects: projects.length };
}
