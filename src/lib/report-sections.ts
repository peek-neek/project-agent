import { z } from "zod";

// Shared (server + client): section keys, amenity categories and the zod
// schemas that validate each section's JSON in the ReportSection table.

export const SECTION_KEYS = {
  listing: "listing",
  amenities: "amenities",
  commute: "commute",
  schools: "schools",
  demographics: "demographics",
  safety: "safety",
  upside: "upside",
  insights: "insights",
  marketing: "marketing",
  /** Agent choices that shape the AI copy (e.g. travel mode). */
  copySettings: "copySettings",
  /** Full listing campaign (AI): headlines, stage posts, Reel, ads, emails. */
  campaign: "campaign",
  /** Showing-day toolkit (AI): personas, proven answers, open house plan. */
  showing: "showing",
  /** The agent's calculator inputs (partial; merged over the defaults). */
  calculators: "calculators",
  /** The agent's own notes on the property (the sticky note). Private. */
  notes: "notes",
} as const;

/** The sticky note: free text, autosaved. */
export const notesSchema = z.object({
  text: z.string().max(10_000),
  savedAt: z.string().optional(),
});
export type NotesData = z.infer<typeof notesSchema>;

export const JOB_KINDS = {
  identity: "property-identity",
  amenities: "amenities",
  commute: "commute",
  schools: "schools",
  demographics: "demographics",
  safety: "safety",
  upside: "upside",
  ai: "ai-insights",
} as const;
export type JobKind = (typeof JOB_KINDS)[keyof typeof JOB_KINDS];

// ---------------------------------------------------------------------------
// Amenities
// ---------------------------------------------------------------------------

/**
 * `featured` categories are the everyday ones drawn on the static overview
 * map (PDF); the interactive map and the header show all of them.
 * `match: "primary"` keeps only places whose main type is listed.
 */
export const AMENITY_CATEGORIES = [
  {
    id: "groceries",
    label: "Groceries",
    featured: true,
    types: ["grocery_store", "supermarket"],
    radius: 1500,
    color: "#2563eb",
    match: "primary",
  },
  {
    id: "pharmacies",
    label: "Pharmacies",
    featured: true,
    types: ["pharmacy", "drugstore"],
    radius: 1500,
    color: "#db2777",
    match: "primary",
  },
  {
    id: "cafes",
    label: "Cafés",
    featured: true,
    types: ["cafe", "coffee_shop"],
    radius: 1000,
    color: "#a16207",
    match: "primary",
  },
  // Restaurant primary types are specific ("pizza_restaurant"), so match any.
  {
    id: "restaurants",
    label: "Restaurants",
    featured: true,
    types: ["restaurant"],
    radius: 1000,
    color: "#ea580c",
    match: "any",
  },
  {
    id: "parks",
    label: "Parks",
    featured: true,
    types: ["park"],
    radius: 1500,
    color: "#16a34a",
    match: "primary",
  },
  {
    id: "gyms",
    label: "Gyms & yoga",
    featured: true,
    types: ["gym", "fitness_center", "yoga_studio"],
    radius: 2000,
    color: "#7c3aed",
    match: "primary",
  },
  {
    id: "healthcare",
    label: "Hospitals",
    featured: true,
    types: ["hospital"],
    radius: 8000,
    color: "#0891b2",
    match: "primary",
  },
  {
    id: "childcare",
    label: "Child care",
    featured: false,
    types: ["child_care_agency", "preschool"],
    radius: 1500,
    color: "#e11d48",
    match: "primary",
  },
  {
    id: "libraries",
    label: "Libraries",
    featured: false,
    types: ["library"],
    radius: 2500,
    color: "#4f46e5",
    match: "primary",
  },
  {
    id: "banks",
    label: "Banks",
    featured: false,
    types: ["bank"],
    radius: 1500,
    color: "#0f766e",
    match: "primary",
  },
  {
    id: "liquor",
    label: "LCBO & liquor",
    featured: false,
    types: ["liquor_store"],
    radius: 2500,
    color: "#7f1d1d",
    match: "primary",
  },
  {
    id: "postOffices",
    label: "Post offices",
    featured: false,
    types: ["post_office"],
    radius: 2500,
    color: "#b91c1c",
    match: "primary",
  },
  {
    id: "shopping",
    label: "Shopping malls",
    featured: false,
    types: ["shopping_mall"],
    radius: 5000,
    color: "#9333ea",
    match: "primary",
  },
  {
    id: "departmentStores",
    label: "Department stores",
    featured: false,
    types: ["department_store"],
    radius: 5000,
    color: "#6d28d9",
    match: "primary",
  },
  {
    id: "homeImprovement",
    label: "Home improvement",
    featured: false,
    types: ["home_improvement_store", "hardware_store"],
    radius: 8000,
    color: "#c2410c",
    match: "primary",
  },
  {
    id: "spas",
    label: "Spas & massage",
    featured: false,
    types: ["spa", "massage", "sauna", "wellness_center"],
    radius: 2000,
    color: "#c026d3",
    match: "primary",
  },
  {
    id: "cinemas",
    label: "Cinemas",
    featured: false,
    types: ["movie_theater"],
    radius: 5000,
    color: "#be123c",
    match: "primary",
  },
  {
    id: "entertainment",
    label: "Arts & culture",
    featured: false,
    types: ["performing_arts_theater", "museum", "art_gallery"],
    radius: 3000,
    color: "#9f1239",
    match: "primary",
  },
  {
    id: "activities",
    label: "Activities & classes",
    featured: false,
    types: ["art_studio", "community_center", "cultural_center"],
    radius: 2500,
    color: "#d97706",
    match: "primary",
  },
  {
    id: "dogParks",
    label: "Dog parks",
    featured: false,
    types: ["dog_park"],
    radius: 2500,
    color: "#65a30d",
    match: "primary",
  },
  {
    id: "gas",
    label: "Gas stations",
    featured: false,
    types: ["gas_station"],
    radius: 3000,
    color: "#525252",
    match: "primary",
  },
  {
    id: "carRepair",
    label: "Car maintenance",
    featured: false,
    types: ["car_repair"],
    radius: 3000,
    color: "#334155",
    match: "primary",
  },
  // All faiths in one neutral category: an amenity, never a buyer signal.
  {
    id: "worship",
    label: "Places of worship",
    featured: false,
    types: ["church", "hindu_temple", "mosque", "synagogue"],
    radius: 2000,
    color: "#57534e",
    match: "primary",
  },
] as const;

