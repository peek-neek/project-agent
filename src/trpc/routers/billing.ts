import {
  getEntitlement,
  getExtraReportPrice,
  getPlanPrices,
  PLANS,
} from "@/server/billing";
import { createTRPCRouter, protectedProcedure } from "../init";

export const billingRouter = createTRPCRouter({
  /**
   * What the agent can do right now, for the UI's gates (the server checks
   * again on every report and chat turn). Dates are ISO strings: no
   * superjson transformer here.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const [entitlement, planPrices, extra] = await Promise.all([
      getEntitlement(ctx.userId),
      getPlanPrices(),
      getExtraReportPrice(),
    ]);
    const plans = (Object.keys(PLANS) as (keyof typeof PLANS)[]).map((id) => ({
      id,
      name: PLANS[id].name,
      reports: PLANS[id].reports,
      chat: PLANS[id].chat,
      monthly: planPrices[id].monthly.amount,
      annual: planPrices[id].annual.amount,
    }));
    if (!entitlement.active) {
      return {
        active: false as const,
        status: entitlement.status,
        plans,
        extraReportPrice: extra.amount,
      };
    }
    const reportsLeft = Math.max(0, entitlement.reportsLimit - entitlement.reportsUsed);
    return {
      active: true as const,
      plan: entitlement.plan,
      planName: entitlement.planName,
      interval: entitlement.interval,
      status: entitlement.status,
      reportsUsed: entitlement.reportsUsed,
      reportsLimit: entitlement.reportsLimit,
      reportsLeft,
      extraReportCredits: entitlement.extraReportCredits,
      /** A new report would spend an extra-report credit. */
      usesCredit: reportsLeft === 0 && entitlement.extraReportCredits > 0,
      /** No plan reports and no credits left: a new report is refused. */
      blocked: reportsLeft === 0 && entitlement.extraReportCredits === 0,
      reportsResetAt: entitlement.reportsResetAt?.toISOString() ?? null,
      chatUsed: entitlement.chatUsed,
      chatLimit: entitlement.chatLimit,
      plans,
      extraReportPrice: extra.amount,
    };
  }),
});
