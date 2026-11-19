// Runs inside the Trigger.dev "ai-insights" task.
import type { z } from "zod";
import {
  AMENITY_CATEGORIES,
  amenitiesSchema,
  CENSUS_FIELDS,
  CRIME_TYPES,
  commuteSchema,
  copySettingsSchema,
  demographicsSchema,
  EQAO_FIELDS,
  insightsSchema,
  listingSchema,
  marketingSchema,
  SCHOOL_SYSTEMS,
  type School,
  SECTION_KEYS,
  safetySchema,
  schoolsSchema,
  upsideSchema,
} from "../../lib/report-sections";
import {
  TRAVEL_MODES,
  type TravelMode,
  type TravelTimes,
  travelTime,
} from "../../lib/travel";
import { generateStructured } from "../ai/generate-structured";
import { reportStore } from "../report-store";

const SYSTEM_PROMPT = `You are a marketing strategist for real estate agents in Ontario, Canada. You turn location data about a property into copy and talking points that help the agent sell it.

Rules:
- Use only the facts in the fact sheet. Never invent amenities, distances, school names, prices, room counts or features. If something isn't in the fact sheet, leave it out.
- Name real places from the fact sheet where it helps (for example "a 6-minute walk to Loblaws").
- Times to nearby places are for the travel mode in "travelTimesBy" (walking, cycling or driving). Describe them that way ("a 6-minute walk", "a 5-minute bike ride", "a 4-minute drive"); never call a cycling or driving time a walk. Commute destinations list their own drive and transit times.
- Travel times marked "estimated" are approximate: write "about" or "roughly".
- Schools: you may name nearby schools from the fact sheet and their travel time or distance. Never say or imply the property is in a school's catchment or boundary ("steps to", "in the district of" a specific school is fine only as distance). Suggest buyers confirm catchment with the board. EQAO results are context for the agent, not marketing claims; don't rank or call schools "top" or "best".
- Census figures describe current residents of the area. Use them to understand the housing stock and lifestyle (for example many renters, mostly detached houses). Never use them to say who should or shouldn't buy, and never describe residents by age, family status or ethnicity in marketing copy.
- Places of worship, child care and similar amenities may be listed as conveniences ("a library, child care and places of worship within a short walk"). Never single out a faith or suggest the area suits a particular religion, family type or age group.
- Future projects: you may mention nearby transit, schools or hospitals that are under construction or planned, with their status (for example "the Ontario Line's Exhibition Station, under construction about 200 m away"). Never promise opening dates beyond the fact sheet, never claim the home will rise in value, and treat nearby development applications as facts for the playbook, not marketing claims.
- Safety: never call an area "safe", "unsafe", "low-crime" or "high-crime" in marketing copy, social posts or emails. Crime, flood and noise facts may appear only in watch-outs and the playbook, stated as facts with their source.
- Follow the Ontario Human Rights Code and RECO advertising rules: don't describe, target or exclude buyers by race, ancestry, place of origin, ethnicity, citizenship, creed or religion, sex, sexual orientation, gender identity, age, marital or family status, or disability. Describe buyers by needs and lifestyle (for example "commuting professionals", "buyers who want walkability").
- Be truthful and specific. No exaggeration ("best", "perfect", "rare gem") unless the data supports it.
- Use Canadian spelling and plain, confident language.`;

type Fact = Record<string, unknown>;

const MODE_WORDS: Record<TravelMode, string> = {
  walk: "walking",
  bike: "cycling",
  drive: "driving (typical traffic)",
};