export const FEATURED_AMENITY_CATEGORIES = AMENITY_CATEGORIES.filter(
  (c) => c.featured,
);

export type AmenityCategoryId = (typeof AMENITY_CATEGORIES)[number]["id"];
export const amenityCategoryIds = AMENITY_CATEGORIES.map((c) => c.id) as [
  AmenityCategoryId,
  ...AmenityCategoryId[],
];

const placePhotoSchema = z.object({
  /** Places photo resource name, served via our place-photo route. */
  name: z.string(),
  author: z.string().nullable(),
  authorUri: z.string().nullable(),
});

export const nearbyPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable(),
  rating: z.number().nullable(),
  ratingCount: z.number().nullable(),
  distanceMeters: z.number(),
  walkMinutes: z.number(),
  /** True when walk time is estimated from distance (Routes API unavailable). */
  walkEstimated: z.boolean(),
  /** Drive times; older reports don't have them (UI estimates). */
  driveMinutes: z.number().nullable().optional(),
  driveEstimated: z.boolean().nullable().optional(),

  /** First Google Places photo; older reports don't have one. */
  photo: placePhotoSchema.nullable().optional(),
  /** Up to 4 photos (the first is `photo`); older reports have only `photo`. */
  photos: z.array(placePhotoSchema).optional(),
});
export type NearbyPlace = z.infer<typeof nearbyPlaceSchema>;

export const amenitiesSchema = z.object({
  categories: z.record(z.string(), z.array(nearbyPlaceSchema)),
  fetchedAt: z.string(),
});
export type AmenitiesData = z.infer<typeof amenitiesSchema>;

// ---------------------------------------------------------------------------
// Commute & transit
// ---------------------------------------------------------------------------

export const TRANSIT_KINDS = {
  subway: { label: "Subway", color: "#2563eb" },
  train: { label: "GO / train", color: "#16a34a" },
  light_rail: { label: "Light rail", color: "#7c3aed" },
  go_bus: { label: "GO bus", color: "#0f766e" },
  bus: { label: "Bus stop", color: "#ea580c" },
} as const;
export type TransitKind = keyof typeof TRANSIT_KINDS;

