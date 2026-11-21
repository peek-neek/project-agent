"use client";

import { TrainFrontIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { TRAVEL_ICONS } from "@/components/globals/travel-mode";
import { SampleMap } from "../sample-map";
import { SAMPLE_TRIPS } from "../sample";
import { EASE, Frame, SampleTag, useReveal } from "../shared";

const ICON = { ...TRAVEL_ICONS, transit: TrainFrontIcon };
const MAX = 75;

export function CommuteVisual() {
  const { ref, inView } = useReveal();
  const reduce = useReducedMotion();
  return (
    <div ref={ref}>
      <Frame
        title="Commute and transit"
        action={
          <span className="text-xs text-foreground/50">Weekday, 8:00 a.m.</span>
        }
        bodyClassName="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
      >
        <SampleMap showRoute className="h-52 md:h-auto md:min-h-80" />
        <ol className="divide-y">
          {SAMPLE_TRIPS.map((trip, ti) => (
            <li key={trip.label} className="px-4 py-4">
              <p className="text-sm font-medium">{trip.label}</p>
              <p className="text-xs text-foreground/50">{trip.note}</p>
              <ul className="mt-3 space-y-2">
                {trip.times.map((t, i) => {
                  const Icon = ICON[t.mode];
                  return (
                    <li key={t.mode} className="flex items-center gap-2.5">
                      <Icon
                        aria-label={t.mode}
                        className="size-3.5 shrink-0 text-foreground/55"
                      />
                      <span className="relative h-1.5 flex-1 bg-muted">
                        <motion.span
                          className="absolute inset-y-0 left-0 origin-left bg-foreground"
                          style={{ width: `${(t.minutes / MAX) * 100}%` }}
                          initial={{ scaleX: reduce ? 1 : 0 }}
                          animate={inView ? { scaleX: 1 } : undefined}
                          transition={{
                            duration: 0.9,
                            delay: 0.3 + ti * 0.15 + i * 0.08,
                            ease: EASE,
                          }}
                        />
                      </span>
                      <span className="w-14 text-right text-sm font-semibold tabular-nums">
                        {t.minutes}
                        <span className="ml-0.5 text-xs font-normal text-foreground/50">
                          min
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}
