"use client";

import {
  LayoutGridIcon,
  MapPinnedIcon,
  PlaneIcon,
  RouteIcon,
  TrainFrontIcon,
} from "lucide-react";
import { cn } from "cn";
import { useMemo, useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTravelMode } from "@/components/globals/travel-mode";
import { destinationTime } from "@/lib/travel";
import {
  type CommuteData,
  DESTINATION_KINDS,
  type DestinationKind,
  JOB_KINDS,
  TRANSIT_KINDS,
  type TransitKind,
} from "@/lib/report-sections";
import { chipClass } from "@/components/globals/report/amenities-tab";
import {
  DESTINATION_ICONS,
  destinationKind,
  FilterChips,
} from "@/components/globals/report/commute-tab";
import { TRANSIT_ICONS } from "@/components/globals/report/transit-icons";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { CompareMap } from "./compare-map";
import { sidePins } from "./compare-places";
import {
  type CompareProperty,
  placeCell,
  SideChip,
  sideState,
  SIDES,
  winner,
} from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";

const REACH = 15;
const KINDS = Object.keys(TRANSIT_KINDS) as TransitKind[];
/** "All" on the map: the nearest few stops of every kind, like a single report. */
const ALL_PER_KIND = 3;

type Destination = CommuteData["destinations"][number];

