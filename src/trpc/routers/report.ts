import { TRPCError } from "@trpc/server";
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
import { createTRPCRouter, protectedProcedure } from "../init";

const token = (max: number) =>
  z
    .string()
    .regex(new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`))
    .optional()
    .catch(undefined);

const travelMode = z.enum(travelModes);

export const createReportInput = z.object({
  address: z.string().trim().min(3).max(500),
  mode: z.enum(reportModes).catch("single"),
  /** The agent's walk / bike / drive choice, for the AI copy's times. */
  travelMode: travelMode.catch("walk"),
  placeId: token(300),
  sessionToken: token(64),
});

const jobKind = z.enum(Object.values(JOB_KINDS) as [JobKind, ...JobKind[]]);

export const reportRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createReportInput)
    .mutation(async ({ ctx, input }) => {
      const { sessionToken, travelMode, ...data } = input;
      const report = await reportStore.create({ userId: ctx.userId, ...data });
      await reportStore.setSection(report.id, SECTION_KEYS.copySettings, {
        travelMode,
      });
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
