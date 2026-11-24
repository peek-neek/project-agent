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
   * again on every report and chat turn). Agents without a subscription are
   * on Basic (a free report and a few chat messages, never reset). Dates are
   * ISO strings: no superjson transformer here.
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
    const reportsLeft = Math.max(
      0,
      entitlement.reportsLimit - entitlement.reportsUsed,
    );
    return {
      /** False on Basic (free, no Stripe subscription). */
      subscribed: entitlement.subscribed,
      plan: entitlement.plan,
      planName: entitlement.planName,
      interval: entitlement.interval,
      /** Stripe status of the subscription, or of a past one on Basic. */
      status: entitlement.status,
      reportsUsed: entitlement.reportsUsed,
      reportsLimit: entitlement.reportsLimit,
      reportsLeft,
      extraReportCredits: entitlement.extraReportCredits,
      /** A new report would spend an extra-report credit. */
      usesCredit: reportsLeft === 0 && entitlement.extraReportCredits > 0,
      /** No plan (or free) reports and no credits left: a report is refused. */
      blocked: reportsLeft === 0 && entitlement.extraReportCredits === 0,
      reportsResetAt: entitlement.reportsResetAt?.toISOString() ?? null,
      chatUsed: entitlement.chatUsed,
      chatLimit: entitlement.chatLimit,
      plans,
      extraReportPrice: extra.amount,
    };
  }),
});
