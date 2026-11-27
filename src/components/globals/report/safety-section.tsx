import {
  PlaneIcon,
  ShieldIcon,
  TrainTrackIcon,
  Volume2Icon,
  WavesIcon,
  WindIcon,
  type LucideIcon,
  CarIcon,
} from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CRIME_TYPES, type SafetyData } from "@/lib/report-sections";
import { formatDistance, formatShortDate } from "./report-format";
import { FieldRow, ReportSubsection } from "./report-layout";

type Crime = NonNullable<SafetyData["crime"]>;
export type AreaCrimeData = NonNullable<SafetyData["areaCrime"]>;

/** Fewer incidents than this are too few to compare meaningfully. */
export const MIN_COUNT_TO_COMPARE = 5;

/** Neutral comparison with the city rate (±15% counts as similar). */
export function compare(
  count: number,
  rate: number | null,
  cityRate: number | null,
) {
  if (count < MIN_COUNT_TO_COMPARE || rate == null || cityRate == null)
    return null;
  if (cityRate === 0) return "Higher";
  const ratio = rate / cityRate;
  return ratio < 0.85 ? "Lower" : ratio > 1.15 ? "Higher" : "Similar";
}

/** Tiny bar chart of yearly counts. */
export function Sparkline({
  values,
  label,
}: {
  values: (number | null)[];
  label: string;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  return (
    <span className="flex h-5 items-end gap-0.5" role="img" aria-label={label}>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5",
            i === values.length - 1 ? "bg-foreground/70" : "bg-foreground/25",
          )}
          style={{ height: `${Math.max(8, ((v ?? 0) / max) * 100)}%` }}
        />
      ))}
    </span>
  );
}

