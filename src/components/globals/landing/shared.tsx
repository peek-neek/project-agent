"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "cn";
import { useEffect, useId, useRef, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TRAVEL_ICONS } from "@/components/globals/travel-mode";
import type { TravelMode } from "@/lib/travel";

export const EASE = [0.16, 1, 0.3, 1] as const;
export const MODES: TravelMode[] = ["walk", "drive"];
export const MODE_LABELS: Record<TravelMode, string> = {
  walk: "Walk",
  drive: "Car",
};

/**
 * Steps through `count` states every `ms` while the element is on screen.
 * Stops for good once the visitor picks a state, and never runs for people
 * who ask for reduced motion.
 */
export function useAutoCycle<T extends HTMLElement = HTMLDivElement>(
  count: number,
  ms = 3200,
) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    if (!inView || reduce || manual) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearInterval(id);
  }, [inView, reduce, manual, count, ms]);
  const select = (i: number) => {
    setManual(true);
    setIndex(i);
  };
  return { ref, index, select, inView };
}

/** Plays once when the element first scrolls into view. */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  amount = 0.3,
) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, amount });
  return { ref, inView };
}

/** Walk / Car, with an indicator that slides between them. */
export function ModeSwitch({
  mode,
  onChange,
  size = "sm",
  className,
}: {
  mode: TravelMode;
  onChange: (mode: TravelMode) => void;
  size?: "sm" | "default";
  className?: string;
}) {
  const id = useId();
  return (
    <ToggleGroup
      aria-label="Travel mode"
      value={[mode]}
      onValueChange={(value) => {
        const next = value[0] as TravelMode | undefined;
        if (next) onChange(next);
      }}
      spacing={0}
      className={cn("border bg-background p-0.5", className)}
    >
      {MODES.map((m) => {
        const Icon = TRAVEL_ICONS[m];
        const active = m === mode;
        return (
          <ToggleGroupItem
            key={m}
            value={m}
            aria-label={MODE_LABELS[m]}
            size={size}
            className={cn(
              "relative gap-1.5 rounded-none px-2.5 text-xs font-medium hover:bg-transparent data-pressed:bg-transparent",
              active
                ? "text-background hover:text-background"
                : "text-foreground/60 hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`mode-${id}`}
                transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                className="absolute inset-0 bg-foreground"
              />
            )}
            <Icon aria-hidden className="relative size-3.5" />
            <span className="relative">{MODE_LABELS[m]}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

/** A value that rolls up into place when it changes. */
export function Rolling({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex overflow-hidden tabular-nums",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Counts from 0 to `to` the first time it's on screen. */
export function CountUp({
  to,
  format = (n) => Math.round(n).toLocaleString("en-CA"),
  duration = 1.2,
  className,
}: {
  to: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const value = useMotionValue(0);
  const text = useTransform(() => format(value.get()));
  useEffect(() => {
    if (!inView) return;
    const controls = animate(value, to, { duration, ease: EASE });
    return () => controls.stop();
  }, [inView, to, duration, value]);
  return (
    <motion.span ref={ref} className={cn("tabular-nums", className)}>
      {text}
    </motion.span>
  );
}

/** Marks a visual as illustrative. */
export function SampleTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-foreground/45 uppercase",
        className,
      )}
    >
      <span className="size-1.5 bg-primary" />
      Sample report · illustrative data
    </span>
  );
}

/** The frame every product visual sits in: a quiet app window. */
export function Frame({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={cn(
        "border border-foreground/10 bg-card shadow-[0_1px_0_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_0_0/0.25)]",
        className,
      )}
    >
      {(title || action) && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b px-4 py-2">
          <div className="min-w-0 text-sm font-medium">{title}</div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
