import {
  ExternalLinkIcon,
  GraduationCapIcon,
  InfoIcon,
  MapIcon,
  UsersIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useTravelMode } from "@/components/globals/travel-mode";
import {
  EQAO_FIELDS,
  type EqaoFieldId,
  SCHOOL_MAP_RADIUS_M,
  SCHOOL_SYSTEMS,
  type School,
  type SchoolsData,
  schoolMapLabels,
} from "@/lib/report-sections";
import { MapImage } from "./map-image";
import { formatDistance } from "./report-format";
import { ReportSubsection } from "./report-layout";

/** EQAO results grouped by grade, e.g. "Grade 3" → reading/writing/math. */
const RESULT_ROWS: {
  label: string;
  fields: { id: EqaoFieldId; short: string }[];
}[] = [
  {
    label: "Gr. 3",
    fields: [
      { id: "g3Reading", short: "Reading" },
      { id: "g3Writing", short: "Writing" },
      { id: "g3Math", short: "Math" },
    ],
  },
  {
    label: "Gr. 6",
    fields: [
      { id: "g6Reading", short: "Reading" },
      { id: "g6Writing", short: "Writing" },
      { id: "g6Math", short: "Math" },
    ],
  },
  {
    label: "Gr. 9–10",
    fields: [
      { id: "g9Math", short: "Math" },
      { id: "osslt", short: "Literacy" },
    ],
  },
];

function SchoolResults({ school }: { school: School }) {
  const rows = RESULT_ROWS.map((row) => ({
    ...row,
    fields: row.fields.filter((f) => school.results[f.id] != null),
  })).filter((row) => row.fields.length > 0);

  if (rows.length === 0) {
    return (
      <p className="mt-1.5 text-xs text-foreground/50">
        EQAO results not reported (small or new school).
      </p>
    );
  }
  return (
    <dl className="mt-1.5 grid grid-cols-[3.25rem_repeat(3,max-content)] gap-x-2.5 gap-y-0.5 text-xs">
      {rows.map((row) => (
        <div key={row.label} className="col-span-full grid grid-cols-subgrid">
          <dt className="text-foreground/55">{row.label}</dt>
          {row.fields.map((f) => (
            <dd key={f.id} className="tabular-nums">
              <span className="text-foreground/60">{f.short}</span>{" "}
              <span className="font-medium">{school.results[f.id]}%</span>
            </dd>
          ))}
        </div>
      ))}
    </dl>
  );
}

