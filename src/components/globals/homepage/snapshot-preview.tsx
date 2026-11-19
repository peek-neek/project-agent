import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import Image from "next/image";
import * as motion from "motion/react-client";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { easeOutExpo, fadeUp, inViewOnce, stagger } from "./motion-presets";
import { SectionHeading } from "./section-heading";

const keyFacts = [
  { label: "Type", value: "Detached" },
  { label: "Beds", value: "4" },
  { label: "Baths", value: "3" },
  { label: "Size", value: "2,450 sq ft" },
  { label: "Price", value: "$1.85M" },
];

const highlights = [
  "8 min walk to a GO station",
  "Three parks within 600 m",
  "Quiet, tree-lined residential street",
  "Grocery and pharmacy under 10 min on foot",
  "Mostly owner-occupied block",
];

const watchOuts = [
  "Busy arterial road two blocks east",
  "Limited street parking",
  "Older roof, check its age",
];

const scores = [
  { label: "Walk", value: 88 },
  { label: "Transit", value: 76 },
  { label: "Bike", value: 64 },
];

const included = [
  "An AI headline that sums up the home and the area",
  "Key facts at a glance: type, beds, baths, size and price",
  "Top 5 highlights and top 3 watch-outs",
  "Walk, transit and bike scores",
];

function ScoreRing({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative size-16 sm:size-20">
        <svg viewBox="0 0 40 40" className="size-full -rotate-90" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            strokeWidth="3.5"
            className="stroke-muted"
          />
          <motion.circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="stroke-primary"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: value / 100 }}
            viewport={inViewOnce}
            transition={{ duration: 1.4, delay: 0.3, ease: easeOutExpo }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-base font-semibold sm:text-lg">
          {value}
        </span>
      </div>
      <span className="text-xs text-foreground/65">{label} Score</span>
    </div>
  );
}

export function SnapshotPreview() {
  return (
    <section
      id="snapshot"
      aria-labelledby="snapshot-title"
      className="scroll-mt-8 bg-card py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div>
          <SectionHeading
            id="snapshot-title"
            eyebrow="The snapshot"
            title="A one-page property summary your clients will actually read"
            description="Most buyers skim. The snapshot puts the essentials on the first page so they get the picture in under a minute."
          />
          <motion.ul
            variants={stagger(0.07, 0.2)}
            initial="hidden"
            whileInView="visible"
            viewport={inViewOnce}
            className="mt-8 space-y-3"
          >
            {included.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-start gap-3 text-sm sm:text-base"
              >
                <CircleCheckIcon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-primary"
                />
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <motion.figure
          variants={stagger(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={inViewOnce}
        >
          <Card className="gap-0 bg-background p-3 ring-border sm:p-4">
            <figcaption className="sr-only">
              Sample snapshot page from a property report
            </figcaption>
            <motion.div
              variants={fadeUp}
              className="relative h-44 overflow-hidden sm:h-56"
            >
              <Image
                src="/images/report-cover-home.jpg"
                alt="Contemporary white home with a covered terrace and a pool"
                fill
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute right-5 bottom-4 left-5 flex items-end justify-between gap-4 text-white">
                <div>
                  <p className="text-xs text-white/70">Sample report</p>
                  <p className="text-lg font-semibold sm:text-xl">
                    24 Birchwood Crescent, Toronto
                  </p>
                </div>
                <Badge className="h-auto bg-white/20 px-3 py-1 text-white backdrop-blur-md">
                  Snapshot
                </Badge>
              </div>
            </motion.div>

            <div className="space-y-3 p-2 pt-4 sm:p-3 sm:pt-5">
              <motion.p
                variants={fadeUp}
                className="text-base leading-snug font-medium text-pretty sm:text-lg"
              >
                “A bright family home on a quiet crescent, minutes from the GO
                train, parks and everyday shops.”
              </motion.p>

              <motion.dl
                variants={fadeUp}
                className="grid grid-cols-3 gap-2 sm:grid-cols-5"
              >
                {keyFacts.map((fact) => (
                  <Card
                    key={fact.label}
                    size="sm"
                    className="gap-0 px-3 py-2.5 ring-border"
                  >
                    <dt className="text-[11px] text-foreground/65">
                      {fact.label}
                    </dt>
                    <dd className="text-sm font-semibold">{fact.value}</dd>
                  </Card>
                ))}
              </motion.dl>

              <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
                <motion.div variants={fadeUp}>
                  <Card className="h-full gap-0 p-4 ring-border">
                    <p className="mb-2 text-xs font-medium text-foreground/65">
                      Top highlights
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {highlights.map((h) => (
                        <li key={h} className="flex gap-2">
                          <CircleCheckIcon
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-primary"
                          />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </Card>
                </motion.div>
                <motion.div variants={fadeUp} className="flex flex-col gap-3">
                  <Card className="gap-0 p-4 ring-border">
                    <p className="mb-2 text-xs font-medium text-foreground/65">
                      Watch-outs
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {watchOuts.map((w) => (
                        <li key={w} className="flex gap-2">
                          <CircleAlertIcon
                            aria-hidden
                            className="mt-0.5 size-4 shrink-0 text-foreground/65"
                          />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card className="flex-1 flex-row items-center justify-around gap-0 p-3 ring-border">
                    {scores.map((s) => (
                      <ScoreRing key={s.label} {...s} />
                    ))}
                  </Card>
                </motion.div>
              </div>
            </div>
          </Card>
        </motion.figure>
      </div>
    </section>
  );
}
