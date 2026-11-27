import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../overlays";
import type { VideoScene } from "../props";
import { COLORS, EASE_OUT, SAFE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The address, the home's facts and the call to action. */
export function OutroScene({
  scene,
  street,
  locality,
  facts,
}: {
  scene: VideoScene;
  street: string;
  locality: string | null;
  facts: string[];
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
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          top: 420,
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <div
          style={{
            width: 120,
            height: 14,
            background: COLORS.primary,
            ...enter(0.1 * fps),
          }}
        />
        <div
          style={{
            fontSize: 100,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.025em",
            color: COLORS.ink,
            textWrap: "balance",
            ...enter(0.2 * fps),
          }}
        >
          {scene.title}
        </div>
        <div style={{ ...enter(0.45 * fps) }}>
          <div style={{ fontSize: 52, fontWeight: 600, color: COLORS.ink }}>
            {street}
          </div>
          {locality && (
            <div style={{ marginTop: 6, fontSize: 40, color: COLORS.muted }}>
              {locality}
            </div>
          )}
        </div>
        {facts.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {facts.map((fact, i) => (
              <div
                key={fact}
                style={{
                  border: `3px solid ${COLORS.ink}`,
                  background: COLORS.card,
                  padding: "14px 26px",
                  fontSize: 40,
                  fontWeight: 600,
                  color: COLORS.ink,
                  fontVariantNumeric: "tabular-nums",
                  ...enter((0.7 + i * 0.12) * fps),
                }}
              >
                {fact}
              </div>
            ))}
          </div>
        )}
      </div>

      <Caption
        text={scene.voiceover}
        spokenFrames={durationInFrames - Math.round(0.6 * fps)}
      />
    </AbsoluteFill>
  );
}
