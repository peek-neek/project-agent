import { z } from "zod";
import {
  AMENITY_CATEGORIES,
  type AmenitiesData,
  type CommuteData,
  SCHOOL_SYSTEMS,
  type SchoolsData,
  TRANSIT_KINDS,
  travelModeSchema,
} from "./report-sections";
import { type TravelMode, travelTime } from "./travel";

// Shared (server, client and the Remotion composition): the map video's
// script schema, its stored section and the places it can show.

export const VIDEO = { fps: 30, width: 1080, height: 1920 } as const;

export const VIDEO_SECTION_KEY = "video";

/** Every scene, in the order the video plays them. */
export const VIDEO_SCENE_KINDS = [
  "intro",
  "overview",
  "amenities",
  "commute",
  "schools",
  "safety",
  "neighbourhood",
  "upside",
  "outro",
] as const;
export type VideoSceneKind = (typeof VIDEO_SCENE_KINDS)[number];

/** Scenes that show the report's figures as cards over the map. */
export type StatSceneKind = "overview" | "safety" | "neighbourhood";
export const isStatScene = (kind: VideoSceneKind): kind is StatSceneKind =>
  kind === "overview" || kind === "safety" || kind === "neighbourhood";

/** Scenes that draw lines from the home to places. */
export type MapSceneKind = "amenities" | "commute" | "schools";
export const isMapScene = (kind: VideoSceneKind): kind is MapSceneKind =>
  kind === "amenities" || kind === "commute" || kind === "schools";

/** Most places one scene shows, so lines and labels stay readable. */
export const MAX_STOPS = 4;

/**
 * What the AI writes. Limits live in descriptions (some providers'
 * structured output rejects length constraints). `placeIds` are the short
 * IDs from the prompt; the server swaps them for real IDs before saving.
 */
export const videoScriptSchema = z.object({
  scenes: z
    .array(
      z.object({
        kind: z.enum(VIDEO_SCENE_KINDS),
        title: z.string().describe("On-screen title, under 28 characters."),
        voiceover: z
          .string()
          .describe("The spoken line for this scene, 14–28 words."),
        placeIds: z
          .array(z.string())
          .describe(
            "IDs from this scene's candidate list (2–4) for amenities, commute and schools. Empty for every other scene.",
          ),
      }),
    )
    .describe(
      "Scenes in this order: intro, overview, amenities, commute, schools, safety, neighbourhood, upside, outro. Leave out any scene whose facts or candidates are missing.",
    ),
});
export type VideoScript = z.infer<typeof videoScriptSchema>;

const videoStatuses = ["writing", "voicing", "ready", "failed"] as const;
export type VideoStatus = (typeof videoStatuses)[number];

/** The exported MP4: one at a time, tied to the script it was made from. */
export const videoRenderSchema = z.object({
  status: z.enum(["rendering", "ready", "failed"]),
  /** videoVersion() of the script and voiceover it was rendered from. */
  version: z.string(),
  /** brandingKey() of the closing card it was rendered with. */
  brand: z.string().default(""),
  /** 0–1 while rendering. */
  progress: z.number().default(0),
  pathname: z.string().nullable().default(null),
  sizeBytes: z.number().nullable().default(null),
  error: z.string().nullable().default(null),
  startedAt: z.string(),
  renderedAt: z.string().nullable().default(null),
});
export type VideoRender = z.infer<typeof videoRenderSchema>;

export const videoSectionSchema = z.object({
  status: z.enum(videoStatuses),
  error: z.string().nullable().default(null),
  /** Travel mode the times and voiceover are written for. */
  travelMode: travelModeSchema,
  /** Saved with real place IDs. Null until the first script is written. */
  script: videoScriptSchema.nullable(),
  /** One voiceover clip per scene (same order); null when there's none. */
  audio: z
    .array(z.object({ pathname: z.string(), durationSec: z.number() }))
    .nullable(),
  /** Why there's no voiceover (e.g. storage isn't configured). */
  audioNote: z.string().nullable().default(null),
  generatedBy: z
    .object({ provider: z.string(), model: z.string() })
    .nullable()
    .default(null),
  render: videoRenderSchema.nullable().default(null),
  /**
   * Street routes from the home to each place in the script (place ID →
   * Google encoded polyline), drawn as progress bars along the streets.
   * Missing ones fall back to a curved line.
   */
  routes: z.record(z.string(), z.string()).nullable().default(null),
  updatedAt: z.string(),
});
export type VideoSection = z.infer<typeof videoSectionSchema>;

export const isVideoWorking = (video: VideoSection | null) =>
  video?.status === "writing" || video?.status === "voicing";

/** A render that hasn't reported in this long is treated as dead. */
const RENDER_TIMEOUT_MS = 20 * 60_000;

export const isRenderActive = (video: VideoSection | null, now = Date.now()) =>
  video?.render?.status === "rendering" &&
  now - Date.parse(video.render.startedAt) < RENDER_TIMEOUT_MS;

/**
 * Identifies what the video says and sounds like: the script, travel mode
 * and voiceover clips. An MP4 is current while its version matches; any
 * rewrite changes it. (FNV-1a: short, stable, same on server and client.)
 */
