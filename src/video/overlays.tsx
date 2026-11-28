import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { VIDEO, type VideoStop } from "../lib/video";
import type { ScreenPoint } from "./map-plate";
import { COLORS, EASE_OUT, SAFE } from "./theme";

// Frame-driven overlays shared by the scenes. Plain elements, not the app's
// shadcn components: video frames are rendered headless, without Tailwind,
// and anything timed by CSS transitions wouldn't render.

const W = VIDEO.width;
const H = VIDEO.height;
const easeOut = Easing.bezier(...EASE_OUT);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Where the caption box ends; scenes keep places above this line. */
export const CAPTION_TOP = 1590;
/** Where commute's destination cards start (above the caption). */
export const DESTINATIONS_TOP = 1390;
/** Below the header card (two-line titles included). */
export const HEADER_BOTTOM = 470;

export function Header({ eyebrow, title }: { eyebrow: string; title: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        right: SAFE.x,
        top: SAFE.top,
        background: COLORS.card,
        borderLeft: `14px solid ${COLORS.primary}`,
        padding: "30px 40px 34px",
        boxShadow: "0 18px 50px rgba(22,22,20,0.16)",
        opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], clamp),
        translate: interpolate(frame, [0, 0.5 * fps], ["0px -40px", "0px 0px"], {
          ...clamp,
          easing: easeOut,
        }),
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: COLORS.primary,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 84,
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: "-0.02em",
          color: COLORS.ink,
          textWrap: "balance",
        }}
      >
        {title}
      </div>
    </div>
  );
}

/** Splits a line into short caption chunks, breaking after punctuation. */
function captionChunks(text: string, maxWords = 7) {
  const out: string[] = [];
  let current: string[] = [];
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    current.push(word);
    const pause = /[.,;:!?—]$/.test(word) && current.length >= 3;
    if (current.length >= maxWords || pause) {
      out.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) {
    // A one- or two-word tail ("corner.") joins the chunk before it.
    if (current.length <= 2 && out.length > 0) {
      out[out.length - 1] += ` ${current.join(" ")}`;
    } else {
      out.push(current.join(" "));
    }
  }
  return out;
}

/**
 * The voiceover as captions (most Reels are watched muted). Each chunk is
 * shown for a share of `spokenFrames` matching its word count.
 */
export function Caption({
  text,
  spokenFrames,
}: {
  text: string;
  spokenFrames: number;
}) {
  const frame = useCurrentFrame();
  const chunks = captionChunks(text);
  const words = chunks.map((c) => c.split(" ").length);
  const total = words.reduce((a, b) => a + b, 0) || 1;
  let start = 0;
  let index = chunks.length - 1;
  let chunkStart = 0;
  for (let i = 0; i < chunks.length; i++) {
    const length = (words[i]! / total) * spokenFrames;
    if (frame < start + length) {
      index = i;
      chunkStart = start;
      break;
    }
    start += length;
  }
  if (chunks.length === 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        right: SAFE.x,
        top: CAPTION_TOP,
        minHeight: 196,
        display: "flex",
        alignItems: "center",
        background: COLORS.ink,
        color: COLORS.card,
        padding: "30px 40px",
        fontSize: 52,
        fontWeight: 600,
        lineHeight: 1.22,
        textWrap: "balance",
      }}
    >
      <span
        style={{
          opacity: interpolate(frame, [chunkStart, chunkStart + 4], [0.4, 1], clamp),
        }}
      >
        {chunks[index]}
      </span>
    </div>
  );
}

export function MapAttribution() {
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.x,
        bottom: 44,
        fontSize: 22,
        color: COLORS.muted,
        textShadow: "0 0 6px #fff, 0 0 6px #fff",
      }}
    >
      © OpenMapTiles © OpenStreetMap contributors
    </div>
  );
}

