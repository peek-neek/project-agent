// Runs inside the Trigger.dev "schools" task. Ontario: reads the School
// table (ministry data: boards and EQAO results). Elsewhere in Canada: the
// CanadaSchool table (Statistics Canada: public and Catholic schools by
// board and language, no test results). Both need no external calls except
// travel times. Where neither has schools nearby: Google Maps.
import {
  EQAO_FIELDS,
  type EqaoFieldId,
  SCHOOL_SYSTEMS,
  type SchoolsData,
  SECTION_KEYS,
} from "../../lib/report-sections";
import { db } from "../db";
import { distanceMeters, type LatLng } from "../geo";
import { type NearbyResult, searchNearby } from "../google-places";
import { reportStore } from "../report-store";
import { withTravelTimes } from "./amenities";

/** Outside Ontario: how many of the nearest schools to keep, per level. */
const NEARBY = { Elementary: 5, Secondary: 3, radiusMeters: 8000 } as const;

/**
 * Outside Ontario: nearest elementary and secondary schools from Google
 * Maps. Places tagged both ways (K–12) are listed once, as elementary.
 */
export async function nearbySchools(origin: LatLng) {
  const [primary, secondary] = await Promise.all([
    searchNearby({ ...origin, types: ["primary_school"], radius: NEARBY.radiusMeters, maxResults: 10 }),
    searchNearby({ ...origin, types: ["secondary_school"], radius: NEARBY.radiusMeters, maxResults: 10 }),
  ]);
  // Map listings include user-made "schools" (Google shows no reviews for
  // schools to filter on). Canadian school names are English or French, or
  // Inuktitut syllabics in the North; drop names with neither.
  // Google also tags preschools and daycares as primary schools.
  const NOT_A_SCHOOL = /pre-?school|day ?care|child ?care|early (learning|childhood)|nursery|garderie|cpe\b/i;
  const credible = (list: NearbyResult[]) =>
    list.filter(
      (p) =>
        /[A-Za-z\u00C0-\u017F\u1400-\u167F]/.test(p.name) && !NOT_A_SCHOOL.test(p.name),
    );
  const elementary = credible(primary).slice(0, NEARBY.Elementary);
  const taken = new Set(elementary.map((p) => p.id));
  const high = credible(secondary.filter((p) => !taken.has(p.id))).slice(0, NEARBY.Secondary);
  const timed = new Map(
    (await withTravelTimes(origin, [...elementary, ...high])).map((t) => [t.id, t]),
  );
  const toSchool = (p: NearbyResult, level: "Elementary" | "Secondary") => {
    const t = timed.get(p.id)!;
    return {
      id: `g:${p.id}`,
      name: p.name,
      board: "",
      boardWebsite: null,
      website: null,
      level,
      gradeRange: null,
      enrolment: null,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      distanceMeters: t.distanceMeters,
      walkMinutes: t.walkMinutes,
      walkEstimated: t.walkEstimated,
      driveMinutes: t.driveMinutes,
      driveEstimated: t.driveEstimated,
      results: {},
    };
  };
  const byDistance = <T extends { distanceMeters: number }>(list: T[]) =>
    list.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return {
    elementary: byDistance(elementary.map((p) => toSchool(p, "Elementary"))),
    secondary: byDistance(high.map((p) => toSchool(p, "Secondary"))),
  };
}

/** How many of the nearest schools to keep, per system and level. */
const LIMITS = {
  English: { Elementary: 3, Secondary: 2, radiusKm: 6 },
  French: { Elementary: 1, Secondary: 1, radiusKm: 30 },
} as const;
/** Rural fallback (outside Ontario): the nearest one within this distance. */
const RURAL_RADIUS_KM = 30;

type CanadaSchoolRow = Awaited<ReturnType<typeof db.canadaSchool.findMany>>[number];

/**
 * Outside Ontario: the nearest public and Catholic schools per system, from
 * Statistics Canada's list. A system with none within its usual radius
 * (rural areas) shows its nearest within RURAL_RADIUS_KM. Null when the
 * list has no school nearby at all (or isn't imported).
 */
