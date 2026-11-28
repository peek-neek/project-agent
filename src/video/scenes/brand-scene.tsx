import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AREAVIEW, type Branding, contactLines } from "../../lib/branding";
import { COLORS, EASE_OUT, SAFE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * The last card: who the video is from. Pro agents get their logo,
 * brokerage and contact details; everyone else Areaview's mark.
 */
export function BrandScene({ branding }: { branding: Branding }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 0.4 * fps], [0, 1], clamp),
    translate: interpolate(
      frame,
      [delay, delay + 0.6 * fps],
      ["0px 40px", "0px 0px"],
      { ...clamp, easing: Easing.bezier(...EASE_OUT) },
    ),
  });

  const column = {
    position: "absolute",
    left: SAFE.x,
    right: SAFE.x,
    top: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: 28,
    // A long email or website wraps instead of running off the frame.
    overflowWrap: "anywhere",
  } as const;

  if (branding.kind === "areaview") {
    return (
      <AbsoluteFill style={{ background: COLORS.paper }}>
        <div style={column}>
          <svg viewBox="0 0 24 24" width={220} height={220} style={enter(0.1 * fps)}>
            <path fill={COLORS.primary} d={AREAVIEW.markPath} />
          </svg>
          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: COLORS.ink,
              ...enter(0.25 * fps),
            }}
          >
            {AREAVIEW.name}
          </div>
          <div
            style={{
              fontSize: 44,
              color: COLORS.muted,
              maxWidth: 760,
              textWrap: "balance",
              ...enter(0.4 * fps),
            }}
          >
            {AREAVIEW.tagline}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  const contacts = contactLines(branding);
  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <div style={column}>
        {branding.logoSrc && (
          <Img
            src={branding.logoSrc}
            style={{
              width: 300,
              height: 300,
              objectFit: "contain",
              marginBottom: 12,
              ...enter(0.1 * fps),
            }}
          />
        )}
        <div
          style={{
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: COLORS.ink,
            textWrap: "balance",
            ...enter(0.25 * fps),
          }}
        >
          {branding.brokerage}
        </div>
        {contacts.length > 0 && (
          <>
            <div
              style={{
                width: 120,
                height: 12,
                background: COLORS.primary,
                ...enter(0.5 * fps),
              }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 46,
                fontWeight: 500,
                color: COLORS.ink,
                fontVariantNumeric: "tabular-nums",
                ...enter(0.6 * fps),
              }}
            >
              {contacts.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
}
