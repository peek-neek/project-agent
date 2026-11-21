"use client";

import { motion, useReducedMotion } from "motion/react";
import { MARKET_LEVELS } from "@/lib/market-score";
import { SAMPLE_FACTORS } from "../sample";
import { EASE, Frame, SampleTag, useReveal } from "../shared";

const LEVELS = [1, 2, 3, 4, 5] as const;
const total = SAMPLE_FACTORS.reduce((a, f) => a + f.weight, 0);
/** What lifts the score most, and what holds it back. */
const HELPS = [...SAMPLE_FACTORS]
  .filter((f) => f.score >= 0.6)
  .sort((a, b) => b.score * b.weight - a.score * a.weight)
  .slice(0, 2);
const DRAG = [...SAMPLE_FACTORS].sort((a, b) => a.score - b.score)[0];
const tone = (score: number) =>
  score >= 0.6 ? "#16a34a" : score >= 0.4 ? "#ca8a04" : "#d10001";

export function ScoreVisual() {
  const { ref, inView } = useReveal();
  const reduce = useReducedMotion();
  const level = MARKET_LEVELS[4];
  return (
    <div ref={ref}>
      <Frame bodyClassName="grid md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {/* The level */}
        <div className="flex flex-col justify-between gap-6 border-b p-5 md:border-r md:border-b-0">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
              Sell / rent ease
            </p>
            <p className="mt-2 flex items-end gap-2">
              <span
                className="text-6xl leading-none font-semibold tracking-tight"
                style={{ color: level.color }}
              >
                4
              </span>
              <span className="pb-1 text-foreground/55">
                / 5 · {level.label}
              </span>
            </p>
          </div>
          <div>
            <div className="grid grid-cols-5 gap-1" aria-hidden>
              {LEVELS.map((l) => (
                <motion.span
                  key={l}
                  className="h-2 origin-left"
                  style={{
                    backgroundColor: MARKET_LEVELS[l].color,
                    opacity: l === 4 ? 1 : 0.22,
                  }}
                  initial={{ scaleX: reduce ? 1 : 0 }}
                  animate={inView ? { scaleX: 1 } : undefined}
                  transition={{
                    duration: 0.45,
                    delay: 0.15 + l * 0.08,
                    ease: EASE,
                  }}
                />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-foreground/45">
              <span>Hard</span>
              <span>Very easy</span>
            </div>
          </div>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-foreground/50">Helps most</dt>
              <dd className="mt-0.5 font-medium">
                {HELPS.map((f) => f.label).join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-foreground/50">Holds it back</dt>
              <dd className="mt-0.5 font-medium">{DRAG.label}</dd>
            </div>
          </dl>
          <p className="text-sm leading-relaxed text-foreground/60">
            Weighted from eight factors, each with the fact behind it, so you
            can explain the number in one sentence.
          </p>
        </div>

        {/* The factors */}
        <ul className="divide-y">
          {SAMPLE_FACTORS.map((f, i) => (
            <li key={f.label} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{f.label}</span>
                <span className="text-xs text-foreground/45 tabular-nums">
                  {Math.round((f.weight / total) * 100)}%
                </span>
              </div>
              <span className="mt-1.5 block h-1 bg-muted">
                <motion.span
                  className="block h-full origin-left"
                  style={{
                    width: `${Math.max(6, f.score * 100)}%`,
                    backgroundColor: tone(f.score),
                  }}
                  initial={{ scaleX: reduce ? 1 : 0 }}
                  animate={inView ? { scaleX: 1 } : undefined}
                  transition={{
                    duration: 0.8,
                    delay: 0.3 + i * 0.07,
                    ease: EASE,
                  }}
                />
              </span>
              <p className="mt-1 truncate text-xs text-foreground/55">
                {f.detail}
              </p>
            </li>
          ))}
        </ul>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}
