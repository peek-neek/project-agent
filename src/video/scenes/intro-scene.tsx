import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { VIDEO } from "../../lib/video";
import { MapPlate, MAX_PLATE_SCALE, MIN_PLATE_SCALE } from "../map-plate";
import { CAPTION_TOP, Caption, HomeMarker, MapAttribution } from "../overlays";
import type { PropertyVideoProps, VideoScene } from "../props";
import { COLORS, EASE_OUT, SAFE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** The title card's height, kept clear of the home on the map. */
const CARD_SPACE = 420;

/** The home on its street, then the address. */
export function IntroScene({
  scene,
  home,
  street,
  locality,
}: {
  scene: VideoScene;
  home: PropertyVideoProps["home"];
  street: string;
  locality: string | null;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // The scene's own length: inside TransitionSeries, useVideoConfig()
  // reports the whole video's.
  const { durationInFrames } = scene;
  const enter = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 0.4 * fps], [0, 1], clamp),
    translate: interpolate(
      frame,
      [delay, delay + 0.6 * fps],
      ["0px 40px", "0px 0px"],
      { ...clamp, easing: Easing.bezier(...EASE_OUT) },
    ),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <MapPlate
        points={[[home.lng, home.lat]]}
        fit={{
          top: SAFE.top,
          bottom: VIDEO.height - CAPTION_TOP + CARD_SPACE,
          side: SAFE.x,
          maxZoom: 15.6,
        }}
        scale={interpolate(
          frame,
          [0, durationInFrames],
          [MIN_PLATE_SCALE + 0.01, MAX_PLATE_SCALE],
          clamp,
        )}
      >
        {(screen) => screen && <HomeMarker point={screen[0]!} drop />}
      </MapPlate>
      <MapAttribution />

      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          bottom: VIDEO.height - CAPTION_TOP + 24,
          background: COLORS.card,
          borderLeft: `14px solid ${COLORS.primary}`,
          padding: "34px 40px 38px",
          boxShadow: "0 18px 50px rgba(22,22,20,0.18)",
          ...enter(0.5 * fps),
        }}
      >
        {locality && (
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLORS.primary,
            }}
          >
            {locality}
          </div>
        )}
        <div
          style={{
            marginTop: 10,
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.02em",
            color: COLORS.ink,
            textWrap: "balance",
          }}
        >
          {scene.title}
        </div>
        <div style={{ marginTop: 14, fontSize: 44, color: COLORS.muted }}>
          {street}
        </div>
      </div>

      <Caption
        text={scene.voiceover}
        spokenFrames={durationInFrames - Math.round(0.6 * fps)}
      />
    </AbsoluteFill>
  );
}
