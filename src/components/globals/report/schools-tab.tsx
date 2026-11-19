"use client";

import { useTravelMode } from "@/components/globals/travel-mode";
import {
  ExternalLinkIcon,
  RouteIcon,
  GlobeIcon,
  GraduationCapIcon,
  InfoIcon,
  LayoutGridIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type EqaoFieldId,
  SCHOOL_SYSTEMS,
  type SchoolSystemId,
  type SchoolsData,
} from "@/lib/report-sections";
import { MapsLink, Thumb } from "./amenities-tab";
import { InteractiveMap, type MapPin } from "./interactive-map";
import { formatDistance, googleMapsUrl } from "./report-format";
import { allSchools, type NearbySchool } from "./report-insights";
import { WIDGET, WIDGET_SELECTED } from "./widget-styles";

type Filter = SchoolSystemId | "all";

const SHORT: Record<EqaoFieldId, string> = {
  g3Reading: "Reading",
  g3Writing: "Writing",
  g3Math: "Math",
  g6Reading: "Reading",
  g6Writing: "Writing",
  g6Math: "Math",
  g9Math: "Gr 9 math",
  osslt: "Literacy",
};

/** EQAO grouped by grade, each value with its gap to the Ontario average. */
function Eqao({
  school,
  average,
}: {
  school: NearbySchool;
  average: SchoolsData["provincialAverage"];
}) {
  const groups = [
    { label: "Grade 3", ids: ["g3Reading", "g3Writing", "g3Math"] as const },
    { label: "Grade 6", ids: ["g6Reading", "g6Writing", "g6Math"] as const },
    { label: "Secondary", ids: ["g9Math", "osslt"] as const },
  ]
    .map((g) => ({
      ...g,
      ids: g.ids.filter((id) => school.results[id] != null),
    }))
    .filter((g) => g.ids.length > 0);

  if (groups.length === 0) {
    return (
      <p className="text-xs text-foreground/45">EQAO results not reported.</p>
    );
  }
  return (
    <dl className="space-y-1">
      {groups.map((g) => (
        <div
          key={g.label}
          className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs"
        >
          <dt className="w-16 shrink-0 text-foreground/50">{g.label}</dt>
          {g.ids.map((id) => {
            const value = school.results[id]!;
            const avg = average[id];
            const gap = avg != null ? value - avg : null;
            return (
              <dd
                key={id}
                className="tabular-nums"
                title={avg != null ? `Ontario average ${avg}%` : undefined}
              >
                <span className="text-foreground/60">{SHORT[id]}</span>{" "}
                <span className="font-semibold">{value}%</span>
                {gap != null && Math.abs(gap) >= 3 && (
                  <span className="ml-0.5 text-[10px] text-foreground/50">
                    {gap > 0 ? "↑" : "↓"}
                    {Math.abs(gap)}
                  </span>
                )}
              </dd>
            );
          })}
        </div>
      ))}
    </dl>
  );
}

