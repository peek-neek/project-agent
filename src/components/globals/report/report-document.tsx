"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { DownloadPdfButton } from "./download-pdf-button";
import {
  GraduationCapIcon,
  HouseIcon,
  LoaderCircleIcon,
  MegaphoneIcon,
  PresentationIcon,
  RefreshCwIcon,
  RouteIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import { notFound } from "next/navigation";
import { useState } from "react";
import { site } from "@/components/globals/homepage/content";
import { Logo } from "@/components/globals/homepage/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AI_PROVIDER_LABELS,
  aiMetaSchema,
  amenitiesSchema,
  commuteSchema,
  demographicsSchema,
  insightsSchema,
  JOB_KINDS,
  type JobKind,
  marketingSchema,
  SECTION_KEYS,
  safetySchema,
  schoolsSchema,
} from "@/lib/report-sections";
import { useTRPC } from "@/trpc/client";
import { AmenitiesSection } from "./amenities-section";
import { CommuteSection } from "./commute-section";
import { DemographicsSection } from "./demographics-section";
import { MarketingSection } from "./marketing-section";
import { PlaybookSection } from "./playbook-section";
import { PropertySection } from "./property-section";
import {
  formatDate,
  formatShortDate,
  type ReportData,
  shortId,
} from "./report-format";
import { useTravelMode } from "@/components/globals/travel-mode";
import {
  getCopySection,
  getJob,
  getSection,
  isJobActive,
  useRerunJob,
} from "./report-hooks";
import { ReportDashboard } from "./report-dashboard";
import { ReportSection } from "./report-layout";
import { SafetySection } from "./safety-section";
import { SchoolsSection } from "./schools-section";
import { SectionGate, type SectionLabels } from "./section-gate";
import { SectionFailed } from "./section-state";
import { StorySection } from "./story-section";

const modeLabels = {
  single: "Single property",
  compare: "Comparison",
  bulk: "Bulk",
} as const;

export function ReportDocument({ reportId }: { reportId: string }) {
  const trpc = useTRPC();
  // Suspends until the server prefetch arrives; errors go to QueryBoundary.
  // Polls while any step is still running.
  const { data: report } = useSuspenseQuery(
    trpc.report.byId.queryOptions(
      { id: reportId },
      {
        refetchInterval: (query) =>
          query.state.data?.jobs.some((j) => isJobActive(j)) ? 2500 : false,
      },
    ),
  );
  if (!report) notFound();
  return (
    <>
      {/* Screen: the dashboard. Print/PDF: the long-form report. */}
      <div className="print:hidden">
        <ReportDashboard report={report} />
      </div>
      <div className="hidden print:block">
        <ReportView report={report} />
      </div>
    </>
  );
}

