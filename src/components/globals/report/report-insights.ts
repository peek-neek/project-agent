// Glanceable numbers for the report dashboard, derived from section data.
import {
  type AmenitiesData,
  type CensusFieldId,
  type CommuteData,
  type DemographicsData,
  SCHOOL_SYSTEMS,
  type School,
  type SchoolsData,
} from "@/lib/report-sections";

const RAPID = new Set(["subway", "train", "light_rail"]);

export function nearestPlace(amenities: AmenitiesData | null, id: string) {
  const places = amenities?.categories[id] ?? [];
  return [...places].sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
}

/** Nearest rapid-transit station, else the nearest stop of any kind. */
export function nearestTransit(commute: CommuteData | null) {
  const stations = [...(commute?.stations ?? [])].sort(
    (a, b) => a.distanceMeters - b.distanceMeters,
  );
  return stations.find((s) => RAPID.has(s.kind)) ?? stations[0];
}

/** The first destination is the nearest downtown. */
export function downtownCommute(commute: CommuteData | null) {
  const d = commute?.destinations[0];
  if (!d) return null;
  const minutes = d.transitMinutes ?? d.driveMinutes;
  return minutes == null
    ? null
    : {
        label: d.label,
        minutes,
        mode: d.transitMinutes != null ? "transit" : "drive",
      };
}

export type NearbySchool = School & { systemLabel: string; color: string };

/** Every school in the report, nearest first, with its system. */
export function allSchools(schools: SchoolsData | null): NearbySchool[] {
  if (!schools) return [];
  return schools.systems
    .flatMap((system) => {
      const meta = SCHOOL_SYSTEMS.find((s) => s.id === system.id)!;
      return [...system.elementary, ...system.secondary].map((school) => ({
        ...school,
        systemLabel: meta.label,
        color: meta.color,
      }));
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/** Mean of a school's reported EQAO results (% meeting the standard). */
export function eqaoAverage(results: School["results"]) {
  const values = Object.values(results).filter(
    (v): v is number => typeof v === "number",
  );
  return values.length
    ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
    : null;
}

const HOME_TYPES: { id: CensusFieldId; label: string }[] = [
  { id: "singleDetached", label: "Detached houses" },
  { id: "semiDetached", label: "Semi-detached" },
  { id: "rowHouse", label: "Townhouses" },
  { id: "duplex", label: "Duplexes" },
  { id: "lowRise", label: "Low-rise apartments" },
  { id: "highRise", label: "High-rise apartments" },
];

/** The most common kind of home in the area. */
export function dominantHomeType(demographics: DemographicsData | null) {
  if (!demographics) return null;
  const values = demographics.area.values;
  const top = HOME_TYPES.map((t) => ({ ...t, share: values[t.id] ?? 0 })).sort(
    (a, b) => b.share - a.share,
  )[0];
  return top && top.share > 0 ? top : null;
}

/** Relative difference vs the city, e.g. +0.24 = 24% higher. */
export function versus(area?: number | null, city?: number | null) {
  if (area == null || city == null || city === 0) return null;
  return (area - city) / city;
}
