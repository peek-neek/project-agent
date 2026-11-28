"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircleIcon, DownloadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AgentBrandingTab,
  useBrandingDraft,
} from "@/components/globals/branding/agent-branding-tab";
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
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  currentRender,
  isRenderActive,
  type VideoSection,
  videoVersion,
} from "@/lib/video";
import { useTRPC } from "@/trpc/client";

/** Saves a file (the route redirects to a signed download URL). */
function startDownload(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.append(link);
  link.click();
  link.remove();
}

/**
 * Download the MP4, the same way as the PDF: a dialog first (who the video
 * is from, on its closing card), then the button becomes a progress bar of
 * the same size while it exports, and the file downloads when it's ready.
 * An export already made with this script and branding downloads at once.
 */
export function VideoDownload({
  reportId,
  video,
}: {
  reportId: string;
  /** The live section (not memoized), so progress updates show. */
  video: VideoSection;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const exportVideo = useMutation(
    trpc.report.renderVideo.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.report.byId.queryKey({ id: reportId }),
        }),
    }),
  );
  const brand = useBrandingDraft();
  const [open, setOpen] = useState(false);
  const downloadUrl = `/api/reports/${reportId}/video/download`;

  // Set when this page asked for an export: download it once it's finished
  // (finished after the request, so an older file never counts).
  const requestedAt = useRef<number | null>(null);
  const render = video.render;
  const current = currentRender(video);
  const rendering = isRenderActive(video) || exportVideo.isPending;
  useEffect(() => {
    const asked = requestedAt.current;
    if (asked == null || current?.status !== "ready" || !current.renderedAt) return;
    if (Date.parse(current.renderedAt) < asked) return;
    requestedAt.current = null;
    startDownload(downloadUrl);
  }, [current?.status, current?.renderedAt, downloadUrl]);

  const openDialog = () => {
    brand.reset();
    void brand.query.refetch();
    setOpen(true);
  };

  const download = async () => {
    if (brand.error) return;
    try {
      // The closing card uses what's saved, so save edits first.
      await brand.saveIfChanged();
    } catch {
      return; // the tab shows the error
    }
    setOpen(false);
    const asked = Date.now();
    const result = await exportVideo.mutateAsync({ id: reportId }).catch(() => null);
    if (!result) return; // the error shows under the button
    if (result.ready) startDownload(downloadUrl);
    else requestedAt.current = asked;
  };

  const failed =
    render?.status === "failed" && render.version === videoVersion(video);
  const outdated = render?.status === "ready" && !current;

  return (
    <div className="mx-auto mt-4 flex w-full max-w-[22rem] flex-col gap-1.5">
      {rendering ? (
        // Same box as the button, so nothing moves.
        <Progress
          value={Math.round((render?.progress ?? 0) * 100)}
          aria-label="Exporting the MP4"
          className="relative h-9 w-full gap-0 *:data-[slot=progress-track]:h-full *:data-[slot=progress-track]:ring-1 *:data-[slot=progress-track]:ring-border **:data-[slot=progress-indicator]:bg-primary/35"
        >
          <ProgressLabel className="absolute inset-0 z-10 flex items-center justify-center gap-1.5 text-sm font-medium tabular-nums">
            <Spinner className="size-3.5" />
            Exporting MP4… {Math.round((render?.progress ?? 0) * 100)}%
          </ProgressLabel>
        </Progress>
      ) : (
        <Button
          className="w-full"
          variant={failed ? "destructive" : "default"}
          onClick={openDialog}
        >
          {failed ? (
            <AlertCircleIcon data-icon="inline-start" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          {failed ? "Try again" : "Download MP4"}
        </Button>
      )}

      {rendering ? (
        <p className="text-xs text-muted-foreground">
          Usually 2 to 4 minutes. It downloads when it&apos;s ready; you can
          also leave and come back.
        </p>
      ) : (exportVideo.error || failed) ? (
        <p className="text-xs text-destructive">
          {exportVideo.error?.message ?? render?.error}
        </p>
      ) : current?.status === "ready" ? (
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {current.sizeBytes != null &&
            `${(current.sizeBytes / 1e6).toFixed(1)} MB · `}
          1080 × 1920 · 30 fps
        </p>
      ) : outdated ? (
        <p className="text-xs text-muted-foreground">
          The script changed since the last export, so it&apos;s made again.
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-cols-1 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Download MP4</DialogTitle>
            <DialogDescription>
              Who the video is from: shown on its closing card.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="agent">
            <TabsList className="w-full">
              <TabsTrigger value="agent">Agent / broker</TabsTrigger>
            </TabsList>
            <TabsContent value="agent" className="pt-3">
              <AgentBrandingTab draft={brand} />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button onClick={download} disabled={brand.saving}>
              {brand.saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
