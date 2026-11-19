// Runs inside the Trigger.dev "upside" task. Infrastructure projects and
// Toronto development applications come from tables refreshed on Trigger.dev
// schedules; other municipalities' applications are queried live from their
// open data (development-sources.ts).
import {
  type ApplicationStage,
  DEVELOPMENT_RADIUS_M,
  PROJECT_CATEGORIES,
  type ProjectCategory,
  SECTION_KEYS,
  type UpsideData,
} from "../../lib/report-sections";
import { municipalityAt } from "../crime-severity";
import { db } from "../db";
import {
  developmentSourceFor,
  type LiveApplication,
  liveApplicationsNear,
} from "../development-sources";
import { distanceMeters } from "../geo";
import { reportStore } from "../report-store";

const MAX_PROJECTS = 14;
const MAX_APPLICATIONS = 15;
/** Older open applications are usually stale; skip them. */
const APPLICATION_MAX_AGE_YEARS = 8;

const STAGES: Record<string, ApplicationStage> = {
  "Under Review": "review",
  "Application Received": "review",
  Circulated: "review",
  "NOAC Issued": "approved",
  "OMB Approved": "approved",
  "OMB Partially Approved": "approved",
  "Draft Plan Approved": "approved",
  "Amend Drft Plan App": "approved",
  "Council Approved": "approved",
  "Approved w/Conditions at Council": "approved",
  "Final Approval Completed": "approved",
  Approved: "approved",
  "OMB Appeal": "appeal",
  "Appeal Received": "appeal",
};

/** Groups parts of one project ("… Phase 2 Expansion Project - Health …"). */
const projectKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 45);

/** Bounding box around a point, in degrees. */
const box = (lat: number, lng: number, meters: number) => {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((lat * Math.PI) / 180));
  return {
    latitude: { gte: lat - dLat, lte: lat + dLat },
    longitude: { gte: lng - dLng, lte: lng + dLng },
  };
};

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|[\s\-/.])([a-z])/g, (_, p, c) => p + c.toUpperCase());

export async function extractUpside(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  const { latitude: lat, longitude: lng } = report?.property ?? {};
  if (lat == null || lng == null) {
    throw new Error("The property's location isn't available yet.");
  }
  const origin = { lat, lng };

  const [projectCount, applicationCount] = await Promise.all([
    db.infrastructureProject.count(),
    db.developmentApplication.count(),
  ]);
  if (projectCount === 0 && applicationCount === 0) {
    throw new Error(
      "Upside data hasn't been loaded yet. Run `npm run data:projects` and `npm run data:development`.",
    );
  }

  // Infrastructure: each category has its own relevant distance.
  const maxRadius = Math.max(
    ...Object.values(PROJECT_CATEGORIES).map((c) => c.radius),
  );
  const candidates = await db.infrastructureProject.findMany({
    where: box(lat, lng, maxRadius),
  });
  const projects = candidates
    .map((p) => ({
      p,
      meters: Math.round(
        distanceMeters(origin, { lat: p.latitude, lng: p.longitude }),
      ),
    }))
    .filter(({ p, meters }) => {
      const radius =
        PROJECT_CATEGORIES[p.category as ProjectCategory]?.radius ?? 2000;
      return meters <= radius;
    })
    .sort((a, b) => a.meters - b.meters)
    // Multi-part projects are listed once per part; keep the nearest one.
    .filter(
      ({ p }, i, list) =>
        list.findIndex(
          ({ p: q }) => projectKey(q.name) === projectKey(p.name),
        ) === i,
    )
    .slice(0, MAX_PROJECTS)
    .map(({ p, meters }) => ({
      id: p.id,
      category: p.category,
      name: p.name,
      status: p.status,
      targetCompletion: p.targetCompletion,
      transitLine: p.transitLine,
      budget: p.budget,
      website: p.website,
      description: p.description,
      lat: p.latitude,
      lng: p.longitude,
      distanceMeters: meters,
    }));

  // Development applications. Toronto: the imported table (inside the city
  // if any application exists within 3 km). Elsewhere: the municipality's
  // own open data, when connected.
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - APPLICATION_MAX_AGE_YEARS);
  const inToronto =
    (await db.developmentApplication.count({ where: box(lat, lng, 3000) })) > 0;

  let applications: LiveApplication[] | null = null;
  let source: string | null = null;
  let municipality: string | null = null;
  let developmentNote: string | null = null;

  if (inToronto) {
    source = "City of Toronto";
    municipality = "Toronto";
    const nearby = await db.developmentApplication.findMany({
      where: {
        ...box(lat, lng, DEVELOPMENT_RADIUS_M),
        status: { in: Object.keys(STAGES) },
        submittedAt: { gte: cutoff },
      },
    });
    applications = nearby
      .map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        stage: STAGES[a.status],
        submittedAt: a.submittedAt?.toISOString() ?? null,
        address: a.address,
        description: a.description,
        url: a.url,
        units: a.units,
        storeys: a.storeys,
        lat: a.latitude,
        lng: a.longitude,
        distanceMeters: Math.round(
          distanceMeters(origin, { lat: a.latitude, lng: a.longitude }),
        ),
      }))
      .filter((a) => a.distanceMeters <= DEVELOPMENT_RADIUS_M);
  } else {
    const muni = await municipalityAt(origin).catch(() => null);
    municipality = muni ? titleCase(muni.name) : null;
    const live = muni ? developmentSourceFor(muni.name) : null;
    if (live) {
      try {
        applications = (
          await liveApplicationsNear(live, origin, DEVELOPMENT_RADIUS_M)
        ).filter((a) => !a.submittedAt || new Date(a.submittedAt) >= cutoff);
        source = live.label;
      } catch (error) {
        console.error("[upside] development applications", error);
        developmentNote = `${live.label}'s development application data couldn't be loaded. Try again shortly.`;
      }
    } else {
      developmentNote = `${municipality ?? "This municipality"} doesn't publish development applications as open data that we can connect yet.`;
    }
  }

  let development: UpsideData["development"] = null;
  if (applications) {
    const listed = applications
      .sort((x, y) => x.distanceMeters - y.distanceMeters)
      .slice(0, MAX_APPLICATIONS);
    const storeys = listed
      .map((a) => a.storeys)
      .filter((s): s is number => s != null);
    development = {
      applications: listed,
      totalUnits: listed.reduce((sum, a) => sum + (a.units ?? 0), 0),
      tallestStoreys: storeys.length ? Math.max(...storeys) : null,
      source,
      municipality,
    };
  }

  const data: UpsideData = {
    projects,
    development,
    developmentNote,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.upside, data);
  return {
    projects: projects.length,
    applications: development?.applications.length ?? null,
  };
}
