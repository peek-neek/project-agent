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

export type ReportToDelete = { id: string; label: string };

/** Confirms and deletes a report, then removes it from the history. */
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

  const mutation = useMutation(
    trpc.report.delete.mutationOptions({
      onSuccess: ({ id }) => {
        // Leave the deleted report's page first, so it doesn't refetch.
        if (pathname === `/reports/${id}`) router.replace("/dashboard");
        else queryClient.removeQueries(trpc.report.byId.queryFilter({ id }));
        queryClient.setQueryData(trpc.report.list.queryKey(), (old) =>
          old?.filter((r) => r.id !== id),
        );
        onClose();
      },
    }),
  );

  return (
    <AlertDialog
      open={report !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) {
          mutation.reset();
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <Trash2Icon />
          </AlertDialogMedia>
          <AlertDialogTitle>Delete this report?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium text-foreground">{report?.label}</span>{" "}
            and everything generated for it will be permanently deleted. This
            can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.isError && (
          <p role="alert" className="text-sm text-destructive">
            {mutation.error.data?.code === "NOT_FOUND"
              ? "This report no longer exists."
              : "We couldn't delete the report. Try again."}
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
            Delete report
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
