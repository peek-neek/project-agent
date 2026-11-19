"use client";

import {
  BuildingIcon,
  GraduationCapIcon,
  HomeIcon,
  KeyRoundIcon,
  LayersIcon,
  type LucideIcon,
  MapPinnedIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import {
  type CensusFieldId,
  type DemographicsData,
} from "@/lib/report-sections";
import { CompareMeter, DashCard, StatTile, TileGrid } from "./dash-card";
import { CompareBar, field, formatValue } from "./demographics-section";
import { dominantHomeType, versus } from "./report-insights";

const GROUPS: { title: string; icon: LucideIcon; ids: CensusFieldId[] }[] = [
  { title: "Age", icon: UserIcon, ids: ["age0to14", "age15to64", "age65plus"] },
  {
    title: "Households",
    icon: UsersIcon,
    ids: ["coupleWithChildren", "coupleNoChildren", "oneParent", "onePerson"],
  },
  {
    title: "Homes",
    icon: BuildingIcon,
    ids: [
      "singleDetached",
      "semiDetached",
      "rowHouse",
      "duplex",
      "lowRise",
      "highRise",
    ],
  },
];

/** Plain-language facts about the area: housing and economics only. */
function glanceNotes(data: DemographicsData) {
  const a = data.area.values;
  const c = data.city?.values;
  const city = data.city?.label ?? "the city";
  const notes: { icon: LucideIcon; text: string }[] = [];

  if (a.owners != null && a.renters != null) {
    notes.push({
      icon: KeyRoundIcon,
      text:
        a.owners >= 60
          ? `Mostly owner-occupied (${Math.round(a.owners)}% own)`
          : a.renters >= 60
            ? `Mostly rented (${Math.round(a.renters)}% rent)`
            : `A mix of owners (${Math.round(a.owners)}%) and renters`,
    });
  }
  const home = dominantHomeType(data);
  if (home) {
    notes.push({
      icon: HomeIcon,
      text: `Most common home: ${home.label.toLowerCase()} (${Math.round(home.share)}%)`,
    });
  }
  const income = versus(a.medianIncome, c?.medianIncome);
  if (income != null && Math.abs(income) >= 0.1) {
    notes.push({
      icon: WalletIcon,
      text: `Median household income ${Math.round(Math.abs(income) * 100)}% ${income > 0 ? "above" : "below"} ${city}`,
    });
  }
  const density = versus(a.density, c?.density);
  if (density != null && Math.abs(density) >= 0.25) {
    notes.push({
      icon: LayersIcon,
      text:
        density > 0
          ? `Denser than ${city} on average`
          : `Less dense than ${city} on average`,
    });
  }
  return notes;
}

export function NeighbourhoodTab({ data }: { data: DemographicsData }) {
  const area = data.area.values;
  const city = data.city?.values;
  const cityLabel = data.city?.label ?? null;
  const tile = (id: CensusFieldId, color: string) => ({
    value: formatValue(id, area[id]),
    caption: cityLabel
      ? `${cityLabel}: ${formatValue(id, city?.[id])}`
      : undefined,
    delta: versus(area[id], city?.[id]),
    accent: color,
    visual: city ? (
      <CompareMeter
        area={area[id]}
        city={city[id]}
        color={color}
        labels={["Here", cityLabel ?? "City"]}
      />
    ) : undefined,
  });
  const notes = glanceNotes(data);

  return (
    <div className="space-y-4">
      <TileGrid className="md:grid-cols-3">
        <StatTile
          icon={WalletIcon}
          label="Household income"
          {...tile("medianIncome", "#0f766e")}
        />
        <StatTile
          icon={UserIcon}
          label="Median age"
          {...tile("medianAge", "#7c3aed")}
        />
        <StatTile
          icon={KeyRoundIcon}
          label="Owners"
          {...tile("owners", "#2563eb")}
        />
        <StatTile
          icon={UsersIcon}
          label="Household size"
          {...tile("householdSize", "#db2777")}
        />
        <StatTile
          icon={GraduationCapIcon}
          label="University degree"
          {...tile("bachelorPlus", "#4f46e5")}
        />
        <StatTile
          icon={LayersIcon}
          label="People per km²"
          {...tile("density", "#ea580c")}
        />
      </TileGrid>

      <div className="grid gap-4 lg:grid-cols-12">
        <DashCard
          title="At a glance"
          icon={MapPinnedIcon}
          className="lg:col-span-4"
        >
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.text} className="flex items-start gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center bg-muted text-foreground/60">
                  <n.icon aria-hidden className="size-4" />
                </span>
                <span className="pt-1.5">{n.text}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-foreground/50">
            {data.area.label} · {formatValue("population", area.population)}{" "}
            people
          </p>
        </DashCard>

        <DashCard title="Tenure" icon={KeyRoundIcon} className="lg:col-span-8">
          {(
            [
              { label: "This area", values: area },
              ...(city && cityLabel
                ? [{ label: cityLabel, values: city }]
                : []),
            ] as const
          ).map((row) => (
            <div key={row.label} className="mb-4 last:mb-0">
              <div className="mb-1.5 flex justify-between text-xs text-foreground/60">
                <span className="font-medium text-foreground/80">
                  {row.label}
                </span>
                <span className="tabular-nums">
                  {formatValue("owners", row.values.owners)} own ·{" "}
                  {formatValue("renters", row.values.renters)} rent
                </span>
              </div>
              <div className="flex h-4 bg-muted" aria-hidden>
                <span
                  className="block h-full bg-primary"
                  style={{ width: `${row.values.owners ?? 0}%` }}
                />
                <span
                  className="block h-full bg-foreground/25"
                  style={{ width: `${row.values.renters ?? 0}%` }}
                />
              </div>
            </div>
          ))}
          <p className="mt-3 flex gap-4 text-xs text-foreground/55">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 bg-primary" /> Owners
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 bg-foreground/25" /> Renters
            </span>
          </p>
        </DashCard>

        {GROUPS.map((group) => (
          <DashCard
            key={group.title}
            title={group.title}
            icon={group.icon}
            className="lg:col-span-4"
          >
            {group.ids.map((id) => (
              <CompareBar
                key={id}
                label={field(id).label}
                area={area[id]}
                city={city?.[id]}
                cityLabel={cityLabel}
              />
            ))}
          </DashCard>
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/50">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-primary" /> This area
        </span>
        {cityLabel && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 bg-foreground/30" /> {cityLabel}
          </span>
        )}
        <span>
          Statistics Canada, {data.censusYear} Census. These figures describe
          current residents; use them to understand the area, not to decide who
          a home suits.
        </span>
      </p>
    </div>
  );
}
