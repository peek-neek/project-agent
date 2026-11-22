"use client";

import { CreditCardIcon, GaugeIcon, SparklesIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { type BillingStatus, PlansDialog } from "./plans-dialog";

export type { BillingStatus };

/** Why the address box is asking before making a report. */
export type Gate = "no_plan" | "limit" | "credit";

const PENDING_KEY = "pending-report-address";

/**
 * Keeps the typed address across a trip to Stripe Checkout, so the agent
 * doesn't retype it after paying. Per-tab, best effort.
 */
export function savePendingAddress(address: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, address);
  } catch {}
}
export function takePendingAddress(): string | null {
  try {
    const value = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    return value;
  } catch {
    return null;
  }
}

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });
const money = (n: number) => `C$${n.toLocaleString("en-CA")}`;

/**
 * Shown when the agent submits an address but a report can't simply start:
 * no plan (pick one), this month's reports used up (buy an extra report or
 * upgrade), or the report would spend an extra-report credit (confirm).
 * Every payment goes through Stripe; nothing is charged from this dialog.
 */
export function ReportGateDialog({
  gate,
  status,
  address,
  onClose,
  onConfirmCredit,
}: {
  gate: Gate | null;
  status: BillingStatus | undefined;
  address: string;
  onClose: () => void;
  /** "credit": the agent agreed to use one extra report. */
  onConfirmCredit: () => void;
}) {
  const keepAddress = () => savePendingAddress(address);

  if (gate === "no_plan") {
    return (
      <PlansDialog
        open
        onOpenChange={(open) => !open && onClose()}
        status={status}
        onLeave={keepAddress}
      />
    );
  }

  if (!status?.active || (gate !== "limit" && gate !== "credit")) return null;

  const resets = status.reportsResetAt
    ? dateFormat.format(new Date(status.reportsResetAt))
    : null;
  const pro = status.plans.find((p) => p.id === "pro");

  if (gate === "credit") {
    const credits = status.extraReportCredits;
    return (
      <AlertDialog open onOpenChange={(open) => !open && onClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <SparklesIcon />
            </AlertDialogMedia>
            <AlertDialogTitle>Use an extra report?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve used this month&apos;s {status.reportsLimit}{" "}
              {status.planName} reports. This report uses 1 of your {credits}{" "}
              extra report{credits === 1 ? "" : "s"} (already paid, no new
              charge).
              {resets ? ` Plan reports reset on ${resets}.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <Button onClick={onConfirmCredit}>Use 1 extra report</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // gate === "limit": nothing left this month.
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <GaugeIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>
            You&apos;ve used your {status.reportsLimit} {status.planName} reports
            this month
          </AlertDialogTitle>
          <AlertDialogDescription>
            {resets
              ? `Your plan reports reset on ${resets}. `
              : ""}
            Need this report now? You have two options:
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <p className="font-medium">
              Buy an extra report: {money(status.extraReportPrice)}
            </p>
            <p className="text-foreground/65">
              A one-time payment through Stripe Checkout (plus sales tax), with
              a receipt you can expense. You can buy several at once. Extra
              reports never expire and are only used after your monthly
              reports run out. Your address is kept, so you can create the
              report as soon as you&apos;re back.
            </p>
          </div>
          {status.plan === "starter" && pro && (
            <>
              <Separator />
              <div className="grid gap-1">
                <p className="font-medium">
                  Upgrade to Pro: {pro.reports} reports a month
                </p>
                <p className="text-foreground/65">
                  {money(status.interval === "annual" ? pro.annual : pro.monthly)}{" "}
                  / {status.interval === "annual" ? "year" : "month"}. You pay
                  only the prorated difference for the rest of this billing
                  period, and the higher allowance applies straight away.
                </p>
              </div>
            </>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          {status.plan === "starter" && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href="/billing/portal" onClick={keepAddress} />}
            >
              Upgrade to Pro
            </Button>
          )}
          <Button
            nativeButton={false}
            render={
              <a href="/billing/extra-reports?quantity=1" onClick={keepAddress} />
            }
          >
            <CreditCardIcon data-icon="inline-start" />
            Buy extra report
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
