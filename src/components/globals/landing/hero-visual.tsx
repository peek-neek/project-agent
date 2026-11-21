"use client";

import {
  BathIcon,
  BedDoubleIcon,
  HouseIcon,
  MapPinIcon,
  TagIcon,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import { AMENITY_ICONS } from "@/components/globals/report/amenity-icons";
import { MARKET_LEVELS } from "@/lib/market-score";
import { AMENITY_CATEGORIES } from "@/lib/report-sections";
import { SampleMap } from "./sample-map";
import { SAMPLE_HOME, SAMPLE_PLACES } from "./sample";
import {
  EASE,
  MODES,
  ModeSwitch,
  Rolling,
  SampleTag,
  useAutoCycle,
} from "./shared";

const COLOR = Object.fromEntries(
  AMENITY_CATEGORIES.map((c) => [c.id, c.color]),
) as Record<string, string>;

const price = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
}).format(SAMPLE_HOME.price);

/** The hero's live report: the photo, and the report building over it. */
export function HeroVisual() {
  const reduce = useReducedMotion();
  const { ref, index, select } = useAutoCycle(MODES.length, 2800);
  const mode = MODES[index];
  const level = MARKET_LEVELS[4];

  return (
    <div ref={ref} className="relative">
      {/* Photo, settling in */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: EASE }}
        className="relative ml-auto aspect-[4/5] w-full overflow-hidden sm:aspect-[5/4] lg:aspect-[4/5] lg:w-[78%]"
      >
        <Image
          src="/images/hero-home.jpg"
          alt="Two-storey modern home at dusk, lit from inside"
          fill
          preload
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
      </motion.div>

      {/* The report, over the photo */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
        className="absolute inset-x-3 bottom-3 border border-foreground/10 bg-card shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)] sm:inset-x-6 sm:bottom-6 lg:inset-x-auto lg:bottom-10 lg:left-0 lg:w-[86%]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {SAMPLE_HOME.street}
            </p>
            <ul className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground/55">
              {[
                {
                  icon: MapPinIcon,
                  label: "Location",
                  value: SAMPLE_HOME.place,
                },
                { icon: HouseIcon, label: "Type", value: SAMPLE_HOME.type },
                {
                  icon: BedDoubleIcon,
                  label: "Bedrooms",
                  value: SAMPLE_HOME.beds,
                },
                {
                  icon: BathIcon,
                  label: "Bathrooms",
                  value: SAMPLE_HOME.baths,
                },
                { icon: TagIcon, label: "List price", value: price },
              ].map((f) => (
                <li key={f.label} className="flex items-center gap-1">
                  <f.icon aria-label={f.label} className="size-3" />
                  {f.value}
                </li>
              ))}
            </ul>
          </div>
          <ModeSwitch mode={mode} onChange={(m) => select(MODES.indexOf(m))} />
        </div>

        <div className="grid sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <SampleMap className="h-40 sm:h-full sm:min-h-64" />
          <div className="flex flex-col gap-3 p-4">
            {/* Sell / rent ease */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
                  Sell / rent ease
                </p>
                <p className="text-sm font-semibold">{level.label}, 4 of 5</p>
              </div>
              <div className="flex gap-0.5" aria-hidden>
                {[1, 2, 3, 4, 5].map((l) => (
                  <motion.span
                    key={l}
                    className="h-6 w-2.5 origin-bottom"
                    style={{
                      backgroundColor:
                        l <= 4
                          ? MARKET_LEVELS[l as 1 | 2 | 3 | 4 | 5].color
                          : "var(--color-muted)",
                    }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.9 + l * 0.08,
                      ease: EASE,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Nearest places, timed in the chosen mode */}
            <ul className="divide-y border-t">
              {SAMPLE_PLACES.slice(0, 4).map((p) => {
                const Icon = AMENITY_ICONS[p.category];
                return (
                  <li
                    key={p.category}
                    className="flex items-center gap-2.5 py-2 text-sm"
                  >
                    <Icon
                      aria-hidden
                      className="size-4 shrink-0"
                      style={{ color: COLOR[p.category] }}
                    />
                    <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    <span className="flex items-baseline gap-1 font-semibold">
                      <Rolling value={p.minutes[mode]} />
                      <span className="text-xs font-normal text-foreground/50">
                        min
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <SampleTag className="mt-auto" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
