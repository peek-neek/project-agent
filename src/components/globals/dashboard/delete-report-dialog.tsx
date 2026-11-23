"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/trpc/client";

export type ReportToDelete = {
  id: string;
  label: string;
  /** A comparison: only it is deleted, never the two reports. */
  kind?: "report" | "comparison";
};

/** Confirms and deletes a report or comparison, then drops it from the history. */
export function DeleteReportDialog({
  report,
  onClose,
}: {
  report: ReportToDelete | null;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const reportMutation = useMutation(
    trpc.report.delete.mutationOptions({
      onSuccess: ({ id }) => {
        // Leave the deleted report's page first, so it doesn't refetch.
        if (pathname === `/reports/${id}`) router.replace("/dashboard");
        else queryClient.removeQueries(trpc.report.byId.queryFilter({ id }));
        queryClient.setQueryData(trpc.report.list.queryKey(), (old) =>
          old?.filter((r) => r.id !== id),
        );
        // Comparisons that included it are deleted with it.
        void queryClient.invalidateQueries(trpc.comparison.list.queryFilter());
        onClose();
      },
    }),
  );
  const comparisonMutation = useMutation(
    trpc.comparison.delete.mutationOptions({
      onSuccess: ({ id }) => {
        if (pathname === `/compare/${id}`) router.replace("/dashboard");
        else
          queryClient.removeQueries(trpc.comparison.byId.queryFilter({ id }));
        queryClient.setQueryData(trpc.comparison.list.queryKey(), (old) =>
          old?.filter((c) => c.id !== id),
        );
        onClose();
      },
    }),
  );
  const isComparison = report?.kind === "comparison";
  const mutation = isComparison ? comparisonMutation : reportMutation;
  const noun = isComparison ? "comparison" : "report";

  return (
    <AlertDialog
      open={report !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) {
          reportMutation.reset();
          comparisonMutation.reset();
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this {noun}?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{report?.label}</span>{" "}
            {isComparison
              ? "will be deleted. Both property reports stay in your history."
              : "and everything generated for it will be permanently deleted. This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.data?.code === "NOT_FOUND"
              ? `This ${noun} no longer exists.`
              : `We couldn't delete the ${noun}. Try again.`}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!report || mutation.isPending}
            onClick={() => report && mutation.mutate({ id: report.id })}
          >
            {mutation.isPending && <Spinner data-icon="inline-start" />}
            Delete {noun}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
