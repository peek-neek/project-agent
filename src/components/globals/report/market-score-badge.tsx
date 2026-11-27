"use client";

import { useQuery } from "@tanstack/react-query";
import { GaugeIcon } from "lucide-react";
import { cn } from "cn";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { levelFor, MARKET_LEVELS, marketScore } from "@/lib/market-score";
import {
  amenitiesSchema,
  commuteSchema,
  listingSchema,
  SECTION_KEYS,
  safetySchema,
  schoolsSchema,
  upsideSchema,
} from "@/lib/report-sections";
import { useTRPC } from "@/trpc/client";
import { useHydrated, useTravelMode } from "@/components/globals/travel-mode";
import { getSection, isJobActive } from "./report-hooks";
import {
  SIDE,
  SideChip,
  type Side,
} from "@/components/globals/compare/compare-shared";

const LEVELS = [1, 2, 3, 4, 5] as const;
const TRAVEL_PHRASE = {
  walk: "walking",
  drive: "driving",
} as const;

/**
 * Header badge on a report page: how easy the location and price make the home to
 * sell or rent, 1 (hard) to 5 (easy), with the reasons on click. Reads the
 * report from the page's query cache; renders nothing elsewhere.
 */
export function MarketScoreBadge() {
  const { reportId, comparisonId } = useParams<{
    reportId?: string;
    comparisonId?: string;
  }>();
  // The header can't know the saved mode until the page hydrates: wait, so
  // the badge never shows a walking score and then switches. Waiting also
  // keeps this query out of the server render: the header renders before the
  // page, and an empty entry here would stop the page's prefetched report
  // from hydrating (it would then refetch without cookies: UNAUTHORIZED).
  const hydrated = useHydrated();
  if (!hydrated) return null;
  if (comparisonId) return <ComparisonBadges comparisonId={comparisonId} />;
  if (!reportId) return null;
  return <RingBadge reportId={reportId} />;
}

/**
 * On a comparison: one compact badge per property at every size, its score
 * framed by a progress border (RingBadge). Single reports keep the full
 * badge (Badge).
 */
function ComparisonBadges({ comparisonId }: { comparisonId: string }) {
  const trpc = useTRPC();
  const { data: comparison } = useQuery(
    trpc.comparison.byId.queryOptions({ id: comparisonId }),
  );
  if (!comparison) return null;
  const ids = { a: comparison.reportAId, b: comparison.reportBId };
  return (
    <span className="flex items-center gap-1.5">
      <RingBadge reportId={ids.a} side="a" />
      <RingBadge reportId={ids.b} side="b" />
    </span>
  );
}

/**
 * A report's market ease, following the walk / car choice like the
 * Overview tiles. `score` is null while data is still coming (`loading`) or
 * when it can't be scored.
 */
function useMarketScore(reportId: string) {
  const trpc = useTRPC();
  const travel = useTravelMode();
  const { data: report } = useQuery(
    trpc.report.byId.queryOptions({ id: reportId }),
  );
  if (!report) return { score: null, loading: true, mode: travel.mode };
  const score = marketScore(
    {
      amenities: getSection(report, SECTION_KEYS.amenities, amenitiesSchema),
      commute: getSection(report, SECTION_KEYS.commute, commuteSchema),
      schools: getSection(report, SECTION_KEYS.schools, schoolsSchema),
      safety: getSection(report, SECTION_KEYS.safety, safetySchema),
      upside: getSection(report, SECTION_KEYS.upside, upsideSchema),
      listPrice:
        getSection(report, SECTION_KEYS.listing, listingSchema)?.listPrice ??
        null,
      city: report.property?.city ?? null,
      province: report.property?.province ?? null,
    },
    travel.mode,
  );
  return {
    score,
    loading: !score && report.jobs.some(isJobActive),
    mode: travel.mode,
  };
}

type Score = NonNullable<ReturnType<typeof marketScore>>;

/**
 * The market badge: the score (1–5) in a small square, inside a white square
 * whose border is a progress bar for it (a fifth per point, clockwise from
 * the top, in the level's colour). The breakdown opens on tap. On a
 * comparison the score sits on the property's colour (A black, B blue); on
 * a single report, on the score's own colour (matching the border).
 */
