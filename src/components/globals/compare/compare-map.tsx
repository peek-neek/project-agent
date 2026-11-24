"use client";

import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  InteractiveMap,
  type MapPin,
} from "@/components/globals/report/interactive-map";
import {
  type CompareProperty,
  SIDE,
  SideChip,
  type Side,
} from "./compare-shared";

type Shown = Side | "both";

/**
 * One map with both homes (A and B in their colours) and any pins. An
 * A / Both / B switch on the map shows one property's home and places, or
 * both. Pin ids start with their side ("a:…", "b:…").
 */
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
  // Starts on both; the switch narrows it to one home and its places.
  const [shown, setShown] = useState<Shown>("both");
  const homes = useMemo(
    () =>
      [a, b].flatMap((p) =>
        p.home && (shown === "both" || shown === p.side)
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
    [a, b, shown],
  );
  const visiblePins = useMemo(
    () =>
      shown === "both"
        ? pins
        : pins.filter((pin) => pin.id.startsWith(`${shown}:`)),
    [pins, shown],
  );

  if (!a.home && !b.home) {
    return (
      <div className="grid h-64 place-items-center bg-muted text-sm text-foreground/55">
        The map appears once the addresses are located.
      </div>
    );
  }
  // The chosen property isn't located yet: fall back to whichever is.
  const framed = homes.length > 0 ? homes : null;
  return (
    <div className="relative">
      <InteractiveMap
        home={(framed ?? [])[0] ?? (a.home ?? b.home)!}
        homes={framed ?? undefined}
        pins={visiblePins}
        selectedId={selected}
        onSelect={setSelected}
        className={className}
      />
      {/* Which property: whenever both homes are on the map. */}
      {a.home && b.home && (
        <ToggleGroup
          aria-label="Show on the map"
          value={[shown]}
          onValueChange={(value) => {
            const next = value[0] as Shown | undefined;
            if (!next) return;
            setSelected(null);
            setShown(next);
          }}
          spacing={0}
          className="absolute top-3 left-3 z-10 border bg-card p-0.5 shadow-sm"
        >
          {(["a", "both", "b"] as const).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              aria-label={
                v === "both"
                  ? "Both properties"
                  : `Property ${SIDE[v].letter} only`
              }
              className="h-7 gap-1.5 rounded-none px-2 text-xs data-pressed:bg-foreground data-pressed:text-background"
            >
              {v === "both" ? (
                "Both"
              ) : (
                <SideChip side={v} className="size-4 text-[10px]" />
              )}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
    </div>
  );
}
