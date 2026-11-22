"use client";

// Loading placeholders that match the real report components' sizes, so
// nothing jumps when data arrives. Card chrome (titles, icons) renders for
// real; only the contents shimmer.
import {
  CalendarCheckIcon,
  ClapperboardIcon,
  ClipboardCheckIcon,
  GalleryHorizontalIcon,
  HeadingIcon,
  MapIcon,
  MegaphoneIcon,
  UsersRoundIcon,
  ZapIcon,
  ConstructionIcon,
  FileTextIcon,
  HardHatIcon,
  KeyRoundIcon,
  type LucideIcon,
  MapPinnedIcon,
  MessageCircleQuestionIcon,
  MessagesSquareIcon,
  QuoteIcon,
  Share2Icon,
  ShieldCheckIcon,
  UsersIcon,
  Volume2Icon,
  WavesIcon,
  WindIcon,
} from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import { AMENITY_CATEGORIES } from "@/lib/report-sections";
import { DashCard } from "./dash-card";
import { WIDGET } from "./widget-styles";

/** Text-line placeholder that keeps the line's box height (no shrink). */
function Line({
  box = "h-5",
  bar = "h-3.5",
  className,
}: {
  /** Height of the real text line, e.g. h-5 for text-sm. */
  box?: string;
  bar?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center", box)}>
      <Skeleton className={cn(bar, className)} />
    </span>
  );
}

const WIDTHS = ["w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/4", "w-2/5"];
const width = (i: number) => WIDTHS[i % WIDTHS.length];

/** A widget tile (StatTile / KpiTile) with caption and micro-visual space. */
export function TileSkeleton({ visual = true }: { visual?: boolean }) {
  return (
    <div className={cn(WIDGET, "flex min-h-[8.5rem] flex-col p-4")}>
      <Line bar="h-3.5 w-24" />
      <Skeleton className="mt-2 h-8 w-16" />
      <span className="mt-1.5 flex h-[2.25rem] flex-col justify-center gap-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </span>
      {visual && <Skeleton className="mt-auto h-[1.875rem] w-full" />}
    </div>
  );
}

export function TileGridSkeleton({
  count,
  className,
  visual,
}: {
  count: number;
  className?: string;
  visual?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <TileSkeleton key={i} visual={visual} />
      ))}
    </div>
  );
}

/** Filter chips (amenities, commute, schools): 38 px tall, varied widths. */
export function ChipRowSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="h-[2.375rem]"
          style={{ width: `${5.5 + ((i * 37) % 5)}rem` }}
        />
      ))}
    </div>
  );
}

/** Two-line list rows (title + detail) as used across dashboard cards. */
export function ListSkeleton({
  rows,
  icon = true,
  trailing = false,
}: {
  rows: number;
  icon?: boolean;
  /** A value on the right (e.g. "6 min", "48%"). */
  trailing?: boolean;
}) {
  return (
    <ul className="divide-y" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-3 py-2.5">
          {icon && <Skeleton className="mt-0.5 size-4 shrink-0" />}
          <span className="min-w-0 flex-1">
            <Line bar={cn("h-3.5", width(i))} />
            <Line box="h-4" bar={cn("h-3", width(i + 2))} />
          </span>
          {trailing && <Line bar="h-4 w-10" />}
        </li>
      ))}
    </ul>
  );
}

/** A paragraph of `lines` text-sm lines. */
export function ParagraphSkeleton({ lines }: { lines: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Line key={i} bar={cn("h-3.5", i === lines - 1 ? "w-2/5" : "w-full")} />
      ))}
    </div>
  );
}

/** A map card: map area plus its one-line footer. */
export function MapCardSkeleton({ height }: { height: string }) {
  return (
    <div className={cn(WIDGET, "overflow-hidden")}>
      <Skeleton className={cn("w-full", height)} />
      <div className="flex h-[2.3125rem] items-center border-t px-4">
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** Place / stop / school card: 4:3 thumbnail, name, facts, link. */
export function PlaceCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className={cn(WIDGET, "flex gap-3 p-2.5")}>
      <Skeleton className="aspect-[4/3] w-28 shrink-0 sm:w-32" />
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
        <div>
          <Line bar={cn("h-3.5", width(index))} />
          <Line box="mt-0.5 h-4" bar="h-3 w-1/3" />
        </div>
        <Line box="h-4" bar={cn("h-3", width(index + 3))} />
      </div>
    </div>
  );
}

