"use client";

import { useMemo, useState } from "react";
import {
  InteractiveMap,
  type MapPin,
} from "@/components/globals/report/interactive-map";
import { type CompareProperty, SIDE } from "./compare-shared";

/** One map with both homes (A and B in their colours) and any pins. */
export function CompareMap({
  a,
  b,
  pins = [],
  className,
}: {
  a: CompareProperty;
  b: CompareProperty;
  pins?: MapPin[];
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const homes = useMemo(
    () =>
      [a, b].flatMap((p) =>
        p.home
          ? [
              {
                ...p.home,
                label: SIDE[p.side].letter,
                color: SIDE[p.side].color,
                textColor: SIDE[p.side].onColor,
              },
            ]
          : [],
      ),
    [a, b],
  );
  if (homes.length === 0) {
    return (
      <div className="grid h-64 place-items-center bg-muted text-sm text-foreground/55">
        The map appears once the addresses are located.
      </div>
    );
  }
  return (
    <InteractiveMap
      home={homes[0]}
      homes={homes}
      pins={pins}
      selectedId={selected}
      onSelect={setSelected}
      className={className}
    />
  );
}