export function videoVersion(
  video: Pick<VideoSection, "script" | "audio" | "travelMode"> &
    Partial<Pick<VideoSection, "routes">>,
) {
  const text = JSON.stringify([
    video.travelMode,
    video.script,
    video.audio,
    // Only when present, so videos made before routes keep their version.
    ...(video.routes ? [video.routes] : []),
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/** The exported MP4 when it matches the current script, else null. */
export function currentRender(video: VideoSection | null) {
  const render = video?.render;
  return render && video?.script && render.version === videoVersion(video)
    ? render
    : null;
}

// ---------------------------------------------------------------------------
// Places the video can show
// ---------------------------------------------------------------------------

export type VideoStop = {
  id: string;
  name: string;
  /** Category, transit kind or school system, e.g. "Groceries". */
  label: string;
  lat: number;
  lng: number;
  minutes: number;
  estimated: boolean;
  color: string;
  /** The street route from the home, [lng, lat]; absent: a curved line. */
  path?: [number, number][];
};

export type VideoDestination = {
  label: string;
  transitMinutes: number | null;
  driveMinutes: number | null;
};

export type VideoPlaces = Record<MapSceneKind, VideoStop[]> & {
  destinations: VideoDestination[];
};

/** Everyday categories, in the order they're offered to the AI. */
const VIDEO_AMENITIES = [
  "groceries",
  "cafes",
  "parks",
  "restaurants",
  "pharmacies",
  "gyms",
  "libraries",
  "shopping",
  "entertainment",
] as const;

/** Minutes an everyday errand can take and still be worth showing. */
const EASY_REACH: Record<TravelMode, number> = { walk: 25, drive: 15 };

const byDistance =(a: { distanceMeters: number }, b: { distanceMeters: number }) =>
  a.distanceMeters - b.distanceMeters;

/**
 * The places a video can use, nearest first, with times in the agent's
 * travel mode. The AI picks from these lists and the composition draws
 * them, so a place can't appear unless it's in the report.
 */
export function videoPlaces(
  data: {
    amenities: AmenitiesData | null;
    commute: CommuteData | null;
    schools: SchoolsData | null;
  },
  mode: TravelMode,
): VideoPlaces {
  const stop = (
    place: {
      id: string;
      name: string;
      lat: number;
      lng: number;
      distanceMeters: number;
      walkMinutes: number;
      walkEstimated: boolean;
      driveMinutes?: number | null;
      driveEstimated?: boolean | null;
    },
    label: string,
    color: string,
  ): VideoStop => {
    const t = travelTime(place, mode);
    return {
      id: place.id,
      name: place.name,
      label,
      lat: place.lat,
      lng: place.lng,
      minutes: t.minutes,
      estimated: t.estimated,
      color,
    };
  };

  const allAmenities = VIDEO_AMENITIES.flatMap((id) => {
    const category = AMENITY_CATEGORIES.find((c) => c.id === id)!;
    return [...(data.amenities?.categories[id] ?? [])]
      .sort(byDistance)
      .slice(0, 2)
      .map((p) => stop(p, category.label, category.color));
  });
  // A "47 min walk" is true but doesn't sell: keep places within easy reach,
  // or the nearest three when nothing is.
  const reachable = allAmenities.filter((s) => s.minutes <= EASY_REACH[mode]);
  const amenities =
    reachable.length > 0
      ? reachable
      : [...allAmenities].sort((a, b) => a.minutes - b.minutes).slice(0, 3);

  // Nearest two of each kind, then nearest overall, so a subway station
  // isn't crowded out by six bus stops.
  const stations = Object.keys(TRANSIT_KINDS)
    .flatMap((kind) =>
      (data.commute?.stations ?? [])
        .filter((s) => s.kind === kind)
        .sort(byDistance)
        .slice(0, 2),
    )
    .sort(byDistance)
    .slice(0, 6)
    .map((s) => {
      const meta = TRANSIT_KINDS[s.kind];
      return stop(s, meta.label, meta.color);
    });

  const schools = (data.schools?.systems ?? [])
    .flatMap((system) => {
      const meta = SCHOOL_SYSTEMS.find((s) => s.id === system.id)!;
      const nearest = [
        [...system.elementary].sort(byDistance)[0],
        [...system.secondary].sort(byDistance)[0],
      ].filter((s) => s != null);
      return nearest.map((s) => ({
        school: s,
        // Outside Ontario there's one "Nearby schools" system: level only.
        label: system.id === "nearby" ? s.level : `${meta.label} · ${s.level}`,
        color: meta.color,
      }));
    })
    .sort((a, b) => byDistance(a.school, b.school))
    .slice(0, 6)
    .map(({ school, label, color }) => stop(school, label, color));

  const destinations = (data.commute?.destinations ?? [])
    .slice(0, 2)
    .map((d) => ({
      label: d.label,
      transitMinutes: d.transitMinutes,
      driveMinutes: d.driveMinutes,
    }));

  return { amenities, commute: stations, schools, destinations };
}

/** A scene's stops, in the script's order, skipping IDs no longer present. */
export function sceneStops(
  places: VideoPlaces,
  kind: VideoSceneKind,
  placeIds: string[],
): VideoStop[] {
  if (!isMapScene(kind)) return [];
  const pool = places[kind];
  return placeIds
    .map((id) => pool.find((p) => p.id === id))
    .filter((p): p is VideoStop => p != null)
    .slice(0, MAX_STOPS);
}