function SchoolRow({
  school,
  label,
  color,
}: {
  school: School;
  label?: string;
  color: string;
}) {
  const travel = useTravelMode();
  return (
    <li className="flex break-inside-avoid gap-3 py-3">
      <span
        className="mt-0.5 grid size-6 shrink-0 place-items-center text-xs font-semibold text-white"
        style={{ backgroundColor: label ? color : undefined }}
      >
        {label ?? (
          <span className="size-2.5" style={{ backgroundColor: color }} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{school.name}</span>
          {school.gradeRange && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[10px] text-foreground/70"
            >
              {school.gradeRange.replace("-", "–")}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-foreground/60">
          <span className="flex items-center gap-1 tabular-nums">
            <travel.icon aria-hidden className="size-3.5" />
            {travel.showsTime(school)
              ? `${travel.minutes(school)} · ${formatDistance(school.distanceMeters)}`
              : formatDistance(school.distanceMeters)}
          </span>
          {school.enrolment != null && (
            <span className="flex items-center gap-1 tabular-nums">
              <UsersIcon aria-hidden className="size-3.5" />
              {school.enrolment.toLocaleString("en-CA")} students
            </span>
          )}
          {school.board && <span>{school.board}</span>}
        </div>
        {!school.id.startsWith("g:") && <SchoolResults school={school} />}
      </div>
    </li>
  );
}

export function SchoolsSection({
  reportId,
  schools,
}: {
  reportId: string;
  schools: SchoolsData;
}) {
  const labels = schoolMapLabels(schools);
  const systems = schools.systems
    .map((s) => ({ ...s, meta: SCHOOL_SYSTEMS.find((x) => x.id === s.id)! }))
    .filter((s) => s.elementary.length + s.secondary.length > 0);
  const boards = [
    ...new Map(
      systems
        .flatMap((s) => [...s.elementary, ...s.secondary])
        .filter((s) => s.boardWebsite)
        .map((s) => [s.board, s.boardWebsite!]),
    ),
  ];
  const average = (id: EqaoFieldId) => schools.provincialAverage[id];
  const nearby = schools.coverage === "nearby";

  if (systems.length === 0) {
    return (
      <p className="text-sm text-foreground/60">
        No schools were found near this property.
      </p>
    );
  }

  return (
    <>
      {labels.size > 0 && (
        <ReportSubsection title="Schools on the map" icon={MapIcon}>
          <MapImage
            src={`/api/reports/${reportId}/maps/schools?v=${encodeURIComponent(schools.fetchedAt)}`}
            alt="Map of nearby schools, colour-coded by school system"
          />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/70">
            <li className="flex items-center gap-1.5">
              <span className="size-2.5 bg-[#111]" />
              The property
            </li>
            {systems.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <span
                  className="size-2.5"
                  style={{ backgroundColor: s.meta.color }}
                />
                {s.meta.label}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-foreground/55">
            Numbered schools are within {formatDistance(SCHOOL_MAP_RADIUS_M)}.
          </p>
        </ReportSubsection>
      )}

      <div className="space-y-4">
        {systems.map((system) => (
          <div
            key={system.id}
            className="break-inside-avoid p-4 ring-1 ring-border sm:p-5 print:border print:border-border print:ring-0"
          >
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <span
                className="grid size-7 place-items-center text-white"
                style={{ backgroundColor: system.meta.color }}
              >
                <GraduationCapIcon aria-hidden className="size-4" />
              </span>
              {system.meta.label}
            </h3>
            <div className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              {(["elementary", "secondary"] as const).map((level) =>
                system[level].length > 0 ? (
                  <div key={level} className="min-w-0">
                    <p className="text-xs font-semibold tracking-wide text-foreground/55 uppercase">
                      {level === "elementary" ? "Elementary" : "Secondary"}
                    </p>
                    <ol className="divide-y divide-foreground/10">
                      {system[level].map((school) => (
                        <SchoolRow
                          key={school.id}
                          school={school}
                          label={labels.get(school.id)}
                          color={system.meta.color}
                        />
                      ))}
                    </ol>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-foreground/55">
        {nearby ? (
          "Nearest schools from Google Maps: public, Catholic, French-language and private schools alike. Test results are shown for Ontario schools only for now."
        ) : (
          <>
            EQAO: share of students meeting the provincial standard,{" "}
            {schools.dataYear} school year. Ontario school averages:{" "}
            {EQAO_FIELDS.filter((f) => average(f.id) != null)
              .map(
                (f) =>
                  `${f.label.replace("Grade 10 literacy (OSSLT)", "Grade 10 literacy")} ${average(f.id)}%`,
              )
              .join(", ")}
            .
          </>
        )}
      </p>

      <Alert className="break-inside-avoid border-foreground/15 bg-muted/60">
        <InfoIcon />
        <AlertTitle>Nearest isn&apos;t always assigned</AlertTitle>
        <AlertDescription className="text-foreground/65">
          School boundaries don&apos;t follow distance, and some schools cap
          enrolment. Confirm which schools serve this address with{" "}
          {nearby ? "the local school district or board" : "each board\u2019s school locator"}{" "}
          before quoting them to buyers.
          {boards.length > 0 && (
            <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {boards.map(([board, url]) => (
                <a
                  key={board}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {board}
                  <ExternalLinkIcon
                    aria-hidden
                    className="size-3 print:hidden"
                  />
                </a>
              ))}
            </span>
          )}
        </AlertDescription>
      </Alert>
    </>
  );
}