function buildFactSheet(
  report: NonNullable<Awaited<ReturnType<typeof reportStore.findWithDetails>>>,
  mode: TravelMode,
) {
  const section = <S extends z.ZodType>(key: string, schema: S) => {
    const row = report.sections.find((s) => s.key === key);
    const parsed = row ? schema.safeParse(row.data) : null;
    return parsed?.success ? (parsed.data as z.infer<S>) : null;
  };

  const listing = section(SECTION_KEYS.listing, listingSchema);
  const amenities = section(SECTION_KEYS.amenities, amenitiesSchema);
  const commute = section(SECTION_KEYS.commute, commuteSchema);
  const p = report.property;

  /** "6 min" or "6 min (estimated)" in the agent's travel mode. */
  const time = (place: TravelTimes) => {
    const t = travelTime(place, mode);
    return `${t.minutes} min${t.estimated ? " (estimated)" : ""}`;
  };
  const verb = TRAVEL_MODES[mode].verb;

  const facts: Fact = {
    travelTimesBy: MODE_WORDS[mode],
    property: {
      address: p?.formattedAddress ?? report.inputAddress,
      unit: p?.unitNumber,
      city: p?.city,
      province: p?.province,
      type: listing?.propertyType,
      bedrooms: listing?.bedrooms,
      bathrooms: listing?.bathrooms,
      listPrice: listing?.listPrice
        ? `$${listing.listPrice.toLocaleString("en-CA")}`
        : null,
      agentNotes: listing?.features,
    },
  };

  if (amenities) {
    facts.nearby = Object.fromEntries(
      AMENITY_CATEGORIES.map((c) => [
        c.label,
        (amenities.categories[c.id] ?? []).slice(0, 3).map((place) => ({
          name: place.name,
          [verb]: time(place),
          distance: `${(place.distanceMeters / 1000).toFixed(1)} km`,
          rating: place.rating
            ? `${place.rating} (${place.ratingCount} reviews)`
            : null,
        })),
      ]),
    );
  }

  if (commute) {
    facts.commute = {
      calculatedFor: commute.departureLabel,
      destinations: commute.destinations.map((d) => ({
        to: d.label,
        drive: d.driveMinutes ? `${d.driveMinutes} min` : "not available",
        transit: d.transitMinutes ? `${d.transitMinutes} min` : "not available",
      })),
      nearestTransit: commute.stations.map((s) => ({
        name: s.name,
        type: s.kind,
        [verb]: time(s),
      })),
    };
  }

  const schools = section(SECTION_KEYS.schools, schoolsSchema);
  if (schools) {
    const describe = (s: School) => ({
      name: s.name,
      grades: s.gradeRange,
      // A long walk isn't worth quoting: give the distance instead.
      [verb]:
        mode !== "walk" || s.distanceMeters <= 2500
          ? time(s)
          : `${(s.distanceMeters / 1000).toFixed(1)} km`,
      eqao: Object.fromEntries(
        EQAO_FIELDS.filter((f) => s.results[f.id] != null).map((f) => [
          f.label,
          `${s.results[f.id]}% (Ontario avg ${schools.provincialAverage[f.id] ?? "n/a"}%)`,
        ]),
      ),
    });
    facts.nearestSchools = Object.fromEntries(
      schools.systems.map((sys) => [
        SCHOOL_SYSTEMS.find((x) => x.id === sys.id)!.label,
        {
          elementary: sys.elementary.map(describe),
          secondary: sys.secondary.map(describe),
        },
      ]),
    );
  }

  const demographics = section(SECTION_KEYS.demographics, demographicsSchema);
  if (demographics) {
    facts.census = {
      year: demographics.censusYear,
      area: demographics.area.label,
      comparedWith: demographics.city?.label ?? null,
      figures: Object.fromEntries(
        CENSUS_FIELDS.map((f) => [
          f.label,
          {
            area: demographics.area.values[f.id] ?? null,
            city: demographics.city?.values[f.id] ?? null,
            unit:
              f.format === "percent" ? "%" : f.format === "currency" ? "$" : "",
          },
        ]),
      ),
    };
  }

  const safety = section(SECTION_KEYS.safety, safetySchema);
  if (safety) {
    facts.safetyAndEnvironment = {
      crime: safety.crime
        ? {
            source: `${safety.crime.source}, ${safety.crime.year}`,
            neighbourhood: safety.crime.neighbourhood,
            ratesPer100k: Object.fromEntries(
              safety.crime.types.map((t) => [
                CRIME_TYPES.find((c) => c.id === t.id)!.label,
                { neighbourhood: t.rate, city: t.cityRate },
              ]),
            ),
          }
        : safety.crimeNote,
      crimeSeverity: safety.areaCrime
        ? {
            source: `${safety.areaCrime.source}, ${safety.areaCrime.year}`,
            area:
              safety.areaCrime.level === "service"
                ? `${safety.areaCrime.service} police service area`
                : "Ontario overall (no local figure published)",
            note: "Crime Severity Index: police-reported crime weighted by seriousness; 100 = Canada in 2006. Covers the whole police service area, not the neighbourhood.",
            index: safety.areaCrime.csi,
            violent: safety.areaCrime.violentCsi,
            nonViolent: safety.areaCrime.nonViolentCsi,
            ontario: safety.areaCrime.ontario.csi,
            canada: safety.areaCrime.canadaCsi,
            trend: Object.fromEntries(
              safety.areaCrime.trend.map((v, i) => [
                safety.areaCrime!.firstYear + i,
                v,
              ]),
            ),
          }
        : null,
      floodRegulation: {
        status: safety.flood.status,
        detail: safety.flood.note,
        criteria: safety.flood.criteria,
      },
      noise: {
        highway: safety.noise.highway
          ? `${safety.noise.highway.meters} m`
          : safety.noise.roadsCovered
            ? "none within 500 m"
            : "unknown",
        railway: safety.noise.railway
          ? `${safety.noise.railway.meters} m`
          : safety.noise.roadsCovered
            ? "none within 500 m"
            : "unknown",
        airport: safety.noise.airport
          ? `${safety.noise.airport.name}, ${safety.noise.airport.km} km`
          : null,
      },
    };
  }

  const upside = section(SECTION_KEYS.upside, upsideSchema);
  if (upside) {
    facts.futureProjects = {
      publicProjects: upside.projects.slice(0, 8).map((p) => ({
        name: p.name,
        category: p.category,
        status: p.status,
        expected: p.targetCompletion ?? "to be determined",
        distance: `${(p.distanceMeters / 1000).toFixed(1)} km`,
      })),
      developmentApplicationsWithin500m: upside.development
        ? {
            source: upside.development.source ?? "City of Toronto",
            count: upside.development.applications.length,
            homesProposed: upside.development.totalUnits || null,
            tallestStoreys: upside.development.tallestStoreys,
          }
        : (upside.developmentNote ?? "not available here"),
    };
  }

  return facts;
}

