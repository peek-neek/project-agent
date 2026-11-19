"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { JobKind } from "@/lib/report-sections";
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
