"use client";

import {
  BabyIcon,
  Building2Icon,
  CalendarClockIcon,
  ConstructionIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GraduationCapIcon,
  HardHatIcon,
  HospitalIcon,
  InfoIcon,
  LandmarkIcon,
  LayersIcon,
  type LucideIcon,
  TrainFrontIcon,
  TreesIcon,
} from "lucide-react";
import { cn } from "cn";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  APPLICATION_STAGES,
  APPLICATION_TYPES,
  DEVELOPMENT_RADIUS_M,
  PROJECT_CATEGORIES,
  type ProjectCategory,
  projectSources,
  type UpsideData,
} from "@/lib/report-sections";
import { MapsLink } from "./amenities-tab";
import {
  DashCard,
  ProximityMeter as ProximityBar,
  StatTile,
  TileGrid,
} from "./dash-card";
import { InteractiveMap, type MapPin } from "./interactive-map";
import { formatDistance, formatShortDate } from "./report-format";
import { WIDGET } from "./widget-styles";

/** A project category's label and colour (grey for unknown ones). Shared with comparisons. */
export const projectCategory = (id: string) =>
  PROJECT_CATEGORIES[id as ProjectCategory] ?? {
    label: id,
    color: "#525252",
    radius: 2000,
  };

/** Pin icon per project category. Shared with comparisons. */
export const PROJECT_ICONS: Record<string, LucideIcon> = {
  Transit: TrainFrontIcon,
  Education: GraduationCapIcon,
  "Health care": HospitalIcon,
  "Child care": BabyIcon,
  Recreation: TreesIcon,
  Communities: LandmarkIcon,
  "Roads and bridges": ConstructionIcon,
};

const budgetLabel = (budget: number) =>
  budget >= 1e9
    ? `$${(budget / 1e9).toFixed(1)}B`
    : budget >= 1e6
      ? `$${Math.round(budget / 1e6)}M`
      : `$${Math.round(budget / 1e3)}K`;

/** Square marker badge matching the map label. */
function Marker({ label, color }: { label?: string; color: string }) {
  return (
    <span
      className="grid size-7 shrink-0 place-items-center text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {label ?? ""}
    </span>
  );
}

