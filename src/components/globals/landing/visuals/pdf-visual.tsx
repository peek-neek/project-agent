"use client";

import {
  type MotionStyle,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import Image from "next/image";
import { useRef } from "react";
import { AMENITY_ICONS } from "@/components/globals/report/amenity-icons";
import { AMENITY_CATEGORIES } from "@/lib/report-sections";
import { SAMPLE_FACTORS, SAMPLE_HOME, SAMPLE_PLACES } from "../sample";
import { SampleTag } from "../shared";

const COLOR = Object.fromEntries(
  AMENITY_CATEGORIES.map((c) => [c.id, c.color]),
) as Record<string, string>;

/** One sheet of the PDF: letter-sized, with the reserved logo spot. */
function Sheet({
  children,
  page,
  style,
  className,
}: {
  children: React.ReactNode;
  page: number;
  /** Position: centred with x "-50%" (Motion owns the transform). */
  style: MotionStyle;
  className?: string;
}) {
  return (
    <motion.div
      style={style}
      className={`absolute top-0 left-1/2 flex aspect-[8.5/11] w-[min(17rem,56%)] flex-col border border-foreground/10 bg-card p-4 shadow-[0_24px_48px_-20px_rgb(0_0_0/0.35)] ${className ?? ""}`}
    >
      <div className="flex-1 overflow-hidden">{children}</div>
      <div className="mt-3 flex items-center justify-between border-t pt-2 text-[7px] text-foreground/40">
        <span className="border border-dashed border-foreground/25 px-2 py-0.5">
          Your logo
        </span>
        <span>Page {page}</span>
      </div>
    </motion.div>
  );
}

export function PdfVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const spread = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [1, 1] : [0, 1],
  );
  const leftRotate = useTransform(spread, [0, 1], [0, -8]);
  const leftX = useTransform(spread, [0, 1], ["-50%", "-112%"]);
  const rightRotate = useTransform(spread, [0, 1], [0, 8]);
  const rightX = useTransform(spread, [0, 1], ["-50%", "12%"]);
  const sideY = useTransform(spread, [0, 1], [0, 18]);

  return (
    <div>
      <div
        ref={ref}
        className="relative mx-auto h-[25rem] max-w-xl sm:h-[28rem]"
      >
        {/* Page 3: amenities */}
        <Sheet page={5} style={{ rotate: rightRotate, x: rightX, y: sideY }}>
          <p className="text-[7px] font-semibold tracking-wider text-primary uppercase">
            04 · Amenities
          </p>
          <p className="mt-1 text-[11px] font-semibold">
            Everyday places nearby
          </p>
          <ul className="mt-3 space-y-1.5">
            {SAMPLE_PLACES.map((p) => {
              const Icon = AMENITY_ICONS[p.category];
              return (
                <li
                  key={p.category}
                  className="flex items-center gap-1.5 border border-foreground/10 p-1.5 text-[7.5px]"
                >
                  <Icon
                    className="size-2.5"
                    style={{ color: COLOR[p.category] }}
                  />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-foreground/50">
                    {p.minutes.walk} · {p.minutes.drive} min
                  </span>
                </li>
              );
            })}
          </ul>
        </Sheet>

        {/* Page 2: scores */}
        <Sheet page={2} style={{ rotate: leftRotate, x: leftX, y: sideY }}>
          <p className="text-[7px] font-semibold tracking-wider text-primary uppercase">
            01 · Scores
          </p>
          <p className="mt-1 text-[11px] font-semibold">
            How this location scores
          </p>
          <ul className="mt-3 space-y-2">
            {SAMPLE_FACTORS.slice(0, 7).map((f) => (
              <li key={f.label}>
                <div className="flex justify-between text-[7.5px]">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-foreground/50">
                    {(1 + f.score * 4).toFixed(1)}
                  </span>
                </div>
                <span className="mt-0.5 block h-1 bg-muted">
                  <span
                    className="block h-full"
                    style={{
                      width: `${f.score * 100}%`,
                      backgroundColor: f.score >= 0.6 ? "#16a34a" : "#ca8a04",
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Sheet>

        {/* Page 1: cover */}
        <Sheet page={1} className="z-10" style={{ x: "-50%" }}>
          <p className="text-[7px] font-semibold tracking-wider text-primary uppercase">
            Property report
          </p>
          <p className="mt-1 text-sm leading-tight font-semibold">
            {SAMPLE_HOME.street}
          </p>
          <p className="text-[8px] text-foreground/50">{SAMPLE_HOME.place}</p>
          <div className="relative mt-2 aspect-[4/3] overflow-hidden">
            <Image
              src="/images/hero-home.jpg"
              alt=""
              fill
              sizes="17rem"
              className="object-cover"
            />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-[7px]">
            {[
              ["Type", SAMPLE_HOME.type],
              ["Bedrooms", String(SAMPLE_HOME.beds)],
              ["Bathrooms", String(SAMPLE_HOME.baths)],
            ].map(([k, v]) => (
              <div key={k} className="border border-foreground/10 p-1">
                <p className="text-foreground/45">{k}</p>
                <p className="font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </Sheet>
      </div>
      <SampleTag className="mt-3" />
    </div>
  );
}
