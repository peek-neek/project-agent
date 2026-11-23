"use client";

import {
  MegaphoneIcon,
  MessageSquareQuoteIcon,
  PresentationIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTravelMode } from "@/components/globals/travel-mode";
import { JOB_KINDS } from "@/lib/report-sections";
import {
  MarketingPanel,
  PlaybookPanel,
} from "@/components/globals/report/copy-panels";
import { DashCard } from "@/components/globals/report/dash-card";
import { sectionTiles } from "@/components/globals/report/overview-tab";
import {
  getJob,
  isJobActive,
  useRerunJob,
} from "@/components/globals/report/report-hooks";
import {
  type CompareProperty,
  propertyMarketScore,
  SideChip,
  CrownedChip,
  type Side,
  SIDES,
  winner,
} from "./compare-shared";

/** Section scores this close count as level. */
const TIE = 0.2;

/** One property's own Marketing or Playbook tab, with its own regenerate. */
function SideCopyPanel({
  p,
  kind,
}: {
  p: CompareProperty;
  kind: "marketing" | "playbook";
}) {
  const rerun = useRerunJob(p.report.id);
  const regenerating =
    isJobActive(getJob(p.report, JOB_KINDS.ai)) || rerun.isPending;
  const onGenerate = () =>
    rerun.mutate({ id: p.report.id, kind: JOB_KINDS.ai });
  const Panel = kind === "marketing" ? MarketingPanel : PlaybookPanel;
  return (
    <Panel
      report={p.report}
      data={p.data}
      regenerating={regenerating}
      onGenerate={onGenerate}
    />
  );
}

/** Interleaves two lists: A1, B1, A2, B2… */
function interleave<T>(a: T[], b: T[]) {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    [a[i], b[i]].filter((x): x is T => x !== undefined),
  ).flat();
}

/**
 * Marketing and Playbook in a comparison: what sets the two apart (one
 * list, each point in its property's colour), then the full kit for the
 * property picked below it.
 */
export function CompareCopy({
  a,
  b,
  kind,
}: {
  a: CompareProperty;
  b: CompareProperty;
  kind: "marketing" | "playbook";
}) {
  const [side, setSide] = useState<Side>("a");
  const props = { a, b };

  return (
    <div className="space-y-4">
      {kind === "marketing" ? (
        <SellingPoints a={a} b={b} />
      ) : (
        <Positioning a={a} b={b} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">
          {kind === "marketing" ? "Marketing kit for" : "Playbook for"}
        </span>
        <ToggleGroup
          aria-label="Property"
          value={[side]}
          onValueChange={(value) => {
            const next = value[0] as Side | undefined;
            if (next) setSide(next);
          }}
          spacing={1}
        >
          {SIDES.map((s) => (
            <ToggleGroupItem
              key={s}
              value={s}
              className="h-9 max-w-64 gap-2 border bg-card px-3 data-pressed:border-foreground data-pressed:bg-card"
            >
              <SideChip side={s} />
              <span className="truncate">{props[s].street}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* Keyed: each property's kit keeps none of the other's state. */}
      <SideCopyPanel key={side} p={props[side]} kind={kind} />
    </div>
  );
}

/** Both homes' AI selling points in one list, colour-coded by property. */
function SellingPoints({ a, b }: { a: CompareProperty; b: CompareProperty }) {
  const points = (p: CompareProperty) =>
    (p.data.insights?.highlights ?? []).slice(0, 4).map((h) => ({
      side: p.side,
      ...h,
    }));
  const list = interleave(points(a), points(b));
  return (
    <DashCard title="Selling points side by side" icon={MegaphoneIcon}>
      {list.length === 0 ? (
        <p className="text-sm text-foreground/55">
          The selling points appear once each property&apos;s copy is written.
        </p>
      ) : (
        <ul className="grid gap-x-6 divide-y md:grid-cols-2 md:divide-y-0">
          {list.map((h, i) => (
            <li key={`${h.side}-${i}`} className="flex gap-3 py-2.5">
              <SideChip side={h.side} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{h.title}</span>
                <span className="block text-xs text-pretty text-foreground/55">
                  {h.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}

/**
 * For buyers deciding between the two: where each home has the edge (from
 * the same scores as the Overview), and what buyers may raise about each.
 */
function Positioning({ a, b }: { a: CompareProperty; b: CompareProperty }) {
  const travel = useTravelMode();
  const props = { a, b };
  const tiles = {
    a: sectionTiles(a.data, travel.mode),
    b: sectionTiles(b.data, travel.mode),
  };
  const market = {
    a: propertyMarketScore(a, travel.mode),
    b: propertyMarketScore(b, travel.mode),
  };

  const edges = tiles.a.flatMap((ta, i) => {
    const tb = tiles.b[i];
    const w = winner(ta.score?.score, tb.score?.score, { tolerance: TIE });
    if (!w) return [];
    const win = w === "a" ? ta : tb;
    const lose = w === "a" ? tb : ta;
    return [
      {
        side: w,
        text: `${props[w].street} has the edge on ${win.label.toLowerCase()} (${win.score!.score.toFixed(1)} vs ${lose.score!.score.toFixed(1)}): ${win.caption}.`,
      },
    ];
  });
  const level = tiles.a
    .filter(
      (ta, i) =>
        ta.score &&
        tiles.b[i].score &&
        !winner(ta.score.score, tiles.b[i].score!.score, { tolerance: TIE }),
    )
    .map((t) => t.label.toLowerCase());
  const marketWinner = winner(market.a?.level, market.b?.level);

  const concerns = (p: CompareProperty) =>
    (p.data.insights?.watchOuts ?? [])
      .slice(0, 2)
      .map((w) => ({ side: p.side, ...w }));
  const watchOuts = interleave(concerns(a), concerns(b));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <DashCard title="Positioning the two" icon={PresentationIcon}>
        <ul className="space-y-3">
          {marketWinner && market.a && market.b && (
            <li className="flex gap-3">
              <CrownedChip side={marketWinner} crowned className="mt-0.5" />
              <span className="text-sm text-pretty">
                <span className="font-medium">
                  {props[marketWinner].street}
                </span>{" "}
                should be the easier sell: market ease{" "}
                {market[marketWinner]!.level}/5 against{" "}
                {market[marketWinner === "a" ? "b" : "a"]!.level}/5.
              </span>
            </li>
          )}
          {edges.map((e) => (
            <li key={e.text} className="flex gap-3">
              <CrownedChip side={e.side} crowned className="mt-0.5" />
              <span className="text-sm text-pretty">{e.text}</span>
            </li>
          ))}
          {level.length > 0 && (
            <li className="flex gap-3 text-sm text-foreground/60">
              <MessageSquareQuoteIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0"
              />
              Much the same on {level.join(", ")}: let the homes themselves
              decide it.
            </li>
          )}
          {edges.length === 0 && level.length === 0 && (
            <li className="text-sm text-foreground/55">
              The comparison fills in as each property&apos;s data arrives.
            </li>
          )}
        </ul>
      </DashCard>

      <DashCard title="What buyers may raise" icon={TriangleAlertIcon}>
        {watchOuts.length === 0 ? (
          <p className="text-sm text-foreground/55">
            Watch-outs appear once each property&apos;s copy is written.
          </p>
        ) : (
          <ul className="divide-y">
            {watchOuts.map((w, i) => (
              <li key={`${w.side}-${i}`} className="flex gap-3 py-2.5">
                <SideChip side={w.side} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{w.title}</span>
                  <span className="block text-xs text-pretty text-foreground/55">
                    {w.reframe}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashCard>
    </div>
  );
}
