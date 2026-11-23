"use client";

import { CrownIcon } from "lucide-react";
import { cn } from "cn";
import { marketScore } from "@/lib/market-score";
import type { JobKind } from "@/lib/report-sections";
import type { TravelMode, TravelTimes } from "@/lib/travel";
import type { useTravelMode } from "@/components/globals/travel-mode";
import type { ReportSectionsData } from "@/components/globals/report/overview-tab";
import type { ReportData } from "@/components/globals/report/report-format";
import {
  getJob,
  getReportSections,
  isJobActive,
} from "@/components/globals/report/report-hooks";

export type Side = "a" | "b";
export const SIDES = ["a", "b"] as const satisfies readonly Side[];

/**
 * Each property's colour everywhere in a comparison: A black, B blue
 * (theme tokens, so A turns white on a dark page). `onColor` is text or an
 * icon drawn on top of the colour.
 */
export const SIDE = {
  a: {
    letter: "A",
    color: "var(--compare-a)",
    onColor: "var(--background)",
    text: "text-compare-a",
    tint: "bg-compare-a/[0.06]",
  },
  b: {
    letter: "B",
    color: "var(--compare-b)",
    onColor: "#fff",
    text: "text-compare-b",
    tint: "bg-compare-b/[0.08]",
  },
} as const;

/** One side of a comparison: the report and what's read from it. */
export type CompareProperty = {
  side: Side;
  report: ReportData;
  data: ReportSectionsData;
  /** "12 Main St" */
  street: string;
  /** "Toronto, ON" */
  place: string;
  home: { lat: number; lng: number } | null;
};

export function toProperty(
  side: Side,
  report: ReportData,
  mode: TravelMode,
): CompareProperty {
  const full = report.property?.formattedAddress ?? report.inputAddress;
  const [street, ...rest] = full.split(",").map((s) => s.trim());
  const p = report.property;
  return {
    side,
    report,
    data: getReportSections(report, mode),
    street,
    place: rest.filter((s) => s !== "Canada").join(", ") || "Canada",
    home:
      p?.latitude != null && p.longitude != null
        ? { lat: p.latitude, lng: p.longitude }
        : null,
  };
}

/** The property's letter on its colour: "A" in black, "B" in blue. */
export function SideChip({
  side,
  className,
}: {
  side: Side;
  className?: string;
}) {
  return (
    <span
      aria-label={`Property ${SIDE[side].letter}`}
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center text-[11px] leading-none font-bold",
        className,
      )}
      style={{ backgroundColor: SIDE[side].color, color: SIDE[side].onColor }}
    >
      {SIDE[side].letter}
    </span>
  );
}

/**
 * The comparison's win mark: a gold crown, tilted. `size-*!` wins over
 * parents that force svg sizes (sidebar, toggle and button `[&_svg]` rules).
 */
export function WinCrown({
  className,
  label = "Better",
}: {
  className?: string;
  /** What the crown says to screen readers. */
  label?: string;
}) {
  return (
    <CrownIcon
      role="img"
      aria-label={label}
      className={cn(
        "size-3.5! shrink-0 rotate-30 fill-amber-400 stroke-amber-600",
        className,
      )}
    />
  );
}

/**
 * A side's chip; when `crowned`, a WinCrown sits on its top-right corner,
 * half over the chip.
 */
export function CrownedChip({
  side,
  crowned,
  className,
  label = "Better",
}: {
  side: Side;
  crowned: boolean;
  className?: string;
  /** What the crown says to screen readers. */
  label?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <SideChip side={side} className={className} />
      {crowned && (
        <WinCrown label={label} className="absolute -top-1.5 -right-1.5" />
      )}
    </span>
  );
}

/**
 * Which side wins a number, or null for a tie (within `tolerance`) or when
 * either is missing. `higher`: bigger is better (else smaller is).
 */
export function winner(
  a: number | null | undefined,
  b: number | null | undefined,
  {
    higher = true,
    tolerance = 0,
  }: { higher?: boolean; tolerance?: number } = {},
): Side | null {
  if (a == null || b == null || Math.abs(a - b) <= tolerance) return null;
  return a > b === higher ? "a" : "b";
}

export type SideState = "ready" | "pending" | "failed" | "empty";

/** Where one side's section stands, for cells that wait on it. */
export function sideState(
  report: ReportData,
  kind: JobKind,
  hasData: boolean,
): SideState {
  if (hasData) return "ready";
  const job = getJob(report, kind);
  if (isJobActive(job)) return "pending";
  if (job?.status === "failed") return "failed";
  return "empty";
}

/** Straight-line distance between two points, in metres. */
export function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** The property's market ease (1–5), as the header badge works it out. */
export function propertyMarketScore(p: CompareProperty, mode: TravelMode) {
  return marketScore(
    {
      amenities: p.data.amenities,
      commute: p.data.commute,
      schools: p.data.schools,
      safety: p.data.safety,
      upside: p.data.upside,
      listPrice: p.data.listing?.listPrice ?? null,
      city: p.report.property?.city ?? null,
      province: p.report.property?.province ?? null,
    },
    mode,
  );
}

export type Travel = ReturnType<typeof useTravelMode>;

/** A place's time in the selected mode, with its name underneath. */
export function placeCell(
  place: (TravelTimes & { name: string }) | null | undefined,
  travel: Travel,
  sub?: string,
) {
  if (!place) return null;
  return {
    value: `${travel.minutes(place)} ${travel.verb}`,
    sub: sub ?? place.name,
  };
}

/** The place's minutes in the selected mode (for picking a winner). */
export const minutesTo = (
  place: TravelTimes | null | undefined,
  travel: Travel,
) => (place ? travel.time(place).minutes : null);
