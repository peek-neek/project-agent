"use client";

import {
  DropletsIcon,
  ShieldIcon,
  TrainTrackIcon,
  WindIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CountUp, EASE, Frame, SampleTag, useReveal } from "../shared";

const NEVER = ["safe", "unsafe", "low-crime", "rough area"];

export function SafetyVisual() {
  const { ref, inView } = useReveal();
  const reduce = useReducedMotion();
  const bar = (value: number, color: string, delay: number) => (
    <span className="relative h-2.5 flex-1 bg-muted">
      <motion.span
        className="absolute inset-y-0 left-0 origin-left"
        style={{ width: `${(value / 100) * 100}%`, backgroundColor: color }}
        initial={{ scaleX: reduce ? 1 : 0 }}
        animate={inView ? { scaleX: 1 } : undefined}
        transition={{ duration: 1, delay, ease: EASE }}
      />
    </span>
  );

  return (
    <div ref={ref}>
      <Frame title="Safety and environment">
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {/* Crime severity */}
          <div className="bg-card p-4 sm:col-span-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldIcon aria-hidden className="size-4 text-foreground/60" />
              Crime severity index
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-28 text-foreground/60">This area</span>
                {bar(48, "#16a34a", 0.2)}
                <span className="w-8 text-right font-semibold">
                  <CountUp to={48} />
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-28 text-foreground/60">Ontario</span>
                {bar(57, "var(--color-foreground)", 0.35)}
                <span className="w-8 text-right font-semibold">
                  <CountUp to={57} />
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs text-foreground/50">
              Statistics Canada, police service area, latest year
            </p>
          </div>
          {[
            {
              icon: DropletsIcon,
              label: "Flood regulation",
              value: "Outside the regulated area",
              note: "Conservation authority mapping",
            },
            {
              icon: TrainTrackIcon,
              label: "Noise sources",
              value: "Highway 1.4 km · Rail 900 m",
              note: "Ontario road and rail networks",
            },
            {
              icon: WindIcon,
              label: "Air quality",
              value: "AQI 74, good",
              note: "Google Air Quality, at report time",
            },
          ].map((f, i) => (
            <motion.div
              key={f.label}
              className="bg-card p-4 sm:last:col-span-2"
              initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
              animate={inView ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.6, delay: 0.5 + i * 0.1, ease: EASE }}
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                <f.icon aria-hidden className="size-4 text-foreground/60" />
                {f.label}
              </p>
              <p className="mt-2 font-semibold">{f.value}</p>
              <p className="mt-1 text-xs text-foreground/50">{f.note}</p>
            </motion.div>
          ))}
        </div>
        {/* The words reports never use */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/40 px-4 py-3 text-sm">
          <span className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
            Never written
          </span>
          {NEVER.map((w, i) => (
            <span key={w} className="relative text-foreground/60">
              &ldquo;{w}&rdquo;
              <motion.span
                aria-hidden
                className="absolute inset-x-0 top-1/2 h-0.5 origin-left bg-primary"
                initial={{ scaleX: reduce ? 1 : 0 }}
                animate={inView ? { scaleX: 1 } : undefined}
                transition={{ duration: 0.4, delay: 1 + i * 0.15, ease: EASE }}
              />
            </span>
          ))}
        </div>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}
