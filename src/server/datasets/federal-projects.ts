// Federally funded infrastructure projects into FederalProject.
//
// Source: Housing, Infrastructure and Communities Canada, "Infrastructure
// Canada Projects" (Open Government Licence – Canada), updated weekly. It
// names each project's municipality but has no coordinates, so reports list
// these by municipality ("Federally funded projects in Saskatoon") instead of
// by distance.
//
// Kept: planned or underway, $5M or more in total eligible cost, in the
// categories a buyer notices (transit, roads and active transportation,
// recreation and culture, health care, schools and child care, community and
// emergency buildings), mapped to the report's project categories. Upkeep
// (same rule as Ontario Builds) and vehicle purchases are left out.
//
// Shared by `npm run data:projects:federal` and the Trigger.dev task (no
// "server-only" import).
import { X509Certificate } from "node:crypto";
import https from "node:https";
import tls from "node:tls";
import type { Prisma } from "../../generated/prisma/client";
import type { ProjectCategory } from "../../lib/report-sections";
import { db } from "../db";
import { MAINTENANCE } from "./ontario-builds";

export const FEDERAL_SOURCE = "Infrastructure Canada";
const FEED = "https://www.infrastructure.gc.ca/alt-format/opendata/project-list-liste-de-projets-bil.json";
const MIN_TOTAL_COST = 5_000_000;
/** Vehicle purchases: real transit spending, but not a place near a home. */
const FLEET =
  /\b(buses|bus fleet|fleet|subway cars|railcars|rolling stock|vehicles|bus electrification|zero[- ]emission bus(es)?|electric bus(es)?|BEB|battery[- ]electric)\b|\bacquisition of\b|\bprocurement of\b/i;

/**
 * The department's servers send their certificate without the intermediate
 * that signed it, so Node can't build the chain. The certificate's own
 * "CA Issuers" address publishes that intermediate: fetch it and connect
 * with the system roots plus it. The chain is still verified up to a trusted
 * root. If the department changes certificate authority, this throws and the
 * existing rows stay.
 */
const INTERMEDIATE_URL = "http://crt.sectigo.com/EntrustOVTLSIssuingRSACA2.crt";

async function intermediatePem() {
  const res = await fetch(INTERMEDIATE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Intermediate certificate: HTTP ${res.status}`);
  const cert = new X509Certificate(Buffer.from(await res.arrayBuffer()));
  if (!cert.ca) throw new Error("Intermediate certificate isn't a CA certificate");
  return cert.toString();
}

/** GET over HTTPS with `ca`, following up to 3 HTTPS redirects. */
function getText(url: string, ca: string[], redirects = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ca, timeout: 120_000 }, (res) => {
      const location = res.headers.location;
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location) {
        res.resume();
        const next = new URL(location, url);
        if (next.protocol !== "https:" || redirects === 0) {
          reject(new Error(`Infrastructure Canada projects: bad redirect to ${next}`));
          return;
        }
        resolve(getText(next.toString(), ca, redirects - 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Infrastructure Canada projects: HTTP ${res.statusCode}`));
        return;
      }
      res.setEncoding("utf8");
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error("Infrastructure Canada projects: timed out")));
    req.on("error", reject);
  });
}

const CATEGORIES: Record<string, ProjectCategory> = {
  "Public Transit": "Transit",
  "Highways and Roads": "Roads and bridges",
  "Active Transportation": "Roads and bridges",
  Recreation: "Recreation",
  Sport: "Recreation",
  Culture: "Recreation",
  "Healthcare Infrastructure": "Health care",
  "Education, Training and Childcare": "Education",
  "Administration, Emergency and Public Works": "Communities",
};

/**
 * Municipality name → matching key: lower case, no accents or punctuation,
 * without "City of", "Town of", "Ville de"… so "Ville de Québec" matches
 * "Québec" and "St. John's" matches "St Johns".
 */
export function municipalityKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /^(the\s+)?(city|town|village|municipality|district|county|regional municipality|rural municipality|rm|township|ville|municipalite)\s+(of|de|du|d')\s*/,
      "",
    )
    .replace(/\bsaint\b/g, "st")
    .replace(/\bsainte\b/g, "ste")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Moncton, Dieppe and Riverview" → three keys. */
const splitMunicipalities = (text: string) =>
  text
    .split(/[,;/]|\band\b|\bet\b/)
    .map((m) => municipalityKey(m))
    .filter(Boolean);

const year = (date: string) => date.match(/^(\d{4})/)?.[1] ?? null;

export async function importFederalProjects() {
  const ca = [...tls.rootCertificates, await intermediatePem()];
  const text = (await getText(FEED, ca)).replace(/^\uFEFF/, "");
  const json = JSON.parse(text) as { indexTitles: string[]; data: string[][] };
  if (!Array.isArray(json.indexTitles) || !Array.isArray(json.data)) {
    throw new Error("Infrastructure Canada projects: unexpected format");
  }
  const col = Object.fromEntries(json.indexTitles.map((t, i) => [t, i]));
  const get = (row: string[], key: string) => (row[col[key]] ?? "").trim();

  const today = new Date().toISOString().slice(0, 10);
  const projects: Prisma.FederalProjectCreateManyInput[] = [];
  for (const row of json.data) {
    const category = CATEGORIES[get(row, "category_en")];
    const title = get(row, "projectTitle_en").replace(/\s+/g, " ");
    const totalCost = Number(get(row, "totalEligibleCost")) || null;
    const ended = get(row, "constructionEndDate");
    const forecastEnd = get(row, "forecastedConstructionEndDate");
    const location = get(row, "location_en");
    if (
      !category ||
      !title ||
      !location ||
      // Finished, or forecast to have finished already.
      ended ||
      (forecastEnd && forecastEnd < today) ||
      (totalCost ?? 0) < MIN_TOTAL_COST ||
      MAINTENANCE.test(title) ||
      FLEET.test(title)
    ) {
      continue;
    }
    const started = get(row, "constructionStartDate");
    projects.push({
      id: get(row, "projectNumber"),
      title,
      // Child care is filed with schools; split it out.
      category: category === "Education" && /child ?care|daycare|early learning/i.test(title)
        ? "Child care"
        : category,
      program: get(row, "program_en") || null,
      status: started && started <= today ? "Under construction" : "Planning",
      targetCompletion: year(forecastEnd),
      municipalities: location,
      municipalityKeys: splitMunicipalities(location),
      province: get(row, "region").toUpperCase(),
      federalContribution: Number(get(row, "federalContribution")) || null,
      totalCost,
    });
  }
  if (projects.length === 0) {
    throw new Error("Infrastructure Canada projects: none kept; kept the existing data.");
  }

  await db.$transaction([
    db.federalProject.deleteMany(),
    db.federalProject.createMany({ data: projects, skipDuplicates: true }),
  ]);
  return { source: FEDERAL_SOURCE, projects: projects.length };
}
