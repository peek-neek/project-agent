import { auth as triggerAuth } from "@trigger.dev/sdk";
import { TRPCError } from "@trpc/server";
import type { UIMessage } from "ai";
import { z } from "zod";
import { BILLING_ERRORS } from "@/lib/billing";
import { getEntitlement } from "@/server/billing";
import { comparisonStore } from "@/server/comparison-store";
import { createTRPCRouter, protectedProcedure } from "../init";
import { createReportInput, startReport } from "./report";

const token = (max: number) =>
  z
    .string()
    .regex(new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`))
    .optional()
    .catch(undefined);

/**
 * The compare form: the first property in the usual report fields, the
 * second in their `compare…` twins.
 */
export const createComparisonInput = createReportInput
  .pick({ address: true, travelMode: true, placeId: true, sessionToken: true })
  .extend({
    compareAddress: z.string().trim().min(3).max(500),
    comparePlaceId: token(300),
    compareSessionToken: token(64),
  });

export const comparisonRouter = createTRPCRouter({
  /**
   * Makes (or reuses) a report for each property, then the comparison.
   * Reports the agent already has for either address (last 30 days) are
   * reused and cost nothing; each new one counts as a report.
   */
  create: protectedProcedure
    .input(createComparisonInput)
    .mutation(async ({ ctx, input }) => {
      const sides = [
        {
          address: input.address,
          placeId: input.placeId,
          sessionToken: input.sessionToken,
        },
        {
          address: input.compareAddress,
          placeId: input.comparePlaceId,
          sessionToken: input.compareSessionToken,
        },
      ];
      const [a, b] = sides;
      if (
        a.address.toLowerCase() === b.address.toLowerCase() ||
        (a.placeId && a.placeId === b.placeId)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pick two different properties to compare.",
        });
      }

      const reusable = await Promise.all(
        sides.map((side) =>
          comparisonStore.findReusableReport(ctx.userId, side),
        ),
      );
      // Check there's room for every new report before making any, so a
      // comparison never stops half made.
      const needed = reusable.filter((r) => !r).length;
      if (needed > 0) {
        // Plan or Basic allowance left, plus extra-report credits.
        const entitlement = await getEntitlement(ctx.userId);
        const available =
          Math.max(0, entitlement.reportsLimit - entitlement.reportsUsed) +
          entitlement.extraReportCredits;
        if (available < needed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            // Nothing left at all reads like any refused report.
            message:
              available === 0
                ? BILLING_ERRORS.limit
                : BILLING_ERRORS.compareLimit,
          });
        }
      }

      // One after the other: each reads the allowance the last one used.
      const reports = [];
      for (const [i, side] of sides.entries()) {
        reports.push(
          reusable[i] ??
            (await startReport(ctx.userId, {
              ...side,
              mode: "compare",
              travelMode: input.travelMode,
            })),
        );
      }
      return comparisonStore.createUnlessRecent({
        userId: ctx.userId,
        reportAId: reports[0].id,
        reportBId: reports[1].id,
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(100) }))
    .query(({ ctx, input }) =>
      comparisonStore.findForUser(input.id, ctx.userId),
    ),

  /**
   * The comparison's chat thread for its chat page: chat id and messages,
   * plus a session token once the conversation exists, so the browser can
   * reconnect to an answer still being written (after a reload).
   */
  chatThread: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const comparison = await comparisonStore.findForUser(
        input.id,
        ctx.userId,
      );
      if (!comparison) throw new TRPCError({ code: "NOT_FOUND" });
      const thread = await comparisonStore.ensureChatThread(comparison.id);
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

  /** Comparison history for the dashboard sidebar. */
  list: protectedProcedure.query(({ ctx }) =>
    comparisonStore.listForUser(ctx.userId),
  ),

  /** Renames a comparison. An empty name restores "A vs B". */
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
      const ok = await comparisonStore.renameForUser(
        input.id,
        ctx.userId,
        input.name,
      );
      if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id, name: input.name };
    }),

  /** Deletes the comparison; both property reports stay in the history. */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await comparisonStore.deleteForUser(input.id, ctx.userId);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND" });
      return { id: input.id };
    }),
});
