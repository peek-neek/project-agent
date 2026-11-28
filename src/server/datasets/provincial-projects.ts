// Public infrastructure projects outside Ontario, into InfrastructureProject
// alongside Ontario Builds (each source replaces only its own rows):
//
// - Alberta: the Government of Alberta's Major Projects site
//   (majorprojects.alberta.ca), from the GeoJSON its map loads. The open-data
//   copy on open.alberta.ca stopped being maintained around 2016, so it isn't
//   used. The feed isn't a documented API: if its shape changes, the import
//   throws and the previous rows stay.
// - British Columbia: the BC Major Projects Inventory map layer (BC
//   Geographic Warehouse). Its records were last updated in December 2024,
//   so the source label says so.
//
// Only what Ontario Builds covers is kept (transit, roads, schools, health
// care, recreation and community buildings, planned or underway), mapped to
// the same categories. Private condos, offices and industry belong with
// development applications; utilities, airports and power aren't listed.
//
// Shared by `npm run data:projects:*` and the Trigger.dev tasks (no
// "server-only" import).
import { createHash } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";
import type { ProjectCategory } from "../../lib/report-sections";
import { db } from "../db";
import { BULK_TRANSACTION, chunks } from "./bulk";
import { MAINTENANCE } from "./ontario-builds";

export const ALBERTA_SOURCE = "Alberta Major Projects";
export const BC_SOURCE = "BC Major Projects Inventory (Dec 2024)";

const ALBERTA_FEED = "https://majorprojects.alberta.ca/api/MajorProjects?years=1";
const BC_LAYER =
  "https://delivery.maps.gov.bc.ca/arcgis/rest/services/whse/bcgw_pub_whse_human_cultural_economic/MapServer/13";

const TRANSIT_NAME = /\b(transit|LRT|SkyTrain|rapid bus|BRT|subway|light rail|station|bus loop|bus exchange)\b/i;

const projectId = (source: string, name: string, lat: number, lng: number) =>
  createHash("sha1")
    .update(`${source}|${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`)
    .digest("hex")
    .slice(0, 24);

async function replaceSource(source: string, projects: Prisma.InfrastructureProjectCreateManyInput[]) {
  if (projects.length === 0) {
    throw new Error(`${source}: no projects found; kept the existing data.`);
  }
  await db.$transaction(
    async (tx) => {
      await tx.infrastructureProject.deleteMany({ where: { source } });
      // In slices: one huge INSERT needs too much memory on a small machine.
      for (const slice of chunks(projects)) {
        await tx.infrastructureProject.createMany({ data: slice });
      }
    },
    BULK_TRANSACTION,
  );
  return { source, projects: projects.length };
}

// --- Alberta ---------------------------------------------------------------

/** Alberta's project types → report categories (others are left out). */
const ALBERTA_TYPES: Record<string, ProjectCategory> = {
  Roadwork: "Roads and bridges",
  "Pedestrian Bridge": "Roads and bridges",
  Transit: "Transit",
  School: "Education",
  "Post-Secondary": "Education",
  "Health Care": "Health care",
  "Continuing Care": "Health care",
  "Sports Facility": "Recreation",
  Park: "Recreation",
  "Community Centre": "Recreation",
  "Arts and Culture": "Recreation",
  Library: "Communities",
  "Emergency Services": "Communities",
  "Court/Justice": "Communities",
};
const ALBERTA_STAGES: Record<string, string> = {
  Proposed: "Planning",
  "Under Construction": "Under construction",
};

type AlbertaFeature = {
  properties: {
    id: number;
    name: string;
    sector: string;
    type: string;
    stage: string;
    schedule: string | null;
    scheduleEnd: string | null;
    cost: number | null;
    municipalities: string[] | null;
    website: string | null;
  };
  geometry: Geometry | null;
};

type Geometry =
  | { type: "Point"; coordinates: number[] }
  | { type: "LineString"; coordinates: number[][] }
  | { type: "MultiLineString"; coordinates: number[][][] }
  | { type: "GeometryCollection"; geometries: Geometry[] }
  | { type: string };

/**
 * One [lng, lat] for a project: a point as is, the first point of a
 * collection, or a line's middle vertex (roadwork is drawn as lines).
 */
function representativePoint(g: Geometry | null | undefined): number[] | null {
  if (!g) return null;
  if (g.type === "Point" && "coordinates" in g) return g.coordinates as number[];
  if (g.type === "LineString" && "coordinates" in g) {
    const line = g.coordinates as number[][];
    return line[Math.floor(line.length / 2)] ?? null;
  }
  if (g.type === "MultiLineString" && "coordinates" in g) {
    const line = (g.coordinates as number[][][])[0] ?? [];
    return line[Math.floor(line.length / 2)] ?? null;
  }
  if (g.type === "GeometryCollection" && "geometries" in g) {
    for (const part of g.geometries) {
      const point = representativePoint(part);
      if (point) return point;
    }
  }
  return null;
}

