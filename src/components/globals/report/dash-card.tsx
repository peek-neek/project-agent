"use client";

import {
  ArrowRightIcon,
  ChevronRightIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WIDGET } from "./widget-styles";

// Apple-widget style (square corners): no outlines, a soft lift, a coloured
// label, one big number, a short caption and an optional micro-visual.

const rise = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
} as const;

type Tone = "default" | "solid";

/** Shared widget body. Renders a button when `onClick` is given. */
function Widget({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  accent,
  delta,
  visual,
  aside,
  tone = "default",
  loading,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  unit?: string;
  caption?: React.ReactNode;
  /** Label colour (and fill for `tone="solid"`). */
  accent?: string;
  /** Relative difference vs the city (0.24 = 24% higher). */
  delta?: number | null;
  /** Micro-visual along the bottom (bars, track…). */
  visual?: React.ReactNode;
  /** Micro-visual beside the number (gauge…). */
  aside?: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  onClick?: () => void;
}) {
  const solid = tone === "solid" && accent;
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      variants={rise}
      whileHover={onClick ? { y: -2 } : undefined}
      transition={{ type: "spring", bounce: 0, visualDuration: 0.2 }}
      style={solid ? { backgroundColor: accent } : undefined}
      className={cn(
        WIDGET,
        "group relative flex min-h-[8.5rem] min-w-0 flex-col p-4 text-left",
        solid && "text-white",
        onClick &&
          "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-[13px] font-medium",
          solid ? "text-white/85" : !accent && "text-foreground/60",
        )}
        style={!solid && accent ? { color: accent } : undefined}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {delta != null && Math.abs(delta) >= 0.05 && (
            <span
              title="Compared with the city"
              className={cn(
                "text-xs font-medium tabular-nums",
                solid ? "text-white/80" : "text-foreground/45",
              )}
            >
              {delta > 0 ? "▲" : "▼"} {Math.round(Math.abs(delta) * 100)}%
            </span>
          )}
          {onClick && (
            <ChevronRightIcon
              aria-hidden
              className={cn(
                "size-4 transition-[opacity,transform] group-hover:translate-x-0.5",
                solid
                  ? "text-white/70"
                  : "text-foreground/25 group-hover:text-foreground/60",
              )}
            />
          )}
        </span>
      </span>

      <span className="mt-2 flex items-end justify-between gap-3">
        <span className="min-w-0">
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <span className="flex items-baseline gap-1.5">
              <span className="text-[2rem] leading-none font-semibold tracking-tight tabular-nums">
                {value}
              </span>
              {unit && (
                <span
                  className={cn(
                    "text-base",
                    solid ? "text-white/70" : "text-foreground/45",
                  )}
                >
                  {unit}
                </span>
              )}
            </span>
          )}
          {caption && !loading && (
            <span
              className={cn(
                "mt-1.5 block truncate text-[13px]",
                solid ? "text-white/75" : "text-foreground/55",
              )}
            >
              {caption}
            </span>
          )}
        </span>
        {aside && !loading && <span className="shrink-0">{aside}</span>}
      </span>

      {visual && !loading && (
        <span className="mt-auto block pt-3">{visual}</span>
      )}
    </Comp>
  );
}

/** Clickable glanceable number (jumps to a section). */
export function KpiTile(
  props: Omit<React.ComponentProps<typeof Widget>, "onClick"> & {
    onClick?: () => void;
  },
) {
  return <Widget {...props} />;
}

/** Static glanceable number, optionally vs the city. */
export function StatTile(
  props: Omit<React.ComponentProps<typeof Widget>, "onClick" | "loading">,
) {
  return <Widget {...props} />;
}

/** Wrapper that staggers its tiles in. */
export function TileGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className={cn("grid grid-cols-2 gap-3", className)}
    >
      {children}
    </motion.div>
  );
}

