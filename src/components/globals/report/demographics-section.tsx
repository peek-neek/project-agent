import { BuildingIcon, HomeIcon, UsersIcon } from "lucide-react";
import {
  CENSUS_FIELDS,
  type CensusFieldId,
  type DemographicsData,
} from "@/lib/report-sections";
import { formatPrice } from "./report-format";
import { ReportSubsection } from "./report-layout";

export const field = (id: CensusFieldId) =>
  CENSUS_FIELDS.find((f) => f.id === id)!;

export function formatValue(
  id: CensusFieldId,
  value: number | null | undefined,
) {
  if (value == null) return "—";
  switch (field(id).format) {
    case "percent":
      return `${Math.round(value)}%`;
    case "currency":
      return formatPrice(value);
    case "decimal":
      return value.toFixed(1);
    default:
      return Math.round(value).toLocaleString("en-CA");
  }
}

const HEADLINE: CensusFieldId[] = [
  "medianIncome",
  "medianAge",
  "owners",
  "householdSize",
  "bachelorPlus",
  "density",
];

const GROUPS: {
  title: string;
  icon: typeof UsersIcon;
  ids: CensusFieldId[];
}[] = [
  {
    title: "Age",
    icon: UsersIcon,
    ids: ["age0to14", "age15to64", "age65plus"],
  },
  {
    title: "Households",
    icon: HomeIcon,
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

/** Two horizontal bars: this area vs the city. */
export function CompareBar({
  label,
  area,
  city,
  cityLabel,
}: {
  label: string;
  area: number | null | undefined;
  city: number | null | undefined;
  cityLabel: string | null;
}) {
  const bar = (value: number | null | undefined, className: string) => (
    <span className="h-2 flex-1 overflow-hidden bg-muted">
      <span
        className={`block h-full ${className}`}
        style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
      />
    </span>
  );
  return (
    <div className="grid break-inside-avoid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-x-4 gap-y-1 py-1.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <span className="text-sm text-foreground/75">{label}</span>
      <span className="space-y-1">
        <span className="flex items-center gap-2">
          {bar(area, "bg-primary")}
          <span className="w-10 text-right text-xs font-semibold tabular-nums">
            {area == null ? "—" : `${Math.round(area)}%`}
          </span>
        </span>
        {cityLabel && (
          <span className="flex items-center gap-2">
            {bar(city, "bg-foreground/30")}
            <span className="w-10 text-right text-xs text-foreground/55 tabular-nums">
              {city == null ? "—" : `${Math.round(city)}%`}
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

export function DemographicsSection({ data }: { data: DemographicsData }) {
  const area = data.area.values;
  const city = data.city?.values;
  const cityLabel = data.city?.label ?? null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3">
        {HEADLINE.map((id) => (
          <div
            key={id}
            className="break-inside-avoid bg-muted/50 p-4 print:border print:border-border print:bg-transparent"
          >
            <p className="text-xs text-foreground/60">{field(id).label}</p>
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {formatValue(id, area[id])}
            </p>
            {cityLabel && (
              <p className="mt-0.5 text-xs text-foreground/55 tabular-nums">
                {cityLabel}: {formatValue(id, city?.[id])}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/65">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-primary" />
          This area ({data.area.label},{" "}
          {formatValue("population", area.population)} people)
        </span>
        {cityLabel && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 bg-foreground/30" />
            {cityLabel}
          </span>
        )}
      </div>

      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2 print:grid-cols-2">
        {GROUPS.map((group) => (
          <ReportSubsection
            key={group.title}
            title={group.title}
            icon={group.icon}
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
          </ReportSubsection>
        ))}
        <ReportSubsection title="Tenure" icon={HomeIcon}>
          {(["owners", "renters"] as const).map((id) => (
            <CompareBar
              key={id}
              label={field(id).label}
              area={area[id]}
              city={city?.[id]}
              cityLabel={cityLabel}
            />
          ))}
        </ReportSubsection>
      </div>

      <p className="text-xs leading-relaxed text-foreground/55">
        Statistics Canada, {data.censusYear} Census of Population. Household
        income is the {data.censusYear - 1} median before tax. These figures
        describe current residents; use them to understand the area, not to
        decide who a home suits.
      </p>
    </>
  );
}
