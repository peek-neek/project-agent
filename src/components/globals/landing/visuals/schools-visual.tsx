"use client";

import { GraduationCapIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { TRAVEL_ICONS } from "@/components/globals/travel-mode";
import { SAMPLE_SCHOOLS } from "../sample";
import {
  CountUp,
  EASE,
  Frame,
  MODES,
  MODE_LABELS,
  SampleTag,
  useReveal,
} from "../shared";

export function SchoolsVisual() {
  const { ref, inView } = useReveal();
  const reduce = useReducedMotion();
  const avg = SAMPLE_SCHOOLS.ontario;
  return (
    <div ref={ref}>
      <Frame
        title="Closest school in each board"
        action={
          <span className="flex items-center gap-1.5 text-xs text-foreground/50">
            <span className="h-3 w-px border-l border-dashed border-foreground/60" />
            Ontario average {avg}%
          </span>
        }
      >
        <ul className="divide-y">
          {SAMPLE_SCHOOLS.schools.map((s, i) => (
            <li
              key={s.name}
              className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center"
            >
              <div className="flex min-w-0 gap-3">
                <span className="grid size-8 shrink-0 place-items-center bg-[#7c3aed]/10 text-[#7c3aed]">
                  <GraduationCapIcon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
                    {s.system}
                  </p>
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-foreground/50">
                    {s.level} · {s.km} km
                  </p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-foreground/50">
                    {MODES.map((m) => {
                      const Icon = TRAVEL_ICONS[m];
                      return (
                        <span key={m} className="flex items-center gap-1">
                          <Icon
                            aria-label={MODE_LABELS[m]}
                            className="size-3"
                          />
                          <span className="font-medium text-foreground/70 tabular-nums">
                            {s.minutes[m]} min
                          </span>
                        </span>
                      );
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="relative h-2.5 flex-1 bg-muted">
                  <motion.span
                    className="absolute inset-y-0 left-0 origin-left"
                    style={{
                      width: `${s.eqao}%`,
                      backgroundColor: s.eqao >= avg ? "#16a34a" : "#ea580c",
                    }}
                    initial={{ scaleX: reduce ? 1 : 0 }}
                    animate={inView ? { scaleX: 1 } : undefined}
                    transition={{
                      duration: 1,
                      delay: 0.2 + i * 0.12,
                      ease: EASE,
                    }}
                  />
                  <span
                    className="absolute -inset-y-1.5 w-px border-l border-dashed border-foreground/60"
                    style={{ left: `${avg}%` }}
                  />
                </span>
                <span className="w-11 text-right text-sm font-semibold">
                  <CountUp to={s.eqao} />%
                </span>
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t bg-muted/40 px-4 py-2.5 text-xs text-foreground/55">
          EQAO: students at or above the provincial standard. Distances, not
          boundaries: confirm attendance areas with each board.
        </p>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}
