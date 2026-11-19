"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/trpc/client";

export type ReportToRename = {
  id: string;
  /** Current custom name, if any. */
  name: string | null;
  /** The address, shown when the name is cleared. */
  address: string;
};

const MAX_LENGTH = 120;

/** Renames a report in the history; an empty name restores the address. */
export function RenameReportDialog({
  report,
  onClose,
}: {
  report: ReportToRename | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={report !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        {/* Keyed so the form state resets for each report. */}
        {report && (
          <RenameForm key={report.id} report={report} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  report,
  onDone,
}: {
  report: ReportToRename;
  onDone: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [name, setName] = useState(report.name ?? "");

  const mutation = useMutation(
    trpc.report.rename.mutationOptions({
      onSuccess: ({ id, name }) => {
        queryClient.setQueryData(trpc.report.list.queryKey(), (old) =>
          old?.map((r) => (r.id === id ? { ...r, name } : r)),
        );
        onDone();
      },
    }),
  );

  const unchanged = name.trim() === (report.name ?? "");
  const tooLong = name.trim().length > MAX_LENGTH;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (unchanged) return onDone();
        mutation.mutate({ id: report.id, name });
      }}
      // minmax(0,1fr): lets the truncated address shrink instead of
      // stretching the form past the dialog.
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4"
    >
      <DialogHeader>
        <DialogTitle>Rename report</DialogTitle>
        <DialogDescription>
          The name only appears in your report list. Leave it empty to show the
          address.
        </DialogDescription>
      </DialogHeader>

      <Field data-invalid={tooLong || mutation.isError || undefined}>
        <FieldLabel htmlFor="report-name">Name</FieldLabel>
        <Input
          id="report-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={report.address}
          maxLength={MAX_LENGTH + 20}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          aria-invalid={tooLong || mutation.isError || undefined}
        />
        {tooLong ? (
          <FieldError>Keep it under {MAX_LENGTH} characters.</FieldError>
        ) : mutation.isError ? (
          <FieldError>
            {mutation.error.data?.code === "NOT_FOUND"
              ? "This report no longer exists."
              : "We couldn't rename the report. Try again."}
          </FieldError>
        ) : (
          <FieldDescription className="truncate">
            Address: {report.address}
          </FieldDescription>
        )}
      </Field>

      <DialogFooter>
        <DialogClose
          render={<Button variant="outline" type="button" />}
          disabled={mutation.isPending}
        >
          Cancel
        </DialogClose>
        <Button type="submit" disabled={tooLong || mutation.isPending}>
          {mutation.isPending && <Spinner data-icon="inline-start" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
