"use client";

import {
  BuildingIcon,
  KeyRoundIcon,
  MapPinnedIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { type CensusFieldId, JOB_KINDS } from "@/lib/report-sections";
import { DashCard } from "@/components/globals/report/dash-card";
import {
  field,
  formatValue,
} from "@/components/globals/report/demographics-section";
import {
  type CompareProperty,
  SIDE,
  SideChip,
  sideState,
  SIDES,
} from "./compare-shared";
import { type CompareRow, CompareTable } from "./compare-table";

const HOME_TYPES: { id: CensusFieldId; label: string }[] = [
  { id: "singleDetached", label: "Detached houses" },
  { id: "semiDetached", label: "Semi-detached" },
  { id: "rowHouse", label: "Townhouses" },
  { id: "duplex", label: "Duplexes" },
  { id: "lowRise", label: "Low-rise apartments" },
  { id: "highRise", label: "High-rise apartments" },
];

// Census facts describe each area; neither home "wins" them (no ticks).
const GROUPS: { title: string; icon: LucideIcon; ids: CensusFieldId[] }[] = [
  { title: "The area", icon: MapPinnedIcon, ids: ["population", "density"] },
  { title: "Tenure", icon: KeyRoundIcon, ids: ["owners", "renters"] },
  {
    title: "Households",
    icon: UsersIcon,
    ids: [
      "householdSize",
      "coupleWithChildren",
      "coupleNoChildren",
      "oneParent",
      "onePerson",
    ],
  },
  {
    title: "Age",
    icon: UserIcon,
    ids: ["medianAge", "age0to14", "age15to64", "age65plus"],
  },
  {
    title: "Income and education",
    icon: WalletIcon,
    ids: ["medianIncome", "bachelorPlus"],
  },
];

export function CompareNeighbourhood({
  a,
  b,
}: {
  a: CompareProperty;
  b: CompareProperty;
}) {
  const props = { a, b };
  const states = {
    a: sideState(a.report, JOB_KINDS.demographics, a.data.demographics != null),
    b: sideState(b.report, JOB_KINDS.demographics, b.data.demographics != null),
  };
  const value = (p: CompareProperty, id: CensusFieldId) =>
    p.data.demographics?.area.values[id] ?? null;
  const cell = (p: CompareProperty, id: CensusFieldId) =>
    value(p, id) != null ? { value: formatValue(id, value(p, id)) } : null;
  const max = Math.max(
    1,
    ...HOME_TYPES.flatMap((t) => SIDES.map((s) => value(props[s], t.id) ?? 0)),
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-12">
      {/* Housing mix: two bars per kind of home, A over B. */}
      <DashCard
        title="Housing mix"
        icon={BuildingIcon}
        className="lg:col-span-5"
      >
        <ul className="space-y-3.5">
          {HOME_TYPES.map((t) => (
            <li key={t.id} className="space-y-1.5">
              <p className="text-sm text-foreground/75">{t.label}</p>
              {SIDES.map((side) => {
                const p = props[side];
                const v = value(p, t.id);
                return (
                  <span key={side} className="flex items-center gap-2">
                    <SideChip side={side} className="size-4 text-[10px]" />
                    {states[side] === "pending" ? (
                      <Skeleton className="h-2 flex-1" />
                    ) : (
                      <span className="h-2 flex-1 bg-foreground/[0.06]">
                        <span
                          className="block h-full"
                          style={{
                            width: `${((v ?? 0) / max) * 100}%`,
                            backgroundColor: SIDE[side].color,
                          }}
                        />
                      </span>
                    )}
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-foreground/60">
                      {formatValue(t.id, v)}
                    </span>
                  </span>
                );
              })}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-foreground/50">
          Share of homes in each census area
          {a.data.demographics?.censusYear
            ? `, ${a.data.demographics.censusYear} census`
            : ""}
          .
        </p>
      </DashCard>

      <div className="space-y-4 lg:col-span-7">
        {GROUPS.map((g) => (
          <CompareTable
            key={g.title}
            title={g.title}
            icon={g.icon}
            a={a}
            b={b}
            states={states}
            rows={g.ids.map((id): CompareRow => ({
              id,
              label: field(id).label,
              a: cell(a, id),
              b: cell(b, id),
            }))}
          />
        ))}
        <p className="text-xs text-foreground/50">
          Census figures describe each area as a whole, not who a home suits, so
          neither property is marked better here.
        </p>
      </div>
    </div>
  );
}
