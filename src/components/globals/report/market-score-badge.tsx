"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDownIcon, GaugeIcon } from "lucide-react";
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

const LEVELS = [1, 2, 3, 4, 5] as const;
const TRAVEL_PHRASE = {
  walk: "walking",
  bike: "cycling",
  drive: "driving",
} as const;

/**
 * Header badge on a report page: how easy the location and price make the home to
 * sell or rent, 1 (hard) to 5 (easy), with the reasons on click. Reads the
 * report from the page's query cache; renders nothing elsewhere.
 */
export function MarketScoreBadge() {
  const { reportId } = useParams<{ reportId?: string }>();
  // The header can't know the saved mode until the page hydrates: wait, so
  // the badge never shows a walking score and then switches. Waiting also
  // keeps this query out of the server render: the header renders before the
  // page, and an empty entry here would stop the page's prefetched report
  // from hydrating (it would then refetch without cookies: UNAUTHORIZED).
  const hydrated = useHydrated();
  if (!reportId || !hydrated) return null;
  return <Badge reportId={reportId} />;
}

function Badge({ reportId }: { reportId: string }) {
  const trpc = useTRPC();
  // The score follows the walk / bike / car choice, like the Overview tiles.
  const travel = useTravelMode();
  const { data: report } = useQuery(
    trpc.report.byId.queryOptions({ id: reportId }),
  );
  if (!report) return null;

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
  if (!score) {
    // Still gathering data: hold the space while steps run.
    return report.jobs.some(isJobActive) ? (
      <Skeleton className="h-7 w-28" aria-label="Scoring this location" />
    ) : null;
  }

  const meta = MARKET_LEVELS[score.level];
  const hasPrice = score.factors.some((f) => f.id === "price");
  const factors = [...score.factors].sort((a, b) => b.weight - a.weight);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 bg-card px-2"
            aria-label={`Market ease ${score.level} of 5: ${score.label}. Show details`}
          />
        }
      >
        <span
          className="grid size-4.5 place-items-center text-[11px] font-bold text-white tabular-nums"
          style={{ backgroundColor: meta.color }}
        >
          {score.level}
        </span>
        <span className="hidden text-xs sm:inline">{score.label}</span>
        <span className="text-xs sm:hidden">/5</span>
        <ChevronDownIcon aria-hidden className="size-3.5 text-foreground/50" />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <GaugeIcon aria-hidden className="size-4 text-primary" />
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
          Uses {TRAVEL_PHRASE[travel.mode]} times.{" "}
          {hasPrice
            ? "The price point reflects how many buyers can afford the list price, not how it compares with recent sales."
            : "Add a list price in the property details to include the price point."}{" "}
          Condition, size and market conditions aren&apos;t included. Census
          facts about residents are never used.
        </p>
      </PopoverContent>
    </Popover>
  );
}
