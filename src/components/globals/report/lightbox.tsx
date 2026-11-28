"use client";

import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  type LucideIcon,
  MapPinIcon,
} from "lucide-react";
import { cn } from "cn";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FadeImg } from "./fade-img";

export type LightboxItem = {
  /** Unique within the list. */
  key: string;
  /** Thumbnail-strip size. */
  src: string;
  /** Larger version for the main photo, when the source offers one. */
  fullSrc?: string;
  title: string;
  subtitle?: string;
  /** A place's street address, shown under its name. */
  address?: string | null;
  /** Where the address links to (Google Maps). */
  addressHref?: string;
  icon?: LucideIcon;
  /** Items sharing a group (a place's photos) show as a thumbnail strip. */
  group?: string;
  credit?: { author: string | null; authorUri: string | null };
};

/**
 * One side of the photo as a big click target: a soft edge gradient and a
 * frosted square button that firms up on hover. Always shown on touch
 * screens (no hover there); on desktop it fades in when the photo is hovered
 * or the button has keyboard focus.
 */
function ArrowZone({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeftIcon : ChevronRightIcon;
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      aria-label={side === "left" ? "Previous photo" : "Next photo"}
      className={cn(
        "group/arrow absolute inset-y-0 flex h-auto w-1/5 max-w-28 min-w-16 items-center rounded-none p-0 outline-none hover:bg-transparent focus-visible:ring-0 dark:hover:bg-transparent",
        side === "left"
          ? "left-0 justify-start bg-gradient-to-r pl-3"
          : "right-0 justify-end bg-gradient-to-l pr-3",
        "from-black/35 to-transparent opacity-100 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/lightbox:opacity-100 focus-visible:opacity-100",
      )}
    >
      <span className="grid size-11 place-items-center border border-white/25 bg-black/40 text-white shadow-lg backdrop-blur-md transition-[background-color,transform,border-color] duration-150 group-hover/arrow:border-white/50 group-hover/arrow:bg-black/65 group-active/arrow:scale-95 group-focus-visible/arrow:ring-2 group-focus-visible/arrow:ring-white">
        <Icon aria-hidden className="size-6" strokeWidth={2.25} />
      </span>
    </Button>
  );
}

/** Google requires the photographer's name, linked when available. */
function Credit({ credit }: { credit?: LightboxItem["credit"] }) {
  if (!credit?.author) return <span />;
  return (
    <span className="text-[11px] text-foreground/50">
      Photo:{" "}
      {credit.authorUri ? (
        <a
          href={credit.authorUri}
          target="_blank"
          rel="noreferrer"
          className="underline-offset-2 hover:underline"
        >
          {credit.author}
        </a>
      ) : (
        credit.author
      )}
    </span>
  );
}

/**
 * Full-size photo viewer: arrows (buttons, keyboard ←/→, swipe), a counter,
 * a strip of the current group's photos, and the neighbours preloaded so
 * stepping through is instant. Wraps around at either end.
 */
export function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: LightboxItem[];
  /** Open at this item; null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const touchX = useRef<number | null>(null);
  const open = index !== null && items.length > 0;
  const i = open ? Math.min(index, items.length - 1) : 0;
  const item = items[i];
  const step = (delta: number) =>
    onIndexChange((i + delta + items.length) % items.length);
  const many = items.length > 1;
  const group = item?.group
    ? items
        .map((it, idx) => ({ it, idx }))
        .filter(({ it }) => it.group === item.group)
    : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        // minmax(0,1fr): the grid column never grows to fit its content
        // (a long strip of thumbnails is wider than a phone), it scrolls.
        className="grid-cols-[minmax(0,1fr)] gap-3 sm:max-w-4xl"
        onKeyDown={(e) => {
          if (!many) return;
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
      >
        {item && (
          <>
            <DialogHeader className="pr-8">
              <DialogTitle className="flex items-center gap-2">
                {item.icon && (
                  <item.icon
                    aria-hidden
                    className="size-4 shrink-0 text-primary"
                  />
                )}
                <span className="truncate">{item.title}</span>
              </DialogTitle>
              {item.address &&
                (item.addressHref ? (
                  <Button
                    variant="link"
                    nativeButton={false}
                    render={
                      <a href={item.addressHref} target="_blank" rel="noreferrer" />
                    }
                    title={`${item.address} (opens Google Maps)`}
                    className="h-auto max-w-full justify-start gap-1.5 p-0 text-sm font-normal text-foreground/70 hover:text-primary"
                  >
                    <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate">{item.address}</span>
                    <ArrowUpRightIcon aria-hidden className="size-3.5 shrink-0" />
                  </Button>
                ) : (
                  <p className="flex items-center gap-1.5 text-sm text-foreground/70">
                    <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
                    <span className="truncate" title={item.address}>
                      {item.address}
                    </span>
                  </p>
                ))}
              <DialogDescription className="flex items-center justify-between gap-3">
                <span className="truncate">{item.subtitle}</span>
              </DialogDescription>
            </DialogHeader>

            <div
              className="group/lightbox relative aspect-[16/10] overflow-hidden bg-muted select-none"
              onTouchStart={(e) => {
                touchX.current = e.touches[0]?.clientX ?? null;
              }}
              onTouchEnd={(e) => {
                const start = touchX.current;
                const end = e.changedTouches[0]?.clientX;
                touchX.current = null;
                if (start == null || end == null || !many) return;
                if (Math.abs(end - start) > 50) step(end < start ? 1 : -1);
              }}
            >
              <FadeImg
                key={item.key}
                src={item.fullSrc ?? item.src}
                alt={item.title}
                className="absolute inset-0 size-full object-cover"
              />
              {many && (
                <>
                  <ArrowZone side="left" onClick={() => step(-1)} />
                  <ArrowZone side="right" onClick={() => step(1)} />
                  {/* Position, on the photo. */}
                  <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white tabular-nums backdrop-blur-sm">
                    {i + 1} / {items.length}
                  </span>
                </>
              )}
              {/* Neighbours load in the background: instant next/previous.
                  Within a place's photos only: each place photo is a billed
                  Google request, so don't fetch photos of places not opened. */}
              {many &&
                [
                  items[(i + 1) % items.length],
                  items[(i - 1 + items.length) % items.length],
                ].map((n) =>
                  n &&
                  n.key !== item.key &&
                  (!item.group || n.group === item.group) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preload only
                    <img
                      key={`pre-${n.key}`}
                      src={n.fullSrc ?? n.src}
                      alt=""
                      aria-hidden
                      className="hidden"
                    />
                  ) : null,
                )}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <Credit credit={item.credit} />
              {group.length > 1 && (
                <div className="flex max-w-full min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain p-0.5 no-scrollbar scroll-fade-x">
                  {group.map(({ it, idx }) => (
                    <button
                      key={it.key}
                      type="button"
                      aria-label={`Photo ${group.findIndex((g) => g.idx === idx) + 1} of ${group.length}`}
                      aria-current={idx === i}
                      onClick={() => onIndexChange(idx)}
                      className={cn(
                        "relative h-12 w-[4.5rem] shrink-0 overflow-hidden bg-muted outline-offset-2",
                        idx === i
                          ? "outline-2 outline-primary"
                          : "opacity-70 hover:opacity-100",
                      )}
                    >
                      <FadeImg
                        src={it.src}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