export const DESTINATION_KINDS = {
  downtown: { label: "Downtowns" },
  airport: { label: "Airports" },
} as const;
export type DestinationKind = keyof typeof DESTINATION_KINDS;

export const TRANSIT_COLORS = Object.fromEntries(
  Object.entries(TRANSIT_KINDS).map(([k, v]) => [k, v.color]),
) as Record<keyof typeof TRANSIT_KINDS, string>;

export const commuteSchema = z.object({
  destinations: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      /** Older reports don't have it: infer from the label. */
      kind: z.enum(["downtown", "airport"]).optional(),
      driveMinutes: z.number().nullable(),
      driveKm: z.number().nullable(),
      transitMinutes: z.number().nullable(),
      /** Walking routes; older reports lack them (estimated). */
      walkMinutes: z.number().nullable().optional(),
      walkKm: z.number().nullable().optional(),
    }),
  ),
  stations: z.array(
    nearbyPlaceSchema.extend({
      kind: z.enum(["subway", "train", "light_rail", "go_bus", "bus"]),
    }),
  ),
  /** e.g. "Weekday, 8:00 a.m." — when drive/transit times were calculated for. */
  departureLabel: z.string(),
  routesAvailable: z.boolean(),
  fetchedAt: z.string(),
});
export type CommuteData = z.infer<typeof commuteSchema>;

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------

/** English/French × public/Catholic: the four school systems in Ontario. */
export const SCHOOL_SYSTEMS = [
  {
    id: "english-public",
    label: "English public",
    language: "English",
    type: "Public",
    color: "#2563eb",
  },
  {
    id: "english-catholic",
    label: "English Catholic",
    language: "English",
    type: "Catholic",
    color: "#7c3aed",
  },
  {
    id: "french-public",
    label: "French public",
    language: "French",
    type: "Public",
    color: "#16a34a",
  },
  {
    id: "french-catholic",
    label: "French Catholic",
    language: "French",
    type: "Catholic",
    color: "#ea580c",
  },
  /** Outside Ontario: nearest schools from Google Maps, any system. */
  {
    id: "nearby",
    label: "Nearby schools",
    language: "Any",
    type: "Any",
    color: "#0891b2",
  },
] as const;
export type SchoolSystemId = (typeof SCHOOL_SYSTEMS)[number]["id"];

/** EQAO results: % of students meeting the provincial standard. */
export const EQAO_FIELDS = [
  { id: "g3Reading", label: "Grade 3 reading", level: "Elementary" },
  { id: "g3Writing", label: "Grade 3 writing", level: "Elementary" },
  { id: "g3Math", label: "Grade 3 math", level: "Elementary" },
  { id: "g6Reading", label: "Grade 6 reading", level: "Elementary" },
  { id: "g6Writing", label: "Grade 6 writing", level: "Elementary" },
  { id: "g6Math", label: "Grade 6 math", level: "Elementary" },
  { id: "g9Math", label: "Grade 9 math", level: "Secondary" },
  { id: "osslt", label: "Grade 10 literacy (OSSLT)", level: "Secondary" },
] as const;
export type EqaoFieldId = (typeof EQAO_FIELDS)[number]["id"];

const eqaoSchema = z.partialRecord(
  z.enum(EQAO_FIELDS.map((f) => f.id) as [EqaoFieldId, ...EqaoFieldId[]]),
  z.number().nullable(),
);

