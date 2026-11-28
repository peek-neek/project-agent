import { TRPCError } from "@trpc/server";
import { agentBrandingInputSchema } from "@/lib/branding";
import {
  appLogoUrl,
  brandingFor,
  getAgentBranding,
  isProAgent,
  removeLogo,
  saveAgentBranding,
  toInput,
} from "@/server/branding";
import { createTRPCRouter, protectedProcedure } from "../init";

export const brandingRouter = createTRPCRouter({
  /**
   * The agent's saved details (for the "Agent / broker" tab), whether they
   * can use them (Pro), and the branding their PDFs and videos carry now.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const [pro, row, applied] = await Promise.all([
      isProAgent(ctx.userId),
      getAgentBranding(ctx.userId),
      brandingFor(ctx.userId, appLogoUrl),
    ]);
    return {
      pro,
      input: toInput(row),
      logoUrl: row?.logoPath ? appLogoUrl(row.logoPath, row.updatedAt) : null,
      applied,
    };
  }),

  save: protectedProcedure
    .input(agentBrandingInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!(await isProAgent(ctx.userId))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Your own branding is part of the Pro plan.",
        });
      }
      await saveAgentBranding(ctx.userId, input);
      return { ok: true };
    }),

  removeLogo: protectedProcedure.mutation(async ({ ctx }) => {
    await removeLogo(ctx.userId);
    return { ok: true };
  }),
});