function SchoolCard({
  reportId,
  school,
  label,
  index,
  average,
  selected,
  onSelect,
}: {
  reportId: string;
  school: NearbySchool;
  label?: string;
  index: number;
  average: SchoolsData["provincialAverage"];
  selected: boolean;
  onSelect: () => void;
}) {
  const travel = useTravelMode();
  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, delay: Math.min(index, 8) * 0.04 }}
      onClick={onSelect}
      className={cn(
        WIDGET,
        "flex cursor-pointer gap-3 p-2.5 transition-shadow",
        selected && WIDGET_SELECTED,
      )}
    >
      <Thumb
        src={`/api/reports/${reportId}/school-photo/${school.id}`}
        label={label}
        color={school.color}
        icon={GraduationCapIcon}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold" title={school.name}>
              {school.name}
            </p>
            {school.gradeRange && (
              <Badge
                variant="outline"
                className="h-4 shrink-0 px-1.5 text-[10px]"
              >
                {school.gradeRange.replace("-", "–")}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground/65">
            <span className="flex items-center gap-1 tabular-nums">
              <travel.icon aria-hidden className="size-3.5" />
              {travel.showsTime(school)
                ? `${travel.minutes(school)} · ${formatDistance(school.distanceMeters)}`
                : formatDistance(school.distanceMeters)}
            </span>
            {school.enrolment != null && (
              <span className="flex items-center gap-1 tabular-nums">
                <UsersIcon aria-hidden className="size-3.5" />
                {school.enrolment.toLocaleString("en-CA")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2"
                style={{ backgroundColor: school.color }}
              />
              {school.board}
            </span>
          </p>
        </div>
        <Eqao school={school} average={average} />
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          <MapsLink
            name={school.name}
            address={school.address}
            lat={school.lat}
            lng={school.lng}
          />
          {school.website && (
            <a
              href={school.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-foreground/65 hover:text-primary"
            >
              <GlobeIcon aria-hidden className="size-3.5" />
              Website
              <ExternalLinkIcon aria-hidden className="size-3" />
            </a>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export function SchoolsTab({
  reportId,
  schools,
  home,
}: {
  reportId: string;
  schools: SchoolsData;
  home: { lat: number; lng: number };
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const travel = useTravelMode();
  const everything = allSchools(schools);
  // Every school numbered nearest-first; pins and cards share the numbers.
  const labels = new Map(everything.map((s, i) => [s.id, String(i + 1)]));
  const shown = everything.filter(
    (s) =>
      filter === "all" ||
      SCHOOL_SYSTEMS.find((x) => x.label === s.systemLabel)?.id === filter,
  );
  const pins: MapPin[] = shown.map((s) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    badge: labels.get(s.id)!,
    color: s.color,
    icon: GraduationCapIcon,
    title: s.name,
    eyebrow: s.systemLabel,
    facts: [
      ...(s.gradeRange
        ? [{ label: `Grades ${s.gradeRange.replace("-", "–")}` }]
        : []),
      travel.showsTime(s)
        ? { icon: travel.icon, label: `${travel.minutes(s)} ${travel.verb}` }
        : { icon: RouteIcon, label: formatDistance(s.distanceMeters) },
    ],
    address: s.address,
    photo: `/api/reports/${reportId}/school-photo/${s.id}`,
    href: googleMapsUrl({
      name: s.name,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
    }),
  }));
  const byLevel = (["Elementary", "Secondary"] as const).map((level) => ({
    level,
    schools: shown.filter((s) => s.level === level),
  }));
  const boards = [
    ...new Map(
      everything
        .filter((s) => s.boardWebsite)
        .map((s) => [s.board, s.boardWebsite!]),
    ),
  ];
  const average = schools.provincialAverage;
  // Stagger order across both levels, computed up front (no render mutation).
  const order = new Map(
    byLevel.flatMap((g) => g.schools).map((s, i) => [s.id, i]),
  );

  return (
    <div className="space-y-4">
      <ToggleGroup
        aria-label="School system"
        value={[filter]}
        onValueChange={(value) => {
          const next = value[0] as Filter | undefined;
          if (next) {
            setFilter(next);
            setSelectedId(null);
          }
        }}
        spacing={1}
        className="flex w-full flex-wrap justify-start"
      >
        <ToggleGroupItem
          value="all"
          className="h-auto gap-2 border bg-card px-3 py-2 data-pressed:border-foreground data-pressed:bg-card"
        >
          <LayoutGridIcon aria-hidden />
          All
          <span className="text-xs text-foreground/50 tabular-nums">
            {everything.length}
          </span>
        </ToggleGroupItem>
        {SCHOOL_SYSTEMS.map((system) => {
          const count = everything.filter(
            (s) => s.systemLabel === system.label,
          ).length;
          return (
            <ToggleGroupItem
              key={system.id}
              value={system.id}
              disabled={count === 0}
              className="h-auto gap-2 border bg-card px-3 py-2 data-pressed:border-foreground data-pressed:bg-card"
            >
              <span
                aria-hidden
                className="size-2.5"
                style={{ backgroundColor: system.color }}
              />
              {system.label}
              <span className="text-xs text-foreground/50 tabular-nums">
                {count}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>

      <div className="grid gap-4 lg:grid-cols-12">
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
                Numbers match the cards, nearest first. Click a pin for details.
              </p>
            </div>
            <Alert className="border-foreground/15 bg-card">
              <InfoIcon />
              <AlertTitle>Nearest isn&apos;t always assigned</AlertTitle>
              <AlertDescription className="text-foreground/65">
                Confirm catchment with each board&apos;s school locator.
                {boards.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {boards.map(([board, url]) => (
                      <a
                        key={board}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-foreground hover:text-primary"
                      >
                        {board}
                        <ExternalLinkIcon aria-hidden className="size-3" />
                      </a>
                    ))}
                  </span>
                )}
              </AlertDescription>
            </Alert>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-7">
          {byLevel.map(
            ({ level, schools: list }) =>
              list.length > 0 && (
                <section key={`${filter}-${level}`}>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-foreground/55 uppercase">
                    {level}
                    <span className="font-normal tabular-nums">
                      {list.length}
                    </span>
                  </h3>
                  <ol className="space-y-2">
                    {list.map((school) => (
                      <SchoolCard
                        key={school.id}
                        reportId={reportId}
                        school={school}
                        label={labels.get(school.id)}
                        index={order.get(school.id) ?? 0}
                        average={average}
                        selected={selectedId === school.id}
                        onSelect={() => {
                          setSelectedId(school.id);
                          mapRef.current?.scrollIntoView({
                            behavior: "smooth",
                            block: "nearest",
                          });
                        }}
                      />
                    ))}
                  </ol>
                </section>
              ),
          )}
          <p className="text-xs leading-relaxed text-foreground/50">
            EQAO: share of students meeting the provincial standard,{" "}
            {schools.dataYear}. ↑/↓ shows points above or below the Ontario
            school average (hover a value to see it). Results aren&apos;t
            reported for small or new schools.
          </p>
        </div>
      </div>
    </div>
  );
}
