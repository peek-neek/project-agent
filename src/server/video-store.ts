// The map video's saved state (one "video" report section) and its private
// voiceover clips in Vercel Blob. Shared by Next.js and Trigger.dev tasks,
// so no "server-only" import here.
import {
  del,
  get,
  getDownloadUrl,
  issueSignedToken,
  presignUrl,
  put,
} from "@vercel/blob";
import type { Prisma } from "../generated/prisma/client";
import {
  VIDEO_SECTION_KEY,
  type VideoRender,
  type VideoSection,
  videoRenderSchema,
  videoSectionSchema,
} from "../lib/video";
import { reportStore } from "./report-store";

/**
 * Blob credentials: a read-write token (Trigger.dev, local dev) or Vercel's
 * OIDC with a store ID (deployments on Vercel).
 */
export const blobConfigured = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export async function getVideo(reportId: string) {
  const data = await reportStore.getSection(reportId, VIDEO_SECTION_KEY);
  const parsed = videoSectionSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** Merges `patch` into the saved video state. */
export async function saveVideo(
  reportId: string,
  patch: Partial<VideoSection> & Pick<VideoSection, "status">,
) {
  const current = await getVideo(reportId);
  const next: VideoSection = {
    error: null,
    travelMode: "walk",
    script: null,
    audio: null,
    audioNote: null,
    generatedBy: null,
    render: null,
    routes: null,
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await reportStore.setSection(
    reportId,
    VIDEO_SECTION_KEY,
    next as unknown as Prisma.InputJsonValue,
  );
  return next;
}

/** Uploads one scene's voiceover clip; returns its private pathname. */
export async function putVoiceClip(reportId: string, scene: number, wav: Buffer) {
  const blob = await put(`reports/${reportId}/video/scene-${scene}.wav`, wav, {
    access: "private",
    contentType: "audio/wav",
    addRandomSuffix: true,
  });
  return blob.pathname;
}

/** Deletes replaced voiceover clips or MP4s. Never throws. */
export async function deleteBlobs(pathnames: string[]) {
  if (pathnames.length === 0 || !blobConfigured()) return;
  await del(pathnames).catch((error: unknown) =>
    console.warn("[video] couldn't delete old files", error),
  );
}

export async function readVoiceClip(pathname: string) {
  return get(pathname, { access: "private" });
}

/** Updates the MP4 export's state, keeping the rest of the video as is. */
export async function saveRender(reportId: string, patch: Partial<VideoRender>) {
  const current = await getVideo(reportId);
  if (!current) return null;
  const render = videoRenderSchema.parse({
    status: "rendering",
    version: "",
    startedAt: new Date().toISOString(),
    ...current.render,
    ...patch,
  });
  return saveVideo(reportId, { status: current.status, render });
}

/** Uploads a rendered MP4; returns its private pathname. */
export async function putVideoFile(reportId: string, name: string, file: Buffer) {
  const blob = await put(`reports/${reportId}/video/${name}.mp4`, file, {
    access: "private",
    contentType: "video/mp4",
    addRandomSuffix: true,
    multipart: file.length > 8 * 1024 * 1024,
  });
  return blob.pathname;
}

/**
 * A short-lived URL anyone holding it can read: lets the renderer fetch
 * voiceover clips, and the browser download an MP4 straight from Blob
 * (function responses are capped at 4.5 MB).
 */
export async function presignedUrl(
  pathname: string,
  { validForMs = 60 * 60_000, download = false } = {},
) {
  const validUntil = Date.now() + validForMs;
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  const { presignedUrl: url } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    validUntil,
  });
  return download ? getDownloadUrl(url) : url;
}
