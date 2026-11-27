import { TRPCError } from "@trpc/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import type { UIMessage } from "ai";
import { z } from "zod";
import {
  JOB_KINDS,
  type JobKind,
  listingInputSchema,
  notesSchema,
  SECTION_KEYS,
} from "@/lib/report-sections";
import {
  cancelReportRuns,
  queueReportGeneration,
  queueReportJob,
  queueReportVideo,
  queueVideoRender,
} from "@/server/jobs";
import { blobConfigured, deleteBlobs } from "@/server/video-store";
import {
  currentRender,
  isRenderActive,
  isVideoWorking,
  VIDEO_SECTION_KEY,
  videoSectionSchema,
} from "@/lib/video";
import {
  type IdentitySources,
  reportModes,
  reportStore,
} from "@/server/report-store";
import { travelModes } from "@/lib/travel";
import {
  LANGUAGES,
  REWRITE_ACTIONS,
  REWRITE_MAX_CHARS,
  type RewriteAction,
} from "@/lib/copy-actions";
import { rewriteCopy } from "@/server/ai/rewrite-copy";
import { createRateLimiter } from "@/server/rate-limit";
import { savedCalculatorsSchema } from "@/lib/finance/scenario";
import { BILLING_ERRORS } from "@/lib/billing";
import {
  consumeExtraReportCredit,
  getEntitlement,
  returnExtraReportCredit,
} from "@/server/billing";
import { recordReportUsage } from "@/server/entitlements";
import { createTRPCRouter, protectedProcedure } from "../init";

