"use client";

import { AlertCircleIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import { useTravelMode } from "@/components/globals/travel-mode";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** File name from the server's Content-Disposition, if it sent one. */
function fileName(res: Response) {
  const match = res.headers
    .get("content-disposition")
    ?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? "property-report.pdf";
}

/**
 * Downloads the report as a PDF file (built on the server) instead of
 * opening the print dialog. The AI copy follows the selected travel mode.
 */
export function DownloadPdfButton({
  reportId,
  disabled,
  label = "PDF",
  className,
}: {
  reportId: string;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const { mode } = useTravelMode();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const download = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/reports/${reportId}/pdf?mode=${mode}`);
      if (!res.ok) throw new Error(`PDF ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(res);
      document.body.append(link);
      link.click();
      link.remove();
      // Give the browser a moment to start the download before freeing it.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState("idle");
    } catch (error) {
      console.error("[pdf]", error);
      setState("error");
    }
  };

  const loading = state === "loading";
  return (
    <Button
      onClick={download}
      disabled={disabled || loading}
      aria-busy={loading}
      variant={state === "error" ? "destructive" : "default"}
      className={className}
    >
      {loading ? (
        <Spinner data-icon="inline-start" />
      ) : state === "error" ? (
        <AlertCircleIcon data-icon="inline-start" />
      ) : (
        <DownloadIcon data-icon="inline-start" />
      )}
      {loading ? "Preparing…" : state === "error" ? "Try again" : label}
    </Button>
  );
}