export const schoolSchema = z.object({
  id: z.string(),
  name: z.string(),
  board: z.string(),
  boardWebsite: z.string().nullable(),
  website: z.string().nullable(),
  level: z.enum(["Elementary", "Secondary"]),
  gradeRange: z.string().nullable(),
  enrolment: z.number().nullable(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  distanceMeters: z.number(),
  walkMinutes: z.number(),
  walkEstimated: z.boolean(),
  /** Drive times; older reports don't have them (UI estimates). */
  driveMinutes: z.number().nullable().optional(),
  driveEstimated: z.boolean().nullable().optional(),
  results: eqaoSchema,
});
export type School = z.infer<typeof schoolSchema>;

export const schoolsSchema = z.object({
  systems: z.array(
    z.object({
      id: z.enum(
        SCHOOL_SYSTEMS.map((s) => s.id) as [
          SchoolSystemId,
          ...SchoolSystemId[],
        ],
      ),
      elementary: z.array(schoolSchema),
      secondary: z.array(schoolSchema),
    }),
  ),
  /**
   * "ontario": Ontario's school list with boards and EQAO results.
   * "nearby": outside Ontario, nearest schools from Google Maps (no boards
   * or test results). Older reports lack it (Ontario).
   */
  coverage: z.enum(["ontario", "nearby"]).optional(),
  /** Unweighted average across Ontario schools, for context. */
  provincialAverage: eqaoSchema,
  dataYear: z.string(),
  fetchedAt: z.string(),
});
export type SchoolsData = z.infer<typeof schoolsSchema>;

/** Schools within this distance are numbered and shown on the map. */
export const SCHOOL_MAP_RADIUS_M = 4000;

/**
 * Schools shown on the map, numbered 1–9 then A–Z in display order. The map
 * route and the report UI both use this, so labels always match.
 */
export function schoolMapLabels(data: SchoolsData) {
  const labels = new Map<string, string>();
  const chars = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // Nearest first, so numbers read in order down a distance-sorted list.
  const schools = data.systems
    .flatMap((system) => [...system.elementary, ...system.secondary])
    .filter((school) => school.distanceMeters <= SCHOOL_MAP_RADIUS_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
  for (const school of schools) {
    if (labels.has(school.id)) continue;
    if (labels.size >= chars.length) break;
    labels.set(school.id, chars[labels.size]);
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Demographics (Statistics Canada, 2021 Census)
// ---------------------------------------------------------------------------

/**
 * Census profile characteristics we report. `statistic` 1 = counts, 4 = rates
 * (percentages, or the value itself for medians and averages).
 */
export const CENSUS_FIELDS = [
  {
    id: "population",
    characteristic: 1,
    statistic: 1,
    label: "Population",
    format: "number",
  },
  {
    id: "density",
    characteristic: 6,
    statistic: 1,
    label: "People per km²",
    format: "number",
  },
  {
    id: "medianAge",
    characteristic: 40,
    statistic: 1,
    label: "Median age",
    format: "decimal",
  },
  {
    id: "age0to14",
    characteristic: 35,
    statistic: 4,
    label: "Children (0–14)",
    format: "percent",
  },
  {
    id: "age15to64",
    characteristic: 36,
    statistic: 4,
    label: "Working age (15–64)",
    format: "percent",
  },
  {
    id: "age65plus",
    characteristic: 37,
    statistic: 4,
    label: "Seniors (65+)",
    format: "percent",
  },
  {
    id: "householdSize",
    characteristic: 56,
    statistic: 1,
    label: "Average household size",
    format: "decimal",
  },
  {
    id: "coupleWithChildren",
    characteristic: 103,
    statistic: 4,
    label: "Couples with children",
    format: "percent",
  },
  {
    id: "coupleNoChildren",
    characteristic: 104,
    statistic: 4,
    label: "Couples without children",
    format: "percent",
  },
  {
    id: "oneParent",
    characteristic: 105,
    statistic: 4,
    label: "One-parent families",
    format: "percent",
  },
  {
    id: "onePerson",
    characteristic: 110,
    statistic: 4,
    label: "People living alone",
    format: "percent",
  },
  {
    id: "medianIncome",
    characteristic: 229,
    statistic: 1,
    label: "Median household income",
    format: "currency",
  },
  {
    id: "owners",
    characteristic: 1401,
    statistic: 4,
    label: "Owners",
    format: "percent",
  },
  {
    id: "renters",
    characteristic: 1402,
    statistic: 4,
    label: "Renters",
    format: "percent",
  },
  {
    id: "singleDetached",
    characteristic: 42,
    statistic: 4,
    label: "Detached houses",
    format: "percent",
  },
  {
    id: "semiDetached",
    characteristic: 43,
    statistic: 4,
    label: "Semi-detached",
    format: "percent",
  },
  {
    id: "rowHouse",
    characteristic: 44,
    statistic: 4,
    label: "Townhouses",
    format: "percent",
  },
  {
    id: "duplex",
    characteristic: 45,
    statistic: 4,
    label: "Duplex units",
    format: "percent",
  },
  {
    id: "lowRise",
    characteristic: 46,
    statistic: 4,
    label: "Low-rise apartments",
    format: "percent",
  },
  {
    id: "highRise",
    characteristic: 47,
    statistic: 4,
    label: "High-rise apartments",
    format: "percent",
  },
  {
    id: "bachelorPlus",
    characteristic: 2024,
    statistic: 4,
    label: "University degree (25–64)",
    format: "percent",
  },
] as const;
export type CensusFieldId = (typeof CENSUS_FIELDS)[number]["id"];

const censusValuesSchema = z.partialRecord(
  z.enum(CENSUS_FIELDS.map((f) => f.id) as [CensusFieldId, ...CensusFieldId[]]),
  z.number().nullable(),
);

export const demographicsSchema = z.object({
  area: z.object({
    /** e.g. "Census tract 0196.02" */
    label: z.string(),
    level: z.enum(["tract", "area"]),
    values: censusValuesSchema,
  }),
  city: z.object({ label: z.string(), values: censusValuesSchema }).nullable(),
  censusYear: z.number(),
  fetchedAt: z.string(),
});
export type DemographicsData = z.infer<typeof demographicsSchema>;

// ---------------------------------------------------------------------------
// Safety & environment
// ---------------------------------------------------------------------------

export const CRIME_TYPES = [
  { id: "BREAKENTER", label: "Break and enter" },
  { id: "AUTOTHEFT", label: "Auto theft" },
  { id: "THEFTFROMMV", label: "Theft from vehicles" },
  { id: "THEFTOVER", label: "Theft over $5,000" },
  { id: "BIKETHEFT", label: "Bike theft" },
  { id: "ASSAULT", label: "Assault" },
  { id: "ROBBERY", label: "Robbery" },
  { id: "SHOOTING", label: "Shootings" },
  { id: "HOMICIDE", label: "Homicide" },
] as const;
export type CrimeTypeId = (typeof CRIME_TYPES)[number]["id"];

export const safetySchema = z.object({
  crime: z
    .object({
      source: z.string(),
      neighbourhood: z.string(),
      population: z.number().nullable(),
      year: z.number(),
      firstYear: z.number(),
      types: z.array(
        z.object({
          id: z.enum(
            CRIME_TYPES.map((c) => c.id) as [CrimeTypeId, ...CrimeTypeId[]],
          ),
          count: z.number(),
          /** Per 100,000 residents. */
          rate: z.number().nullable(),
          cityRate: z.number().nullable(),
          /** Counts per year, oldest first (firstYear…year). */
          trend: z.array(z.number().nullable()),
        }),
      ),
      /** Share of the city's neighbourhoods with a higher total rate (0–1). */
      lowerRateThanShare: z.number().nullable(),
    })
    .nullable(),
  /** Why crime data is missing, when it is. */
  crimeNote: z.string().nullable(),
  /**
   * Crime Severity Index for the local police service (anywhere in Canada),
   * or the province overall when no service matches. Older reports lack it;
   * Ontario-only reports saved the comparison as `ontario` (mapped below).
   */
  areaCrime: z.preprocess(
    (v) =>
      v && typeof v === "object" && "ontario" in v && !("province" in v)
        ? { ...v, province: { code: "ON", name: "Ontario", ...(v as { ontario: object }).ontario } }
        : v,
    z
    .object({
      source: z.string(),
      level: z.enum(["service", "province"]),
      /** e.g. "York Region", "Dufferin (Orangeville)". */
      service: z.string(),
      /** opp / sq: Ontario / Quebec provincial police; rcmp: RCMP detachment. */
      policing: z.enum(["municipal", "opp", "sq", "rcmp"]).nullable(),
      municipality: z.string().nullable(),
      year: z.number(),
      firstYear: z.number(),
      /** 100 = Canada in 2006; higher means more (and more serious) crime. */
      csi: z.number().nullable(),
      violentCsi: z.number().nullable(),
      nonViolentCsi: z.number().nullable(),
      /** CSI per year, firstYear…year. */
      trend: z.array(z.number().nullable()),
      /** The property's province or territory, for comparison. */
      province: z.object({
        code: z.string().nullable(),
        /** "Ontario", "British Columbia"; "Canada" when the province is unknown. */
        name: z.string(),
        csi: z.number().nullable(),
        violentCsi: z.number().nullable(),
        nonViolentCsi: z.number().nullable(),
      }),
      canadaCsi: z.number().nullable(),
    })
    .nullable()
    .optional(),
  ),
  flood: z.object({
    authority: z.string().nullable(),
    status: z.enum(["inside", "nearby", "clear", "unknown"]),
    /** e.g. ["Flood hazard", "Crest of slope"] */
    criteria: z.array(z.string()),
    note: z.string(),
  }),
  noise: z.object({
    highway: z.object({ meters: z.number() }).nullable(),
    railway: z.object({ meters: z.number() }).nullable(),
    airport: z.object({ name: z.string(), km: z.number() }).nullable(),
    /** False when road/rail data couldn't be loaded (retry to fix). */
    roadsCovered: z.boolean(),
    /** Where the highway and rail distances came from; older reports lack it. */
    source: z.string().nullable().optional(),
    /**
     * Older reports only: true outside Ontario, before highway and rail data
     * covered all of Canada (regenerate the section to fill it in).
     */
    outsideCoverage: z.boolean().optional(),
  }),
  airQuality: z
    .object({
      aqi: z.number(),
      category: z.string(),
      dominantPollutant: z.string().nullable(),
      color: z.string().nullable(),
      observedAt: z.string(),
    })
    .nullable(),
  airQualityNote: z.string().nullable(),
  fetchedAt: z.string(),
});
export type SafetyData = z.infer<typeof safetySchema>;

// ---------------------------------------------------------------------------
// Future upside: what's being built and proposed nearby
// ---------------------------------------------------------------------------

export const PROJECT_CATEGORIES = {
  Transit: { label: "Transit", color: "#2563eb", radius: 3000 },
  Education: { label: "Schools", color: "#7c3aed", radius: 2000 },
  "Health care": { label: "Health care", color: "#0891b2", radius: 5000 },
  "Child care": { label: "Child care", color: "#db2777", radius: 1500 },
  Recreation: { label: "Recreation", color: "#16a34a", radius: 2000 },
  Communities: { label: "Community", color: "#a16207", radius: 2000 },
  "Roads and bridges": { label: "Roads", color: "#525252", radius: 3000 },
} as const;
export type ProjectCategory = keyof typeof PROJECT_CATEGORIES;

export const APPLICATION_TYPES = {
  OZ: "Rezoning / Official Plan amendment",
  SA: "Site plan",
  SB: "Plan of subdivision",
  CD: "Condominium",
  PL: "Part-lot control",
} as const;

export const APPLICATION_STAGES = {
  review: { label: "In review", color: "#2563eb" },
  approved: { label: "Approved", color: "#16a34a" },
  appeal: { label: "Under appeal", color: "#d97706" },
} as const;
export type ApplicationStage = keyof typeof APPLICATION_STAGES;

/** Development applications within this distance are listed. */
export const DEVELOPMENT_RADIUS_M = 500;

export const upsideSchema = z.object({
  projects: z.array(
    z.object({
      id: z.string(),
      category: z.string(),
      name: z.string(),
      status: z.string(),
      targetCompletion: z.string().nullable(),
      transitLine: z.string().nullable(),
      budget: z.number().nullable(),
      website: z.string().nullable(),
      description: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
      distanceMeters: z.number(),
    }),
  ),
  /** Null where the municipality's applications aren't connected. */
  development: z
    .object({
      applications: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          status: z.string(),
          stage: z.enum(["review", "approved", "appeal"]),
          submittedAt: z.string().nullable(),
          address: z.string(),
          description: z.string().nullable(),
          url: z.string().nullable(),
          units: z.number().nullable(),
          storeys: z.number().nullable(),
          lat: z.number(),
          lng: z.number(),
          distanceMeters: z.number(),
        }),
      ),
      totalUnits: z.number(),
      tallestStoreys: z.number().nullable(),
      /** e.g. "City of Mississauga"; older (Toronto-only) reports lack it. */
      source: z.string().nullable().optional(),
      municipality: z.string().nullable().optional(),
    })
    .nullable(),
  developmentNote: z.string().nullable(),
  /** Why the project list is empty for reasons other than "none nearby". */
  projectsNote: z.string().nullable().optional(),
  fetchedAt: z.string(),
});
export type UpsideData = z.infer<typeof upsideSchema>;

/** Map markers: applications numbered 1–9, projects lettered A–Z. */
export function upsideMapLabels(data: UpsideData) {
  const labels = new Map<string, string>();
  (data.development?.applications ?? [])
    .slice(0, 9)
    .forEach((a, i) => labels.set(a.id, String(i + 1)));
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  data.projects
    .slice(0, letters.length)
    .forEach((p, i) => labels.set(p.id, letters[i]));
  return labels;
}

// ---------------------------------------------------------------------------
// Agent inputs (quick details used to make the AI copy specific)
// ---------------------------------------------------------------------------

export const PROPERTY_TYPES = [
  "Detached",
  "Semi-detached",
  "Townhouse",
  "Condo apartment",
  "Condo townhouse",
  "Multiplex",
  "Other",
] as const;

const optionalNumber = (max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= max), {
      message: "Enter a valid number",
    })
    .nullable();

