import {
  CircleCheckIcon,
  MessageSquareQuoteIcon,
  SunIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { InsightsData } from "@/lib/report-sections";
import { ReportSubsection } from "./report-layout";

export function StorySection({ insights }: { insights: InsightsData }) {
  return (
    <>
      <div className="break-inside-avoid">
        <p className="text-xl leading-snug font-semibold tracking-tight text-balance">
          {insights.headline}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/75">
          {insights.summary}
        </p>
      </div>

      <Card className="break-inside-avoid gap-2 bg-muted/60 px-5 py-5 ring-0 print:bg-muted/40">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <SunIcon aria-hidden className="size-4 text-primary" />A day in this
          neighbourhood
        </p>
        <p className="text-sm leading-relaxed text-foreground/80">
          {insights.dayInTheLife}
        </p>
      </Card>

      <ReportSubsection title="Top highlights" icon={CircleCheckIcon}>
        <ol className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
          {insights.highlights.slice(0, 5).map((h, i) => (
            <li
              key={h.title}
              className="flex break-inside-avoid gap-3 p-3 ring-1 ring-border print:border print:border-border print:ring-0"
            >
              <span className="grid size-6 shrink-0 place-items-center bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-semibold">{h.title}</span>
                <span className="mt-0.5 block text-sm text-foreground/70">
                  {h.detail}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </ReportSubsection>

      <ReportSubsection title="Watch-outs" icon={TriangleAlertIcon}>
        <ul className="space-y-3">
          {insights.watchOuts.slice(0, 3).map((w) => (
            <li
              key={w.title}
              className="break-inside-avoid p-4 ring-1 ring-border print:border print:border-border print:ring-0"
            >
              <p className="flex items-center gap-2 text-sm font-semibold">
                <TriangleAlertIcon
                  aria-hidden
                  className="size-4 text-amber-600"
                />
                {w.title}
              </p>
              <p className="mt-1 text-sm text-foreground/70">{w.detail}</p>
              <p className="mt-2 flex gap-2 text-sm text-foreground/80">
                <MessageSquareQuoteIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                <span>
                  <span className="font-medium">How to address it: </span>
                  {w.reframe}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </ReportSubsection>
    </>
  );
}