/** A DashCard with real chrome and shimmering contents. */
function CardShell({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DashCard title={title} icon={icon} className={className}>
      <div aria-hidden>{children}</div>
    </DashCard>
  );
}

const MAP_TALL = "h-[28rem] lg:h-[34rem]";
const MAP_SIDE = "h-[24rem] lg:h-[30rem]";

// ---------------------------------------------------------------------------
// One skeleton per tab, mirroring its layout.
// ---------------------------------------------------------------------------

function Busy({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 print:hidden" aria-busy="true" aria-label={label}>
      {children}
    </div>
  );
}

export function AmenitiesSkeleton() {
  return (
    <Busy label="Finding nearby amenities">
      <ChipRowSkeleton count={AMENITY_CATEGORIES.length + 1} />
      <MapCardSkeleton height={MAP_TALL} />
    </Busy>
  );
}

export function CommuteSkeleton() {
  return (
    <Busy label="Calculating commute times">
      <TileGridSkeleton count={3} className="md:grid-cols-2 lg:grid-cols-3" visual={false} />
      <Line box="h-4" bar="h-3 w-64" />
      <Line box="mt-4 h-5" bar="h-3.5 w-32" />
      <ChipRowSkeleton count={6} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <MapCardSkeleton height={MAP_SIDE} />
        </div>
        <div className="space-y-2 lg:col-span-7">
          {Array.from({ length: 5 }, (_, i) => (
            <PlaceCardSkeleton key={i} index={i} />
          ))}
        </div>
      </div>
    </Busy>
  );
}

export function SchoolsSkeleton() {
  return (
    <Busy label="Finding nearby schools">
      <ChipRowSkeleton count={5} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <MapCardSkeleton height={MAP_SIDE} />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="space-y-5 lg:col-span-7">
          {[0, 1].map((group) => (
            <div key={group}>
              <Line box="mb-2 h-4" bar="h-3 w-40" />
              <div className="space-y-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <PlaceCardSkeleton key={i} index={group * 3 + i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Busy>
  );
}

export function SafetySkeleton() {
  return (
    <Busy label="Checking crime, flood, noise and air quality">
      <TileGridSkeleton count={4} className="md:grid-cols-4" />
      <div className="grid gap-4 lg:grid-cols-12">
        <CardShell
          title="Crime"
          icon={ShieldCheckIcon}
          className="lg:col-span-8"
        >
          <Line box="mb-3 h-4" bar="h-3 w-3/4" />
          <ListSkeleton rows={6} icon={false} trailing />
        </CardShell>
        <div className="space-y-4 lg:col-span-4">
          <CardShell title="Flood & erosion" icon={WavesIcon}>
            <Skeleton className="h-5 w-20" />
            <div className="mt-2">
              <ParagraphSkeleton lines={3} />
            </div>
          </CardShell>
          <CardShell title="Air quality" icon={WindIcon}>
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 shrink-0" />
              <div className="flex-1">
                <Line bar="h-3.5 w-24" />
                <Line box="h-4" bar="h-3 w-32" />
              </div>
            </div>
          </CardShell>
        </div>
        <CardShell
          title="Noise sources"
          icon={Volume2Icon}
          className="lg:col-span-12"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[8.25rem]" />
            ))}
          </div>
        </CardShell>
      </div>
    </Busy>
  );
}

