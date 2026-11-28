import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type StatSceneKind, VIDEO } from "../../lib/video";
import type { StatTone, VideoStats } from "../../lib/video-stats";
import { MapPlate, MAX_PLATE_SCALE, MIN_PLATE_SCALE } from "../map-plate";
import {
  CAPTION_TOP,
  Caption,
  Header,
  HEADER_BOTTOM,
  MapAttribution,
} from "../overlays";
import type { PropertyVideoProps, VideoScene } from "../props";
import { COLORS, EASE_OUT, SAFE } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const EYEBROWS: Record<StatSceneKind, string> = {
  overview: "The report at a glance",
  safety: "Safety & environment",
  neighbourhood: "Homes in the area",
};

const TONES: Record<StatTone, string> = {
  good: "#16a34a",
  warn: "#d97706",
  bad: COLORS.primary,
  neutral: COLORS.muted,
};

/** Score colours, matching the app's 1–5 levels. */
const LEVEL_COLORS = ["#d10001", "#ea580c", "#ca8a04", "#65a30d", "#16a34a"];
const levelColor = (score: number) =>
  LEVEL_COLORS[Math.min(5, Math.max(1, Math.round(score))) - 1]!;

/**
 * Overview, safety or neighbourhood: the report's figures on a card over
 * the map around the home, each line arriving in turn.
 */
export function StatScene({
  scene,
  home,
  stats,
}: {
  scene: VideoScene & { kind: StatSceneKind };
  home: PropertyVideoProps["home"];
  stats: VideoStats;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { durationInFrames } = scene;
  // Lines arrive one by one over the first half of the scene.
  const at = (i: number) => Math.round((0.5 + i * 0.32) * fps);
  const enter = (start: number) => ({
    opacity: interpolate(frame, [start, start + 0.3 * fps], [0, 1], clamp),
    translate: interpolate(frame, [start, start + 0.5 * fps], ["0px 24px", "0px 0px"], {
      ...clamp,
      easing: Easing.bezier(...EASE_OUT),
    }),
  });
  /** 0–1 fill of a bar that starts at `start`. */
  const fill = (start: number) =>
    interpolate(frame, [start, start + 0.7 * fps], [0, 1], {
      ...clamp,
      easing: Easing.bezier(...EASE_OUT),
    });

  let body: ReactNode = null;
  if (scene.kind === "overview" && stats.overview) {
    const o = stats.overview;
    body = (
      <>
        <div style={enter(at(0))}>
          <div style={{ fontSize: 34, color: COLORS.muted }}>Sell / rent ease</div>
          <div
            style={{
              fontSize: 112,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: o.color,
            }}
          >
            {o.label}
          </div>
          <Segments score={o.level} color={o.color} progress={fill(at(0))} height={22} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, marginTop: 20 }}>
          {o.rows.map((row, i) => (
            <div
              key={row.label}
              style={{
                display: "grid",
                gridTemplateColumns: "340px 1fr 90px",
                alignItems: "center",
                gap: 24,
                ...enter(at(i + 1)),
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 500, color: COLORS.ink }}>
                {row.label}
              </div>
              <Segments
                score={row.score}
                color={levelColor(row.score)}
                progress={fill(at(i + 1))}
                height={18}
              />
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  textAlign: "right",
                  color: COLORS.ink,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.score.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else if (scene.kind === "safety" && stats.safety) {
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        {stats.safety.items.map((item, i) => (
          <div
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: 28, ...enter(at(i)) }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                borderRadius: 999,
                background: TONES[item.tone],
                boxShadow: `0 0 0 8px ${TONES[item.tone]}22`,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 32, color: COLORS.muted }}>{item.label}</div>
              <div style={{ fontSize: 48, fontWeight: 600, color: COLORS.ink, lineHeight: 1.15 }}>
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (scene.kind === "neighbourhood" && stats.neighbourhood) {
    const n = stats.neighbourhood;
    const top = Math.max(1, ...n.homes.map((h) => h.share));
    body = (
      <>
        {n.homes.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
            {n.homes.map((h, i) => (
              <div key={h.label} style={enter(at(i))}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 40,
                    color: COLORS.ink,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{h.label}</span>
                  <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {h.share}%
                  </span>
                </div>
                <div style={{ marginTop: 12, height: 22, background: COLORS.border }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${(h.share / top) * 100 * fill(at(i))}%`,
                      background: COLORS.ink,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {n.owners != null && n.renters != null && (
          <div style={{ marginTop: 26, ...enter(at(n.homes.length)) }}>
            <div style={{ fontSize: 34, color: COLORS.muted }}>Owned and rented</div>
            <div style={{ display: "flex", height: 64, marginTop: 14 }}>
              <div
                style={{
                  width: `${n.owners * fill(at(n.homes.length))}%`,
                  background: COLORS.primary,
                }}
              />
              <div style={{ flex: 1, background: COLORS.border }} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 12,
                fontSize: 40,
                fontWeight: 600,
                color: COLORS.ink,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{n.owners}% owned</span>
              <span style={{ color: COLORS.muted }}>{n.renters}% rented</span>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <MapPlate
        points={[[home.lng, home.lat]]}
        fit={{
          top: SAFE.top,
          bottom: VIDEO.height - CAPTION_TOP,
          side: SAFE.x,
          maxZoom: 14.5,
        }}
        scale={interpolate(
          frame,
          [0, durationInFrames],
          [MIN_PLATE_SCALE + 0.01, MAX_PLATE_SCALE],
          clamp,
        )}
      >
        {() => null}
      </MapPlate>
      {/* Soften the map so the card reads first. */}
      <AbsoluteFill style={{ background: "rgba(246,245,244,0.55)" }} />
      <MapAttribution />
      <Header eyebrow={EYEBROWS[scene.kind]} title={scene.title} />
      <div
        style={{
          position: "absolute",
          left: SAFE.x,
          right: SAFE.x,
          top: HEADER_BOTTOM + 40,
          maxHeight: CAPTION_TOP - HEADER_BOTTOM - 80,
          background: COLORS.card,
          borderTop: `10px solid ${COLORS.ink}`,
          boxShadow: "0 20px 50px rgba(22,22,20,0.18)",
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
          overflow: "hidden",
          ...enter(Math.round(0.2 * fps)),
        }}
      >
        {body}
      </div>
      <Caption
        text={scene.voiceover}
        spokenFrames={durationInFrames - Math.round(0.6 * fps)}
      />
    </AbsoluteFill>
  );
}

/** Five blocks filled to `score` (fractions fill part of a block). */
function Segments({
  score,
  color,
  progress,
  height,
}: {
  score: number;
  color: string;
  progress: number;
  height: number;
}) {
  const shown = score * progress;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ flex: 1, height, background: COLORS.border }}>
          <div
            style={{
              height: "100%",
              width: `${Math.max(0, Math.min(1, shown - i)) * 100}%`,
              background: color,
            }}
          />
        </div>
      ))}
    </div>
  );
}
