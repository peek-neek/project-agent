"use client";

import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlansDialog, useBillingStatus } from "./plans-dialog";

/** "Choose a plan to run reports. See plans": the link opens the plans popup. */
export function SeePlansPrompt({
  message = "Choose a plan to run reports.",
  tone = "muted",
}: {
  message?: string;
  tone?: "muted" | "destructive";
}) {
  const [open, setOpen] = useState(false);
  const { data: status } = useBillingStatus();
  return (
    <>
      <p
        className={cn(
          "flex flex-wrap items-center justify-center gap-x-1.5 text-sm",
          tone === "destructive" ? "text-destructive" : "text-foreground/65",
        )}
      >
        {message}
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-sm"
          onClick={() => setOpen(true)}
          disabled={!status}
        >
          See plans
        </Button>
      </p>
      <PlansDialog open={open} onOpenChange={setOpen} status={status} />
    </>
  );
}
