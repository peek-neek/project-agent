"use client";

import type { JobKind } from "@/lib/report-sections";
import type { ReportData } from "./report-format";
import { getJob, isJobActive } from "./report-hooks";
import { SectionFailed, SectionMissing, SectionPending } from "./section-state";

export type SectionLabels = {
  pending: string;
  failed: string;
  empty: string;
  /** Shown for reports created before this section existed. */
  missing?: string;
};

/** Pending, failed, missing and empty states for one generated section. */
export function SectionGate<T>({
  report,
  kind,
  data,
  labels,
  children,
}: {
  report: ReportData;
  kind: JobKind;
  data: T | null;
  labels: SectionLabels;
  children: (data: T) => React.ReactNode;
}) {
  const job = getJob(report, kind);
  if (!job && !data && labels.missing && report.property) {
    return (
      <SectionMissing reportId={report.id} kind={kind} label={labels.missing} />
    );
  }
  // While a step re-runs, keep showing what we have; the tab and progress
  // strip already show that it's updating.
  if (isJobActive(job)) {
    return data ? children(data) : <SectionPending label={labels.pending} />;
  }
  if (job?.status === "failed" && !data) {
    return (
      <SectionFailed
        reportId={report.id}
        kind={kind}
        job={job}
        title={labels.failed}
      />
    );
  }
  if (data) return children(data);
  return <p className="text-sm text-foreground/60">{labels.empty}</p>;
}
