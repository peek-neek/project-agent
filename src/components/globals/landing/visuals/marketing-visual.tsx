"use client";

import { MailIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "cn";
import { useId } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  BRAND_COLORS,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
} from "@/components/globals/brand-icons";
import { SAMPLE_STAGES, SAMPLE_TONES } from "../sample";
import { EASE, Frame, Rolling, SampleTag, useAutoCycle } from "../shared";

const MLS_LIMIT = 450;

export function MarketingVisual() {
  const id = useId();
  const reduce = useReducedMotion();
  const { ref, index, select, inView } = useAutoCycle(
    SAMPLE_TONES.length,
    3600,
  );
  const tone = SAMPLE_TONES[index];

  return (
    <div ref={ref}>
      <Frame>
        {/* Tones */}
        <ToggleGroup
          aria-label="Tone"
          value={[tone.id]}
          onValueChange={(v) => {
            const i = SAMPLE_TONES.findIndex((t) => t.id === v[0]);
            if (i >= 0) select(i);
          }}
          spacing={0}
          className="w-full overflow-x-auto border-b px-2"
        >
          {SAMPLE_TONES.map((t) => {
            const active = t.id === tone.id;
            return (
              <ToggleGroupItem
                key={t.id}
                value={t.id}
                className={cn(
                  "relative h-11 rounded-none px-3 text-sm hover:bg-transparent data-pressed:bg-transparent",
                  active ? "text-foreground" : "text-foreground/55",
                )}
              >
                {t.label}
                {active && (
                  <motion.span
                    layoutId={`tone-${id}`}
                    transition={{
                      type: "spring",
                      bounce: 0.15,
                      duration: 0.45,
                    }}
                    className="absolute inset-x-3 bottom-0 h-0.5 bg-primary"
                  />
                )}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>

        {/* The copy. Invisible copies of every tone hold the height (the
            frame never jumps); the visible one fades out, then the next in. */}
        <div className="grid p-5 text-[15px] leading-relaxed text-pretty">
          {SAMPLE_TONES.map((t) => (
            <p key={t.id} aria-hidden className="invisible [grid-area:1/1]">
              {t.text}
            </p>
          ))}
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={tone.id}
              className="[grid-area:1/1]"
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -4 }}
              transition={{ duration: 0.25, ease: EASE }}
            >
              {tone.text}
            </motion.p>
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-2.5 text-xs text-foreground/55">
          <span>Written from this home&apos;s real surroundings</span>
          <span className="flex items-center gap-1">
            <Rolling
              value={tone.text.length}
              className="font-semibold text-foreground"
            />
            / {MLS_LIMIT} for MLS
          </span>
        </div>

        {/* Also written */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t bg-muted/40 px-5 py-3 text-sm">
          <span className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
            Also written
          </span>
          <span className="flex items-center gap-1.5">
            <InstagramIcon
              className="size-4"
              style={{ color: BRAND_COLORS.instagram }}
            />
            Instagram
          </span>
          <span className="flex items-center gap-1.5">
            <FacebookIcon
              className="size-4"
              style={{ color: BRAND_COLORS.facebook }}
            />
            Facebook
          </span>
          <span className="flex items-center gap-1.5">
            <LinkedinIcon
              className="size-4"
              style={{ color: BRAND_COLORS.linkedin }}
            />
            LinkedIn
          </span>
          <span className="flex items-center gap-1.5">
            <MailIcon className="size-4 text-foreground/60" />
            Email
          </span>
          <span className="text-foreground/60">
            Reel script · Carousel · Ads
          </span>
        </div>

        {/* Campaign */}
        <div className="border-t px-5 py-4">
          <p className="text-xs font-medium tracking-wide text-foreground/50 uppercase">
            A post for every stage
          </p>
          <ol className="relative mt-4 grid grid-cols-5">
            <span className="absolute top-[5px] right-[10%] left-[10%] h-px bg-border" />
            <motion.span
              className="absolute top-[5px] left-[10%] h-px w-[80%] origin-left bg-primary"
              initial={{ scaleX: reduce ? 1 : 0 }}
              animate={inView ? { scaleX: 1 } : undefined}
              transition={{ duration: 1.6, delay: 0.3, ease: EASE }}
            />
            {SAMPLE_STAGES.map((s, i) => (
              <li
                key={s}
                className="relative flex flex-col items-center gap-2 text-center"
              >
                <motion.span
                  className="size-2.5 border-2 border-primary bg-card"
                  initial={{ scale: reduce ? 1 : 0 }}
                  animate={inView ? { scale: 1 } : undefined}
                  transition={{
                    type: "spring",
                    bounce: 0.4,
                    delay: 0.3 + i * 0.3,
                  }}
                />
                <span className="text-[11px] leading-tight text-foreground/65">
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}
