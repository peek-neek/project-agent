import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { VIDEO, type VideoStop } from "../../lib/video";
import type { VideoStats } from "../../lib/video-stats";
import { MapPlate, MAX_PLATE_SCALE, MIN_PLATE_SCALE } from "../map-plate";
import {
  CAPTION_TOP,
  Caption,
  Header,
  HEADER_BOTTOM,
  MapAttribution,
  Routes,
} from "../overlays";
import type { PropertyVideoProps, VideoScene } from "../props";
import { COLORS } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Future upside: what's planned or being built near the home, pinned on
 * the map one by one (no routes: these aren't trips), each labelled with
 * its type and status.
 */
export function UpsideScene({
  scene,
  home,
  stats,
}: {
  scene: VideoScene;
  home: PropertyVideoProps["home"];
  stats: VideoStats;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = scene;
  const pins = stats.upside?.pins ?? [];
  // The overlay draws stops; these carry no travel time.
  const stops: VideoStop[] = pins.map((p) => ({
    id: p.id,
    name: p.name,
    label: p.label,
    lat: p.lat,
    lng: p.lng,
    minutes: 0,
    estimated: false,
    color: p.color,
  }));

  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <MapPlate
        points={[[home.lng, home.lat], ...pins.map((p): [number, number] => [p.lng, p.lat])]}
        fit={{
          top: HEADER_BOTTOM + 60,
          bottom: VIDEO.height - CAPTION_TOP + 80,
          side: 170,
          maxZoom: 16,
        }}
        scale={interpolate(
          frame,
          [0, durationInFrames],
          [MIN_PLATE_SCALE + 0.02, MAX_PLATE_SCALE],
          clamp,
        )}
      >
        {(screen) =>
          screen && (
            <Routes
              home={screen[0]!}
              points={screen.slice(1)}
              stops={stops}
              verb=""
              lines={false}
              subtitles={pins.map((p) => p.label)}
              area={{ top: HEADER_BOTTOM + 20, bottom: CAPTION_TOP - 24 }}
              durationInFrames={durationInFrames}
            />
          )
        }
      </MapPlate>
      <MapAttribution />
      <Header eyebrow="Future upside" title={scene.title} />
      <Caption
        text={scene.voiceover}
        spokenFrames={durationInFrames - Math.round(0.6 * fps)}
      />
    </AbsoluteFill>
  );
}
