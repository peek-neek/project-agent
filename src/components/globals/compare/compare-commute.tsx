"use client";

import {
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
  JOB_KINDS,
  TRANSIT_KINDS,
  type TransitKind,
} from "@/lib/report-sections";
import { chipClass } from "@/components/globals/report/amenities-tab";
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
  const destinationRows: CompareRow[] = labels.map((label) => {
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
  const [picked, setKind] = useState<TransitKind | null>(null);
  const kind = picked ?? firstKind;
  const pins = useMemo(
    () =>
      SIDES.flatMap((side) =>
        sidePins(props[side], stations(props[side], kind).slice(0, 8), {
          icon: TRANSIT_ICONS[kind],
          eyebrow: TRANSIT_KINDS[kind].label,
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
            const next = value[0] as TransitKind | undefined;
            if (next) setKind(next);
          }}
          spacing={1}
          className="flex w-full flex-wrap justify-start"
        >
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
              {TRANSIT_KINDS[kind].label}
            </span>
            {SIDES.map((side) => (
              <span key={side} className="flex items-center gap-1.5">
                <SideChip side={side} className="size-4 text-[10px]" />
                {stations(props[side], kind).length} nearby
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
