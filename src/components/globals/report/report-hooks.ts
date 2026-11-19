"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { copySectionKey, type JobKind } from "@/lib/report-sections";
import type { TravelMode } from "@/lib/travel";
import { useTravelMode } from "@/components/globals/travel-mode";
import { useTRPC } from "@/trpc/client";
import type { ReportData, ReportJob } from "./report-format";

const ACTIVE = new Set(["queued", "running"]);

/** Parsed data for a section, or null if missing/invalid. */
export function getSection<S extends z.ZodType>(
  report: ReportData,
  key: string,
  schema: S,
): z.infer<S> | null {
  const row = report.sections.find((s) => s.key === key);
  if (!row) return null;
  const parsed = schema.safeParse(row.data);
  return parsed.success ? parsed.data : null;
}

/**
 * AI copy for a travel mode: its own copy ("marketing:bike"), else the
 * report's single copy (older reports, or a mode that failed to generate).
 */
export function getCopySection<S extends z.ZodType>(
  report: ReportData,
  key: string,
  schema: S,
  mode: TravelMode,
): z.infer<S> | null {
  return (
    getSection(report, copySectionKey(key, mode), schema) ??
    getSection(report, key, schema)
  );
}

/** Whether the report has copy written specifically for this mode. */
export const hasCopyForMode = (
  report: ReportData,
  key: string,
  mode: TravelMode,
) => report.sections.some((s) => s.key === copySectionKey(key, mode));

export function getJob(report: ReportData, kind: JobKind) {
  return report.jobs.find((j) => j.kind === kind);
}

export const isJobActive = (job?: ReportJob) =>
  job ? ACTIVE.has(job.status) : false;

export function useRerunJob(reportId: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mode } = useTravelMode();
  const mutation = useMutation(
    trpc.report.rerunJob.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.report.byId.queryKey({ id: reportId }),
        }),
    }),
  );
  // Always send the current travel mode: regenerated AI copy uses it.
  return {
    ...mutation,
    mutate: (vars: { id: string; kind: JobKind }) =>
      mutation.mutate({ ...vars, travelMode: mode }),
  };
}
