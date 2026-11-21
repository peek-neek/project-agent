"use client";

import { useState } from "react";
import { AMENITY_ICONS } from "@/components/globals/report/amenity-icons";
import { AMENITY_CATEGORIES } from "@/lib/report-sections";
import { SampleMap } from "../sample-map";
import { SAMPLE_PLACES } from "../sample";
import {
  Frame,
  MODES,
  ModeSwitch,
  Rolling,
  SampleTag,
  useAutoCycle,
} from "../shared";

const COLOR = Object.fromEntries(
  AMENITY_CATEGORIES.map((c) => [c.id, c.color]),
) as Record<string, string>;

export function AmenitiesVisual() {
  const { ref, index, select } = useAutoCycle(MODES.length, 3000);
  const mode = MODES[index];
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div ref={ref}>
      <Frame
        title="Nearest in each category"
        action={
          <ModeSwitch mode={mode} onChange={(m) => select(MODES.indexOf(m))} />
        }
        bodyClassName="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
      >
        <SampleMap highlight={hover} className="h-56 md:h-auto md:min-h-80" />
        <ul className="divide-y" onMouseLeave={() => setHover(null)}>
          {SAMPLE_PLACES.map((p) => {
            const Icon = AMENITY_ICONS[p.category];
            return (
              <li
                key={p.category}
                onMouseEnter={() => setHover(p.category)}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
              >
                <span
                  className="grid size-8 shrink-0 place-items-center"
                  style={{ backgroundColor: `${COLOR[p.category]}1a` }}
                >
                  <Icon
                    aria-hidden
                    className="size-4"
                    style={{ color: COLOR[p.category] }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {p.name}
                  </span>
                  <span className="block text-xs text-foreground/50">
                    {p.label}
                  </span>
                </span>
                <span className="flex items-baseline gap-1 text-sm font-semibold">
                  <Rolling value={p.minutes[mode]} />
                  <span className="text-xs font-normal text-foreground/50">
                    min
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Frame>
      <SampleTag className="mt-3" />
    </div>
  );
}
