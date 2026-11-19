// Marks a report job running/completed around an extractor. Failures are
// recorded by each task's onFailure hook, after Trigger.dev's last retry.
import { AbortTaskRunError } from "@trigger.dev/sdk";
import type { JobKind } from "../lib/report-sections";
import { reportStore } from "./report-store";

export async function runReportJob<T>(
  reportId: string,
  kind: JobKind,
  work: () => Promise<T>,
) {
  // The agent may have deleted the report; stop without retrying.
  if (!(await reportStore.findById(reportId))) {
    throw new AbortTaskRunError(`Report ${reportId} was deleted`);
  }
  await reportStore.updateJob(reportId, kind, {
    status: "running",
    startedAt: new Date(),
    error: null,
  });
  const result = await work();
  await reportStore.updateJob(reportId, kind, {
    status: "completed",
    finishedAt: new Date(),
  });
  return result;
}

export async function markReportJobFailed(
  reportId: string,
  kind: JobKind,
  error: unknown,
) {
  if (!(await reportStore.findById(reportId))) return; // deleted
  await reportStore.updateJob(reportId, kind, {
    status: "failed",
    finishedAt: new Date(),
    error: error instanceof Error ? error.message : String(error),
  });
}