export async function importAlbertaProjects() {
  const res = await fetch(ALBERTA_FEED, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Alberta Major Projects: HTTP ${res.status}`);
  const features = (await res.json()) as AlbertaFeature[];
  if (!Array.isArray(features) || !features[0]?.properties) {
    throw new Error("Alberta Major Projects: unexpected feed format");
  }

  const projects: Prisma.InfrastructureProjectCreateManyInput[] = [];
  const seen = new Set<string>();
  for (const { properties: p, geometry } of features) {
    let category = ALBERTA_TYPES[p.type];
    const status = ALBERTA_STAGES[p.stage];
    const [longitude, latitude] = representativePoint(geometry) ?? [];
    if (
      !category ||
      !status ||
      !p.name ||
      // Upkeep (repaving, repairs, replacements): same rule as Ontario Builds.
      MAINTENANCE.test(p.name) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    // Transit work filed as roadwork (e.g. an LRT extension).
    if (category === "Roads and bridges" && TRANSIT_NAME.test(p.name)) category = "Transit";
    const name = p.name.replace(/\s+/g, " ").trim();
    const id = projectId(ALBERTA_SOURCE, name, latitude, longitude);
    if (seen.has(id)) continue;
    seen.add(id);
    projects.push({
      id,
      source: ALBERTA_SOURCE,
      category,
      name,
      status,
      targetCompletion: p.scheduleEnd?.trim() || null,
      community: p.municipalities?.join(", ") || null,
      address: null,
      transitLine: null,
      // Costs are in millions of dollars.
      budget: p.cost && p.cost > 0 ? p.cost * 1_000_000 : null,
      website:
        p.website?.trim() ||
        `https://majorprojects.alberta.ca/details/${encodeURIComponent(String(p.id))}`,
      description: null,
      latitude,
      longitude,
    });
  }
  return replaceSource(ALBERTA_SOURCE, projects);
}

// --- British Columbia ------------------------------------------------------

const BC_STATUSES: Record<string, string> = {
  Proposed: "Planning",
  "Construction started": "Under construction",
};

type BcAttrs = {
  PROJECT_ID: number;
  PROJECT_NAME: string;
  PROJECT_DESCRIPTION: string | null;
  CONSTRUCTION_TYPE: string;
  CONSTRUCTION_SUBTYPE: string;
  PROJECT_STATUS: string;
  ESTIMATED_COST: number | null;
  STANDARDIZED_COMPLETION_DATE: string | null;
  MUNICIPALITY: string | null;
  PUBLIC_FUNDING_IND: string | null;
  PROJECT_WEBSITE: string | null;
  LATITUDE: number;
  LONGITUDE: number;
};

function bcCategory(a: BcAttrs): ProjectCategory | null {
  const text = `${a.PROJECT_NAME} ${a.PROJECT_DESCRIPTION ?? ""}`;
  if (TRANSIT_NAME.test(a.PROJECT_NAME)) return "Transit";
  switch (a.CONSTRUCTION_SUBTYPE) {
    case "Health":
      return "Health care";
    case "Education":
      // Private universities bundled with housing ("University and
      // Residential Community") aren't public schools.
      return /residential community/i.test(text) ? null : "Education";
    case "Roads & Highways":
      return "Roads and bridges";
    case "Government buildings":
      return "Communities";
    case "Recreation":
      // Commercial recreation (resorts, golf) only when publicly funded.
      return a.PUBLIC_FUNDING_IND === "TRUE" ? "Recreation" : null;
    default:
      return null;
  }
}

/** "2027-Q4" → "Q4 2027". */
const quarter = (v: string | null) => {
  const m = v?.match(/^(\d{4})-Q([1-4])$/);
  return m ? `Q${m[2]} ${m[1]}` : v?.trim() || null;
};

export async function importBcProjects() {
  const body = new URLSearchParams({
    f: "json",
    where: "PROJECT_STATUS IN ('Proposed','Construction started')",
    outFields: [
      "PROJECT_ID",
      "PROJECT_NAME",
      "PROJECT_DESCRIPTION",
      "CONSTRUCTION_TYPE",
      "CONSTRUCTION_SUBTYPE",
      "PROJECT_STATUS",
      "ESTIMATED_COST",
      "STANDARDIZED_COMPLETION_DATE",
      "MUNICIPALITY",
      "PUBLIC_FUNDING_IND",
      "PROJECT_WEBSITE",
      "LATITUDE",
      "LONGITUDE",
    ].join(","),
    returnGeometry: "false",
    resultRecordCount: "2000",
  });
  const res = await fetch(`${BC_LAYER}/query`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`BC Major Projects: HTTP ${res.status}`);
  const json = (await res.json()) as {
    features?: { attributes: BcAttrs }[];
    error?: { message?: string };
  };
  if (json.error || !json.features) {
    throw new Error(`BC Major Projects: ${json.error?.message ?? "query failed"}`);
  }

  const projects: Prisma.InfrastructureProjectCreateManyInput[] = [];
  for (const { attributes: a } of json.features) {
    const category = bcCategory(a);
    const status = BC_STATUSES[a.PROJECT_STATUS];
    const { LATITUDE: latitude, LONGITUDE: longitude } = a;
    if (
      !category ||
      !status ||
      MAINTENANCE.test(a.PROJECT_NAME) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    const name = a.PROJECT_NAME.replace(/\s+/g, " ").trim();
    projects.push({
      id: projectId(BC_SOURCE, name, latitude, longitude),
      source: BC_SOURCE,
      category,
      name,
      status,
      targetCompletion: quarter(a.STANDARDIZED_COMPLETION_DATE),
      community: a.MUNICIPALITY,
      address: null,
      transitLine: null,
      // Costs are in millions of dollars.
      budget: a.ESTIMATED_COST && a.ESTIMATED_COST > 0 ? a.ESTIMATED_COST * 1_000_000 : null,
      website: a.PROJECT_WEBSITE?.trim() || null,
      description: a.PROJECT_DESCRIPTION?.replace(/\s+/g, " ").trim() || null,
      latitude,
      longitude,
    });
  }
  return replaceSource(BC_SOURCE, projects);
}
