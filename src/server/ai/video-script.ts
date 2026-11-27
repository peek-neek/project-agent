// Writes the map video's script. Shared by Next.js and Trigger.dev tasks
// (no "server-only" import).
import type { z } from "zod";
import {
  amenitiesSchema,
  commuteSchema,
  insightsSchema,
  listingSchema,
  SECTION_KEYS,
  schoolsSchema,
} from "../../lib/report-sections";
import { TRAVEL_MODES, type TravelMode } from "../../lib/travel";
import {
  isMapScene,
  MAX_STOPS,
  type MapSceneKind,
  VIDEO_SCENE_KINDS,
  type VideoPlaces,
  type VideoScript,
  type VideoSection,
  videoPlaces,
  videoScriptSchema,
} from "../../lib/video";
import { buildVideoProps } from "../../video/props";
import { SYSTEM_PROMPT } from "../extractors/ai-insights";
import type { reportStore } from "../report-store";
import { generateStructured } from "./generate-structured";

type Report = NonNullable<
  Awaited<ReturnType<typeof reportStore.findWithDetails>>
>;

function section<S extends z.ZodType>(report: Report, key: string, schema: S) {
  const row = report.sections.find((s) => s.key === key);
  const parsed = row ? schema.safeParse(row.data) : null;
  return parsed?.success ? (parsed.data as z.infer<S>) : null;
}

/** The places this report's video can show, in the given travel mode. */
export function reportVideoPlaces(report: Report, mode: TravelMode) {
  return videoPlaces(
    {
      amenities: section(report, SECTION_KEYS.amenities, amenitiesSchema),
      commute: section(report, SECTION_KEYS.commute, commuteSchema),
      schools: section(report, SECTION_KEYS.schools, schoolsSchema),
    },
    mode,
  );
}

/** The composition's props for this report's saved video (see buildVideoProps). */
export function reportVideoProps(
  report: Report,
  video: VideoSection,
  audioSrc: (sceneIndex: number) => string,
) {
  return buildVideoProps({
    property: report.property,
    inputAddress: report.inputAddress,
    listing: section(report, SECTION_KEYS.listing, listingSchema),
    places: reportVideoPlaces(report, video.travelMode),
    video,
    audioSrc,
  });
}

const MODE_WORDS: Record<TravelMode, string> = {
  walk: "walking",
  bike: "cycling",
  drive: "driving (typical traffic)",
};

/** Short IDs in the prompt ("a1", "t2"): cheaper, and easy to validate. */
const PREFIX: Record<MapSceneKind, string> = {
  amenities: "a",
  commute: "t",
  schools: "s",
};

const TASK = `Write the voiceover script for a 30–40 second vertical (9:16) location video for social media. Each scene shows a map: a line is drawn from the home to each place you pick, labelled with its name and travel time, while your line is spoken and shown as captions.

Scenes, in this order (leave out commute or schools if its candidate list is empty):
- intro: a hook about the home's location. Title like "Life on Maple Avenue" (use the street name). No placeIds.
- amenities: pick 3–4 everyday places from different categories.
- commute: pick 1–3 transit stops, rapid transit first. The voiceover may also use one commute destination time.
- schools: pick 2–3 schools, nearest first. Say only how near they are, and end with a reminder to confirm catchment with the school board.
- outro: invite viewers to book a showing. No placeIds.

Voiceover rules:
- 14–28 words per scene, about 90–120 words in total. Spoken, warm and specific.
- Mention only the places picked for that scene, with their times exactly as given (say "about" when a time says "about"), in the travel mode given.
- Write times the way people say them ("a six-minute walk").
- No hashtags, emoji or URLs.

Titles: under 28 characters, no ending punctuation.
placeIds: copy the id values from that scene's candidates exactly.`;

export async function generateVideoScript(report: Report, mode: TravelMode) {
  const places = reportVideoPlaces(report, mode);
  const listing = section(report, SECTION_KEYS.listing, listingSchema);
  const insights = section(report, SECTION_KEYS.insights, insightsSchema);
  const verb = TRAVEL_MODES[mode].verb;
  const p = report.property;

  const alias = new Map<string, string>();
  const candidates = Object.fromEntries(
    (Object.keys(PREFIX) as MapSceneKind[]).map((kind) => [
      kind,
      places[kind].map((place, i) => {
        const id = `${PREFIX[kind]}${i + 1}`;
        alias.set(id, place.id);
        return {
          id,
          name: place.name,
          type: place.label,
          time: `${place.estimated ? "about " : ""}${place.minutes} min ${verb}`,
        };
      }),
    ]),
  );

  const facts = {
    travelTimesBy: MODE_WORDS[mode],
    property: {
      address: p?.formattedAddress ?? report.inputAddress,
      street: p?.streetName,
      city: p?.city,
      province: p?.province,
      type: listing?.propertyType,
      bedrooms: listing?.bedrooms,
      bathrooms: listing?.bathrooms,
      agentNotes: listing?.features,
    },
    locationHeadline: insights?.headline,
    commuteDestinations: places.destinations.map((d) => ({
      to: d.label,
      // Same cut-off as the video's cards: a 3-hour bus ride doesn't sell.
      byTransit:
        d.transitMinutes != null && d.transitMinutes <= 90
          ? `${d.transitMinutes} min`
          : null,
      byCar: d.driveMinutes != null ? `${d.driveMinutes} min` : null,
    })),
  };

  const { output, generatedBy } = await generateStructured({
    schema: videoScriptSchema,
    instructions: SYSTEM_PROMPT,
    prompt: `<fact_sheet>\n${JSON.stringify(facts, null, 2)}\n</fact_sheet>\n\n<candidates>\n${JSON.stringify(candidates, null, 2)}\n</candidates>\n\n<task>\n${TASK}\n</task>`,
    timeoutMs: 60_000,
  });
  return { script: resolveScript(output, alias, places), generatedBy };
}

/**
 * Swaps short IDs for real ones and drops any the AI made up. A map scene
 * left with no valid places falls back to the nearest three; scenes come
 * back in the fixed order, one of each kind.
 */
function resolveScript(
  script: VideoScript,
  alias: Map<string, string>,
  places: VideoPlaces,
): VideoScript {
  const seen = new Set<string>();
  const scenes = script.scenes.flatMap((scene) => {
    if (seen.has(scene.kind)) return [];
    seen.add(scene.kind);
    const base = {
      ...scene,
      title: scene.title.trim().replace(/[.!]+$/, ""),
      voiceover: scene.voiceover.trim(),
    };
    if (!isMapScene(scene.kind)) return [{ ...base, placeIds: [] }];
    const pool = places[scene.kind];
    let ids = [
      ...new Set(
        scene.placeIds
          .map((id) => alias.get(id.trim()))
          .filter((id): id is string => id != null),
      ),
    ]
      .filter((id) => pool.some((place) => place.id === id))
      .slice(0, MAX_STOPS);
    if (ids.length === 0) {
      if (pool.length === 0) return [];
      ids = pool.slice(0, 3).map((place) => place.id);
    }
    return [{ ...base, placeIds: ids }];
  });
  scenes.sort(
    (a, b) => VIDEO_SCENE_KINDS.indexOf(a.kind) - VIDEO_SCENE_KINDS.indexOf(b.kind),
  );
  if (scenes.length === 0) throw new Error("The AI returned an empty video script.");
  return { scenes };
}
