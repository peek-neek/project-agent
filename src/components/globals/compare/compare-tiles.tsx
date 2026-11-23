"use client";

import { ChevronRightIcon, type LucideIcon } from "lucide-react";
import { cn } from "cn";
import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBar } from "@/components/globals/report/overview-tab";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { CrownedChip, type Side, SIDES } from "./compare-shared";

const rise = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
} as const;

/** One property's figure on a duel tile. */
export type DuelSide = {
  /** 1–5, drawn as five segments coloured like a single report's. */
  score: number | null;
  /** Shown big; defaults to the score. */
  value?: React.ReactNode;
  caption?: React.ReactNode;
  loading?: boolean;
};

/**
 * The Overview tile for a comparison: the same widget as a single report,
 * with both properties' scores stacked and the better one ticked.
 */
export function DuelTile({
  icon: Icon,
  label,
  accent,
  a,
  b,
  winner,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  accent: string;
  a: DuelSide;
  b: DuelSide;
  winner: Side | null;
  onClick?: () => void;
}) {
  const sides = { a, b };
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      variants={rise}
      whileHover={onClick ? { y: -2 } : undefined}
      transition={{ type: "spring", bounce: 0, visualDuration: 0.2 }}
      className={cn(
        WIDGET,
        "group relative flex min-w-0 flex-col gap-3 p-4 text-left",
        onClick &&
          "cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
      )}
    >
      <span
        className="flex items-start gap-1.5 text-[13px] leading-tight font-medium xl:text-xs"
        style={{ color: accent }}
      >
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 pt-px break-words">{label}</span>
        {onClick && (
          <ChevronRightIcon
            aria-hidden
            className="ml-auto size-4 shrink-0 text-foreground/25 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:text-foreground/60"
          />
        )}
      </span>

      {SIDES.map((side) => {
        const s = sides[side];
        const won = winner === side;
        return (
          <span key={side} className="block space-y-1.5">
            <span className="flex items-center gap-2">
              <CrownedChip side={side} crowned={won} />
              {s.loading ? (
                <Skeleton className="h-6 w-12" />
              ) : (
                <span
                  className={cn(
                    "text-2xl leading-none tracking-tight tabular-nums",
                    won ? "font-semibold" : "font-medium text-foreground/70",
                  )}
                >
                  {s.value ?? (s.score != null ? s.score.toFixed(1) : "—")}
                </span>
              )}
            </span>
            {!s.loading && s.score != null && <ScoreBar score={s.score} />}
            {!s.loading && s.caption && (
              <span className="block text-xs leading-snug text-pretty text-foreground/55">
                {s.caption}
              </span>
            )}
          </span>
        );
      })}
    </Comp>
  );
}