async function generate<S extends z.ZodType>(
  schema: S,
  facts: Fact,
  task: string,
) {
  return generateStructured({
    schema,
    instructions: SYSTEM_PROMPT,
    prompt: `<fact_sheet>\n${JSON.stringify(facts, null, 2)}\n</fact_sheet>\n\n${task}`,
  });
}

export async function extractAiInsights(reportId: string) {
  const report = await reportStore.findWithDetails(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const settings = copySettingsSchema.safeParse(
    report.sections.find((s) => s.key === SECTION_KEYS.copySettings)?.data,
  );
  const travelMode: TravelMode = settings.success
    ? settings.data.travelMode
    : "walk";
  const facts = buildFactSheet(report, travelMode);

  const [insights, marketing] = await Promise.all([
    generate(
      insightsSchema,
      facts,
      "Write the neighbourhood story for this property: a headline, a short summary, a 'day in this neighbourhood' paragraph, exactly 5 data-backed highlights and exactly 3 honest watch-outs, each with a way for the agent to address it.",
    ),
    generate(
      marketingSchema,
      facts,
      "Write the agent's marketing kit and showing playbook: MLS-ready listing descriptions in professional, warm and luxury tones; one social post each for Instagram, Facebook and LinkedIn with hashtags; a short email to the agent's buyer list; talking points for showings; likely buyer objections with suggested responses; the likely buyer profile described by needs and lifestyle; and a showing preparation checklist.",
    ),
  ]);

  const generatedAt = new Date().toISOString();
  await reportStore.setSection(reportId, SECTION_KEYS.insights, {
    ...insights.output,
    generatedAt,
    travelMode,
    generatedBy: insights.generatedBy,
  });
  await reportStore.setSection(reportId, SECTION_KEYS.marketing, {
    ...marketing.output,
    generatedAt,
    travelMode,
    generatedBy: marketing.generatedBy,
  });
  return {
    insightsBy: insights.generatedBy,
    marketingBy: marketing.generatedBy,
  };
}
