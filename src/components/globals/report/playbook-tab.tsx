"use client";

import {
  ClipboardCheckIcon,
  MessageCircleQuestionIcon,
  MessagesSquareIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
  UserRoundIcon,
} from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { InsightsData, MarketingData } from "@/lib/report-sections";
import { CopyButton } from "./copy-button";
import { DashCard } from "./dash-card";

// Checklist ticks are a per-agent convenience, kept in this browser only.
const CHANGE_EVENT = "playbook-checklist";
const storageKey = (reportId: string) => `playbook-checklist:${reportId}`;

function readTicks(reportId: string): string {
  try {
    return localStorage.getItem(storageKey(reportId)) ?? "[]";
  } catch {
    return "[]";
  }
}

function useChecklist(reportId: string) {
  const raw = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(CHANGE_EVENT, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(CHANGE_EVENT, notify);
      };
    },
    () => readTicks(reportId),
    () => "[]",
  );
  let ticked: number[] = [];
  try {
    ticked = JSON.parse(raw) as number[];
  } catch {}

  const save = (next: number[]) => {
    try {
      localStorage.setItem(storageKey(reportId), JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return {
    ticked: new Set(ticked),
    toggle: (i: number, on: boolean) =>
      save(on ? [...new Set([...ticked, i])] : ticked.filter((t) => t !== i)),
    reset: () => save([]),
  };
}

export function PlaybookTab({
  reportId,
  insights,
  playbook,
}: {
  reportId: string;
  insights: InsightsData | null;
  playbook: MarketingData["playbook"];
}) {
  const checklist = useChecklist(reportId);
  const done = playbook.showingChecklist.filter((_, i) =>
    checklist.ticked.has(i),
  ).length;
  const total = playbook.showingChecklist.length;

  // Watch-outs (from the data) and objections (likely buyer pushback), with
  // the answer one click away.
  const questions = [
    ...(insights?.watchOuts ?? []).map((w) => ({
      kind: "watch-out" as const,
      question: w.title,
      context: w.detail,
      answer: w.reframe,
    })),
    ...playbook.objections.map((o) => ({
      kind: "objection" as const,
      question: o.objection,
      context: null,
      answer: o.response,
    })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <DashCard
        title="Likely buyer"
        icon={UserRoundIcon}
        className="lg:col-span-5"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center bg-primary/10 text-primary">
            <UserRoundIcon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold">
              {playbook.buyerProfile.title}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              {playbook.buyerProfile.summary}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-foreground/55">
          What they want
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {playbook.buyerProfile.motivations.map((m) => (
            <Badge
              key={m}
              variant="outline"
              className="h-auto px-2.5 py-1 font-normal"
            >
              {m}
            </Badge>
          ))}
        </div>
      </DashCard>

      <DashCard
        title="Talking points"
        icon={MessagesSquareIcon}
        action={
          <CopyButton
            text={playbook.talkingPoints
              .map((p, i) => `${i + 1}. ${p}`)
              .join("\n")}
            label="Copy all"
          />
        }
        className="lg:col-span-7"
      >
        <ol className="divide-y">
          {playbook.talkingPoints.map((point, i) => (
            <li key={point} className="flex items-start gap-3 py-2.5">
              <span className="grid size-6 shrink-0 place-items-center bg-foreground text-xs font-semibold text-background tabular-nums">
                {i + 1}
              </span>
              <span className="text-sm">{point}</span>
            </li>
          ))}
        </ol>
      </DashCard>

      <DashCard
        title="Tough questions"
        icon={MessageCircleQuestionIcon}
        className="lg:col-span-7"
        bodyClassName="py-0"
      >
        <Accordion>
          {questions.map((q) => (
            <AccordionItem
              key={q.question}
              className="border-b last:border-b-0"
            >
              <AccordionTrigger className="items-center gap-3 py-3.5 text-sm font-medium hover:no-underline">
                <span className="flex min-w-0 items-center gap-3">
                  {q.kind === "watch-out" ? (
                    <TriangleAlertIcon
                      aria-hidden
                      className="size-4 shrink-0 text-amber-600"
                    />
                  ) : (
                    <MessageCircleQuestionIcon
                      aria-hidden
                      className="size-4 shrink-0 text-foreground/50"
                    />
                  )}
                  <span className="text-left">
                    {q.kind === "objection" ? (
                      <>&ldquo;{q.question}&rdquo;</>
                    ) : (
                      q.question
                    )}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4 pl-7">
                {q.context && (
                  <p className="text-xs text-foreground/55">{q.context}</p>
                )}
                <p className="mt-1.5 border-l-[3px] border-primary bg-muted/50 py-2 pr-2 pl-3 text-sm text-foreground/85">
                  {q.answer}
                </p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DashCard>

      <DashCard
        title="Showing checklist"
        icon={ClipboardCheckIcon}
        action={
          done > 0 && (
            <Button variant="ghost" size="sm" onClick={checklist.reset}>
              <RotateCcwIcon data-icon="inline-start" />
              Reset
            </Button>
          )
        }
        className="lg:col-span-5"
      >
        <div className="mb-3 flex items-center gap-3">
          <Progress
            value={total ? (done / total) * 100 : 0}
            className="flex-1"
          />
          <span className="text-xs font-medium text-foreground/60 tabular-nums">
            {done}/{total}
          </span>
        </div>
        <ul className="space-y-1">
          {playbook.showingChecklist.map((item, i) => {
            const id = `check-${reportId}-${i}`;
            const checked = checklist.ticked.has(i);
            return (
              <li key={item} className="flex items-start gap-3 py-1.5">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(on) => checklist.toggle(i, Boolean(on))}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={id}
                  className={
                    "text-sm leading-snug font-normal " +
                    (checked ? "text-foreground/45 line-through" : "")
                  }
                >
                  {item}
                </Label>
              </li>
            );
          })}
        </ul>
      </DashCard>
    </div>
  );
}
