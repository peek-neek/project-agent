"use client";

import { HouseIcon, TrainFrontIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useRef } from "react";
import { AMENITY_ICONS } from "@/components/globals/report/amenity-icons";
import { AMENITY_CATEGORIES } from "@/lib/report-sections";
import { EASE } from "./shared";
import { SAMPLE_PLACES } from "./sample";

const COLOR = Object.fromEntries(
  AMENITY_CATEGORIES.map((c) => [c.id, c.color]),
) as Record<string, string>;

const HOME: [number, number] = [0.5, 0.48];
// On the street east of the home (x = 268 + 8 * y / 260), inside the part
// of the map every frame shows.
const GO: [number, number] = [0.687, 0.84];

/**
 * A drawn neighbourhood: streets, a park, Lake Ontario's shore, the home and
 * the nearest place in each category. Pins drop in once it's on screen; the
 * dashed route to the GO station draws itself after them.
 */
export function SampleMap({
  highlight,
  showRoute = false,
  className,
}: {
  /** Category to emphasise (the others dim). */
  highlight?: string | null;
  showRoute?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion();
  const W = 400;
  const H = 260;
  const at = ([x, y]: [number, number]) => [x * W, y * H] as const;
  const [hx, hy] = at(HOME);
  const [gx, gy] = at(GO);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden bg-[#eef0ea]", className)}
    >
      {/* One plane with the map's exact proportions, sized to cover the
          frame and centred (cropped evenly like a photo). Streets, pins and
          the route share its coordinates, so they always line up. */}
      <div className="absolute top-1/2 left-1/2 aspect-[20/13] min-h-full min-w-full -translate-x-1/2 -translate-y-1/2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          {/* Lake Ontario */}
          <path
            d={`M0 ${H} L0 228 C 80 214, 150 236, 230 222 S 360 206, ${W} 214 L ${W} ${H} Z`}
            fill="#cfe1ea"
          />
          <path
            d="M0 228 C 80 214, 150 236, 230 222 S 360 206, 400 214"
            fill="none"
            stroke="#b7d0dc"
            strokeWidth="1.5"
          />
          {/* Parks */}
          <path d="M70 130 L150 120 L160 190 L84 198 Z" fill="#d7e5cf" />
          <path d="M300 40 L360 34 L366 82 L306 88 Z" fill="#d7e5cf" />
          {/* Creek */}
          <path
            d="M40 0 C 60 60, 30 110, 66 160 S 70 220, 60 230"
            fill="none"
            stroke="#c5dbe5"
            strokeWidth="4"
          />
          {/* Local streets */}
          <g stroke="#ffffff" strokeWidth="5" fill="none" strokeLinecap="round">
            <path d="M0 70 L400 58" />
            <path d="M0 175 L400 162" />
            <path d="M120 0 L132 260" />
            <path d="M268 0 L276 260" />
            <path d="M190 64 C 200 100, 196 130, 210 168" />
            <path d="M210 168 C 240 150, 250 130, 272 120" />
            <path d="M330 60 L340 210" />
          </g>
          {/* Arterial roads */}
          <g stroke="#f6dfb4" strokeWidth="7" fill="none" strokeLinecap="round">
            <path d="M0 116 L400 100" />
            <path d="M366 0 L384 260" />
          </g>
          <g
            fill="#8a8f86"
            fontSize="7"
            letterSpacing="0.6"
            style={{ fontFamily: "var(--font-inter), system-ui" }}
          >
            <text x="150" y="104" transform="rotate(-2.3 150 104)">
              DUNDAS ST W
            </text>
            <text x="214" y="152">
              ASHGROVE CRES
            </text>
            <text x="150" y="248">
              LAKE ONTARIO
            </text>
          </g>
          {/* Route to the GO station */}
          {showRoute && (
            <motion.path
              // Down the home's crescent, east along the local street, then
              // south on the next street to the station.
              d={`M${hx} ${hy} C 199 145, 203 158, 210 168.2 L 273.1 166.1 L ${gx} ${gy}`}
              fill="none"
              className="stroke-foreground"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              initial={{ pathLength: reduce ? 1 : 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
              transition={{ duration: 1.4, delay: 0.9, ease: EASE }}
            />
          )}
        </svg>

        {/* Places */}
        {SAMPLE_PLACES.map((p, i) => {
          const Icon = AMENITY_ICONS[p.category];
          const dim = highlight != null && highlight !== p.category;
          return (
            <motion.span
              key={p.category}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${p.pin[0] * 100}%`, top: `${p.pin[1] * 100}%` }}
              initial={{ scale: reduce ? 1 : 0, opacity: 0 }}
              animate={
                inView ? { scale: dim ? 0.85 : 1, opacity: dim ? 0.35 : 1 } : {}
              }
              transition={{
                type: "spring",
                bounce: 0.35,
                duration: 0.6,
                delay: inView && highlight === undefined ? 0.25 + i * 0.09 : 0,
              }}
            >
              <span
                className="grid size-6 place-items-center border-2 border-white text-white shadow-sm"
                style={{ backgroundColor: COLOR[p.category] }}
              >
                <Icon aria-hidden className="size-3" />
              </span>
            </motion.span>
          );
        })}

        {/* GO station */}
        {showRoute && (
          <motion.span
            className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-white bg-[#15803d] text-white shadow-sm"
            style={{ left: `${GO[0] * 100}%`, top: `${GO[1] * 100}%` }}
            initial={{ scale: reduce ? 1 : 0 }}
            animate={inView ? { scale: 1 } : undefined}
            transition={{ type: "spring", bounce: 0.35, delay: 0.8 }}
          >
            <TrainFrontIcon aria-hidden className="size-3" />
          </motion.span>
        )}

        {/* The home, with a slow pulse */}
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${HOME[0] * 100}%`, top: `${HOME[1] * 100}%` }}
        >
          {!reduce && (
            <motion.span
              className="absolute inset-0 bg-foreground/30"
              animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <span className="relative grid size-8 place-items-center bg-foreground text-background shadow-md">
            <HouseIcon aria-hidden className="size-4" />
          </span>
        </span>
      </div>
    </div>
  );
}