function CrimeTable({ crime }: { crime: Crime }) {
  return (
    <>
      <p className="mb-3 text-sm text-foreground/75">
        <span className="font-medium text-foreground">
          {crime.neighbourhood}
        </span>
        {crime.population != null &&
          ` · ${crime.population.toLocaleString("en-CA")} residents`}
        {crime.lowerRateThanShare != null && (
          <>
            {" "}
            · Lower overall rate than{" "}
            <span className="font-medium text-foreground">
              {Math.round(crime.lowerRateThanShare * 100)}%
            </span>{" "}
            of Toronto neighbourhoods
          </>
        )}
      </p>
      <div className="overflow-hidden ring-1 ring-border print:border print:border-border print:ring-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="pl-4">Reported in {crime.year}</TableHead>
              <TableHead className="text-right">Per 100k</TableHead>
              <TableHead className="text-right">Toronto</TableHead>
              <TableHead>vs city</TableHead>
              <TableHead className="pr-4">
                {crime.firstYear}–{String(crime.year).slice(2)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crime.types.map((t) => {
              const label = CRIME_TYPES.find((c) => c.id === t.id)!.label;
              const vs = compare(t.count, t.rate, t.cityRate);
              return (
                <TableRow key={t.id}>
                  <TableCell className="pl-4 font-medium whitespace-normal">
                    {label}
                    <span className="ml-1.5 text-xs font-normal text-foreground/50 tabular-nums">
                      ({t.count})
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.rate ?? "—"}
                  </TableCell>
                  <TableCell className="text-right text-foreground/60 tabular-nums">
                    {t.cityRate ?? "—"}
                  </TableCell>
                  <TableCell>
                    {!vs && (
                      <span className="text-xs text-foreground/45">
                        Too few
                      </span>
                    )}
                    {vs && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 px-2 text-[11px]",
                          vs === "Higher"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                            : "text-foreground/70",
                        )}
                      >
                        {vs}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    <Sparkline
                      values={t.trend}
                      label={`${label} per year: ${t.trend.map((v) => v ?? "n/a").join(", ")}`}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-foreground/55">
        {crime.source}, neighbourhood crime rates. Counts in brackets; rates per
        100,000 residents. Types with fewer than {MIN_COUNT_TO_COMPARE}{" "}
        incidents aren&apos;t compared. Neighbourhoods with shopping or
        nightlife can have high rates relative to the residents who live there.
      </p>
    </>
  );
}

export const FLOOD_BADGES: Record<
  SafetyData["flood"]["status"],
  { label: string; className: string }
> = {
  inside: {
    label: "Regulated area",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  },
  nearby: {
    label: "Near regulated area",
    className:
      "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300",
  },
  clear: { label: "Not regulated", className: "text-foreground/70" },
  unknown: { label: "Not checked", className: "text-foreground/60" },
};

function NoiseRow({
  label,
  icon,
  value,
  empty,
}: {
  label: string;
  icon: LucideIcon;
  value: React.ReactNode;
  empty: string;
}) {
  return (
    <FieldRow
      label={label}
      icon={icon}
      empty={<span className="text-foreground/55">{empty}</span>}
    >
      {value}
    </FieldRow>
  );
}

/** Neutral comparison of two index values (±15% counts as similar). */
export function compareIndex(value: number | null, reference: number | null) {
  if (value == null || reference == null || reference === 0) return null;
  const ratio = value / reference;
  return ratio < 0.85 ? "Lower" : ratio > 1.15 ? "Higher" : "Similar";
}

const POLICING_LABELS: Record<NonNullable<AreaCrimeData["policing"]>, string> = {
  opp: "Ontario Provincial Police",
  sq: "Sûreté du Québec",
  rcmp: "RCMP",
  municipal: "Police service",
};
const policingLabel = (a: AreaCrimeData) => (a.policing ? POLICING_LABELS[a.policing] : null);

/**
 * Crime Severity Index for the local police service (or the province
 * overall), against the province: overall, violent and non-violent, plus a
 * 6-year trend.
 */
export function AreaCrime({ area }: { area: AreaCrimeData }) {
  const rows = [
    { label: "Overall", value: area.csi, reference: area.province.csi },
    {
      label: "Violent",
      value: area.violentCsi,
      reference: area.province.violentCsi,
    },
    {
      label: "Non-violent",
      value: area.nonViolentCsi,
      reference: area.province.nonViolentCsi,
    },
  ];
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [r.value ?? 0, r.reference ?? 0]),
  );
  const region = area.province.name;
  const width = (v: number | null) =>
    `${Math.min(100, ((v ?? 0) / max) * 100)}%`;
  const province = area.level === "province";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/60">
        <span className="font-medium text-foreground">
          {province ? `${region} overall` : area.service}
        </span>
        {!province && policingLabel(area) && <span>{policingLabel(area)}</span>}
        {area.municipality && <span>Covers {area.municipality}</span>}
        {!province && (
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 bg-primary" /> This area
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 bg-foreground/30" /> {region}
        </span>
        <span>Crime Severity Index, {area.year}</span>
      </div>

      <ul className="divide-y">
        {rows.map((r) => {
          const vs = province ? null : compareIndex(r.value, r.reference);
          return (
            <li
              key={r.label}
              className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 py-2 break-inside-avoid"
            >
              <span className="text-sm font-medium">{r.label}</span>
              <span className="block space-y-1">
                {!province && (
                  <span className="flex items-center gap-2">
                    <span className="h-2 flex-1 bg-muted">
                      <span
                        className="block h-full bg-primary"
                        style={{ width: width(r.value) }}
                      />
                    </span>
                    <span className="w-10 text-right text-xs font-semibold tabular-nums">
                      {r.value?.toFixed(0) ?? "—"}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-2">
                  <span className="h-2 flex-1 bg-muted">
                    <span
                      className="block h-full bg-foreground/30"
                      style={{ width: width(r.reference) }}
                    />
                  </span>
                  <span className="w-10 text-right text-xs text-foreground/55 tabular-nums">
                    {r.reference?.toFixed(0) ?? "—"}
                  </span>
                </span>
              </span>
              <span>
                {vs && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      vs === "Higher"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
                        : "text-foreground/70",
                    )}
                  >
                    {vs}
                  </Badge>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 text-xs text-foreground/60">
        <Sparkline
          values={area.trend}
          label={`Crime Severity Index per year, ${area.firstYear}–${area.year}: ${area.trend.map((v) => v?.toFixed(0) ?? "n/a").join(", ")}`}
        />
        <span>
          Trend {area.firstYear}–{area.year}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-foreground/50">
        {province
          ? `Statistics Canada doesn't publish separate police figures for ${area.municipality ?? "this municipality"}, so this is ${region} overall. `
          : "Covers the whole police service area, not just this neighbourhood. "}
        The Crime Severity Index weighs police-reported crime by seriousness
        (100 = Canada in 2006). Canada: {area.canadaCsi?.toFixed(0) ?? "n/a"}.{" "}
        {area.source}.
      </p>
    </div>
  );
}

export function SafetySection({ safety }: { safety: SafetyData }) {
  const { flood, noise, airQuality } = safety;
  const flag = FLOOD_BADGES[flood.status];
  const notCovered = noise.outsideCoverage
    ? "Not checked yet. Regenerate this section to add it."
    : "Couldn't be checked. Regenerate this section to retry.";

  return (
    <>
      <ReportSubsection title="Crime" icon={ShieldIcon}>
        {safety.crime && <CrimeTable crime={safety.crime} />}
        {safety.areaCrime && (
          <div className={cn(safety.crime && "mt-6")}>
            {safety.crime && (
              <h4 className="mb-2 text-sm font-semibold">
                Across the police service area
              </h4>
            )}
            <AreaCrime area={safety.areaCrime} />
          </div>
        )}
        {!safety.crime && !safety.areaCrime && (
          <p className="text-sm text-foreground/60">{safety.crimeNote}</p>
        )}
      </ReportSubsection>

      <ReportSubsection title="Flood & erosion" icon={WavesIcon}>
        <dl>
          <FieldRow label="Conservation authority" empty="—">
            {flood.authority}
          </FieldRow>
          <FieldRow label="Status">
            <span className="flex flex-col gap-1.5">
              <Badge
                variant="outline"
                className={cn("h-5 w-fit px-2 text-[11px]", flag.className)}
              >
                {flag.label}
              </Badge>
              <span className="font-normal text-foreground/75">
                {flood.note}
              </span>
              {flood.criteria.length > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  {flood.criteria.map((c) => (
                    <Badge
                      key={c}
                      variant="secondary"
                      className="h-5 px-2 text-[11px] font-normal"
                    >
                      {c}
                    </Badge>
                  ))}
                </span>
              )}
            </span>
          </FieldRow>
        </dl>
      </ReportSubsection>

      <ReportSubsection title="Noise sources" icon={Volume2Icon}>
        <dl>
          <NoiseRow
            label="Highway"
            icon={CarIcon}
            value={
              noise.highway &&
              `${formatDistance(noise.highway.meters)} to the nearest highway`
            }
            empty={noise.roadsCovered ? "None within 500 m" : notCovered}
          />
          <NoiseRow
            label="Railway"
            icon={TrainTrackIcon}
            value={
              noise.railway &&
              `${formatDistance(noise.railway.meters)} to the nearest rail line`
            }
            empty={noise.roadsCovered ? "None within 500 m" : notCovered}
          />
          <NoiseRow
            label="Airport"
            icon={PlaneIcon}
            value={
              noise.airport &&
              `${noise.airport.name}, ${noise.airport.km} km away`
            }
            empty="No major airport close by"
          />
        </dl>
        <p className="mt-2 text-xs text-foreground/55">
          Straight-line distances. Visit at rush hour to judge noise for
          yourself; flight paths can matter more than distance.
        </p>
      </ReportSubsection>

      <ReportSubsection title="Air quality" icon={WindIcon}>
        {airQuality ? (
          <div className="flex items-center gap-4">
            <span
              className="grid size-14 shrink-0 place-items-center text-lg font-semibold text-white tabular-nums"
              style={{
                backgroundColor: airQuality.color ?? "var(--color-primary)",
              }}
            >
              {airQuality.aqi}
            </span>
            <div className="text-sm">
              <p className="font-medium">{airQuality.category}</p>
              <p className="text-xs text-foreground/60">
                Universal AQI (0–100, higher is cleaner)
                {airQuality.dominantPollutant &&
                  ` · Main pollutant: ${airQuality.dominantPollutant}`}
              </p>
              <p className="text-xs text-foreground/55">
                Snapshot on {formatShortDate(airQuality.observedAt)}; conditions
                change hourly.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/60">{safety.airQualityNote}</p>
        )}
      </ReportSubsection>
    </>
  );
}