export function UpsideTab({
  upside,
  home,
}: {
  upside: UpsideData;
  home: { lat: number; lng: number };
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const transit = upside.projects.find((p) => p.category === "Transit");
  const apps = upside.development?.applications ?? [];
  // Applications numbered, projects lettered; pins and rows share them.
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const labels = new Map<string, string>([
    ...apps.map((a, i) => [a.id, String(i + 1)] as const),
    ...upside.projects.map((p, i) => [p.id, LETTERS[i] ?? "•"] as const),
  ]);
  const pins: MapPin[] = [
    ...upside.projects.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      badge: labels.get(p.id)!,
      color: projectCategory(p.category).color,
      icon: PROJECT_ICONS[p.category] ?? ConstructionIcon,
      title: p.name,
      eyebrow: projectCategory(p.category).label,
      facts: [
        { icon: ConstructionIcon, label: p.status },
        {
          icon: CalendarClockIcon,
          label: p.targetCompletion ?? "Date to be determined",
        },
        { label: `${formatDistance(p.distanceMeters)} away` },
      ],
      href: p.website ?? undefined,
      linkLabel: "Project page",
    })),
    ...apps.map((a) => ({
      id: a.id,
      lat: a.lat,
      lng: a.lng,
      badge: labels.get(a.id)!,
      color: APPLICATION_STAGES[a.stage].color,
      icon: HardHatIcon,
      title: a.address,
      eyebrow: "Development application",
      facts: [
        { icon: FileTextIcon, label: APPLICATION_STAGES[a.stage].label },
        ...(a.storeys != null
          ? [{ icon: LayersIcon, label: `${a.storeys} storeys` }]
          : []),
        ...(a.units != null
          ? [
              {
                icon: Building2Icon,
                label: `${a.units.toLocaleString("en-CA")} units`,
              },
            ]
          : []),
        { label: `${formatDistance(a.distanceMeters)} away` },
      ],
      href: a.url ?? undefined,
      linkLabel: "City application file",
    })),
  ];
  /** Select a row (ignoring clicks on links inside it). */
  const selectRow = (id: string) => (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) return;
    setSelectedId(id);
    mapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const rowClass = (id: string) =>
    cn(
      "-mx-2 flex cursor-pointer gap-3 px-2 py-3 transition-colors",
      selectedId === id ? "bg-muted" : "hover:bg-muted/50",
    );
  const hasMap = upside.projects.length > 0 || apps.length > 0;

  return (
    <div className="space-y-4">
      <TileGrid className="md:grid-cols-4">
        <StatTile
          icon={TrainFrontIcon}
          label="Transit coming"
          value={transit ? formatDistance(transit.distanceMeters) : "—"}
          caption={transit?.name ?? "None within 3 km"}
          accent={transit ? PROJECT_CATEGORIES.Transit.color : undefined}
          visual={
            transit && (
              <ProximityBar
                meters={transit.distanceMeters}
                max={3000}
                color={PROJECT_CATEGORIES.Transit.color}
              />
            )
          }
        />
        <StatTile
          icon={ConstructionIcon}
          label="Public projects nearby"
          value={upside.projects.length}
          caption={`${upside.projects.filter((p) => p.status === "Under construction").length} under construction`}
        />
        <StatTile
          icon={HardHatIcon}
          label="Development applications"
          value={upside.development ? apps.length : "—"}
          caption={
            upside.development
              ? `Within ${formatDistance(DEVELOPMENT_RADIUS_M)}`
              : "Not published here"
          }
        />
        <StatTile
          icon={Building2Icon}
          label="Homes proposed"
          value={
            upside.development?.totalUnits
              ? upside.development.totalUnits.toLocaleString("en-CA")
              : "—"
          }
          caption={
            upside.development?.tallestStoreys
              ? `Tallest: ${upside.development.tallestStoreys} storeys`
              : "Where stated in applications"
          }
        />
      </TileGrid>

      <div className="grid gap-4 lg:grid-cols-12">
        {hasMap && (
          <div className="lg:col-span-5">
            <div className="space-y-4 lg:sticky lg:top-32">
              <div
                ref={mapRef}
                className={cn(WIDGET, "scroll-mt-32 overflow-hidden")}
              >
                <InteractiveMap
                  home={home}
                  pins={pins}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  className="h-[24rem] lg:h-[30rem]"
                />
                <p className="border-t px-4 py-2.5 text-xs text-foreground/55">
                  Numbers are development applications; letters are public
                  projects. Click a pin for details.
                </p>
              </div>
              <Alert className="border-foreground/15 bg-card">
                <InfoIcon />
                <AlertDescription className="text-foreground/65">
                  New transit and buildings can bring amenities and demand, and
                  also construction. Plans change: confirm status with the
                  municipality or project owner before quoting dates to buyers.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        <div
          className={
            hasMap ? "space-y-4 lg:col-span-7" : "space-y-4 lg:col-span-12"
          }
        >
          <DashCard
            title="Being built or planned"
            icon={ConstructionIcon}
            bodyClassName="py-1"
          >
            {upside.projects.length === 0 ? (
              <p className="py-3 text-sm text-foreground/60">
                {upside.projectsNote ??
                  "No provincial transit, school, hospital or community projects are planned or under construction close by."}
              </p>
            ) : (
              <ul className="divide-y">
                {upside.projects.map((p, i) => {
                  const c = projectCategory(p.category);
                  return (
                    <motion.li
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(i, 8) * 0.04,
                      }}
                      onClick={selectRow(p.id)}
                      className={rowClass(p.id)}
                    >
                      <Marker label={labels.get(p.id)} color={c.color} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/65">
                          <Badge
                            variant="outline"
                            style={{ borderColor: c.color, color: c.color }}
                          >
                            {c.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={
                              p.status === "Under construction"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
                                : "text-foreground/70"
                            }
                          >
                            {p.status}
                          </Badge>
                          <span className="tabular-nums">
                            {formatDistance(p.distanceMeters)} away
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarClockIcon
                              aria-hidden
                              className="size-3.5"
                            />
                            {p.targetCompletion ?? "Date to be determined"}
                          </span>
                          {p.budget != null && (
                            <span className="tabular-nums">
                              {budgetLabel(p.budget)}
                            </span>
                          )}
                          {p.website && (
                            <a
                              href={p.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 hover:text-primary"
                            >
                              Project page
                              <ExternalLinkIcon
                                aria-hidden
                                className="size-3"
                              />
                            </a>
                          )}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </DashCard>

          {upside.federal && (
            <DashCard
              title={`Federally funded in ${upside.federal.municipality}`}
              icon={LandmarkIcon}
              bodyClassName="py-1"
            >
              {upside.federal.projects.length === 0 ? (
                <p className="py-3 text-sm text-foreground/60">
                  No federally funded transit, road, school, health or
                  community projects of $5M or more are planned or underway in{" "}
                  {upside.federal.municipality}.
                </p>
              ) : (
                <>
                  <ul className="divide-y">
                    {upside.federal.projects.map((p) => {
                      const c = projectCategory(p.category);
                      return (
                        <li key={p.id} className="py-3">
                          <p className="text-sm font-semibold">{p.title}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/65">
                            <Badge
                              variant="outline"
                              style={{ borderColor: c.color, color: c.color }}
                            >
                              {c.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                p.status === "Under construction"
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-800"
                                  : "text-foreground/70"
                              }
                            >
                              {p.status}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <CalendarClockIcon
                                aria-hidden
                                className="size-3.5"
                              />
                              {p.targetCompletion ?? "Date to be determined"}
                            </span>
                            {p.totalCost != null && (
                              <span className="tabular-nums">
                                {budgetLabel(p.totalCost)} total
                              </span>
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="pb-3 text-xs text-foreground/50">
                    Somewhere in {upside.federal.municipality}: Infrastructure
                    Canada lists each project&apos;s municipality, not its
                    exact site.
                  </p>
                </>
              )}
            </DashCard>
          )}

          <DashCard
            title={`Development applications · ${formatDistance(DEVELOPMENT_RADIUS_M)}`}
            icon={HardHatIcon}
            bodyClassName="py-1"
          >
            {!upside.development ? (
              <p className="py-3 text-sm text-foreground/60">
                {upside.developmentNote}
              </p>
            ) : apps.length === 0 ? (
              <p className="py-3 text-sm text-foreground/60">
                No open development applications within{" "}
                {formatDistance(DEVELOPMENT_RADIUS_M)}.
              </p>
            ) : (
              <ul className="divide-y">
                {apps.map((a, i) => {
                  const stage = APPLICATION_STAGES[a.stage];
                  return (
                    <motion.li
                      key={a.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{
                        duration: 0.25,
                        delay: Math.min(i, 8) * 0.04,
                      }}
                      onClick={selectRow(a.id)}
                      className={rowClass(a.id)}
                    >
                      <Marker label={labels.get(a.id)} color={stage.color} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <MapsLink
                            name={a.address}
                            address={`${a.address}, ${upside.development?.municipality ?? "Toronto"}`}
                            lat={a.lat}
                            lng={a.lng}
                          />
                          <Badge
                            variant="outline"
                            style={{
                              borderColor: stage.color,
                              color: stage.color,
                            }}
                          >
                            {stage.label}
                          </Badge>
                        </div>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/60">
                          <span className="flex items-center gap-1">
                            <FileTextIcon aria-hidden className="size-3.5" />
                            {APPLICATION_TYPES[
                              a.type as keyof typeof APPLICATION_TYPES
                            ] ?? a.type}
                          </span>
                          {a.storeys != null && (
                            <span className="flex items-center gap-1 tabular-nums">
                              <LayersIcon aria-hidden className="size-3.5" />
                              {a.storeys} storeys
                            </span>
                          )}
                          {a.units != null && (
                            <span className="flex items-center gap-1 tabular-nums">
                              <Building2Icon aria-hidden className="size-3.5" />
                              {a.units.toLocaleString("en-CA")} units
                            </span>
                          )}
                          <span className="tabular-nums">
                            {formatDistance(a.distanceMeters)} away
                          </span>
                          {a.submittedAt && (
                            <span>Filed {formatShortDate(a.submittedAt)}</span>
                          )}
                        </p>
                        {a.description && (
                          <p
                            className="line-clamp-2 text-xs text-foreground/70"
                            title={a.description}
                          >
                            {a.description}
                          </p>
                        )}
                        {a.url && (
                          <a
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-foreground/65 hover:text-primary"
                          >
                            City file {a.id}
                            <ExternalLinkIcon aria-hidden className="size-3" />
                          </a>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </DashCard>

          <p className="text-xs leading-relaxed text-foreground/50">
            Sources:{" "}
            {[
              ...(upside.projects.length
                ? projectSources(upside).map((s) => `${s} (projects)`)
                : []),
              upside.federal?.projects.length &&
                "Infrastructure Canada (federally funded projects)",
              upside.development &&
                `${upside.development.source} (development applications)`,
            ]
              .filter(Boolean)
              .join(", ") || "Public open data"}
            . Unit and storey counts are read from application data or
            descriptions where stated.
          </p>
        </div>
      </div>
    </div>
  );
}