/** The home: a red pin with a pulsing ring. `drop` animates it in. */
export function HomeMarker({
  point,
  drop = false,
}: {
  point: ScreenPoint;
  drop?: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const landed = drop
    ? spring({ frame, fps, delay: 0.3 * fps, config: { damping: 14, mass: 0.7 } })
    : 1;
  const pulse = (frame % (1.6 * fps)) / (1.6 * fps);
  return (
    <svg
      width={W}
      height={H}
      style={{ position: "absolute", inset: 0, overflow: "visible" }}
    >
      <g transform={`translate(${point.x} ${point.y - (1 - landed) * 220})`}>
        <circle
          r={30 + pulse * 70}
          fill={COLORS.primary}
          opacity={(1 - pulse) * 0.28 * landed}
        />
        <circle r={34} fill={COLORS.primary} stroke="#fff" strokeWidth={8} />
        {/* A small house. */}
        <path
          d="M-14 2 L0 -12 L14 2 V14 H-14 Z"
          fill="#fff"
          stroke="#fff"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

type Chip = { x: number; y: number; w: number; h: number };
const CHIP_H = 116;

/** Rough label width (Inter at these sizes), to place labels without measuring. */
function chipWidth(name: string, sub: string) {
  const nameW = Math.min(name.length * 19.5, 520);
  const subW = sub.length * 15;
  return Math.ceil(Math.max(nameW, subW) + 64);
}

/** Puts each label beside its pin, inside the frame, without overlaps. */
function layoutChips(
  points: ScreenPoint[],
  widths: number[],
  home: ScreenPoint,
  area: { top: number; bottom: number },
): Chip[] {
  const placed: Chip[] = [];
  // Labels must not cover the home marker or another place's pin.
  const pin = (q: ScreenPoint, r: number): Chip => ({
    x: q.x - r,
    y: q.y - r,
    w: r * 2,
    h: r * 2,
  });
  const hit = (a: Chip, b: Chip) =>
    a.x < b.x + b.w + 12 &&
    b.x < a.x + a.w + 12 &&
    a.y < b.y + b.h + 12 &&
    b.y < a.y + a.h + 12;
  points.forEach((p, i) => {
    const obstacles = [
      pin(home, 48),
      ...points.filter((_, j) => j !== i).map((q) => pin(q, 22)),
    ];
    const overlaps = (a: Chip) =>
      placed.some((b) => hit(a, b)) || obstacles.some((b) => hit(a, b));
    const w = widths[i]!;
    const clampY = (y: number) =>
      Math.min(Math.max(y, area.top), area.bottom - CHIP_H);
    // Prefer the side facing away from the home; switch if it doesn't fit.
    const fitsRight = p.x + 34 + w <= W - SAFE.x;
    const fitsLeft = p.x - 34 - w >= SAFE.x;
    const preferRight =
      p.x >= home.x ? fitsRight || !fitsLeft : !fitsLeft && fitsRight;

    // On each side, beside the pin, then nudged down and up in turn; the
    // first spot clear of other labels and pins wins.
    const candidates = [preferRight, !preferRight].flatMap((right) => {
      const x = Math.min(
        Math.max(right ? p.x + 34 : p.x - 34 - w, SAFE.x),
        W - SAFE.x - w,
      );
      return Array.from({ length: 9 }, (_, step) => {
        const offset =
          Math.ceil(step / 2) * (CHIP_H + 14) * (step % 2 ? 1 : -1);
        return { x, y: clampY(p.y - CHIP_H / 2 + offset), w, h: CHIP_H };
      });
    });
    placed.push(candidates.find((c) => !overlaps(c)) ?? candidates[0]!);
  });
  return placed;
}

/** When each stop's line starts drawing, in scene frames. */
export function stopStarts(count: number, durationInFrames: number, fps: number) {
  const first = 0.7 * fps;
  const gap = Math.min(0.95 * fps, (durationInFrames * 0.65 - first) / Math.max(1, count));
  return Array.from({ length: count }, (_, i) => Math.round(first + i * Math.max(gap, 0.5 * fps)));
}

/** A quadratic curve as a polyline, so every route is drawn the same way. */
function arcPoints(from: ScreenPoint, to: ScreenPoint, bend: number) {
  const cx = (from.x + to.x) / 2 - (to.y - from.y) * bend;
  const cy = (from.y + to.y) / 2 + (to.x - from.x) * bend;
  return Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * cx + t * t * to.x,
      y: u * u * from.y + 2 * u * t * cy + t * t * to.y,
    };
  });
}

/** The point `share` (0–1) of the way along a polyline, by length. */
function pointAlong(line: ScreenPoint[], share: number): ScreenPoint {
  const lengths = line.slice(1).map((p, i) => Math.hypot(p.x - line[i]!.x, p.y - line[i]!.y));
  let left = lengths.reduce((a, b) => a + b, 0) * share;
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (left <= len && len > 0) {
      const a = line[i]!;
      const b = line[i + 1]!;
      return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len };
    }
    left -= len;
  }
  return line[line.length - 1]!;
}

/** How long a route takes to fill: street routes are longer, so slower. */
const drawSeconds = (street: boolean) => (street ? 1.1 : 0.75);

/**
 * Routes from the home to each stop, one after another, each like a
 * progress bar: the whole route appears as a faint track (along the
 * streets when there's a route, else a gentle curve), then fills from the
 * home to the place with a dot at its leading edge, ending in a pin and a
 * label with the travel time.
 */
