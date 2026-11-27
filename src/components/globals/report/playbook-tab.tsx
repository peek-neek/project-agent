"use client";

import {
  BadgeCheckIcon,
  CalendarCheckIcon,
  ClipboardCheckIcon,
  CoffeeIcon,
  GraduationCapIcon,
  ListChecksIcon,
  type LucideIcon,
  MapIcon,
  MessageCircleQuestionIcon,
  MessageSquareTextIcon,
  MessagesSquareIcon,
  RotateCcwIcon,
  ShoppingCartIcon,
  SparklesIcon,
  TrainFrontIcon,
  TreesIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersRoundIcon,
  UtensilsCrossedIcon,
  ZapIcon,
} from "lucide-react";
import { cn } from "cn";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useTravelMode } from "@/components/globals/travel-mode";
import type {
  AmenitiesData,
  CommuteData,
  DemographicsData,
  InsightsData,
  MarketingData,
  SafetyData,
  SchoolsData,
  ShowingData,
  UpsideData,
} from "@/lib/report-sections";
import { CopyBlock } from "./copy-block";
import { CopyButton } from "./copy-button";
import { DashCard } from "./dash-card";
import { InteractiveMap, type MapPin } from "./interactive-map";
import { formatDistance, googleMapsUrl } from "./report-format";
import { fastFacts, neighbourhoodTour } from "./showing-kit";

// Checklist ticks are a per-agent convenience, kept in this browser only.
const CHANGE_EVENT = "playbook-checklist";
const storageKey = (reportId: string, list: string) =>
  `playbook-checklist:${reportId}${list === "showing" ? "" : `:${list}`}`;

function readTicks(key: string): string {
  try {
    return localStorage.getItem(key) ?? "[]";
  } catch {
    return "[]";
  }
}

/** Ticked item keys for one checklist, saved in this browser. */
function useChecklist(reportId: string, list = "showing") {
  const key = storageKey(reportId, list);
  const raw = useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(CHANGE_EVENT, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(CHANGE_EVENT, notify);
      };
    },
    () => readTicks(key),
    () => "[]",
  );
  let ticked: (number | string)[] = [];
  try {
    ticked = JSON.parse(raw) as (number | string)[];
  } catch {}

  const save = (next: (number | string)[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return {
    ticked: new Set(ticked),
    toggle: (item: number | string, on: boolean) =>
      save(
        on ? [...new Set([...ticked, item])] : ticked.filter((t) => t !== item),
      ),
    reset: () => save([]),
  };
}

/** One tickable item. */
function Tick({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <li className="flex items-start gap-3 py-1.5">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(on) => onChange(Boolean(on))}
        className="mt-0.5"
      />
      <Label
        htmlFor={id}
        className={cn(
          "text-sm leading-snug font-normal",
          checked && "text-foreground/45 line-through",
        )}
      >
        {label}
      </Label>
    </li>
  );
}

const TOUR_ICONS: Record<string, LucideIcon> = {
  Groceries: ShoppingCartIcon,
  Café: CoffeeIcon,
  Park: TreesIcon,
  Restaurant: UtensilsCrossedIcon,
  "Elementary school": GraduationCapIcon,
};

/** Placeholder for older reports without the showing kit. */
function ShowingMissing({
  pending,
  onGenerate,
}: {
  pending: boolean;
  onGenerate: () => void;
}) {
  return (
    <DashCard
      title="Showing-day kit"
      icon={SparklesIcon}
      className="lg:col-span-12"
    >
      {pending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm text-foreground/70">
            Three buyer personas with what to lead with, tough questions
            answered with numbers, an open house plan and follow-up messages,
            written from this report&apos;s data.
          </p>
          <Button onClick={onGenerate}>
            <SparklesIcon data-icon="inline-start" />
            Generate showing kit
          </Button>
        </div>
      )}
    </DashCard>
  );
}

