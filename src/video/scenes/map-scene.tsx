import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type MapSceneKind, VIDEO, type VideoDestination } from "../../lib/video";
import { MapPlate, MAX_PLATE_SCALE, MIN_PLATE_SCALE } from "../map-plate";
import {
  CAPTION_TOP,
  Caption,
  DESTINATIONS_TOP,
  Header,
  HEADER_BOTTOM,
  MapAttribution,
  Routes,
} from "../overlays";
import type { PropertyVideoProps, VideoScene } from "../props";
import { COLORS, EASE_OUT, SAFE } from "../theme";

const EYEBROWS: Record<MapSceneKind, string> = {
  amenities: "Everyday essentials",
  commute: "Getting around",
  schools: "Schools nearby",
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Amenities, transit or schools: lines from the home to each place. */
export function MapScene({
  scene,
  home,
  verb,
  destinations,
}: {
  scene: VideoScene & { kind: MapSceneKind };
  home: PropertyVideoProps["home"];
  verb: string;
  destinations: VideoDestination[];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The scene's own length: inside TransitionSeries, useVideoConfig()
  // reports the whole video's.
  const { durationInFrames } = scene;
  const showDestinations = scene.kind === "commute" && destinations.length > 0;
  const contentBottom = showDestinations ? DESTINATIONS_TOP : CAPTION_TOP;

  const points: [number, number][] = [
    [home.lng, home.lat],
    ...scene.stops.map((s): [number, number] => [s.lng, s.lat]),
  ];

  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <MapPlate
        points={points}
        paths={scene.stops.map((s) => s.path ?? [])}
        fit={{
          top: HEADER_BOTTOM + 60,
          bottom: VIDEO.height - contentBottom + 80,
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
        {(screen, screenPaths) =>
          screen && (
            <Routes
              home={screen[0]!}
              points={screen.slice(1)}
              paths={screenPaths}
              stops={scene.stops}
              verb={verb}
              area={{ top: HEADER_BOTTOM + 20, bottom: contentBottom - 24 }}
              durationInFrames={durationInFrames}
            />
          )
        }
      </MapPlate>
      <MapAttribution />
      <Header eyebrow={EYEBROWS[scene.kind]} title={scene.title} />
      {showDestinations && <Destinations destinations={destinations} />}
      <Caption
        text={scene.voiceover}
        spokenFrames={durationInFrames - Math.round(0.6 * fps)}
      />
    </AbsoluteFill>
  );
}

/** Transit beyond this isn't a selling point, so it's left off the card. */
const MAX_TRANSIT_MINUTES = 90;

/**
 * Leads with transit when it's competitive with driving (within 1.5×),
 * else with the drive; a slow transit trip isn't shown at all.
 */
function destinationTimes(d: VideoDestination) {
  const transit =
    d.transitMinutes != null && d.transitMinutes <= MAX_TRANSIT_MINUTES
      ? { minutes: d.transitMinutes, mode: "by transit" }
      : null;
  const drive =
    d.driveMinutes != null ? { minutes: d.driveMinutes, mode: "by car" } : null;
  const transitFirst =
    transit != null && (drive == null || transit.minutes <= drive.minutes * 1.5);
  const [primary, other] = transitFirst ? [transit, drive] : [drive, transit];
  return {
    primary,
    secondary: primary && other ? `${other.minutes} min ${other.mode}` : null,
  };
}

/** Commute: drive and transit times to the nearest downtown and airport. */
function Destinations({ destinations }: { destinations: VideoDestination[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        right: SAFE.x,
        top: DESTINATIONS_TOP,
        height: CAPTION_TOP - DESTINATIONS_TOP - 24,
        display: "flex",
        gap: 20,
      }}
    >
      {destinations.map((d, i) => {
        const start = (0.5 + i * 0.25) * fps;
        const { primary, secondary } = destinationTimes(d);
        return (
          <div
            key={d.label}
            style={{
              flex: 1,
              minWidth: 0,
              background: COLORS.card,
              borderTop: `8px solid ${COLORS.ink}`,
              padding: "20px 26px",
              boxShadow: "0 10px 30px rgba(22,22,20,0.14)",
              opacity: interpolate(frame, [start, start + 0.3 * fps], [0, 1], clamp),
              translate: interpolate(
                frame,
                [start, start + 0.45 * fps],
                ["0px 24px", "0px 0px"],
                { ...clamp, easing: Easing.bezier(...EASE_OUT) },
              ),
            }}
          >
            <div
              style={{
                fontSize: 28,
                color: COLORS.muted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {d.label}
            </div>
            {primary && (
              <div style={{ marginTop: 6, color: COLORS.ink }}>
                <span style={{ fontSize: 52, fontWeight: 700 }}>
                  {primary.minutes} min
                </span>{" "}
                <span style={{ fontSize: 28, fontWeight: 500 }}>
                  {primary.mode}
                </span>
              </div>
            )}
            {secondary && (
              <div style={{ marginTop: 2, fontSize: 26, color: COLORS.muted }}>
                {secondary}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
