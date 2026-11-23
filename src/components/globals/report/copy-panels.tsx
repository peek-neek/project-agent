"use client";

import { useTravelMode } from "@/components/globals/travel-mode";
import {
  campaignSchema,
  JOB_KINDS,
  marketingSchema,
  SECTION_KEYS,
  showingSchema,
} from "@/lib/report-sections";
import { MarketingTab } from "./marketing-tab";
import type { ReportSectionsData } from "./overview-tab";
import { PlaybookTab } from "./playbook-tab";
import type { ReportData } from "./report-format";
import { getCopySection } from "./report-hooks";
import { MarketingSkeleton, PlaybookSkeleton } from "./report-skeletons";
import { SectionGate } from "./section-gate";

type CopyPanelProps = {
  report: ReportData;
  data: ReportSectionsData;
  /** The AI copy step is running (campaign and showing kit placeholders). */
  regenerating: boolean;
  /** Writes the campaign and showing kit (re-runs the AI copy step). */
  onGenerate: () => void;
};

/** The Marketing tab for one report: listing copy, social and campaign. */
export function MarketingPanel({
  report,
  data,
  regenerating,
  onGenerate,
}: CopyPanelProps) {
  const travel = useTravelMode();
  const marketing = getCopySection(
    report,
    SECTION_KEYS.marketing,
    marketingSchema,
    travel.mode,
  );
  const campaign = getCopySection(
    report,
    SECTION_KEYS.campaign,
    campaignSchema,
    travel.mode,
  );
  return (
    <SectionGate
      report={report}
      kind={JOB_KINDS.ai}
      skeleton={<MarketingSkeleton />}
      data={
        data.insights && marketing
          ? { insights: data.insights, marketing }
          : null
      }
      labels={{
        pending: "Writing the marketing kit…",
        failed: "We couldn't write the marketing kit",
        empty: "The marketing kit appears once the location data is ready.",
      }}
    >
      {(ai) => (
        <MarketingTab
          reportId={report.id}
          insights={ai.insights}
          marketing={ai.marketing}
          campaign={campaign}
          campaignPending={regenerating}
          onGenerate={onGenerate}
        />
      )}
    </SectionGate>
  );
}

/** The Playbook tab for one report: talking points, objections, showing kit. */
export function PlaybookPanel({
  report,
  data,
  regenerating,
  onGenerate,
}: CopyPanelProps) {
  const travel = useTravelMode();
  const marketing = getCopySection(
    report,
    SECTION_KEYS.marketing,
    marketingSchema,
    travel.mode,
  );
  const showing = getCopySection(
    report,
    SECTION_KEYS.showing,
    showingSchema,
    travel.mode,
  );
  return (
    <SectionGate
      report={report}
      kind={JOB_KINDS.ai}
      skeleton={<PlaybookSkeleton />}
      data={marketing}
      labels={{
        pending: "Writing the agent playbook…",
        failed: "We couldn't write the agent playbook",
        empty: "The playbook appears once the location data is ready.",
      }}
    >
      {(m) => (
        <PlaybookTab
          reportId={report.id}
          insights={data.insights}
          playbook={m.playbook}
          showing={showing}
          showingPending={regenerating}
          onGenerate={onGenerate}
          data={data}
          home={
            report.property?.latitude != null &&
            report.property.longitude != null
              ? {
                  lat: report.property.latitude,
                  lng: report.property.longitude,
                }
              : null
          }
        />
      )}
    </SectionGate>
  );
}