export function NeighbourhoodSkeleton() {
  return (
    <Busy label="Loading census figures">
      <TileGridSkeleton count={6} className="md:grid-cols-3" />
      <div className="grid gap-4 lg:grid-cols-12">
        <CardShell
          title="At a glance"
          icon={MapPinnedIcon}
          className="lg:col-span-4"
        >
          <ListSkeleton rows={4} />
        </CardShell>
        <CardShell title="Tenure" icon={KeyRoundIcon} className="lg:col-span-8">
          {[0, 1].map((i) => (
            <div key={i} className="mb-4">
              <Line box="mb-1.5 h-4" bar="h-3 w-1/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </CardShell>
        {Array.from({ length: 4 }, (_, i) => (
          <CardShell
            key={i}
            title="Census"
            icon={UsersIcon}
            className="lg:col-span-4"
          >
            <ListSkeleton rows={3} icon={false} trailing />
          </CardShell>
        ))}
      </div>
    </Busy>
  );
}

export function UpsideSkeleton() {
  return (
    <Busy label="Looking for nearby projects">
      <TileGridSkeleton count={4} className="md:grid-cols-4" visual={false} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
          <MapCardSkeleton height={MAP_SIDE} />
        </div>
        <div className="space-y-4 lg:col-span-7">
          <CardShell title="Being built or planned" icon={ConstructionIcon}>
            <ListSkeleton rows={4} trailing />
          </CardShell>
          <CardShell title="Development applications" icon={HardHatIcon}>
            <ListSkeleton rows={4} trailing />
          </CardShell>
        </div>
      </div>
    </Busy>
  );
}

export function MarketingSkeleton() {
  return (
    <Busy label="Writing the marketing kit">
      <div className="grid gap-4 lg:grid-cols-12">
        <div
          className={cn(WIDGET, "flex h-12 items-center px-4 lg:col-span-12")}
        >
          <Skeleton className="h-4 w-80" />
        </div>
        <CardShell title="The pitch" icon={QuoteIcon} className="lg:col-span-7">
          <Line box="h-7" bar="h-5 w-3/4" />
          <div className="mt-2">
            <ParagraphSkeleton lines={3} />
          </div>
        </CardShell>
        <CardShell
          title="Headline options"
          icon={HeadingIcon}
          className="lg:col-span-5"
        >
          <ListSkeleton rows={5} icon={false} trailing />
        </CardShell>
        <CardShell
          title="Listing description"
          icon={FileTextIcon}
          className="lg:col-span-7"
        >
          <ParagraphSkeleton lines={8} />
        </CardShell>
        <CardShell
          title="Social posts"
          icon={Share2Icon}
          className="lg:col-span-5"
        >
          <ParagraphSkeleton lines={8} />
        </CardShell>
        <CardShell
          title="Campaign timeline"
          icon={MegaphoneIcon}
          className="lg:col-span-12"
        >
          <ParagraphSkeleton lines={4} />
        </CardShell>
        <CardShell
          title="Reel & TikTok script"
          icon={ClapperboardIcon}
          className="lg:col-span-7"
        >
          <ListSkeleton rows={6} />
        </CardShell>
        <CardShell
          title="Instagram carousel"
          icon={GalleryHorizontalIcon}
          className="lg:col-span-5"
        >
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        </CardShell>
      </div>
    </Busy>
  );
}

export function PlaybookSkeleton() {
  return (
    <Busy label="Writing the showing playbook">
      <div className="grid gap-4 lg:grid-cols-12">
        <CardShell title="Fast facts" icon={ZapIcon} className="lg:col-span-7">
          <ListSkeleton rows={8} icon={false} />
        </CardShell>
        <CardShell
          title="Neighbourhood tour"
          icon={MapIcon}
          className="lg:col-span-5"
        >
          <Skeleton className="h-[18rem] w-full" />
          <div className="mt-3">
            <ListSkeleton rows={4} trailing />
          </div>
        </CardShell>
        <CardShell
          title="Buyer personas"
          icon={UsersRoundIcon}
          className="lg:col-span-12"
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        </CardShell>
        <CardShell
          title="Talking points"
          icon={MessagesSquareIcon}
          className="lg:col-span-5"
        >
          <ListSkeleton rows={6} />
        </CardShell>
        <CardShell
          title="Tough questions"
          icon={MessageCircleQuestionIcon}
          className="lg:col-span-7"
        >
          <ListSkeleton rows={6} />
        </CardShell>
        <CardShell
          title="Open house plan"
          icon={CalendarCheckIcon}
          className="lg:col-span-7"
        >
          <ListSkeleton rows={5} />
        </CardShell>
        <CardShell
          title="Showing checklist"
          icon={ClipboardCheckIcon}
          className="lg:col-span-5"
        >
          <ListSkeleton rows={6} />
        </CardShell>
      </div>
    </Busy>
  );
}
