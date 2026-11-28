import {
  isMapScene,
  isStatScene,
  sceneStops,
  VIDEO,
  type VideoDestination,
  type VideoPlaces,
  type VideoSceneKind,
  type VideoSection,
  type VideoStop,
} from "../lib/video";
import type { Branding } from "../lib/branding";
import { decodePolyline } from "../lib/polyline";
import type { ListingData } from "../lib/report-sections";
import type { VideoStats } from "../lib/video-stats";
import { TRAVEL_MODES, type TravelMode } from "../lib/travel";

// Turns a report's saved video script into the composition's props. Pure,
// so the in-app Player and the MP4 render build identical videos.

export type VideoScene = {
  kind: VideoSceneKind;
  title: string;
  voiceover: string;
  durationInFrames: number;
  /** Voiceover clip, or null to play the scene silently (captions only). */
  audioSrc: string | null;
  stops: VideoStop[];
};

export type PropertyVideoProps = {
  home: { lat: number; lng: number };
  /** Street address line, e.g. "123 Maple Ave". */
  street: string;
  /** "Toronto, ON" */
  locality: string | null;
  /** Home facts for the closing card, e.g. ["3 bed", "2 bath"]. */
  facts: string[];
  destinations: VideoDestination[];
  /** "walk" | "drive": the word after each time. */
  verb: (typeof TRAVEL_MODES)[TravelMode]["verb"];
  scenes: VideoScene[];
  /** The closing card: the Pro agent's branding, else Areaview's. */
  branding: Branding;
  /** Figures for the overview, safety and neighbourhood cards; upside pins. */
  stats: VideoStats;
};

/** The brand card that closes every video (see scenes/brand-scene.tsx). */
export const BRAND_FRAMES = Math.round(3.5 * VIDEO.fps);

/** Frames two scenes overlap while one fades into the next. */
export const TRANSITION_FRAMES = 12;

/** Spoken pace used to time scenes that have no voiceover clip yet. */
const WORDS_PER_SECOND = 2.6;
const MIN_SECONDS: Record<VideoSceneKind, number> = {
  intro: 3.5,
  overview: 6,
  amenities: 5,
  commute: 5,
  schools: 5,
  safety: 6,
  neighbourhood: 5.5,
  upside: 5.5,
  outro: 4,
};
/** Breathing room after the voiceover ends, longer than the transition. */
const TAIL_SECONDS = 0.6;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

function sceneFrames(
  kind: VideoSceneKind,
  voiceover: string,
  audioSec: number | null,
  stops: number,
) {
  const spoken = audioSec ?? wordCount(voiceover) / WORDS_PER_SECOND;
  // Map scenes need time to draw every route; stat cards to fill their bars.
  const drawing = isMapScene(kind)
    ? 1.2 + stops * 0.9
    : kind === "upside"
      ? 1.2 + stops * 0.5
      : 0;
  const seconds = Math.max(MIN_SECONDS[kind], drawing, spoken + TAIL_SECONDS);
  return Math.ceil(seconds * VIDEO.fps);
}

/** The whole video: the scenes, then the brand card, minus the overlaps. */
export function totalFrames(scenes: Pick<VideoScene, "durationInFrames">[]) {
  const sum = scenes.reduce((n, s) => n + s.durationInFrames, 0) + BRAND_FRAMES;
  return Math.max(1, sum - TRANSITION_FRAMES * scenes.length);
}

const money = (n: number) =>
  `$${n.toLocaleString("en-CA", { maximumFractionDigits: 0 })}`;

function homeFacts(listing: ListingData | null) {
  if (!listing) return [];
  return [
    listing.bedrooms != null ? `${listing.bedrooms} bed` : null,
    listing.bathrooms != null ? `${listing.bathrooms} bath` : null,
    listing.propertyType && listing.propertyType !== "Other"
      ? listing.propertyType
      : null,
    listing.listPrice != null ? money(listing.listPrice) : null,
  ].filter((f): f is string => f != null);
}

/**
 * Null when the video can't be drawn yet (no location or no script).
 * `audioSrc(i)` is the URL of scene i's voiceover clip.
 */
export function buildVideoProps({
  property,
  inputAddress,
  listing,
  places,
  video,
  audioSrc,
  branding,
  stats,
}: {
  property: {
    latitude: number | null;
    longitude: number | null;
    formattedAddress: string | null;
    streetNumber: string | null;
    streetName: string | null;
    unitNumber: string | null;
    city: string | null;
    province: string | null;
  } | null;
  inputAddress: string;
  listing: ListingData | null;
  places: VideoPlaces;
  video: VideoSection | null;
  audioSrc: (sceneIndex: number) => string;
  branding: Branding;
  stats: VideoStats;
}): PropertyVideoProps | null {
  if (property?.latitude == null || property.longitude == null) return null;
  if (!video?.script) return null;

  const street =
    property.streetNumber && property.streetName
      ? `${property.unitNumber ? `${property.unitNumber}-` : ""}${property.streetNumber} ${property.streetName}`
      : (property.formattedAddress ?? inputAddress).split(",")[0]!.trim();
  const locality =
    [property.city, property.province].filter(Boolean).join(", ") || null;

  const scenes = video.script.scenes
    .map((scene, i) => {
      const stops = sceneStops(places, scene.kind, scene.placeIds).map((s) => {
        const encoded = video.routes?.[s.id];
        const path = encoded ? decodePolyline(encoded) : [];
        // A usable route has a start and an end; else the curved line.
        return path.length >= 2 ? { ...s, path } : s;
      });
      const clip = video.audio?.[i] ?? null;
      return {
        kind: scene.kind,
        title: scene.title,
        voiceover: scene.voiceover,
        stops,
        audioSrc: clip ? audioSrc(i) : null,
        durationInFrames: sceneFrames(
          scene.kind,
          scene.voiceover,
          clip?.durationSec ?? null,
          scene.kind === "upside"
            ? (stats.upside?.pins.length ?? 0)
            : stops.length,
        ),
      };
    })
    // A scene whose places or figures are gone (data refreshed) has nothing
    // to show.
    .filter((s) =>
      isMapScene(s.kind)
        ? s.stops.length > 0
        : isStatScene(s.kind) || s.kind === "upside"
          ? stats[s.kind] != null
          : true,
    );

  if (scenes.length === 0) return null;

  return {
    home: { lat: property.latitude, lng: property.longitude },
    street,
    locality,
    facts: homeFacts(listing),
    destinations: places.destinations,
    verb: TRAVEL_MODES[video.travelMode].verb,
    scenes,
    branding,
    stats,
  };
}