export const listingInputSchema = z.object({
  unitNumber: z
    .string()
    .max(20, "Keep it under 20 characters")
    .regex(/^[A-Za-z0-9 #-]*$/, "Use letters, numbers, spaces, # or -")
    .transform((v) => (v.trim() === "" ? null : v.trim())),
  propertyType: z.enum(PROPERTY_TYPES).nullable(),
  bedrooms: optionalNumber(50),
  bathrooms: optionalNumber(50),
  listPrice: optionalNumber(1_000_000_000),
  features: z
    .string()
    .max(600, "Keep it under 600 characters")
    .transform((v) => (v.trim() === "" ? null : v.trim())),
});
export type ListingInput = z.input<typeof listingInputSchema>;

export const listingSchema = z.object({
  propertyType: z.enum(PROPERTY_TYPES).nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  listPrice: z.number().nullable(),
  features: z.string().nullable(),
});
export type ListingData = z.infer<typeof listingSchema>;

// ---------------------------------------------------------------------------
// AI output
// ---------------------------------------------------------------------------

export const insightsSchema = z.object({
  headline: z.string().describe("One sentence, under 20 words."),
  summary: z
    .string()
    .describe("2–3 sentences on the property's location and lifestyle."),
  dayInTheLife: z
    .string()
    .describe("A short 'day in this neighbourhood' paragraph, 80–120 words."),
  highlights: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .describe("Exactly 5 selling points backed by the data."),
  watchOuts: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        reframe: z
          .string()
          .describe("How an agent can address it honestly with buyers."),
      }),
    )
    .describe("Exactly 3 honest watch-outs a buyer may raise."),
});
export type InsightsData = z.infer<typeof insightsSchema>;