function RingBadge({ reportId, side }: { reportId: string; side?: Side }) {
  const { score, loading, mode } = useMarketScore(reportId);
  if (!score) {
    return loading ? (
      <Skeleton className="size-7" aria-label="Scoring this location" />
    ) : null;
  }
  const fill = (score.level / 5) * 100;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative size-7 bg-card p-0 hover:bg-card dark:bg-muted dark:hover:bg-accent"
            aria-label={`${side ? `Property ${SIDE[side].letter}: ` : ""}Market ease ${score.level} of 5: ${score.label}. Show details`}
          />
        }
      >
        {/* The border: a track, then the score along it. The path starts
            at the top centre; pathLength 100 makes the fill a percentage. */}
        <svg
          aria-hidden
          viewBox="0 0 28 28"
          className="pointer-events-none absolute inset-0 size-full!"
        >
          <path
            d="M14 1.5 H26.5 V26.5 H1.5 V1.5 Z"
            pathLength={100}
            fill="none"
            strokeWidth={3}
            className="stroke-foreground/15"
          />
          <path
            d="M14 1.5 H26.5 V26.5 H1.5 V1.5 Z"
            pathLength={100}
            fill="none"
            strokeWidth={3}
            strokeDasharray="100 100"
            strokeDashoffset={100 - fill}
            stroke={MARKET_LEVELS[score.level].color}
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        {/* The score, on the property's colour, or the score's colour. */}
        <span
          aria-hidden
          className="grid size-4 place-items-center text-[11px] leading-none font-bold tabular-nums"
          style={
            side
              ? { backgroundColor: SIDE[side].color, color: SIDE[side].onColor }
              : // Single report: the same colour as the progress border.
                {
                  backgroundColor: MARKET_LEVELS[score.level].color,
                  color: "#fff",
                }
          }
        >
          {score.level}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(36rem,calc(100svh-5rem))] w-[min(20rem,calc(100vw-1.5rem))] gap-3 overflow-y-auto p-3"
      >
        <MarketDetails score={score} side={side} mode={mode} />
      </PopoverContent>
    </Popover>
  );
}

/** One score's breakdown: the 1–5 scale, each factor, and the caveats. */
function MarketDetails({
  score,
  side,
  mode,
}: {
  score: Score;
  side?: Side;
  mode: keyof typeof TRAVEL_PHRASE;
}) {
  const hasPrice = score.factors.some((f) => f.id === "price");
  const factors = [...score.factors].sort((a, b) => b.weight - a.weight);
  return (
    <>
      <PopoverHeader>
        <PopoverTitle className="flex items-center gap-2">
          <GaugeIcon aria-hidden className="size-4 text-primary" />
          {side && <SideChip side={side} className="size-4.5" />}
          Market ease: {score.level}/5 · {score.label}
        </PopoverTitle>
        <PopoverDescription className="text-xs">
          How much the location and price point help or hinder selling or
          renting. 1 is hard, 5 is easy.
        </PopoverDescription>
      </PopoverHeader>

      {/* 1–5 scale with this home's level marked. */}
      <div className="grid grid-cols-5 gap-0.5" aria-hidden>
        {LEVELS.map((l) => (
          <span key={l} className="space-y-1 text-center">
            <span
              className={cn(
                "block h-1.5",
                l === score.level ? "" : "opacity-25",
              )}
              style={{ backgroundColor: MARKET_LEVELS[l].color }}
            />
            <span
              className={cn(
                "block text-[10px] tabular-nums",
                l === score.level
                  ? "font-semibold text-foreground"
                  : "text-foreground/45",
              )}
            >
              {l}
            </span>
          </span>
        ))}
      </div>

      {/* Each factor rated 1–5 on the same scale (and colours) as the
            total, as five segments filled up to its rating. */}
      <ul className="space-y-2.5">
        {factors.map((f) => {
          const rating = levelFor(f.score);
          const color = MARKET_LEVELS[rating].color;
          return (
            <li key={f.id} className="space-y-1">
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{f.label}</span>
                <span className="font-semibold tabular-nums" style={{ color }}>
                  {rating}/5
                </span>
              </span>
              <span
                role="img"
                aria-label={`${f.label}: ${rating} of 5`}
                className="grid grid-cols-5 gap-0.5"
              >
                {LEVELS.map((l) => (
                  <span
                    key={l}
                    className={cn("block h-1.5", l > rating && "bg-muted")}
                    style={l <= rating ? { backgroundColor: color } : undefined}
                  />
                ))}
              </span>
              <span className="block text-[11px] leading-snug text-foreground/55">
                {f.detail}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="border-t pt-2 text-[11px] leading-snug text-foreground/50">
        Uses {TRAVEL_PHRASE[mode]} times.{" "}
        {hasPrice
          ? "The price point reflects how many buyers can afford the list price, not how it compares with recent sales."
          : "Add a list price in the property details to include the price point."}{" "}
        Condition, size and market conditions aren&apos;t included. Census facts
        about residents are never used.
      </p>
    </>
  );
}