/** A dashboard panel: coloured icon + title, optional "open" action. */
export function DashCard({
  title,
  icon: Icon,
  action,
  onOpen,
  openLabel = "Open",
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  /** Adds an arrow button that jumps to the full section. */
  onOpen?: () => void;
  openLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(WIDGET, "flex min-w-0 flex-col", className)}>
      <header className="flex h-12 items-center gap-2 px-4">
        <Icon aria-hidden className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto flex items-center gap-1">
          {action}
          {onOpen && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onOpen}
              aria-label={`${openLabel}: ${title}`}
              title={openLabel}
            >
              <ArrowRightIcon />
            </Button>
          )}
        </div>
      </header>
      <div className={cn("flex-1 px-4 pb-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small "label · value · vs city" row for glance cards. */
export function GlanceRow({
  icon: Icon,
  label,
  value,
  hint,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Relative difference vs the city (0.24 = 24% higher). */
  delta?: number | null;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center bg-muted text-foreground/55">
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{label}</span>
        {hint && (
          <span className="block truncate text-xs text-foreground/50">
            {hint}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-semibold tabular-nums">{value}</span>
        {delta != null && Math.abs(delta) >= 0.05 && (
          <span
            title="Compared with the city"
            className="text-[11px] text-foreground/45 tabular-nums"
          >
            {delta > 0 ? "▲" : "▼"} {Math.round(Math.abs(delta) * 100)}% vs city
          </span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro-visuals
// ---------------------------------------------------------------------------

/** Semicircle gauge for a 0–1 share (e.g. a percentile). */
export function Gauge({ value, color }: { value: number; color: string }) {
  const v = Math.max(0, Math.min(1, value));
  // Arc from 180° to 0°, radius 26, centre (32, 32).
  const end = Math.PI * (1 - v);
  const x = 32 + 26 * Math.cos(end);
  const y = 32 - 26 * Math.sin(end);
  return (
    <svg viewBox="0 0 64 36" className="h-8 w-14" aria-hidden>
      <path
        d="M6 32 A26 26 0 0 1 58 32"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.1"
        strokeWidth="6"
      />
      {v > 0 && (
        <path
          d={`M6 32 A26 26 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
        />
      )}
    </svg>
  );
}

/** Places along a travel-time scale; the first is emphasised. */
export function DotTrack({
  minutes,
  max = 20,
  color,
  unit = "min walk",
}: {
  minutes: number[];
  max?: number;
  color: string;
  /** Scale label after the max, e.g. "min walk". */
  unit?: string;
}) {
  const pos = (m: number) => `${Math.min(100, (m / max) * 100)}%`;
  return (
    <span className="block">
      <span className="relative block h-2.5">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-foreground/10" />
        {minutes.map((m, i) => (
          <span
            key={i}
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: pos(m),
              backgroundColor: color,
              opacity: i === 0 ? 1 : 0.35,
            }}
          />
        ))}
      </span>
      <span className="mt-1.5 flex justify-between text-[10px] text-foreground/40 tabular-nums">
        <span>0</span>
        <span>
          {max} {unit}
        </span>
      </span>
    </span>
  );
}

/** This area vs the city, as two thin bars on a shared scale. */
export function CompareMeter({
  area,
  city,
  color,
  max,
  labels = ["Here", "City"],
}: {
  area: number | null | undefined;
  city: number | null | undefined;
  color: string;
  /** Scale maximum; defaults to the larger value. */
  max?: number;
  /** Row labels, e.g. ["School", "Ontario"]. */
  labels?: [string, string];
}) {
  const top = max ?? Math.max(area ?? 0, city ?? 0, 1);
  const w = (v?: number | null) => `${Math.min(100, ((v ?? 0) / top) * 100)}%`;
  return (
    <span className="block space-y-1.5">
      <span className="flex items-center gap-2 text-[10px] text-foreground/45">
        <span className="w-10 shrink-0 truncate">{labels[0]}</span>
        <span className="h-1.5 flex-1 bg-foreground/[0.06]">
          <span
            className="block h-full"
            style={{ width: w(area), backgroundColor: color }}
          />
        </span>
      </span>
      <span className="flex items-center gap-2 text-[10px] text-foreground/45">
        <span className="w-10 shrink-0 truncate">{labels[1]}</span>
        <span className="h-1.5 flex-1 bg-foreground/[0.06]">
          <span
            className="block h-full bg-foreground/25"
            style={{ width: w(city) }}
          />
        </span>
      </span>
    </span>
  );
}

/** Closeness on a 0–max metre scale: fuller = closer. */
export function ProximityMeter({
  meters,
  max = 500,
  color = "#d97706",
}: {
  meters: number | null;
  max?: number;
  color?: string;
}) {
  const closeness = meters == null ? 0 : Math.max(0.04, 1 - meters / max);
  return (
    <span className="block">
      <span className="flex h-1.5 gap-0.5" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className="flex-1"
            style={{
              backgroundColor:
                i < Math.round(closeness * 10) ? color : "currentColor",
              opacity: i < Math.round(closeness * 10) ? 1 : 0.08,
            }}
          />
        ))}
      </span>
      <span className="mt-1.5 flex justify-between text-[10px] text-foreground/40">
        <span>Far</span>
        <span>Close</span>
      </span>
    </span>
  );
}
