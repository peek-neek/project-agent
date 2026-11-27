// Runs inside the Trigger.dev "ai-insights" task.
import type { z } from "zod";
import {
  AMENITY_CATEGORIES,
  amenitiesSchema,
  CENSUS_FIELDS,
  CRIME_TYPES,
  commuteSchema,
  copySectionKey,
  copySettingsSchema,
  demographicsSchema,
  EQAO_FIELDS,
  insightsSchema,
  listingSchema,
  marketingSchema,
  campaignSchema,
  showingSchema,
  SCHOOL_SYSTEMS,
  type School,
  SECTION_KEYS,
  safetySchema,
  schoolsSchema,
  upsideSchema,
} from "../../lib/report-sections";
import {
  destinationTime,
  TRAVEL_MODES,
  type TravelMode,
  travelModes,
  type TravelTimes,
  travelTime,
} from "../../lib/travel";
import { generateStructured } from "../ai/generate-structured";
import { reportStore } from "../report-store";

export const SYSTEM_PROMPT = `You are a marketing strategist for real estate agents in Canada. You turn location data about a property into copy and talking points that help the agent sell it.

Rules:
- Use only the facts in the fact sheet. Never invent amenities, distances, school names, prices, room counts or features. If something isn't in the fact sheet, leave it out.
- Name real places from the fact sheet where it helps (for example "a 6-minute walk to Loblaws").
- Times to nearby places are for the travel mode in "travelTimesBy" (walking, cycling or driving). Describe them that way ("a 6-minute walk", "a 5-minute bike ride", "a 4-minute drive"); never call a cycling or driving time a walk. Commute destinations list their own drive and transit times.
- Travel times marked "estimated" are approximate: write "about" or "roughly".
- Schools: you may name nearby schools from the fact sheet and their travel time or distance. Never say or imply the property is in a school's catchment or boundary ("steps to", "in the district of" a specific school is fine only as distance). Suggest buyers confirm catchment with the school board or district. Test results (EQAO, for Ontario schools) are context for the agent, not marketing claims; don't rank or call schools "top" or "best".
- Census figures describe current residents of the area. Use them to understand the housing stock and lifestyle (for example many renters, mostly detached houses). Never use them to say who should or shouldn't buy, and never describe residents by age, family status or ethnicity in marketing copy.
- Places of worship, child care and similar amenities may be listed as conveniences ("a library, child care and places of worship within a short walk"). Never single out a faith or suggest the area suits a particular religion, family type or age group.
- Future projects: you may mention nearby transit, schools or hospitals that are under construction or planned, with their status (for example "a new LRT station, under construction about 200 m away"). Never promise opening dates beyond the fact sheet, never claim the home will rise in value, and treat nearby development applications as facts for the playbook, not marketing claims.
- Safety: never call an area "safe", "unsafe", "low-crime" or "high-crime" in marketing copy, social posts or emails. Crime, flood and noise facts may appear only in watch-outs and the playbook, stated as facts with their source.
- Follow the province's human rights code and the provincial real estate regulator's advertising rules (RECO in Ontario, BCFSA in British Columbia, RECA in Alberta, OACIQ in Quebec, or the local equivalent): don't describe, target or exclude buyers by race, ancestry, place of origin, ethnicity, citizenship, creed or religion, sex, sexual orientation, gender identity, age, marital or family status, or disability. Describe buyers by needs and lifestyle (for example "commuting professionals", "buyers who want walkability").
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
      destinations: commute.destinations.map((d) => {
        const trip = destinationTime(d, mode);
        return {
          to: d.label,
          drive: d.driveMinutes ? `${d.driveMinutes} min` : "not available",
          transit: d.transitMinutes
            ? `${d.transitMinutes} min`
            : "not available",
          // The agent's mode too, when it isn't driving.
          ...(mode !== "drive" && trip.minutes != null
            ? {
                [verb]: `${trip.minutes} min${trip.estimated ? " (estimated)" : ""}`,
              }
            : {}),
        };
      }),
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
                : `${safety.areaCrime.province.name} overall (no local figure published)`,
            note: "Crime Severity Index: police-reported crime weighted by seriousness; 100 = Canada in 2006. Covers the whole police service area, not the neighbourhood.",
            index: safety.areaCrime.csi,
            violent: safety.areaCrime.violentCsi,
            nonViolent: safety.areaCrime.nonViolentCsi,
            [safety.areaCrime.province.name]: safety.areaCrime.province.csi,
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

const TASKS = {
  insights:
    "Write the neighbourhood story for this property: a headline, a short summary, a 'day in this neighbourhood' paragraph, exactly 5 data-backed highlights and exactly 3 honest watch-outs, each with a way for the agent to address it.",
  marketing:
    "Write the agent's marketing kit and showing playbook: MLS-ready listing descriptions in professional, warm and luxury tones; one social post each for Instagram, Facebook and LinkedIn with hashtags; a short email to the agent's buyer list; talking points for showings; likely buyer objections with suggested responses; the likely buyer profile described by needs and lifestyle; and a showing preparation checklist.",
  campaign:
    "Write the full listing campaign: 5 headline options; a compact MLS public-remarks version; one social post for each campaign stage (coming soon, just listed, open house, price improved, sold); a 30-second Reel/TikTok script with a hook, 5–7 scenes (what to film, voiceover, on-screen text), caption and call to action; 6 Instagram carousel slides; Google/Meta ad headlines and descriptions within their character limits; an open house invitation email; and a short 'just listed' letter to neighbours.",
  showing:
    "Write the agent's showing-day toolkit: 3 distinct needs-based buyer personas (what each needs, the 3 facts to lead with, and which nearby place to show first); 5 tough buyer questions answered with a specific number from the fact sheet as proof; an open house plan (before, day of, after); a same-evening follow-up text to visitors; and a next-day follow-up email.",
} as const;

/**
 * All four AI sections for one travel mode, saved under mode keys
 * ("insights:bike"…). The agent's own mode is also saved under the plain
 * keys, which older readers and older reports use. The core (story and
 * marketing kit) must succeed; the campaign and showing kits are extras.
 */
async function writeCopyForMode(
  report: NonNullable<Awaited<ReturnType<typeof reportStore.findWithDetails>>>,
  mode: TravelMode,
  primary: boolean,
) {
  const facts = buildFactSheet(report, mode);
  const [insights, marketing, campaign, showing] = await Promise.allSettled([
    generate(insightsSchema, facts, TASKS.insights),
    generate(marketingSchema, facts, TASKS.marketing),
    generate(campaignSchema, facts, TASKS.campaign),
    generate(showingSchema, facts, TASKS.showing),
  ]);
  const generatedAt = new Date().toISOString();
  const saved: string[] = [];
  for (const [key, result] of [
    [SECTION_KEYS.insights, insights],
    [SECTION_KEYS.marketing, marketing],
    [SECTION_KEYS.campaign, campaign],
    [SECTION_KEYS.showing, showing],
  ] as const) {
    if (result.status !== "fulfilled") {
      console.error(`[ai] ${key} (${mode}) failed`, result.reason);
      continue;
    }
    const data = {
      ...result.value.output,
      generatedAt,
      travelMode: mode,
      generatedBy: result.value.generatedBy,
    };
    await reportStore.setSection(report.id, copySectionKey(key, mode), data);
    if (primary) await reportStore.setSection(report.id, key, data);
    saved.push(key);
  }
  if (insights.status === "rejected" || marketing.status === "rejected") {
    const reason =
      insights.status === "rejected"
        ? insights.reason
        : (marketing as PromiseRejectedResult).reason;
    if (primary) throw reason;
  }
  return saved;
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

  // The agent's mode first (saved as soon as it's written, so the tabs fill
  // in quickly), then the other two modes side by side, so switching modes
  // is instant.
  const primary = await writeCopyForMode(report, travelMode, true);
  const others = await Promise.allSettled(
    travelModes
      .filter((m) => m !== travelMode)
      .map(async (mode) => ({
        mode,
        saved: await writeCopyForMode(report, mode, false),
      })),
  );
  return {
    primary: { mode: travelMode, saved: primary },
    others: others.map((o) =>
      o.status === "fulfilled" ? o.value : { failed: String(o.reason) },
    ),
  };
}
