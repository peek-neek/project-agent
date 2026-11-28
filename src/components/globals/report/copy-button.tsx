"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  /** Visible text; "" for an icon-only button (still named for readers). */
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const iconOnly = label === "";
  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-xs" : "xs"}
      aria-label={iconOnly ? (copied ? "Copied" : "Copy") : undefined}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-foreground/65 print:hidden"
    >
      {copied ? (
        <CheckIcon data-icon="inline-start" />
      ) : (
        <CopyIcon data-icon="inline-start" />
      )}
      {/* {!iconOnly && (copied ? "Copied" : label)} */}
    </Button>
  );
}
