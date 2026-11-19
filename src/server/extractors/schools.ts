// Runs inside the Trigger.dev "schools" task. Reads the School table
// (imported with `npm run data:schools`), so no external API calls except
// walking times.
import {
  EQAO_FIELDS,
  type EqaoFieldId,
  SCHOOL_SYSTEMS,
  type SchoolsData,
  SECTION_KEYS,
} from "../../lib/report-sections";
import { db } from "../db";
import { distanceMeters } from "../geo";
import { reportStore } from "../report-store";
import { withTravelTimes } from "./amenities";

/** How many of the nearest schools to keep, per system and level. */
const LIMITS = {
  English: { Elementary: 3, Secondary: 2, radiusKm: 6 },
  French: { Elementary: 1, Secondary: 1, radiusKm: 30 },
} as const;

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

  const picked = SCHOOL_SYSTEMS.map((system) => {
    const limits = LIMITS[system.language];
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
      bikeMinutes: t.bikeMinutes,
      bikeEstimated: t.bikeEstimated,
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
    provincialAverage,
    dataYear,
    fetchedAt: new Date().toISOString(),
  };
  await reportStore.setSection(reportId, SECTION_KEYS.schools, data);
  return { schools: all.length, candidates: candidates.length };
}