export async function canadaSchools(origin: LatLng): Promise<SchoolsData | null> {
  const dLat = RURAL_RADIUS_KM / 111;
  const dLng = RURAL_RADIUS_KM / (111 * Math.cos((origin.lat * Math.PI) / 180));
  const candidates = await db.canadaSchool.findMany({
    where: {
      latitude: { gte: origin.lat - dLat, lte: origin.lat + dLat },
      longitude: { gte: origin.lng - dLng, lte: origin.lng + dLng },
    },
  });
  if (candidates.length === 0) return null;

  const withDistance = candidates
    .map((school) => ({
      school,
      meters: distanceMeters(origin, { lat: school.latitude, lng: school.longitude }),
    }))
    .filter((c) => c.meters <= RURAL_RADIUS_KM * 1000)
    .sort((a, b) => a.meters - b.meters);
  if (withDistance.length === 0) return null;

  const picked = SCHOOL_SYSTEMS.filter((system) => system.id !== "nearby").map((system) => {
    const limits = LIMITS[system.language as keyof typeof LIMITS];
    const pick = (level: "Elementary" | "Secondary") => {
      const inSystem = withDistance.filter(
        ({ school }) =>
          school.language === system.language &&
          school.type === system.type &&
          (level === "Elementary" ? school.elementary : school.secondary),
      );
      const near = inSystem.filter(({ meters }) => meters <= limits.radiusKm * 1000);
      return (near.length ? near.slice(0, limits[level]) : inSystem.slice(0, 1)).map(
        ({ school }) => school,
      );
    };
    return { system, elementary: pick("Elementary"), secondary: pick("Secondary") };
  });

  // A K–12 school can be in both lists: time it once.
  const unique = new Map<string, CanadaSchoolRow>();
  for (const p of picked) for (const s of [...p.elementary, ...p.secondary]) unique.set(s.id, s);
  if (unique.size === 0) return null;
  const timed = await withTravelTimes(
    origin,
    [...unique.values()].map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
      address: s.street,
      rating: null,
      ratingCount: null,
      primaryType: null,
    })),
  );
  const timeById = new Map(timed.map((t) => [t.id, t]));

  const toSchool = (s: CanadaSchoolRow, level: "Elementary" | "Secondary") => {
    const t = timeById.get(s.id)!;
    return {
      id: `ca:${s.id}`,
      name: s.name,
      board: s.boardName ?? "",
      boardWebsite: null,
      website: null,
      level,
      gradeRange: null,
      enrolment: null,
      address: [s.street, s.city].filter(Boolean).join(", ") || null,
      lat: s.latitude,
      lng: s.longitude,
      distanceMeters: t.distanceMeters,
      walkMinutes: t.walkMinutes,
      // Placed at its town (a rural box address): times are rough.
      walkEstimated: t.walkEstimated || s.approximate,
      driveMinutes: t.driveMinutes,
      driveEstimated: Boolean(t.driveEstimated) || s.approximate,
      results: {},
    };
  };

  return {
    systems: picked.map((p) => ({
      id: p.system.id,
      elementary: p.elementary.map((s) => toSchool(s, "Elementary")),
      secondary: p.secondary.map((s) => toSchool(s, "Secondary")),
    })),
    coverage: "canada",
    provincialAverage: {},
    dataYear: candidates[0].dataYear,
    fetchedAt: new Date().toISOString(),
  };
}

const eqaoSelect = Object.fromEntries(
  EQAO_FIELDS.map((f) => [f.id, true]),
) as Record<EqaoFieldId, true>;

