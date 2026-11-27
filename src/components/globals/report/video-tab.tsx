"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ClapperboardIcon,
  DownloadIcon,
  FileVideoIcon,
  MapPinOffIcon,
  MicOffIcon,
  RefreshCwIcon,
  ScrollTextIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useTravelMode } from "@/components/globals/travel-mode";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { checkCompliance } from "@/lib/compliance";
import { JOB_KINDS } from "@/lib/report-sections";
import { TRAVEL_MODES } from "@/lib/travel";
import {
  currentRender,
  isMapScene,
  isRenderActive,
  isVideoWorking,
  sceneStops,
  type VideoSection,
  videoVersion,
  VIDEO_SECTION_KEY,
  type VideoSceneKind,
  videoPlaces,
  videoSectionSchema,
} from "@/lib/video";
import { useTRPC } from "@/trpc/client";
import { buildVideoProps } from "@/video/props";
import { ComplianceBadge, FlaggedText } from "./copy-block";
import { DashCard } from "./dash-card";
import type { ReportData } from "./report-format";
import { getJob, getSection, isJobActive } from "./report-hooks";
import type { ReportSectionsData } from "./overview-tab";

// MapLibre and Remotion run in the browser only.
const VideoPlayer = dynamic(() => import("./video-player"), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

const SCENE_LABELS: Record<VideoSceneKind, string> = {
  intro: "Intro",
  amenities: "Essentials",
  commute: "Commute",
  schools: "Schools",
  outro: "Call to action",
};

const MODE_WORDS = { walk: "walking", bike: "cycling", drive: "driving" } as const;

/** The Video tab: a map tour of the location, previewed in the browser. */
export function VideoTab({
  report,
  data,
}: {
  report: ReportData;
  data: ReportSectionsData;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const travel = useTravelMode();
  const parsed = getSection(report, VIDEO_SECTION_KEY, videoSectionSchema);
  // What the video says and sounds like. Export progress saves change the
  // section every few seconds; the Player only reloads when this changes.
  const version = parsed?.script ? videoVersion(parsed) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
  const video = useMemo(() => parsed, [version, parsed?.status]);
  const working = isVideoWorking(parsed);
  const rendering = isRenderActive(parsed);

  // The dashboard polls only while report steps run; poll for the video too.
  useQuery({
    ...trpc.report.byId.queryOptions({ id: report.id }),
    refetchInterval: working || rendering ? 2500 : false,
    enabled: working || rendering,
  });

  const generate = useMutation(
    trpc.report.generateVideo.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.report.byId.queryKey({ id: report.id }),
        }),
    }),
  );
  const create = () =>
    generate.mutate({ id: report.id, travelMode: travel.mode });
  const busy = working || generate.isPending;

  const located = report.property?.latitude != null;
  const dataPending = [JOB_KINDS.amenities, JOB_KINDS.commute, JOB_KINDS.schools]
    .some((kind) => isJobActive(getJob(report, kind)));
  const mode = video?.travelMode ?? travel.mode;

  const places = useMemo(
    () =>
      videoPlaces(
        { amenities: data.amenities, commute: data.commute, schools: data.schools },
        mode,
      ),
    [data.amenities, data.commute, data.schools, mode],
  );
  const props = useMemo(
    () =>
      buildVideoProps({
        property: report.property,
        inputAddress: report.inputAddress,
        listing: data.listing,
        places,
        video,
        // The version busts the browser cache when the voiceover is redone.
        audioSrc: (i) =>
          `/api/reports/${report.id}/video/audio/${i}?v=${version ?? ""}`,
      }),
    [report.property, report.inputAddress, report.id, data.listing, places, video, version],
  );

  if (!located) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPinOffIcon />
          </EmptyMedia>
          <EmptyTitle>The video needs the property&rsquo;s location</EmptyTitle>
          <EmptyDescription>
            Once the address is located, you can make a map tour of the
            neighbourhood.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const script = video?.script ?? null;
  const findings = script
    ? script.scenes.flatMap((s) => [
        ...checkCompliance(s.title),
        ...checkCompliance(s.voiceover),
      ])
    : [];
  const otherMode = script && !working && video!.travelMode !== travel.mode;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <DashCard
        title="Map video"
        icon={ClapperboardIcon}
        className={script ? "lg:col-span-5" : "lg:col-span-12"}
        bodyClassName="p-4"
        action={
          script && (
            <Button
              variant="ghost"
              size="sm"
              onClick={create}
              disabled={busy || dataPending || rendering}
            >
              <RefreshCwIcon data-icon="inline-start" />
              Rewrite
            </Button>
          )
        }
      >
        <div className="mx-auto aspect-[9/16] w-full max-w-[22rem] overflow-hidden bg-muted">
          {working ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Spinner />
                </EmptyMedia>
                <EmptyTitle>
                  {video?.status === "voicing"
                    ? "Recording the voiceover…"
                    : "Writing the script…"}
                </EmptyTitle>
                <EmptyDescription>
                  Picking places from this report and timing each scene. This
                  takes under a minute.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : props ? (
            <VideoPlayer video={props} />
          ) : (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClapperboardIcon />
                </EmptyMedia>
                <EmptyTitle>A 30-second map tour</EmptyTitle>
                <EmptyDescription>
                  Lines from the home to nearby essentials, transit and schools,
                  each with its travel time, under a voiceover and captions.
                  Made for Reels, TikTok and Stories.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={create} disabled={busy || dataPending}>
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  Create video
                </Button>
                {dataPending && (
                  <p className="text-xs text-muted-foreground">
                    Waiting for nearby places to finish loading…
                  </p>
                )}
              </EmptyContent>
            </Empty>
          )}
        </div>
        {props && !working && parsed && (
          <ExportControls reportId={report.id} video={parsed} />
        )}
      </DashCard>

      {(generate.error || video?.status === "failed") && (
        <Alert variant="destructive" className="lg:col-span-12 lg:order-first">
          <AlertCircleIcon />
          <AlertTitle>The video couldn&rsquo;t be made</AlertTitle>
          <AlertDescription>
            {generate.error?.message ?? video?.error ?? "Try again shortly."}
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={create} disabled={busy}>
              Try again
            </Button>
          </AlertAction>
        </Alert>
      )}

      {script && (
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          {video?.audioNote && !working && (
            <Alert>
              <MicOffIcon />
              <AlertTitle>Captions only</AlertTitle>
              <AlertDescription>{video.audioNote}</AlertDescription>
            </Alert>
          )}

          <DashCard
            title="Script"
            icon={ScrollTextIcon}
            action={<ComplianceBadge findings={findings} />}
            bodyClassName="px-4 pb-4"
          >
            <ol className="flex flex-col divide-y">
              {script.scenes.map((scene, i) => {
                const stops = sceneStops(places, scene.kind, scene.placeIds);
                return (
                  <li key={`${scene.kind}-${i}`} className="flex flex-col gap-1.5 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{SCENE_LABELS[scene.kind]}</Badge>
                      <span className="text-sm font-semibold">{scene.title}</span>
                      {video?.audio?.[i] && (
                        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                          {video.audio[i]!.durationSec.toFixed(1)} s
                        </span>
                      )}
                    </div>
                    <FlaggedText
                      text={scene.voiceover}
                      findings={checkCompliance(scene.voiceover)}
                      className="text-sm leading-relaxed text-foreground/80"
                    />
                    {isMapScene(scene.kind) && stops.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {stops
                          .map(
                            (s) =>
                              `${s.name} (${s.estimated ? "~" : ""}${s.minutes} min ${TRAVEL_MODES[mode].verb})`,
                          )
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </DashCard>

          <p className="text-xs leading-relaxed text-foreground/50">
            Times are for {MODE_WORDS[mode]}
            {otherMode && (
              <>
                {" "}(you&rsquo;re viewing {MODE_WORDS[travel.mode]} times:{" "}
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-xs"
                  onClick={create}
                  disabled={busy}
                >
                  rewrite for {MODE_WORDS[travel.mode]}
                </Button>
                )
              </>
            )}
            . Schools are shown by distance only; buyers should confirm
            catchment with the school board. Map data © OpenStreetMap
            contributors. Review the script before sharing.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Export to MP4 (rendered in the background), then download. An export is
 * tied to the script it was made from: rewriting asks for a new one.
 */
function ExportControls({
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
  const current = currentRender(video);
  const render = video.render;

  if (isRenderActive(video) || exportVideo.isPending) {
    return (
      <div className="mx-auto mt-4 flex w-full max-w-[22rem] flex-col gap-1.5">
        <Progress value={Math.round((render?.progress ?? 0) * 100)}>
          <ProgressLabel className="flex items-center gap-1.5">
            <Spinner className="size-3.5" />
            Exporting MP4…
          </ProgressLabel>
          <ProgressValue />
        </Progress>
        <p className="text-xs text-muted-foreground">
          Usually 2 to 4 minutes. You can leave this page.
        </p>
      </div>
    );
  }

  if (current?.status === "ready") {
    return (
      <div className="mx-auto mt-4 flex w-full max-w-[22rem] flex-col gap-1.5">
        <Button
          className="w-full"
          nativeButton={false}
          render={<a href={`/api/reports/${reportId}/video/download`} />}
        >
          <DownloadIcon data-icon="inline-start" />
          Download MP4
        </Button>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {current.sizeBytes != null &&
            `${(current.sizeBytes / 1e6).toFixed(1)} MB · `}
          1080 × 1920 · 30 fps
        </p>
      </div>
    );
  }

  const failed = render?.status === "failed" && render.version === videoVersion(video);
  const outdated = render?.status === "ready" && !current;
  return (
    <div className="mx-auto mt-4 flex w-full max-w-[22rem] flex-col gap-1.5">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => exportVideo.mutate({ id: reportId })}
      >
        <FileVideoIcon data-icon="inline-start" />
        {failed ? "Try the export again" : "Export MP4"}
      </Button>
      {(exportVideo.error || failed) && (
        <p className="text-xs text-destructive">
          {exportVideo.error?.message ?? render?.error}
        </p>
      )}
      {outdated && !exportVideo.error && (
        <p className="text-xs text-muted-foreground">
          The script changed since the last export.
        </p>
      )}
    </div>
  );
}