export const marketingSchema = z.object({
  listingDescriptions: z
    .array(
      z.object({
        tone: z.enum(["professional", "warm", "luxury"]),
        text: z
          .string()
          .describe("MLS-ready description, 120–180 words, no headings."),
      }),
    )
    .describe("One description per tone: professional, warm, luxury."),
  socialPosts: z
    .array(
      z.object({
        platform: z.enum(["instagram", "facebook", "linkedin"]),
        caption: z.string(),
        hashtags: z.array(z.string()),
      }),
    )
    .describe("One post per platform."),
  email: z.object({ subject: z.string(), body: z.string() }),
  playbook: z.object({
    talkingPoints: z
      .array(z.string())
      .describe("6–8 short talking points for showings."),
    objections: z
      .array(z.object({ objection: z.string(), response: z.string() }))
      .describe("4–5 likely buyer objections with suggested responses."),
    buyerProfile: z.object({
      title: z.string(),
      summary: z.string(),
      motivations: z.array(z.string()),
    }),
    showingChecklist: z
      .array(z.string())
      .describe("6–10 showing preparation steps."),
  }),
});
export type MarketingData = z.infer<typeof marketingSchema>;

/**
 * AI copy is written for every travel mode: "insights:walk", "marketing:drive"…
 * The plain key holds the agent's own mode (and all copy on older reports).
 */