/** Presentational report, also used for print/PDF rendering. */
export function ReportView({ report }: { report: ReportData }) {
  const travel = useTravelMode();
  const [detailsChanged, setDetailsChanged] = useState(false);
  const rerun = useRerunJob(report.id);

  const jobs = Object.values(JOB_KINDS).map((kind) => getJob(report, kind));
  const done = jobs.filter((j) => j?.status === "completed").length;
  const working = jobs.some((j) => isJobActive(j));
  const identityJob = getJob(report, JOB_KINDS.identity);
  const aiJob = getJob(report, JOB_KINDS.ai);

  const amenities = getSection(report, SECTION_KEYS.amenities, amenitiesSchema);
  const commute = getSection(report, SECTION_KEYS.commute, commuteSchema);
  const schools = getSection(report, SECTION_KEYS.schools, schoolsSchema);
  const demographics = getSection(
    report,
    SECTION_KEYS.demographics,
    demographicsSchema,
  );
  const safety = getSection(report, SECTION_KEYS.safety, safetySchema);
  // The printed copy matches the travel mode on screen.
  const insights = getCopySection(
    report,
    SECTION_KEYS.insights,
    insightsSchema,
    travel.mode,
  );
  const marketing = getCopySection(
    report,
    SECTION_KEYS.marketing,
    marketingSchema,
    travel.mode,
  );
  const aiModels = [
    ...new Set(
      [SECTION_KEYS.insights, SECTION_KEYS.marketing].flatMap((key) => {
        const meta = getCopySection(report, key, aiMetaSchema, travel.mode);
        return meta
          ? [
              `${AI_PROVIDER_LABELS[meta.generatedBy.provider]} ${meta.generatedBy.model}`,
            ]
          : [];
      }),
    ),
  ];

  /** Pending / failed / empty states shared by the generated sections. */
  function sectionBody<T>(
    kind: JobKind,
    data: T | null,
    labels: SectionLabels,
    render: (data: T) => React.ReactNode,
  ) {
    return (
      <SectionGate report={report} kind={kind} data={data} labels={labels}>
        {render}
      </SectionGate>
    );
  }

  const regenerate = (
    <Button
      variant={detailsChanged ? "default" : "outline"}
      size="sm"
      disabled={isJobActive(aiJob) || rerun.isPending}
      onClick={() => {
        setDetailsChanged(false);
        rerun.mutate({ id: report.id, kind: JOB_KINDS.ai });
      }}
    >
      <RefreshCwIcon data-icon="inline-start" />
      {detailsChanged ? "Regenerate with new details" : "Regenerate"}
    </Button>
  );

  const aiLabels = (what: string) => ({
    pending: `Writing the ${what}…`,
    failed: `We couldn't write the ${what}`,
    empty: `The ${what} will appear once the location data is ready.`,
  });

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-end gap-3 print:hidden">
        <div className="flex items-center gap-3">
          {working && (
            <span
              className="flex items-center gap-2 text-sm text-foreground/65"
              aria-live="polite"
            >
              <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
              Preparing report · {done} of {jobs.length} steps
            </span>
          )}
          <DownloadPdfButton
            reportId={report.id}
            disabled={working}
            label="Download PDF"
            className="h-9 w-36 px-4"
          />
        </div>
      </div>

      <article className="mx-auto max-w-[8.5in] bg-card px-6 py-8 shadow-sm ring-1 ring-border sm:px-12 sm:py-12 print:max-w-none print:p-0 print:shadow-none print:ring-0">
        <header className="break-inside-avoid print:break-after-page">
          <div className="flex items-center justify-between gap-4">
            <Logo />
            <Badge
              variant="outline"
              className="h-auto px-3 py-1 text-foreground/70"
            >
              {modeLabels[report.mode]} report
            </Badge>
          </div>
          <p className="mt-10 text-sm font-medium text-primary print:mt-8">
            Property report
          </p>
          <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl print:text-3xl">
            {report.property?.formattedAddress ?? report.inputAddress}
          </h1>
          {insights && (
            <p className="mt-3 text-base text-foreground/75 text-pretty">
              {insights.headline}
            </p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-foreground/55">Report date</dt>
              <dd className="mt-0.5 font-medium">
                {formatDate(report.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="text-foreground/55">Report ID</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {shortId(report.id)}
              </dd>
            </div>
            <div>
              <dt className="text-foreground/55">Prepared with</dt>
              <dd className="mt-0.5 font-medium">{site.name}</dd>
            </div>
          </dl>
        </header>

        <Separator className="my-10 print:hidden" />

        <ReportSection
          number={1}
          title="Property at a glance"
          icon={HouseIcon}
          description="The basics, plus a few details from you that make the marketing copy specific."
        >
          {identityJob?.status === "failed" && !report.property ? (
            <SectionFailed
              reportId={report.id}
              kind={JOB_KINDS.identity}
              job={identityJob}
              title="We couldn't look up this address"
            />
          ) : (
            <PropertySection
              report={report}
              loading={isJobActive(identityJob)}
              onDetailsSaved={() => setDetailsChanged(true)}
            />
          )}
        </ReportSection>

        <ReportSection
          number={2}
          title="Neighbourhood story"
          icon={SparklesIcon}
          description="How to describe the location, what stands out, and what buyers may ask about."
          action={insights ? regenerate : undefined}
        >
          {sectionBody(
            JOB_KINDS.ai,
            insights,
            aiLabels("neighbourhood story"),
            (data) => (
              <StorySection insights={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={3}
          title="Amenities & walkability"
          icon={StoreIcon}
          description="What's nearby, colour-coded on the maps, with walking times from the front door."
        >
          {sectionBody(
            JOB_KINDS.amenities,
            amenities,
            {
              pending: "Finding nearby amenities…",
              failed: "We couldn't load nearby amenities",
              empty:
                "Nearby amenities will appear once the address is resolved.",
            },
            (data) => (
              <AmenitiesSection reportId={report.id} amenities={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={4}
          title="Commute & transit"
          icon={RouteIcon}
          description="Travel times at rush hour and the nearest transit."
        >
          {sectionBody(
            JOB_KINDS.commute,
            commute,
            {
              pending: "Calculating commute times…",
              failed: "We couldn't calculate commute times",
              empty: "Commute times will appear once the address is resolved.",
            },
            (data) => (
              <CommuteSection reportId={report.id} commute={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={5}
          title="Schools"
          icon={GraduationCapIcon}
          description="The nearest schools in each of Ontario's four school systems, with EQAO results."
        >
          {sectionBody(
            JOB_KINDS.schools,
            schools,
            {
              pending: "Finding nearby schools…",
              failed: "We couldn't load nearby schools",
              empty: "Nearby schools will appear once the address is resolved.",
              missing: "school results",
            },
            (data) => (
              <SchoolsSection reportId={report.id} schools={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={6}
          title="Who lives here"
          icon={UsersIcon}
          description="The neighbourhood from the census, compared with the city: ages, households, homes and incomes."
        >
          {sectionBody(
            JOB_KINDS.demographics,
            demographics,
            {
              pending: "Reading the census profile…",
              failed: "We couldn't load census data",
              empty: "Census figures will appear once the address is resolved.",
              missing: "census figures",
            },
            (data) => (
              <DemographicsSection data={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={7}
          title="Safety & environment"
          icon={ShieldCheckIcon}
          description="Facts buyers ask about: reported crime, flood and erosion regulation, noise and air quality."
        >
          {sectionBody(
            JOB_KINDS.safety,
            safety,
            {
              pending: "Checking crime, flood, noise and air quality…",
              failed: "We couldn't load safety and environment data",
              empty:
                "Safety and environment data will appear once the address is resolved.",
              missing: "safety and environment checks",
            },
            (data) => (
              <SafetySection safety={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={8}
          title="Marketing kit"
          icon={MegaphoneIcon}
          description="Ready-to-use listing copy. Review and edit before publishing."
          action={marketing ? regenerate : undefined}
        >
          {sectionBody(
            JOB_KINDS.ai,
            marketing,
            aiLabels("marketing kit"),
            (data) => (
              <MarketingSection marketing={data} />
            ),
          )}
        </ReportSection>

        <ReportSection
          number={9}
          title="Agent playbook"
          icon={PresentationIcon}
          description="For you, not the client: how to show the property and handle questions."
        >
          {sectionBody(
            JOB_KINDS.ai,
            marketing,
            aiLabels("agent playbook"),
            (data) => (
              <PlaybookSection playbook={data.playbook} />
            ),
          )}
        </ReportSection>

        <footer className="mt-14 break-inside-avoid border-t border-foreground/10 pt-6 text-xs leading-relaxed text-foreground/55 print:mt-10">
          <h2 className="text-sm font-semibold text-foreground">
            Sources & disclaimer
          </h2>
          <ul className="mt-2 space-y-0.5">
            <li>
              <span className="text-foreground/75">Google Maps Platform:</span>{" "}
              address, nearby places, ratings, walking and travel times, and
              maps
              {amenities && ` (as of ${formatShortDate(amenities.fetchedAt)})`}.
            </li>
            {schools && (
              <li>
                <span className="text-foreground/75">
                  Ontario Ministry of Education:
                </span>{" "}
                school locations, enrolment and EQAO results ({schools.dataYear}
                ).
              </li>
            )}
            {demographics && (
              <li>
                <span className="text-foreground/75">Statistics Canada:</span>{" "}
                {demographics.censusYear} Census of Population.
              </li>
            )}
            {safety && (
              <li>
                <span className="text-foreground/75">
                  Safety & environment:
                </span>{" "}
                {[
                  safety.crime &&
                    `${safety.crime.source} (${safety.crime.year})`,
                  safety.flood.status !== "unknown" &&
                    "Toronto and Region Conservation Authority regulation mapping",
                  safety.areaCrime &&
                    `Statistics Canada Crime Severity Index (${safety.areaCrime.year})`,
                  safety.noise.roadsCovered &&
                    "Ontario Road Network and Ontario Railway Network",
                  safety.airQuality && "Google Air Quality API",
                ]
                  .filter(Boolean)
                  .join("; ") || "Public open data"}
                .
              </li>
            )}
            <li>
              <span className="text-foreground/75">AI-generated:</span>{" "}
              neighbourhood story, marketing kit and playbook, written from the
              data in this report
              {aiModels.length > 0 && ` by ${aiModels.join(" and ")}`}. Review
              before sharing.
            </li>
            <li>
              <span className="text-foreground/75">Entered by agent:</span>{" "}
              property details provided by the agent preparing this report.
            </li>
          </ul>
          <p className="mt-3">
            This report is for reference only and may contain errors or outdated
            information. Travel times vary with traffic and schedules. Verify
            important details before relying on them.
          </p>
        </footer>
      </article>
    </div>
  );
}