export async function extractSchools(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  const { latitude: lat, longitude: lng } = report?.property ?? {};
  if (lat == null || lng == null) {
    throw new Error("The property's location isn't available yet.");
  }
  const origin = { lat, lng };

  // Ontario's school data (boards, EQAO) covers Ontario only.
  const province = report?.property?.province;
  if (province && province !== "ON") {
    const canada = await canadaSchools(origin);
    if (canada) {
      await reportStore.setSection(reportId, SECTION_KEYS.schools, canada);
      const count = new Set(
        canada.systems.flatMap((s) => [...s.elementary, ...s.secondary].map((x) => x.id)),
      ).size;
      return { schools: count, source: "canada" };
    }
    // Nothing in Statistics Canada's list nearby: Google Maps instead.
    const { elementary, secondary } = await nearbySchools(origin);
    const data: SchoolsData = {
      systems: [{ id: "nearby", elementary, secondary }],
      coverage: "nearby",
      provincialAverage: {},
      dataYear: "",
      fetchedAt: new Date().toISOString(),
    };
    await reportStore.setSection(reportId, SECTION_KEYS.schools, data);
    return { schools: elementary.length + secondary.length, candidates: 0 };
  }

  const total = await db.school.count();
  if (total === 0) {
    throw new Error(
      "School data hasn't been imported yet. Run `npm run data:schools`.",
    );
  }

  // Bounding box big enough for the farthest system (French schools).
  const dLat = LIMITS.French.radiusKm / 111;
  const dLng = LIMITS.French.radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const candidates = await db.school.findMany({
    where: {
      latitude: { gte: lat - dLat, lte: lat + dLat },
      longitude: { gte: lng - dLng, lte: lng + dLng },
    },
  });

  const withDistance = candidates
    .map((s) => ({
      school: s,
      meters: distanceMeters(origin, { lat: s.latitude, lng: s.longitude }),
    }))
    .sort((a, b) => a.meters - b.meters);

  const picked = SCHOOL_SYSTEMS.filter((system) => system.id !== "nearby").map((system) => {
    const limits = LIMITS[system.language as keyof typeof LIMITS];
    const pick = (level: "Elementary" | "Secondary") =>
      withDistance
        .filter(
          ({ school, meters }) =>
            school.language === system.language &&
            school.type === system.type &&
            school.level === level &&
            meters <= limits.radiusKm * 1000,
        )
        .slice(0, limits[level])
        .map(({ school }) => school);
    return {
      system,
      elementary: pick("Elementary"),
      secondary: pick("Secondary"),
    };
  });

  // One matrix call per travel mode for every picked school.
  const all = picked.flatMap((p) => [...p.elementary, ...p.secondary]);
  const timed = await withTravelTimes(
    origin,
    all.map((s) => ({
      id: s.id,
      name: s.name,
      lat: s.latitude,
      lng: s.longitude,
      address: s.street,
      rating: null,
      ratingCount: null,
      primaryType: null,
    })),
  );
  const timeById = new Map(timed.map((t) => [t.id, t]));

  const toSchool = (s: (typeof all)[number]) => {
    const t = timeById.get(s.id)!;
    return {
      id: s.id,
      name: s.name,
      board: s.boardName,
      boardWebsite: s.boardWebsite,
      website: s.website,
      level: s.level as "Elementary" | "Secondary",
      gradeRange: s.gradeRange,
      enrolment: s.enrolment,
      address: [s.street, s.city].filter(Boolean).join(", ") || null,
      lat: s.latitude,
      lng: s.longitude,
      distanceMeters: t.distanceMeters,
      walkMinutes: t.walkMinutes,
      walkEstimated: t.walkEstimated,
      driveMinutes: t.driveMinutes,
      driveEstimated: t.driveEstimated,
      results: Object.fromEntries(
        EQAO_FIELDS.filter((f) => f.level === s.level).map((f) => [
          f.id,
          s[f.id],
        ]),
      ),
    };
  };

  const avg = await db.school.aggregate({ _avg: eqaoSelect });
  const provincialAverage = Object.fromEntries(
    EQAO_FIELDS.map((f) => {
      const v = avg._avg[f.id];
      return [f.id, v == null ? null : Math.round(v)];
    }),
  );

  const dataYear =
    (await db.school.findFirst({ select: { dataYear: true } }))?.dataYear ?? "";

  const data: SchoolsData = {
    systems: picked.map((p) => ({
      id: p.system.id,
      elementary: p.elementary.map(toSchool),
      secondary: p.secondary.map(toSchool),
    })),
    coverage: "ontario",
    provincialAverage,
    dataYear,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.schools, data);
  return { schools: all.length, candidates: candidates.length };
}