export const copySectionKey = (key: string, mode: "walk" | "drive") =>
  `${key}:${mode}`;

export const CAMPAIGN_STAGES = {
  comingSoon: "Coming soon",
  justListed: "Just listed",
  openHouse: "Open house",
  priceImproved: "Price improved",
  sold: "Sold",
} as const;
export type CampaignStage = keyof typeof CAMPAIGN_STAGES;

const emailSchema = z.object({ subject: z.string(), body: z.string() });

/**
 * The full listing campaign. Limits live in descriptions (some providers'
 * structured output rejects length constraints); the UI counts against them.
 */
export const campaignSchema = z.object({
  headlines: z
    .array(z.string())
    .describe(
      "Exactly 5 headline options for signs, feature sheets and ads, each under 60 characters.",
    ),
  mlsShort: z
    .string()
    .describe(
      "A compact MLS public-remarks version of the listing, under 450 characters including spaces.",
    ),
  stagePosts: z
    .array(
      z.object({
        stage: z.enum([
          "comingSoon",
          "justListed",
          "openHouse",
          "priceImproved",
          "sold",
        ]),
        caption: z.string(),
        hashtags: z.array(z.string()),
      }),
    )
    .describe(
      "One social post per stage, in this order: comingSoon, justListed, openHouse, priceImproved, sold. Use [date] and [time] placeholders for the open house and [new price] for the price change.",
    ),
  reel: z.object({
    hook: z
      .string()
      .describe("The opening line, spoken in the first 3 seconds."),
    scenes: z
      .array(
        z.object({
          shot: z.string().describe("What to film."),
          voiceover: z.string(),
          onScreenText: z.string().describe("Under 40 characters."),
        }),
      )
      .describe("5–7 scenes for a 30-second Instagram Reel or TikTok."),
    caption: z.string(),
    callToAction: z.string(),
  }),
  carousel: z
    .array(
      z.object({
        title: z.string().describe("Under 40 characters."),
        body: z.string().describe("Under 120 characters."),
      }),
    )
    .describe(
      "Exactly 6 Instagram carousel slides: a cover, 4 location facts, and a call to action.",
    ),
  ads: z.object({
    headlines: z
      .array(z.string())
      .describe("Exactly 5 ad headlines, each 30 characters or fewer."),
    descriptions: z
      .array(z.string())
      .describe("Exactly 3 ad descriptions, each 90 characters or fewer."),
  }),
  openHouseEmail: emailSchema.describe(
    "An open house invitation to the agent's buyer list, with [date] and [time] placeholders.",
  ),
  neighbourLetter: emailSchema.describe(
    "A short 'just listed in your neighbourhood' letter to nearby homeowners, inviting them to the open house and to pass it on.",
  ),
});
export type CampaignData = z.infer<typeof campaignSchema>;

