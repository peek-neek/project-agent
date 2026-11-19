"use client";

import {
  AlertCircleIcon,
  LoaderCircleIcon,
  PlusIcon,
  RotateCwIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobKind } from "@/lib/report-sections";
import type { ReportJob } from "./report-format";
import { useRerunJob } from "./report-hooks";

export function SectionPending({ label }: { label: string }) {
  return (
    <div className="space-y-3 print:hidden" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-foreground/65">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
        {label}
      </p>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function SectionFailed({
  reportId,
  kind,
  job,
  title,
}: {
  reportId: string;
  kind: JobKind;
  job?: ReportJob;
  title: string;
}) {
  const rerun = useRerunJob(reportId);
  return (
    <Alert className="border-foreground/15 bg-muted/60 print:hidden">
      <AlertCircleIcon className="text-destructive-foreground" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-foreground/65">
        {job?.error ?? "Something went wrong."}
        <Button
          variant="outline"
          size="sm"
          disabled={rerun.isPending}
          onClick={() => rerun.mutate({ id: reportId, kind })}
          className="mt-3 w-fit bg-card"
        >
          <RotateCwIcon data-icon="inline-start" />
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}

/** For reports created before a section existed: offers to generate it. */
export function SectionMissing({
  reportId,
  kind,
  label,
}: {
  reportId: string;
  kind: JobKind;
  label: string;
}) {
  const rerun = useRerunJob(reportId);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/60 p-4 print:hidden">
      <p className="text-sm text-foreground/65">
        This report was created before {label} were available.
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={rerun.isPending}
        onClick={() => rerun.mutate({ id: reportId, kind })}
        className="bg-card"
      >
        <PlusIcon data-icon="inline-start" />
        Add this section
      </Button>
    </div>
  );
}
