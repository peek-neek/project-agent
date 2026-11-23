"use client";

import { StoreIcon } from "lucide-react";
import { cn } from "cn";
import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTravelMode } from "@/components/globals/travel-mode";
import {
  AMENITY_CATEGORIES,
  type AmenityCategoryId,
  JOB_KINDS,
} from "@/lib/report-sections";
import { chipClass } from "@/components/globals/report/amenities-tab";
import { AMENITY_ICONS } from "@/components/globals/report/amenity-icons";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { CompareMap } from "./compare-map";
import { sidePins } from "./compare-places";
import {
  type CompareProperty,
  SideChip,
  sideState,
  SIDES,
  winner,
} from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";

/** Places this many minutes away or less count as "within reach". */
const REACH = 15;

export function CompareAmenities({
  a,
  b,
}: {
  a: CompareProperty;
  b: CompareProperty;
}) {
  const travel = useTravelMode();
  const [category, setCategory] = useState<AmenityCategoryId>("groceries");
  const props = { a, b };
  const states = {
    a: sideState(a.report, JOB_KINDS.amenities, a.data.amenities != null),
    b: sideState(b.report, JOB_KINDS.amenities, b.data.amenities != null),
  };

  /** A category's places for one side, quickest first in the travel mode. */
  const places = (p: CompareProperty, id: string) =>
    [...(p.data.amenities?.categories[id] ?? [])].sort(
      (x, y) => travel.time(x).minutes - travel.time(y).minutes,
    );
  const inReach = (p: CompareProperty, id: string) =>
    places(p, id).filter((x) => travel.time(x).minutes <= REACH).length;

  const rows: CompareRow[] = AMENITY_CATEGORIES.map((c) => {
    const nearest = { a: places(a, c.id)[0], b: places(b, c.id)[0] };
    const cell = (p: CompareProperty) => {
      const n = nearest[p.side];
      if (!n) return p.data.amenities ? { value: "None nearby" } : null;
      return {
        value: `${travel.minutes(n)} ${travel.verb}`,
        sub: `${n.name} · ${inReach(p, c.id)} within ${REACH} min`,
      };
    };
    return {
      id: c.id,
      label: c.label,
      icon: AMENITY_ICONS[c.id],
      iconColor: c.color,
      a: cell(a),
      b: cell(b),
      winner: winner(
        nearest.a
          ? travel.time(nearest.a).minutes
          : a.data.amenities
            ? 999
            : null,
        nearest.b
          ? travel.time(nearest.b).minutes
          : b.data.amenities
            ? 999
            : null,
        { higher: false, tolerance: 1 },
      ),
    };
  });
  const totals = {
    a: AMENITY_CATEGORIES.filter((c) => inReach(a, c.id) > 0).length,
    b: AMENITY_CATEGORIES.filter((c) => inReach(b, c.id) > 0).length,
  };
  rows.unshift({
    id: "reach",
    label: `Categories within ${REACH} min`,
    hint: "Of every kind of place we look for",
    icon: StoreIcon,
    a: a.data.amenities
      ? { value: `${totals.a} of ${AMENITY_CATEGORIES.length}` }
      : null,
    b: b.data.amenities
      ? { value: `${totals.b} of ${AMENITY_CATEGORIES.length}` }
      : null,
    winner: winner(
      a.data.amenities ? totals.a : null,
      b.data.amenities ? totals.b : null,
    ),
  });

  const meta = AMENITY_CATEGORIES.find((c) => c.id === category)!;
  const pins = useMemo(
    () =>
      SIDES.flatMap((side) =>
        sidePins(props[side], places(props[side], category), {
          icon: AMENITY_ICONS[category],
          eyebrow: meta.label,
          travel,
          photoPath: "place-photo",
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt per category, data and mode
    [a.data.amenities, b.data.amenities, category, travel.mode],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <CompareTable
        title="Nearest of each"
        icon={StoreIcon}
        a={a}
        b={b}
        rows={rows}
        states={states}
        className="lg:col-span-7"
      />

      {/* One map: pick a kind of place to see it around both homes. */}
      <div className="space-y-3 lg:sticky lg:top-32 lg:col-span-5">
        <ToggleGroup
          aria-label="Kind of place on the map"
          value={[category]}
          onValueChange={(value) => {
            const next = value[0] as AmenityCategoryId | undefined;
            if (next) setCategory(next);
          }}
          spacing={1}
          className="flex w-full flex-wrap justify-start"
        >
          {AMENITY_CATEGORIES.map((c) => {
            const Icon = AMENITY_ICONS[c.id];
            return (
              <ToggleGroupItem
                key={c.id}
                value={c.id}
                aria-label={c.label}
                className={cn(chipClass, "px-2.5 py-1.5 text-xs")}
              >
                <Icon aria-hidden style={{ color: c.color }} />
                <span className="hidden sm:inline">{c.label}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <div className={cn(WIDGET, "overflow-hidden")}>
          <CompareMap
            a={a}
            b={b}
            pins={pins}
            className="h-[24rem] lg:h-[30rem]"
          />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-xs text-foreground/55">
            <span className="font-medium text-foreground">{meta.label}</span>
            {SIDES.map((side) => (
              <span key={side} className="flex items-center gap-1.5">
                <SideChip side={side} className="size-4 text-[10px]" />
                {places(props[side], category).length} nearby
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
