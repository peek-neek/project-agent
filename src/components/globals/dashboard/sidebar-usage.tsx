"use client";

import { SparklesIcon } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { PlansDialog, useBillingStatus } from "./plans-dialog";
import { ReportGateDialog } from "./report-gate-dialog";

const dateFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric" });
const money = (n: number) => `C$${n.toLocaleString("en-CA")}`;

/*
 * Expanded vs collapsed is chosen with CSS (the sidebar's
 * data-collapsible="icon"), never in JS: the collapsed state is restored by
 * an inline script before hydration, so branching on it in render would
 * make the server HTML and the first client render differ.
 */
const EXPANDED = "group-data-[collapsible=icon]:hidden";
const COLLAPSED = "hidden group-data-[collapsible=icon]:block";

/** A small ring for the collapsed sidebar: the share of reports left. */
function UsageRing({ left, limit, empty }: { left: number; limit: number; empty: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  const share = limit > 0 ? Math.min(1, left / limit) : 0;
  return (
    <span className="relative grid size-6 shrink-0 place-items-center">
      <svg viewBox="0 0 24 24" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r={r} fill="none" strokeWidth="2.5" className="stroke-sidebar-border" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            empty ? "stroke-destructive" : "stroke-primary",
          )}
        />
      </svg>
      <span className={cn("text-[10px] font-semibold tabular-nums", empty && "text-destructive")}>
        {left}
      </span>
    </span>
  );
}

/**
 * Above the account menu: reports left this month (a bar, or a ring when the
 * sidebar is collapsed), or a prompt to pick a plan. Both open a popup.
 */
export function SidebarUsage() {
  const { data: status, isPending } = useBillingStatus();
  const { setOpen } = useSidebar();
  const [plansOpen, setPlansOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);

  if (isPending || !status) {
    // One element sized by CSS for either state (no hydration mismatch).
    return (
      <Skeleton className="h-[74px] w-full group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8" />
    );
  }

  const dialogs = (
    <>
      <PlansDialog open={plansOpen} onOpenChange={setPlansOpen} status={status} />
      <ReportGateDialog
        gate={limitOpen ? "limit" : null}
        status={status}
        address=""
        onClose={() => setLimitOpen(false)}
        onConfirmCredit={() => setLimitOpen(false)}
      />
    </>
  );

  // No plan: a prompt to pick one.
  if (!status.active) {
    const from = Math.min(...status.plans.map((p) => p.monthly));
    return (
      <>
        <SidebarMenu className={COLLAPSED}>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="No plan yet: choose one to run reports"
              onClick={() => setPlansOpen(true)}
              className="justify-center"
            >
              <SparklesIcon className="text-primary" />
              <span className="sr-only">Choose a plan</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className={cn("grid gap-2 border bg-background p-3", EXPANDED)}>
          <div className="flex items-start gap-2">
            <SparklesIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="grid gap-0.5">
              <p className="text-sm font-medium">No plan yet</p>
              <p className="text-xs text-foreground/60">
                From {money(from)} a month for 3–10 reports, AI chat and the PDF.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => setPlansOpen(true)}>
            Choose a plan
          </Button>
        </div>
        {dialogs}
      </>
    );
  }

  // A plan: reports left this month.
  const { reportsLeft: left, reportsLimit: limit, extraReportCredits: extras } = status;
  const empty = left === 0 && extras === 0;
  const resets = status.reportsResetAt ? dateFormat.format(new Date(status.reportsResetAt)) : null;
  const summary = `${left} of ${limit} reports left${extras ? `, +${extras} extra` : ""}`;

  return (
    <>
      <SidebarMenu className={COLLAPSED}>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={`${summary}${resets ? ` · resets ${resets}` : ""}`}
            onClick={() => (status.blocked ? setLimitOpen(true) : setOpen(true))}
            className="justify-center"
          >
            <UsageRing left={left} limit={limit} empty={empty} />
            <span className="sr-only">{summary}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <div className={cn("grid gap-2 border bg-background p-3", EXPANDED)}>
        <Progress
          value={limit > 0 ? (left / limit) * 100 : 0}
          className={cn("gap-2", empty && "[&_[data-slot=progress-indicator]]:bg-destructive")}
        >
          <ProgressLabel className="text-xs font-medium text-foreground/70">
            Reports left
          </ProgressLabel>
          <span
            className={cn(
              "ml-auto text-xs font-semibold tabular-nums",
              empty && "text-destructive",
            )}
          >
            {left} of {limit}
          </span>
        </Progress>
        <p className="text-xs text-foreground/55">
          {status.planName}
          {resets ? ` · resets ${resets}` : ""}
          {extras ? ` · +${extras} extra` : ""}
        </p>
        {status.blocked && (
          <Button size="sm" variant="outline" onClick={() => setLimitOpen(true)}>
            Get more reports
          </Button>
        )}
      </div>
      {dialogs}
    </>
  );
}