export function Routes({
  home,
  points,
  paths,
  stops,
  verb,
  area,
  durationInFrames,
  lines = true,
  subtitles,
}: {
  home: ScreenPoint;
  points: ScreenPoint[];
  /** Each stop's street route on screen (empty or missing: a curve). */
  paths?: ScreenPoint[][] | null;
  /** False: pins and labels only (places that aren't trips, e.g. projects). */
  lines?: boolean;
  /** Label second lines; default "6 min walk · Groceries". */
  subtitles?: string[];
  stops: VideoStop[];
  verb: string;
  /** Vertical band the labels must stay in. */
  area: { top: number; bottom: number };
  /** The scene's length (useVideoConfig reports the whole video's). */
  durationInFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = stopStarts(stops.length, durationInFrames, fps);
  const subs =
    subtitles ??
    stops.map(
      (s) => `${s.estimated ? "~" : ""}${s.minutes} min ${verb} · ${s.label}`,
    );
  const chips = layoutChips(
    points,
    stops.map((s, i) => chipWidth(s.name, subs[i]!)),
    home,
    area,
  );
  const routes = stops.map((_, i) => {
    const street = paths?.[i];
    return street && street.length >= 2
      ? { line: street, street: true }
      : { line: arcPoints(home, points[i]!, i % 2 === 0 ? 0.18 : -0.18), street: false };
  });
  const drawFrames = routes.map((l) =>
    (lines ? drawSeconds(l.street) : 0.3) * fps,
  );

  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {stops.map((stop, i) => {
          const p = points[i]!;
          const t0 = starts[i]!;
          const { line } = routes[i]!;
          const draw = drawFrames[i]!;
          const progress = interpolate(frame, [t0, t0 + draw], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.65, 0, 0.35, 1),
          });
          // The empty bar shows the whole route just before it fills.
          const track = interpolate(frame, [t0 - 6, t0 + 4], [0, 1], clamp);
          const d = `M ${line.map((q) => `${q.x} ${q.y}`).join(" L ")}`;
          const head = pointAlong(line, progress);
          const pin = spring({
            frame,
            fps,
            delay: t0 + draw - 4,
            config: { damping: 12, mass: 0.6 },
          });
          const stroke = {
            fill: "none",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          } as const;
          return (
            <g key={stop.id}>
              {lines && track > 0 && (
                <g opacity={track}>
                  {/* The track: a white casing with a pale fill. */}
                  <path d={d} {...stroke} stroke="#fff" strokeWidth={24} />
                  <path
                    d={d}
                    {...stroke}
                    stroke={stop.color}
                    strokeOpacity={0.22}
                    strokeWidth={13}
                  />
                </g>
              )}
              {lines && progress > 0 && (
                <>
                  {/* The bar filling from the home to the place. */}
                  <path
                    d={d}
                    {...stroke}
                    stroke={stop.color}
                    strokeWidth={13}
                    pathLength={1}
                    strokeDasharray="1 1"
                    strokeDashoffset={1 - progress}
                  />
                  {progress < 1 && (
                    <circle
                      cx={head.x}
                      cy={head.y}
                      r={13}
                      fill="#fff"
                      stroke={stop.color}
                      strokeWidth={6}
                    />
                  )}
                </>
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={20 * pin}
                fill={stop.color}
                stroke="#fff"
                strokeWidth={7 * pin}
              />
            </g>
          );
        })}
      </svg>

      {stops.map((stop, i) => {
        const chip = chips[i]!;
        const t0 = starts[i]! + drawFrames[i]! - 2;
        return (
          <div
            key={stop.id}
            style={{
              position: "absolute",
              left: chip.x,
              top: chip.y,
              width: chip.w,
              height: chip.h,
              background: COLORS.card,
              borderLeft: `10px solid ${stop.color}`,
              padding: "16px 22px",
              boxShadow: "0 10px 30px rgba(22,22,20,0.18)",
              opacity: interpolate(frame, [t0, t0 + 0.25 * fps], [0, 1], clamp),
              translate: interpolate(frame, [t0, t0 + 0.4 * fps], ["0px 16px", "0px 0px"], {
                ...clamp,
                easing: easeOut,
              }),
            }}
          >
            <div
              style={{
                fontSize: 34,
                fontWeight: 600,
                color: COLORS.ink,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {stop.name}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 28,
                color: COLORS.muted,
                whiteSpace: "nowrap",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {subs[i]}
            </div>
          </div>
        );
      })}

      <HomeMarker point={home} />
    </AbsoluteFill>
  );
}
