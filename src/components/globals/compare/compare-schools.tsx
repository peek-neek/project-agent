"use client";

import { GraduationCapIcon, SchoolIcon } from "lucide-react";
import { cn } from "cn";
import { useMemo, useState } from "react";
import { useTravelMode } from "@/components/globals/travel-mode";
import { eqaoMean } from "@/lib/section-scores";
import {
  JOB_KINDS,
  SCHOOL_SYSTEMS,
  type School,
  type SchoolSystemId,
} from "@/lib/report-sections";
import { FilterChips } from "@/components/globals/report/commute-tab";
import { allSchools } from "@/components/globals/report/report-insights";
import { WIDGET } from "@/components/globals/report/widget-styles";
import { CompareMap } from "./compare-map";
import { sidePins } from "./compare-places";
import {
  type CompareProperty,
  minutesTo,
  SideChip,
  sideState,
  SIDES,
  type Travel,
  winner,
} from "./compare-shared";
import {
  type CompareCell,
  type CompareRow,
  CompareTable,
} from "./compare-table";

const REACH = 15;
/** "All" on the map: each home's nearest few schools. */
const ALL_NEAREST = 6;

/** "~6 min walk" with the school and its EQAO average underneath. */
function schoolCell(
  school: School | undefined,
  travel: Travel,
): CompareCell | null {
  if (!school) return null;
  const eqao = eqaoMean(school.results);
  return {
    value: `${travel.minutes(school)} ${travel.verb}`,
    sub: [school.name, eqao != null ? `EQAO ${Math.round(eqao)}%` : null]
      .filter(Boolean)
      .join(" · "),
  };
}