const token = (max: number) =>
  z
    .string()
    .regex(new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`))
    .optional()
    .catch(undefined);

const travelMode = z.enum(travelModes);

/** Canada's bounding box, so a pin can't land somewhere we have no data. */
const CANADA_BOX = { south: 41.6, north: 83.2, west: -141.1, east: -52.5 };

export const createReportInput = z.object({
  address: z.string().trim().min(3).max(500),
  mode: z.enum(reportModes).catch("single"),
  /** The agent's walk / drive choice, for the AI copy's times. */
  travelMode: travelMode.catch("walk"),
  placeId: token(300),
  sessionToken: token(64),
  /** A pin the agent dropped (new builds, rural lots): skips the lookup. */
  lat: z.coerce
    .number()
    .min(CANADA_BOX.south)
    .max(CANADA_BOX.north)
    .optional()
    .catch(undefined),
  lng: z.coerce
    .number()
    .min(CANADA_BOX.west)
    .max(CANADA_BOX.east)
    .optional()
    .catch(undefined),
});

export type CreateReportInput = z.infer<typeof createReportInput>;

/**
 * Creates a report and queues its generation: checks the plan, spends an
 * extra-report credit when the month's allowance is gone, and logs the
 * usage. A double submit returns the report it already started. Shared by
 * single reports and comparisons (one call per property).
 */
export async function startReport(userId: string, input: CreateReportInput) {
  const { sessionToken, travelMode, lat, lng, ...data } = input;
  const pin = lat != null && lng != null ? { lat, lng } : null;
  // Each report runs paid lookups, so it needs an allowance: this month's
  // plan reports, or Basic's one free report (ever).
  const entitlement = await getEntitlement(userId);
  // Allowance used up: spend an extra report (bought at C$15), on any plan.
  let usedCredit = false;
  if (entitlement.reportsUsed >= entitlement.reportsLimit) {
    usedCredit = await consumeExtraReportCredit(userId);
    if (!usedCredit) {
      throw new TRPCError({ code: "FORBIDDEN", message: BILLING_ERRORS.limit });
    }
  }
  // A double submit returns the report it already started.
  const { report, created } = await reportStore
    .createUnlessRecent({ userId, ...data })
    .catch(async (error: unknown) => {
      if (usedCredit) await returnExtraReportCredit(userId);
      throw error;
    });
  if (!created) {
    // Nothing new was made, so the credit goes back.
    if (usedCredit) await returnExtraReportCredit(userId);
    return report;
  }
  // Counts toward the allowance even if the report is deleted later.
  await recordReportUsage({ reportId: report.id, userId, usedCredit });
  await reportStore.setSection(report.id, SECTION_KEYS.copySettings, {
    travelMode,
  });
  if (pin) {
    // The identity step sees the pin and fills in the town and province
    // from it.
    const asOf = new Date().toISOString();
    await reportStore.saveIdentity(
      report.id,
      {
        formattedAddress: data.address,
        latitude: pin.lat,
        longitude: pin.lng,
        country: "CA",
      },
      {
        formattedAddress: { source: "agent", asOf },
        location: { source: "pin", asOf },
      },
    );
  }
  await queueReportGeneration(report.id, { sessionToken });
  return report;
}

/** AI rewrites per agent: generous for real use, a ceiling on runaway cost. */
const rewriteLimiter = createRateLimiter("report:rewrite", [
  { limit: 30, windowMs: 10 * 60_000 },
  { limit: 300, windowMs: 24 * 60 * 60_000 },
]);

/** Each video is an AI script plus a voiceover per scene. */
const videoLimiter = createRateLimiter("report:video", [
  { limit: 6, windowMs: 10 * 60_000 },
  { limit: 40, windowMs: 24 * 60 * 60_000 },
]);

/** Each export is a few minutes of a 4-vCPU machine. */
const renderLimiter = createRateLimiter("report:video-render", [
  { limit: 4, windowMs: 10 * 60_000 },
  { limit: 20, windowMs: 24 * 60 * 60_000 },
]);

function getVideoSection(report: { sections: { key: string; data: unknown }[] }) {
  const row = report.sections.find((s) => s.key === VIDEO_SECTION_KEY);
  const parsed = row ? videoSectionSchema.safeParse(row.data) : null;
  return parsed?.success ? parsed.data : null;
}

const jobKind = z.enum(Object.values(JOB_KINDS) as [JobKind, ...JobKind[]]);

export const reportRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createReportInput)
    .mutation(({ ctx, input }) => startReport(ctx.userId, input)),

  /** Report history for the dashboard sidebar. */
  list: protectedProcedure.query(({ ctx }) =>
    reportStore.listForUser(ctx.userId),
  ),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(100) }))
    .query(({ ctx, input }) => reportStore.findForUser(input.id, ctx.userId)),

  /**
   * The report's chat thread for the chat page: its chat id and messages,
   * plus a session token when the conversation exists, so the browser can
   * reconnect to an answer still being written (e.g. after a reload).
   */
  chatThread: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      const thread = await reportStore.ensureChatThread(report.id);
      const messages = thread.entries.map((e) => e.message) as UIMessage[];
      const session =
        messages.length > 0
          ? {
              publicAccessToken: await triggerAuth.createPublicToken({
                scopes: {
                  read: { sessions: thread.chatId },
                  write: { sessions: thread.chatId },
                },
                expirationTime: "1h",
              }),
              lastEventId: thread.cursors?.lastOutEventId,
            }
          : null;
      return { chatId: thread.chatId, messages, session };
    }),

  /** The agent's quick details: unit number plus inputs for the AI copy. */
  updateListing: protectedProcedure
    .input(listingInputSchema.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });

      const { id, unitNumber, ...listing } = input;
      if ((report.property?.unitNumber ?? null) !== unitNumber) {
        const sources: IdentitySources = {
          unitNumber: { source: "agent", asOf: new Date().toISOString() },
        };
        await reportStore.saveIdentity(id, { unitNumber }, sources);
      }
      await reportStore.setSection(id, SECTION_KEYS.listing, listing);
      return { ok: true };
    }),

  /**
   * The agent's calculator inputs, autosaved from the Calculators tab. The
   * PDF's financial scenarios and the chat's calculator tools use them.
   * An empty object clears them (back to the defaults).
   */
  saveCalculators: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        inputs: savedCalculatorsSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findById(input.id);
      if (!report || report.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const savedAt = new Date().toISOString();
      await reportStore.setSection(input.id, SECTION_KEYS.calculators, {
        ...input.inputs,
        savedAt,
      });
      return { savedAt };
    }),

  /** The agent's sticky note on the property, autosaved as they type. */
  saveNotes: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        text: notesSchema.shape.text,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findById(input.id);
      if (!report || report.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const savedAt = new Date().toISOString();
      await reportStore.setSection(input.id, SECTION_KEYS.notes, {
        text: input.text,
        savedAt,
      });
      return { savedAt };
    }),

  /** Renames a report in the history. An empty name restores the address. */
  rename: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z
          .string()
          .trim()
          .max(120, "Keep it under 120 characters")
          .transform((v) => (v === "" ? null : v)),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ok = await reportStore.renameForUser(
        input.id,
        ctx.userId,
        input.name,
      );
      if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id, name: input.name };
    }),

  /** Deletes a report and stops any of its background steps still running. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      await cancelReportRuns(report.jobs);
      const video = getVideoSection(report);
      const files = [
        ...(video?.audio?.map((c) => c.pathname) ?? []),
        ...(video?.render?.pathname ? [video.render.pathname] : []),
      ];
      await reportStore.deleteForUser(report.id, ctx.userId);
      // Best effort: the voiceover clips and MP4 go with the report.
      await deleteBlobs(files);
      return { id: report.id };
    }),

  /** One-click rewrite or translation of a piece of generated copy. */
  rewriteCopy: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        text: z.string().trim().min(1).max(REWRITE_MAX_CHARS),
        action: z.enum(
          Object.keys(REWRITE_ACTIONS) as [RewriteAction, ...RewriteAction[]],
        ),
        language: z.enum(LANGUAGES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      const limit = rewriteLimiter.check(ctx.userId);
      if (!limit.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many rewrites. Try again in ${Math.ceil(limit.retryAfterMs / 60_000)} min.`,
        });
      }
      try {
        return await rewriteCopy(input);
      } catch (error) {
        console.error("[report.rewriteCopy]", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't rewrite that right now. Try again shortly.",
        });
      }
    }),

  /** Writes (or rewrites) the map video's script and voiceover. */
  generateVideo: protectedProcedure
    .input(z.object({ id: z.string().uuid(), travelMode }))
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      if (report.property?.latitude == null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "The video needs the property's location first.",
        });
      }
      const video = getVideoSection(report);
      if (isVideoWorking(video)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The video is already being made.",
        });
      }
      if (isRenderActive(video)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Wait for the MP4 export to finish before rewriting.",
        });
      }
      const limit = videoLimiter.check(ctx.userId);
      if (!limit.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many videos. Try again in ${Math.ceil(limit.retryAfterMs / 60_000)} min.`,
        });
      }
      await queueReportVideo(report.id, input.travelMode);
      return { ok: true };
    }),

  /** Exports the current video to an MP4 (rendered in the background). */
  renderVideo: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      const video = getVideoSection(report);
      if (!video?.script || video.status !== "ready") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Create the video before exporting it.",
        });
      }
      if (!blobConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Exporting needs file storage, which isn't set up yet.",
        });
      }
      if (isRenderActive(video)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The MP4 is already being exported.",
        });
      }
      // Already exported for this script: nothing to do.
      if (currentRender(video)?.status === "ready") return { ok: true };
      const limit = renderLimiter.check(ctx.userId);
      if (!limit.success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many exports. Try again in ${Math.ceil(limit.retryAfterMs / 60_000)} min.`,
        });
      }
      await queueVideoRender(report.id, video);
      return { ok: true };
    }),

  /** Re-runs one step: a failed section, or regenerating the AI copy. */
  rerunJob: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        kind: jobKind,
        /** Current travel mode: the AI copy is rewritten with it. */
        travelMode: travelMode.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const report = await reportStore.findForUser(input.id, ctx.userId);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      const job = report.jobs.find((j) => j.kind === input.kind);
      if (job && (job.status === "queued" || job.status === "running")) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That section is already being prepared.",
        });
      }
      if (input.kind === JOB_KINDS.ai && input.travelMode) {
        await reportStore.setSection(report.id, SECTION_KEYS.copySettings, {
          travelMode: input.travelMode,
        });
      }
      await queueReportJob(report.id, input.kind);
      return { ok: true };
    }),
});
