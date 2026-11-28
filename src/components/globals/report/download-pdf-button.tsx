"use client";

import { cn } from "cn";
import { AlertCircleIcon, DownloadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTravelMode } from "@/components/globals/travel-mode";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AgentBrandingTab,
  useBrandingDraft,
} from "@/components/globals/branding/agent-branding-tab";
import { Label } from "@/components/ui/label";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  isPdfSectionId,
  PDF_SECTIONS,
  type PdfSectionId,
} from "@/lib/pdf-sections";

/**
 * Sections the agent left out last time. Stored as the left-out ones, so a
 * section added later starts ticked.
 */
const STORAGE_KEY = "pdf:excluded-sections:v1";

function readExcluded(): Set<PdfSectionId> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return new Set(
      Array.isArray(raw)
        ? raw.filter(
            (x): x is PdfSectionId =>
              typeof x === "string" && isPdfSectionId(x),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeExcluded(excluded: Set<PdfSectionId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...excluded]));
  } catch {
    // Storage blocked: the choice applies to this download only.
  }
}

/** File name from the server's Content-Disposition, if it sent one. */
function fileName(res: Response) {
  const match = res.headers
    .get("content-disposition")
    ?.match(/filename="?([^";]+)"?/);
  return match?.[1] ?? "property-report.pdf";
}

/**
 * The server doesn't report how far along the layout is, so the wait is an
 * estimate: it eases toward this share over a few seconds and never stalls
 * at a fixed point. The file's own download fills the rest.
 */
const BUILD_SHARE = 90;
const BUILD_EASE_MS = 8_000;

/**
 * Downloads the report as a PDF file (built on the server). First a dialog
 * picks the sections (remembered for next time); while it builds, the button
 * becomes a progress bar of the same size. The AI copy follows the selected
 * travel mode.
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
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"report" | "agent">("report");
  const brand = useBrandingDraft();
  const [excluded, setExcluded] = useState<Set<PdfSectionId>>(new Set());
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const ticker = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(ticker.current), []);

  const included = PDF_SECTIONS.filter((s) => !excluded.has(s.id));

  const openDialog = () => {
    // Read on open (not during render): storage only exists in the browser.
    setExcluded(readExcluded());
    brand.reset();
    void brand.query.refetch();
    setTab("report");
    setOpen(true);
  };

  const toggle = (id: PdfSectionId, checked: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(id);
      else next.add(id);
      return next;
    });

  const download = async () => {
    if (included.length === 0) return;
    // The agent's edits go into this PDF, so save them first.
    if (brand.error) {
      setTab("agent");
      return;
    }
    try {
      await brand.saveIfChanged();
    } catch {
      setTab("agent"); // the tab shows the error
      return;
    }
    writeExcluded(excluded);
    setOpen(false);
    setState("loading");
    setProgress(0);
    const started = Date.now();
    clearInterval(ticker.current);
    ticker.current = setInterval(() => {
      const t = Date.now() - started;
      setProgress(BUILD_SHARE * (1 - Math.exp(-t / (BUILD_EASE_MS / 3))));
    }, 150);

    try {
      const query = new URLSearchParams({ mode });
      // Everything ticked: no filter, so new sections are never dropped.
      if (excluded.size > 0) {
        query.set("sections", included.map((s) => s.id).join(","));
      }
      const res = await fetch(`/api/reports/${reportId}/pdf?${query}`);
      clearInterval(ticker.current);
      if (!res.ok || !res.body) throw new Error(`PDF ${res.status}`);

      // The file itself: real progress when the size is known.
      const total = Number(res.headers.get("content-length")) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      setProgress((p) => Math.max(p, BUILD_SHARE));
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) {
          setProgress(
            BUILD_SHARE + (100 - BUILD_SHARE) * Math.min(1, received / total),
          );
        }
      }
      setProgress(100);

      const url = URL.createObjectURL(
        new Blob(chunks, { type: "application/pdf" }),
      );
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
      clearInterval(ticker.current);
      console.error("[pdf]", error);
      setState("error");
    }
  };

  const loading = state === "loading";
  return (
    <>
      {loading ? (
        // Same box as the button (the caller's size), so the row never shifts.
        <Progress
          value={progress}
          aria-label="Downloading PDF"
          className={cn(
            "relative gap-0 *:data-[slot=progress-track]:h-full *:data-[slot=progress-track]:ring-1 *:data-[slot=progress-track]:ring-border **:data-[slot=progress-indicator]:bg-primary/35",
            className,
            "p-0 sm:p-0",
          )}
        >
          <ProgressLabel className="absolute inset-0 z-10 flex items-center justify-center text-sm font-medium tabular-nums">
            {Math.round(progress)}%
          </ProgressLabel>
        </Progress>
      ) : (
        <Button
          onClick={openDialog}
          disabled={disabled}
          variant={state === "error" ? "destructive" : "default"}
          className={className}
        >
          {state === "error" ? (
            <AlertCircleIcon data-icon="inline-start" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          {state === "error" ? "Try again" : label}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="grid-cols-1 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Download PDF</DialogTitle>
            <DialogDescription>
              {tab === "report"
                ? "Untick anything you don't want in the PDF. Your choice is remembered for next time. Sections without data yet are left out either way."
                : "Who the PDF is from: shown at the bottom left of every page."}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="w-full">
              <TabsTrigger value="report">Report data</TabsTrigger>
              <TabsTrigger value="agent">Agent / broker</TabsTrigger>
            </TabsList>
            <TabsContent value="report" className="space-y-3 pt-3">
              <div className="flex flex-wrap gap-2">
                {PDF_SECTIONS.map((s) => (
                  <Label
                    key={s.id}
                    className="cursor-pointer gap-2 border bg-card px-3 py-2 font-normal transition-colors hover:bg-muted has-data-checked:border-foreground/30"
                  >
                    <Checkbox
                      checked={!excluded.has(s.id)}
                      onCheckedChange={(checked) => toggle(s.id, checked)}
                    />
                    {s.label}
                  </Label>
                ))}
              </div>

              <div className="flex items-center gap-1 text-xs text-foreground/60">
                <span className="mr-auto">
                  {included.length} of {PDF_SECTIONS.length} sections
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setExcluded(new Set())}
                  disabled={excluded.size === 0}
                >
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setExcluded(new Set(PDF_SECTIONS.map((s) => s.id)))
                  }
                  disabled={included.length === 0}
                >
                  Clear
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="agent" className="pt-3">
              <AgentBrandingTab draft={brand} />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={download}
              disabled={included.length === 0 || brand.saving}
            >
              {brand.saving ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <DownloadIcon data-icon="inline-start" />
              )}
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
