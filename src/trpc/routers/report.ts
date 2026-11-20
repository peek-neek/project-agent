import { TRPCError } from "@trpc/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import type { UIMessage } from "ai";
import { z } from "zod";
import {
  JOB_KINDS,
  type JobKind,
  listingInputSchema,
  SECTION_KEYS,
} from "@/lib/report-sections";
import {
  cancelReportRuns,
  queueReportGeneration,
  queueReportJob,
} from "@/server/jobs";
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
import { createTRPCRouter, protectedProcedure } from "../init";

const token = (max: number) =>
  z
    .string()
    .regex(new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`))
    .optional()
    .catch(undefined);

const travelMode = z.enum(travelModes);

/** Roughly Ontario, so a pin can't land somewhere we have no data. */
const ONTARIO_BOX = { south: 41.6, north: 57, west: -95.2, east: -74.3 };

export const createReportInput = z.object({
  address: z.string().trim().min(3).max(500),
  mode: z.enum(reportModes).catch("single"),
  /** The agent's walk / bike / drive choice, for the AI copy's times. */
  travelMode: travelMode.catch("walk"),
  placeId: token(300),
  sessionToken: token(64),
  /** A pin the agent dropped (new builds, rural lots): skips the lookup. */
  lat: z.coerce
    .number()
    .min(ONTARIO_BOX.south)
    .max(ONTARIO_BOX.north)
    .optional()
    .catch(undefined),
  lng: z.coerce
    .number()
    .min(ONTARIO_BOX.west)
    .max(ONTARIO_BOX.east)
    .optional()
    .catch(undefined),
});

/** AI rewrites per agent: generous for real use, a ceiling on runaway cost. */
const rewriteLimiter = createRateLimiter("report:rewrite", [
  { limit: 30, windowMs: 10 * 60_000 },
  { limit: 300, windowMs: 24 * 60 * 60_000 },
]);

const jobKind = z.enum(Object.values(JOB_KINDS) as [JobKind, ...JobKind[]]);

export const reportRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createReportInput)
    .mutation(async ({ ctx, input }) => {
      const { sessionToken, travelMode, lat, lng, ...data } = input;
      const pin = lat != null && lng != null ? { lat, lng } : null;
      // A double submit returns the report it already started.
      const { report, created } = await reportStore.createUnlessRecent({
        userId: ctx.userId,
        ...data,
      });
      if (!created) return report;
      await reportStore.setSection(report.id, SECTION_KEYS.copySettings, {
        travelMode,
      });
      if (pin) {
        // The identity step sees the pin and fills in the town from it.
        const asOf = new Date().toISOString();
        await reportStore.saveIdentity(
          report.id,
          {
            formattedAddress: data.address,
            latitude: pin.lat,
            longitude: pin.lng,
            province: "ON",
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
    }),

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
      await reportStore.deleteForUser(report.id, ctx.userId);
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