export function CompareSchools({
  a,
  b,
}: {
  a: CompareProperty;
  b: CompareProperty;
}) {
  const travel = useTravelMode();
  const props = { a, b };
  const states = {
    a: sideState(a.report, JOB_KINDS.schools, a.data.schools != null),
    b: sideState(b.report, JOB_KINDS.schools, b.data.schools != null),
  };
  const nearest = (p: CompareProperty, level: School["level"]) =>
    allSchools(p.data.schools)
      .filter((s) => s.level === level)
      .sort((x, y) => travel.time(x).minutes - travel.time(y).minutes)[0];
  const average = (p: CompareProperty) => {
    const values = allSchools(p.data.schools)
      .slice(0, 4)
      .map((s) => eqaoMean(s.results))
      .filter((v): v is number => v != null);
    return values.length
      ? Math.round(values.reduce((x, y) => x + y, 0) / values.length)
      : null;
  };
  const inReach = (p: CompareProperty) =>
    p.data.schools
      ? allSchools(p.data.schools).filter(
          (s) => travel.time(s).minutes <= REACH,
        ).length
      : null;
  const ontario = a.data.schools ?? b.data.schools;
  const provincial = ontario
    ? eqaoMean(ontario.provincialAverage as School["results"])
    : null;

  const glance: CompareRow[] = [
    {
      id: "eqao",
      label: "School results",
      hint: `EQAO average, 4 nearest${provincial != null ? ` · Ontario ${Math.round(provincial)}%` : ""}`,
      icon: GraduationCapIcon,
      a: average(a) != null ? { value: `${average(a)}%` } : null,
      b: average(b) != null ? { value: `${average(b)}%` } : null,
      winner: winner(average(a), average(b), { tolerance: 1 }),
    },
    ...(["Elementary", "Secondary"] as const).map((level) => {
      const n = { a: nearest(a, level), b: nearest(b, level) };
      return {
        id: level,
        label: `Nearest ${level.toLowerCase()}`,
        icon: SchoolIcon,
        a: schoolCell(n.a, travel),
        b: schoolCell(n.b, travel),
        winner: winner(minutesTo(n.a, travel), minutesTo(n.b, travel), {
          higher: false,
          tolerance: 1,
        }),
      };
    }),
    {
      id: "reach",
      label: `Schools within ${REACH} min`,
      icon: SchoolIcon,
      a: inReach(a) != null ? { value: inReach(a) } : null,
      b: inReach(b) != null ? { value: inReach(b) } : null,
      winner: winner(inReach(a), inReach(b)),
    },
  ];

  // Each school system and level: the nearest school for each home.
  const systems = SCHOOL_SYSTEMS.filter((sys) =>
    SIDES.some((side) =>
      props[side].data.schools?.systems.some((s) => s.id === sys.id),
    ),
  );
  // All systems, or one (map and table), like a single report's filter.
  const [system, setSystem] = useState<SchoolSystemId | "all">("all");
  const picked = SCHOOL_SYSTEMS.find((x) => x.id === system) ?? null;
  const systemRows: CompareRow[] = systems
    .filter((sys) => !picked || sys.id === picked.id)
    .flatMap((sys) =>
      (["elementary", "secondary"] as const).map((level) => {
        const first = (p: CompareProperty) =>
          [
            ...(p.data.schools?.systems.find((s) => s.id === sys.id)?.[level] ??
              []),
          ].sort((x, y) => travel.time(x).minutes - travel.time(y).minutes)[0];
        const n = { a: first(a), b: first(b) };
        const eqao = (s?: School) => (s ? eqaoMean(s.results) : null);
        return {
          id: `${sys.id}-${level}`,
          label: sys.label,
          hint: level === "elementary" ? "Elementary" : "Secondary",
          icon: GraduationCapIcon,
          iconColor: sys.color,
          a: schoolCell(n.a, travel),
          b: schoolCell(n.b, travel),
          // Results first; nearer only breaks a tie.
          winner:
            winner(eqao(n.a), eqao(n.b), { tolerance: 2 }) ??
            winner(minutesTo(n.a, travel), minutesTo(n.b, travel), {
              higher: false,
              tolerance: 2,
            }),
        };
      }),
    );

  /** One side's schools on the map: the nearest few, or all of a system. */
  const mapSchools = (p: CompareProperty) => {
    const list = allSchools(p.data.schools);
    return picked
      ? list.filter((s) => s.systemLabel === picked.label)
      : list.slice(0, ALL_NEAREST);
  };
  const pins = useMemo(
    () =>
      SIDES.flatMap((side) =>
        sidePins(props[side], mapSchools(props[side]), {
          icon: GraduationCapIcon,
          eyebrow: "School",
          eyebrowFor: (s) => s.systemLabel,
          colorFor: (s) => s.color,
          travel,
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt per system, data and mode
    [a.data.schools, b.data.schools, system, travel.mode],
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-7">
        <CompareTable
          title="Schools at a glance"
          icon={GraduationCapIcon}
          a={a}
          b={b}
          rows={glance}
          states={states}
        />
        {systemRows.length > 0 && (
          <CompareTable
            title="By school system"
            icon={SchoolIcon}
            a={a}
            b={b}
            rows={systemRows}
            states={states}
            footer={
              ontario?.dataYear
                ? `EQAO: share of students meeting the provincial standard, ${ontario.dataYear}. Better results win; distance breaks a tie.`
                : undefined
            }
          />
        )}
      </div>
      <div className="space-y-3 lg:sticky lg:top-32 lg:col-span-5">
        {systems.length > 1 && (
          <FilterChips
            label="School system"
            value={system}
            onChange={setSystem}
            options={systems.map((sys) => ({
              value: sys.id,
              label: sys.label,
              icon: GraduationCapIcon,
              color: sys.color,
            }))}
          />
        )}
        <div className={cn(WIDGET, "overflow-hidden")}>
          <CompareMap
            a={a}
            b={b}
            pins={pins}
            className="h-[24rem] lg:h-[34rem]"
          />
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t px-4 py-2.5 text-xs text-foreground/55">
            <span className="font-medium text-foreground">
              {picked ? picked.label : "Nearest schools"}
            </span>
            {SIDES.map((side) => (
              <span key={side} className="flex items-center gap-1.5">
                <SideChip side={side} className="size-4 text-[10px]" />
                {mapSchools(props[side]).length} shown
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}
