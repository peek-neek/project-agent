"use client";

import {
  BuildingIcon,
  ConstructionIcon,
  HardHatIcon,
  LayersIcon,
  TrainFrontIcon,
  TrendingUpIcon,
} from "lucide-react";
import { cn } from "cn";
import { useMemo } from "react";
import {
  JOB_KINDS,
  PROJECT_CATEGORIES,
  type ProjectCategory,
  type UpsideData,
} from "@/lib/report-sections";
import type { MapPin } from "@/components/globals/report/interactive-map";
import { formatDistance } from "@/components/globals/report/report-format";
import {
  PROJECT_ICONS,
  projectCategory,
} from "@/components/globals/report/upside-tab";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { CompareMap } from "./compare-map";
import {
  type CompareProperty,
  SIDE,
  SideChip,
  sideState,
  SIDES,
  winner,
} from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";

const CATEGORIES = Object.keys(PROJECT_CATEGORIES) as ProjectCategory[];

export function CompareUpside({
  a,
  b,
}: {
  a: CompareProperty;
  b: CompareProperty;
}) {
  const props = { a, b };
  const states = {
    a: sideState(a.report, JOB_KINDS.upside, a.data.upside != null),
    b: sideState(b.report, JOB_KINDS.upside, b.data.upside != null),
  };
  const ua = a.data.upside;
  const ub = b.data.upside;
  const count = (u: UpsideData | null, fn: (u: UpsideData) => number) =>
    u ? fn(u) : null;
  const transitBuilds = (u: UpsideData) =>
    u.projects.filter(
      (p) => p.category === "Transit" && p.status === "Under construction",
    ).length;
  const applications = (u: UpsideData) =>
    u.development?.applications.length ?? 0;
  const num = (v: number | null, sub?: string) =>
    v != null ? { value: v.toLocaleString("en-CA"), sub } : null;

  const glance: CompareRow[] = [
    {
      id: "projects",
      label: "Public projects nearby",
      hint: "Planned or under construction",
      icon: HardHatIcon,
      a: num(count(ua, (u) => u.projects.length)),
      b: num(count(ub, (u) => u.projects.length)),
      winner: winner(
        count(ua, (u) => u.projects.length),
        count(ub, (u) => u.projects.length),
      ),
    },
    {
      id: "transit",
      label: "Transit being built",
      icon: TrainFrontIcon,
      a: num(count(ua, transitBuilds)),
      b: num(count(ub, transitBuilds)),
      winner: winner(count(ua, transitBuilds), count(ub, transitBuilds)),
    },
    {
      id: "applications",
      label: "Development applications",
      hint: "Within 500 m",
      icon: ConstructionIcon,
      a: ua?.development
        ? num(applications(ua), ua.development.municipality ?? undefined)
        : ua
          ? { value: "Not connected", sub: ua.developmentNote ?? undefined }
          : null,
      b: ub?.development
        ? num(applications(ub), ub.development.municipality ?? undefined)
        : ub
          ? { value: "Not connected", sub: ub.developmentNote ?? undefined }
          : null,
    },
    {
      id: "units",
      label: "New homes proposed",
      icon: BuildingIcon,
      a: num(ua?.development?.totalUnits ?? null),
      b: num(ub?.development?.totalUnits ?? null),
    },
    {
      id: "storeys",
      label: "Tallest proposal",
      icon: LayersIcon,
      a: ua?.development?.tallestStoreys
        ? { value: `${ua.development.tallestStoreys} storeys` }
        : null,
      b: ub?.development?.tallestStoreys
        ? { value: `${ub.development.tallestStoreys} storeys` }
        : null,
    },
  ];

  // Per kind of project: how many, and the nearest.
  const categoryRows: CompareRow[] = CATEGORIES.flatMap((cat) => {
    const list = (u: UpsideData | null) =>
      (u?.projects ?? [])
        .filter((p) => p.category === cat)
        .sort((x, y) => x.distanceMeters - y.distanceMeters);
    if (list(ua).length + list(ub).length === 0) return [];
    const cell = (u: UpsideData | null) => {
      if (!u) return null;
      const l = list(u);
      return l.length
        ? {
            value: `${l.length} · ${formatDistance(l[0].distanceMeters)}`,
            sub: `${l[0].name}${l[0].targetCompletion ? ` · ${l[0].targetCompletion}` : ""}`,
          }
        : { value: "None" };
    };
    return [
      {
        id: cat,
        label: PROJECT_CATEGORIES[cat].label,
        hint: "Count · nearest",
        icon: HardHatIcon,
        iconColor: PROJECT_CATEGORIES[cat].color,
        a: cell(ua),
        b: cell(ub),
        winner: winner(
          ua ? list(ua).length : null,
          ub ? list(ub).length : null,
        ),
      },
    ];
  });

  const pins = useMemo(
    () =>
      SIDES.flatMap((side): MapPin[] => {
        const p = props[side];
        return (p.data.upside?.projects ?? [])
          .slice(0, 10)
          .map((project, i) => ({
            id: `${side}:${project.id}`,
            lat: project.lat,
            lng: project.lng,
            badge: `${SIDE[side].letter}${i + 1}`,
            // In the project category's colour and icon, as on a single
            // report; the badge says which home.
            color: projectCategory(project.category).color,
            icon: PROJECT_ICONS[project.category] ?? HardHatIcon,
            title: project.name,
            eyebrow: `${projectCategory(project.category).label} · near ${SIDE[side].letter}`,
            facts: [
              { label: project.status },
              { label: formatDistance(project.distanceMeters) },
              ...(project.targetCompletion
                ? [{ label: project.targetCompletion }]
                : []),
            ],
            href: project.website ?? undefined,
            linkLabel: "Project page",
          }));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt per data
    [ua, ub],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <CompareTable
          title="What's coming"
          icon={TrendingUpIcon}
          a={a}
          b={b}
          rows={glance}
          states={states}
        />
        {categoryRows.length > 0 && (
          <CompareTable
            title="Projects by kind"
            icon={HardHatIcon}
            a={a}
            b={b}
            rows={categoryRows}
            states={states}
            footer="Ontario Builds projects within each kind's reach of the home."
          />
        )}
      </div>
      <div
        className={cn(
          WIDGET,
          "overflow-hidden lg:sticky lg:top-32 lg:col-span-5",
        )}
      >
        <CompareMap
          a={a}
          b={b}
          pins={pins}
          className="h-[24rem] lg:h-[30rem]"
        />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-xs text-foreground/55">
          <span className="font-medium text-foreground">Projects</span>
          {SIDES.map((side) => (
            <span key={side} className="flex items-center gap-1.5">
              <SideChip side={side} className="size-4 text-[10px]" />
              {props[side].data.upside?.projects.length ?? 0} nearby
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}