export function PlaybookTab({
  reportId,
  insights,
  playbook,
  showing,
  showingPending,
  onGenerate,
  data,
  home,
}: {
  reportId: string;
  insights: InsightsData | null;
  playbook: MarketingData["playbook"];
  showing: ShowingData | null;
  showingPending: boolean;
  onGenerate: () => void;
  data: {
    amenities: AmenitiesData | null;
    commute: CommuteData | null;
    schools: SchoolsData | null;
    safety: SafetyData | null;
    demographics: DemographicsData | null;
    upside: UpsideData | null;
  };
  home: { lat: number; lng: number } | null;
}) {
  const travel = useTravelMode();
  const checklist = useChecklist(reportId);
  const openHouse = useChecklist(reportId, "open-house");
  const done = playbook.showingChecklist.filter((_, i) =>
    checklist.ticked.has(i),
  ).length;
  const total = playbook.showingChecklist.length;

  const facts = fastFacts(data, travel.mode);
  const factsText = facts.map((f) => `${f.question}\n${f.answer}`).join("\n\n");
  const tour = home ? neighbourhoodTour(data, home, travel.mode) : [];
  const pins: MapPin[] = tour.map((s, i) => ({
    id: s.id,
    lat: s.lat,
    lng: s.lng,
    badge: String(i + 1),
    color: s.color,
    icon: TOUR_ICONS[s.kind] ?? TrainFrontIcon,
    title: s.name,
    eyebrow: s.kind,
    facts: [
      {
        icon: travel.icon,
        label: `${s.estimated ? "~" : ""}${s.minutes} min ${travel.verb}`,
      },
      { label: formatDistance(s.distanceMeters) },
    ],
    address: s.address,
    href: googleMapsUrl({
      name: s.name,
      address: s.address,
      placeId: s.id,
      lat: s.lat,
      lng: s.lng,
    }),
  }));

  // Watch-outs (from the data), objections, and number-backed answers.
  const questions = [
    ...(showing?.provenAnswers ?? []).map((q) => ({
      kind: "proven" as const,
      question: q.question,
      context: null as string | null,
      answer: q.answer,
      proof: q.proof as string | null,
    })),
    ...(insights?.watchOuts ?? []).map((w) => ({
      kind: "watch-out" as const,
      question: w.title,
      context: w.detail,
      answer: w.reframe,
      proof: null,
    })),
    ...playbook.objections.map((o) => ({
      kind: "objection" as const,
      question: o.objection,
      context: null,
      answer: o.response,
      proof: null,
    })),
  ];

  const phases = showing
    ? ([
        ["before", "Before", showing.openHousePlan.before],
        ["dayOf", "Day of", showing.openHousePlan.dayOf],
        ["after", "After", showing.openHousePlan.after],
      ] as const)
    : [];
  const openHouseTotal = phases.reduce((n, [, , steps]) => n + steps.length, 0);
  const openHouseDone = phases.reduce(
    (n, [phase, , steps]) =>
      n + steps.filter((_, i) => openHouse.ticked.has(`${phase}-${i}`)).length,
    0,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* Fast facts: exact answers from the report, in the travel mode. */}
      <DashCard
        title="Fast facts"
        icon={ZapIcon}
        action={<CopyButton text={factsText} label="Copy cheat sheet" />}
        className="lg:col-span-7"
        bodyClassName="py-1"
      >
        <dl className="divide-y">
          {facts.map((f) => (
            <div key={f.id} className="group/fact flex gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium text-foreground/55">
                  {f.question}
                </dt>
                <dd className="mt-0.5 text-sm text-foreground/90">
                  {f.answer}
                </dd>
              </div>
              <span className="opacity-60 transition-opacity group-hover/fact:opacity-100">
                <CopyButton text={f.answer} label="" />
              </span>
            </div>
          ))}
        </dl>
        <p className="py-2 text-[11px] text-foreground/45">
          From this report&apos;s data, in{" "}
          {travel.verb === "walk" ? "walking" : "driving"}{" "}
          times. &ldquo;~&rdquo; marks an estimate.
        </p>
      </DashCard>

      {/* Neighbourhood tour: an ordered loop of the places worth showing. */}
      <DashCard
        title="Neighbourhood tour"
        icon={MapIcon}
        className="lg:col-span-5"
        bodyClassName="p-0"
      >
        {home && pins.length > 0 ? (
          <>
            <InteractiveMap
              home={home}
              pins={pins}
              selectedId={null}
              onSelect={() => {}}
              className="h-[18rem]"
            />
            <ol className="divide-y border-t">
              {tour.map((s, i) => {
                const Icon = TOUR_ICONS[s.kind] ?? TrainFrontIcon;
                return (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                    <span
                      className="grid size-6 shrink-0 place-items-center text-xs font-semibold text-white tabular-nums"
                      style={{ backgroundColor: s.color }}
                    >
                      {i + 1}
                    </span>
                    <Icon
                      aria-hidden
                      className="size-4 shrink-0 text-foreground/45"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {s.name}
                      </span>
                      <span className="block text-xs text-foreground/55">
                        {s.kind}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-foreground/60 tabular-nums">
                      {s.estimated ? "~" : ""}
                      {s.minutes} min {travel.verb}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="border-t px-4 py-2 text-[11px] text-foreground/45">
              Ordered as a loop from the home; times are from the home.
            </p>
          </>
        ) : (
          <p className="p-4 text-sm text-foreground/60">
            The tour appears once nearby places are found.
          </p>
        )}
      </DashCard>

      {/* Personas: who to pitch to, and what to lead with for each. */}
      {showing ? (
        <DashCard
          title="Buyer personas"
          icon={UsersRoundIcon}
          className="lg:col-span-12"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {showing.personas.map((p) => (
              <div key={p.title} className="flex flex-col bg-muted/50 p-4">
                <span className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center bg-primary/10 text-primary">
                    <UserRoundIcon aria-hidden className="size-4" />
                  </span>
                  <span className="text-sm font-semibold">{p.title}</span>
                </span>
                <p className="mt-2 text-sm text-foreground/70">{p.needs}</p>
                <p className="mt-3 text-xs font-medium text-foreground/55">
                  Lead with
                </p>
                <ul className="mt-1 space-y-1">
                  {p.emphasize.map((e) => (
                    <li key={e} className="flex items-start gap-2 text-sm">
                      <BadgeCheckIcon
                        aria-hidden
                        className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
                      />
                      {e}
                    </li>
                  ))}
                </ul>
                <p className="mt-auto border-t pt-2.5 text-xs text-foreground/65">
                  <span className="font-medium text-foreground/80">
                    Show first:{" "}
                  </span>
                  {p.tourFocus}
                </p>
              </div>
            ))}
          </div>
        </DashCard>
      ) : (
        <>
          <DashCard
            title="Likely buyer"
            icon={UserRoundIcon}
            className="lg:col-span-12"
          >
            <p className="text-base font-semibold">
              {playbook.buyerProfile.title}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              {playbook.buyerProfile.summary}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
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
          <ShowingMissing pending={showingPending} onGenerate={onGenerate} />
        </>
      )}

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
        className="lg:col-span-5"
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
              key={`${q.kind}:${q.question}`}
              className="border-b last:border-b-0"
            >
              <AccordionTrigger className="items-center gap-3 py-3.5 text-sm font-medium hover:no-underline">
                <span className="flex min-w-0 items-center gap-3">
                  {q.kind === "watch-out" ? (
                    <TriangleAlertIcon
                      aria-hidden
                      className="size-4 shrink-0 text-amber-600"
                    />
                  ) : q.kind === "proven" ? (
                    <BadgeCheckIcon
                      aria-hidden
                      className="size-4 shrink-0 text-emerald-600"
                    />
                  ) : (
                    <MessageCircleQuestionIcon
                      aria-hidden
                      className="size-4 shrink-0 text-foreground/50"
                    />
                  )}
                  <span className="text-left">
                    {q.kind === "watch-out" ? (
                      q.question
                    ) : (
                      <>&ldquo;{q.question}&rdquo;</>
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
                {q.proof && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-foreground/60">
                    <BadgeCheckIcon
                      aria-hidden
                      className="mt-px size-3.5 shrink-0 text-emerald-600"
                    />
                    <span>
                      <span className="font-medium text-foreground/75">
                        Proof:{" "}
                      </span>
                      {q.proof}
                    </span>
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </DashCard>

      {showing && (
        <DashCard
          title="Open house plan"
          icon={CalendarCheckIcon}
          action={
            openHouseDone > 0 && (
              <Button variant="ghost" size="sm" onClick={openHouse.reset}>
                <RotateCcwIcon data-icon="inline-start" />
                Reset
              </Button>
            )
          }
          className="lg:col-span-7"
        >
          <div className="mb-3 flex items-center gap-3">
            <Progress
              value={
                openHouseTotal ? (openHouseDone / openHouseTotal) * 100 : 0
              }
              className="flex-1"
            />
            <span className="text-xs font-medium text-foreground/60 tabular-nums">
              {openHouseDone}/{openHouseTotal}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {phases.map(([phase, label, steps]) => (
              <div key={phase}>
                <p className="mb-1 text-xs font-semibold tracking-wide text-foreground/55 uppercase">
                  {label}
                </p>
                <ul>
                  {steps.map((step, i) => (
                    <Tick
                      key={step}
                      id={`oh-${reportId}-${phase}-${i}`}
                      label={step}
                      checked={openHouse.ticked.has(`${phase}-${i}`)}
                      onChange={(on) => openHouse.toggle(`${phase}-${i}`, on)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DashCard>
      )}

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
        className={showing ? "lg:col-span-5" : "lg:col-span-12"}
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
        <ul>
          {playbook.showingChecklist.map((item, i) => (
            <Tick
              key={item}
              id={`check-${reportId}-${i}`}
              label={item}
              checked={checklist.ticked.has(i)}
              onChange={(on) => checklist.toggle(i, on)}
            />
          ))}
        </ul>
      </DashCard>

      {showing && (
        <DashCard
          title="Follow-ups"
          icon={MessageSquareTextIcon}
          className="lg:col-span-12"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground/55 uppercase">
                <ListChecksIcon aria-hidden className="size-3.5" />
                Text to visitors · same evening
              </p>
              <CopyBlock
                reportId={reportId}
                text={showing.followUpText}
                limit={300}
              />
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-foreground/55 uppercase">
                <ListChecksIcon aria-hidden className="size-3.5" />
                Email · next day · {showing.followUpEmail.subject}
              </p>
              <CopyBlock
                reportId={reportId}
                text={showing.followUpEmail.body}
              />
            </div>
          </div>
        </DashCard>
      )}
    </div>
  );
}
