"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";
import type { AppRouter } from "@/trpc/routers/_app";
import { PlanPicker } from "./plan-picker";

export type BillingStatus = inferRouterOutputs<AppRouter>["billing"]["status"];

/** The agent's plan and allowance (signed-in users only). */
export function useBillingStatus(opts: { fresh?: boolean } = {}) {
  const trpc = useTRPC();
  const { isSignedIn } = useAuth();
  return useQuery({
    ...trpc.billing.status.queryOptions(),
    enabled: Boolean(isSignedIn),
    retry: false,
    ...(opts.fresh ? { staleTime: 0, refetchOnMount: "always" as const } : {}),
  });
}

const money = (n: number) => `C$${n.toLocaleString("en-CA")}`;

/**
 * Starter / Pro with a Monthly / Annual switch; "Choose" goes to Stripe
 * Checkout. `onLeave` runs just before that (e.g. to keep a typed address).
 */
export function PlansDialog({
  open,
  onOpenChange,
  status,
  onLeave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: BillingStatus | undefined;
  onLeave?: () => void;
}) {
  if (!status) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a plan for more reports</DialogTitle>
          <DialogDescription>
            Basic gives every account one free report to try. Plans add
            monthly reports and AI chat. Pay securely with Stripe; change
            plans or cancel anytime.
          </DialogDescription>
        </DialogHeader>
        <div onClickCapture={onLeave}>
          <PlanPicker
            plans={status.plans.map((p) => ({
              id: p.id,
              name: p.name,
              reports: p.reports,
              chat: p.chat,
              prices: { monthly: p.monthly, annual: p.annual },
            }))}
          />
        </div>
        <p className="text-xs text-foreground/55">
          Prices in Canadian dollars, plus applicable sales tax. Extra reports
          beyond your plan are {money(status.extraReportPrice)} each.
        </p>
      </DialogContent>
    </Dialog>
  );
}
