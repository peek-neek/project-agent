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
import { MARKET_LEVELS, marketScore } from "@/lib/market-score";
import {
  amenitiesSchema,
  commuteSchema,
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
 * Header badge on a report page: how easy the location makes the home to
 * sell or rent, 1 (hard) to 5 (easy), with the reasons on click. Reads the
 * report from the page's query cache; renders nothing elsewhere.
 */
export function MarketScoreBadge() {
  const { reportId } = useParams<{ reportId?: string }>();
  const trpc = useTRPC();
  // The score follows the walk / bike / car choice, like the Overview tiles.
  const travel = useTravelMode();
  // The header can't know the saved mode until the page hydrates: wait, so
  // the badge never shows a walking score and then switches.
  const hydrated = useHydrated();
  const { data: report } = useQuery({
    ...trpc.report.byId.queryOptions({ id: reportId ?? "" }),
    enabled: Boolean(reportId),
  });
  if (!reportId || !report || !hydrated) return null;

  const score = marketScore(
    {
      amenities: getSection(report, SECTION_KEYS.amenities, amenitiesSchema),
      commute: getSection(report, SECTION_KEYS.commute, commuteSchema),
      schools: getSection(report, SECTION_KEYS.schools, schoolsSchema),
      safety: getSection(report, SECTION_KEYS.safety, safetySchema),
      upside: getSection(report, SECTION_KEYS.upside, upsideSchema),
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
            How much the location helps or hinders selling or renting. 1 is
            hard, 5 is easy.
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

        <ul className="space-y-2.5">
          {factors.map((f) => (
            <li key={f.id} className="space-y-1">
              <span className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium">{f.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    f.score >= 0.6
                      ? "text-emerald-700"
                      : f.score < 0.35
                        ? "text-amber-700"
                        : "text-foreground/55",
                  )}
                >
                  {f.score >= 0.6
                    ? "Helps"
                    : f.score < 0.35
                      ? "Hurts"
                      : "Neutral"}
                </span>
              </span>
              <span className="block h-1 bg-muted">
                <span
                  className="block h-full bg-foreground/60"
                  style={{ width: `${Math.max(4, f.score * 100)}%` }}
                />
              </span>
              <span className="block text-[11px] leading-snug text-foreground/55">
                {f.detail}
              </span>
            </li>
          ))}
        </ul>

        <p className="border-t pt-2 text-[11px] leading-snug text-foreground/50">
          Location only, using {TRAVEL_PHRASE[travel.mode]} times: price,
          condition, size and market conditions aren&apos;t included. Census
          facts about residents are never used.
        </p>
      </PopoverContent>
    </Popover>
  );
}