export function CompareCommute({
  a,
  b,
}: {
  a: CompareProperty;
  b: CompareProperty;
}) {
  const travel = useTravelMode();
  const props = { a, b };
  const states = {
    a: sideState(a.report, JOB_KINDS.commute, a.data.commute != null),
    b: sideState(b.report, JOB_KINDS.commute, b.data.commute != null),
  };

  // Destinations: the same downtowns and airports, matched by name.
  const labels = [
    ...new Set(
      SIDES.flatMap((s) =>
        (props[s].data.commute?.destinations ?? []).map((d) => d.label),
      ),
    ),
  ];
  const trip = (d: Destination | undefined) => {
    if (!d) return null;
    const own = destinationTime(d, travel.mode).minutes;
    const best = Math.min(
      ...[d.transitMinutes, own].filter((m): m is number => m != null),
    );
    return {
      own,
      transit: d.transitMinutes,
      best: Number.isFinite(best) ? best : null,
    };
  };
  // Destinations: all, or only downtowns / airports (when both kinds exist).
  const [destFilter, setDestFilter] = useState<DestinationKind | "all">("all");
  const kindOfLabel = (label: string): DestinationKind => {
    const d = SIDES.map((s) =>
      props[s].data.commute?.destinations.find((x) => x.label === label),
    ).find(Boolean);
    return d ? destinationKind(d) : "downtown";
  };
  const destKinds = (
    Object.keys(DESTINATION_KINDS) as DestinationKind[]
  ).filter((k) => labels.some((l) => kindOfLabel(l) === k));
  const shownLabels = labels.filter(
    (l) => destFilter === "all" || kindOfLabel(l) === destFilter,
  );
  const destinationRows: CompareRow[] = shownLabels.map((label) => {
    const find = (p: CompareProperty) =>
      p.data.commute?.destinations.find((d) => d.label === label);
    const t = { a: trip(find(a)), b: trip(find(b)) };
    const cell = (side: "a" | "b") => {
      const x = t[side];
      if (!x || x.best == null) return null;
      return {
        value:
          x.transit != null
            ? `${x.transit} min transit`
            : `${x.own} min ${travel.verb}`,
        sub:
          x.transit != null && x.own != null
            ? `${x.own} min ${travel.verb}`
            : undefined,
      };
    };
    const airport = /airport/i.test(label) || find(a)?.kind === "airport";
    return {
      id: label,
      label,
      icon: airport ? PlaneIcon : MapPinnedIcon,
      a: cell("a"),
      b: cell("b"),
      winner: winner(t.a?.best, t.b?.best, { higher: false, tolerance: 2 }),
    };
  });

  const stations = (p: CompareProperty, kind: TransitKind) =>
    [...(p.data.commute?.stations ?? [])]
      .filter((s) => s.kind === kind)
      .sort((x, y) => travel.time(x).minutes - travel.time(y).minutes);
  const stopRows: CompareRow[] = KINDS.map((kind) => {
    const meta = TRANSIT_KINDS[kind];
    const nearest = { a: stations(a, kind)[0], b: stations(b, kind)[0] };
    const count = (p: CompareProperty) =>
      stations(p, kind).filter((s) => travel.time(s).minutes <= REACH).length;
    const cell = (p: CompareProperty) => {
      const n = nearest[p.side];
      if (!n) return p.data.commute ? { value: "None nearby" } : null;
      return placeCell(
        n,
        travel,
        `${n.name} · ${count(p)} within ${REACH} min`,
      );
    };
    const mins = (p: CompareProperty) => {
      const n = nearest[p.side];
      return n ? travel.time(n).minutes : p.data.commute ? 999 : null;
    };
    return {
      id: kind,
      label: meta.label,
      icon: TRANSIT_ICONS[kind],
      iconColor: meta.color,
      a: cell(a),
      b: cell(b),
      winner: winner(mins(a), mins(b), { higher: false, tolerance: 1 }),
    };
  });

  const firstKind =
    KINDS.find((k) => stations(a, k).length + stations(b, k).length > 0) ??
    "subway";
  // "All" (the nearest few of each kind) or one kind, like a single report.
  const [picked, setKind] = useState<TransitKind | "all" | null>(null);
  const kind = picked ?? firstKind;
  /** One side's stops on the map, quickest first. */
  const mapStops = (p: CompareProperty) =>
    kind === "all"
      ? KINDS.flatMap((k) => stations(p, k).slice(0, ALL_PER_KIND)).sort(
          (x, y) => travel.time(x).minutes - travel.time(y).minutes,
        )
      : stations(p, kind).slice(0, 8);
  const pins = useMemo(
    () =>
      SIDES.flatMap((side) =>
        sidePins(props[side], mapStops(props[side]), {
          icon: TrainFrontIcon,
          eyebrow: "Stop",
          iconFor: (stop) => TRANSIT_ICONS[stop.kind],
          eyebrowFor: (stop) => TRANSIT_KINDS[stop.kind].label,
          colorFor: (stop) => TRANSIT_KINDS[stop.kind].color,
          travel,
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt per kind, data and mode
    [a.data.commute, b.data.commute, kind, travel.mode],
  );
  const departure =
    a.data.commute?.departureLabel ?? b.data.commute?.departureLabel;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        {destKinds.length > 1 && (
          <FilterChips
            label="Destination type"
            value={destFilter}
            onChange={setDestFilter}
            options={destKinds.map((k) => ({
              value: k,
              label: DESTINATION_KINDS[k].label,
              icon: DESTINATION_ICONS[k],
              meta: String(labels.filter((l) => kindOfLabel(l) === k).length),
            }))}
          />
        )}
        <CompareTable
          title="Trips"
          icon={RouteIcon}
          a={a}
          b={b}
          rows={destinationRows}
          states={states}
          footer={
            departure
              ? `Transit and driving times for ${departure}.`
              : undefined
          }
        />
        <CompareTable
          title="Transit stops"
          icon={TrainFrontIcon}
          a={a}
          b={b}
          rows={stopRows}
          states={states}
        />
      </div>

      <div className="space-y-3 lg:sticky lg:top-32 lg:col-span-5">
        <ToggleGroup
          aria-label="Kind of stop on the map"
          value={[kind]}
          onValueChange={(value) => {
            const next = value[0] as TransitKind | "all" | undefined;
            if (next) setKind(next);
          }}
          spacing={1}
          className="flex w-full flex-wrap justify-start"
        >
          <ToggleGroupItem
            value="all"
            className={cn(chipClass, "px-2.5 py-1.5 text-xs")}
          >
            <LayoutGridIcon aria-hidden />
            All
          </ToggleGroupItem>
          {KINDS.map((k) => {
            const Icon = TRANSIT_ICONS[k];
            return (
              <ToggleGroupItem
                key={k}
                value={k}
                className={cn(chipClass, "px-2.5 py-1.5 text-xs")}
              >
                <Icon aria-hidden style={{ color: TRANSIT_KINDS[k].color }} />
                {TRANSIT_KINDS[k].label}
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
            <span className="font-medium text-foreground">
              {kind === "all"
                ? `The ${ALL_PER_KIND} nearest of each kind`
                : TRANSIT_KINDS[kind].label}
            </span>
            {SIDES.map((side) => (
              <span key={side} className="flex items-center gap-1.5">
                <SideChip side={side} className="size-4 text-[10px]" />
                {kind === "all"
                  ? `${mapStops(props[side]).length} shown`
                  : `${stations(props[side], kind).length} nearby`}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
