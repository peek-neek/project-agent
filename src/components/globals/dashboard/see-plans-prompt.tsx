"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlansDialog, useBillingStatus } from "./plans-dialog";

/**
 * A "See plans" button that opens the plans popup. Usable from server
 * components (the billing panel) and the chat.
 */
export function SeePlansButton({
  label = "See plans",
  variant = "outline",
}: {
  label?: string;
  variant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const { data: status } = useBillingStatus();
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!status}
      >
        {label}
      </Button>
      <PlansDialog open={open} onOpenChange={setOpen} status={status} />
    </>
  );
}