/** The showing-day toolkit: who to pitch to, proof for tough questions, plan. */
export const showingSchema = z.object({
  personas: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            "Needs-based, e.g. 'Transit commuters' or 'Remote workers who want space'. Never age, family status, ethnicity or religion.",
          ),
        needs: z.string().describe("One sentence on what they're looking for."),
        emphasize: z
          .array(z.string())
          .describe("Exactly 3 facts from the fact sheet to lead with."),
        tourFocus: z
          .string()
          .describe("Which nearby place to show them first, and why."),
      }),
    )
    .describe("Exactly 3 distinct buyer personas."),
  provenAnswers: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
        proof: z
          .string()
          .describe(
            "The exact fact from the fact sheet that backs the answer.",
          ),
      }),
    )
    .describe(
      "Exactly 5 tough buyer questions, each answered with a number from the fact sheet.",
    ),
  openHousePlan: z
    .object({
      before: z.array(z.string()),
      dayOf: z.array(z.string()),
      after: z.array(z.string()),
    })
    .describe("4–6 short steps for each phase."),
  followUpText: z
    .string()
    .describe(
      "A text message to open house visitors the same evening, under 300 characters.",
    ),
  followUpEmail: emailSchema.describe(
    "A follow-up email to open house visitors the next day.",
  ),
});
export type ShowingData = z.infer<typeof showingSchema>;

/**
 * Walk or drive. Copy from before cycling was retired may say "bike": it
 * reads as walk, the closest remaining mode (bike times are no longer shown).
 */
export const travelModeSchema = z.preprocess(
  (value) => (value === "bike" ? "walk" : value),
  z.enum(["walk", "drive"]),
);

/** Settings the AI copy is written with; older reports have none (walk). */
export const copySettingsSchema = z.object({ travelMode: travelModeSchema });
export type CopySettings = z.infer<typeof copySettingsSchema>;

/** Stored alongside AI sections: when and by which provider/model. */
export const aiMetaSchema = z.object({
  generatedAt: z.string(),
  /** Travel mode the copy's times use; absent on older copy (walk). */
  travelMode: travelModeSchema.optional(),
  generatedBy: z.object({
    provider: z.enum(["openai", "anthropic", "google"]),
    model: z.string(),
  }),
});

export const AI_PROVIDER_LABELS = {
  openai: "OpenAI",
  anthropic: "Claude",
  google: "Gemini",
} as const;
