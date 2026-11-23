"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/components/globals/travel-mode";
import { notesSchema, SECTION_KEYS } from "@/lib/report-sections";
import { useTRPC } from "@/trpc/client";
import type { ReportData } from "./report-format";
import { getSection } from "./report-hooks";

/** Sticky-note colours: paper, its darker fold, and readable ink. */
const COLORS = [
  { paper: "#fde68a", fold: "#f5c842", ink: "#422006" }, // yellow
  { paper: "#fbcfe8", fold: "#f39ac8", ink: "#500724" }, // pink
  { paper: "#bfdbfe", fold: "#8cbcf7", ink: "#172554" }, // blue
  { paper: "#bbf7d0", fold: "#7fe3a6", ink: "#052e16" }, // green
  { paper: "#fed7aa", fold: "#f8b26a", ink: "#431407" }, // orange
  { paper: "#ddd6fe", fold: "#b7a9f9", ink: "#2e1065" }, // violet
] as const;

/**
 * A colour picked at random per report, but stable: hashed from the id, so
 * the same report keeps its colour on every visit and device.
 */
function colorFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(h) % COLORS.length]!;
}

const SAVE_DELAY_MS = 700;
const SPRING = { type: "spring", bounce: 0.18, visualDuration: 0.45 } as const;

/** A folded bottom-right corner, `fold` px deep. */
const foldClip = (fold: number) =>
  `polygon(0 0, 100% 0, 100% calc(100% - ${fold}px), calc(100% - ${fold}px) 100%, 0 100%)`;

/** The small note's sizes: next to a page heading, or to text-sm lines. */
const SIZES = {
  lg: {
    button: "size-7 sm:size-8",
    note: "size-6 sm:size-7",
    fold: 6,
    foldClass: "size-1.5",
    lines: true,
  },
  sm: {
    button: "size-5",
    note: "size-4",
    fold: 4,
    foldClass: "size-1",
    lines: false,
  },
} as const;

/**
 * The agent's sticky note on a property: a small note after the address
 * (the address's size) that, when clicked, flies to the top right and opens
 * so they can jot their thoughts. Autosaves to the report; private (the AI
 * chat doesn't read it). Shown on the report, the comparison and both chats;
 * every copy of one property's note shares its colour and text.
 */
export function StickyNote({
  report,
  street,
  size = "lg",
}: {
  /** The live report (from its query), so copies of the note stay in step. */
  report: ReportData;
  street: string;
  size?: keyof typeof SIZES;
}) {
  const reportId = report.id;
  const color = colorFor(reportId);
  const look = SIZES[size];
  // Unique per copy: the same report's note can be on screen twice.
  const layoutId = `sticky-note-${useId()}`;
  const [open, setOpen] = useState(false);
  const saved = getSection(report, SECTION_KEYS.notes, notesSchema)?.text ?? "";
  const [text, setText] = useState(saved);
  // Another copy of this note saved (the cache changed): pick it up while
  // this one is closed. Adjusting state during render, not in an effect.
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    if (!open) setText(saved);
  }
  const hydrated = useHydrated();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Autosave after a pause in typing, and right away on close.
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate: save, isPending: saving } = useMutation(
    trpc.report.saveNotes.mutationOptions({
      // Keep the cached report in step (the same report opens elsewhere,
      // e.g. a comparison's A/B view).
      onSuccess: ({ savedAt }, { text }) => {
        queryClient.setQueryData(
          trpc.report.byId.queryKey({ id: reportId }),
          (report) =>
            report && {
              ...report,
              sections: [
                ...report.sections.filter((s) => s.key !== SECTION_KEYS.notes),
                {
                  reportId,
                  key: SECTION_KEYS.notes,
                  data: { text, savedAt },
                  updatedAt: savedAt,
                },
              ],
            },
        );
      },
    }),
  );
  const dirty = useRef(false);
  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    save({ id: reportId, text });
  };
  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      save({ id: reportId, text });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, reportId, save]);

  const close = () => {
    flush();
    setOpen(false);
  };
  // Escape, or a click anywhere outside the note, closes it. (The small
  // note is excluded: its own click would reopen it straight away.)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close reads the latest text
  }, [open, text]);

  const hasText = text.trim().length > 0;

  return (
    <>
      {/* The small note: same size as the address text. Its slot stays
          while it's open, so the heading never shifts. */}
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        aria-label={hasText ? "Open your notes" : "Add a note"}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn("shrink-0 p-0 hover:bg-transparent", look.button)}
      >
        {!open && (
          <motion.span
            layoutId={layoutId}
            transition={SPRING}
            initial={false}
            whileHover={{ rotate: 0, scale: 1.08 }}
            style={{
              backgroundColor: color.paper,
              clipPath: foldClip(look.fold),
              rotate: -6,
            }}
            className={cn("relative block shadow-sm", look.note)}
          >
            {/* The fold, and a few lines when there's something written. */}
            <span
              aria-hidden
              className={cn("absolute right-0 bottom-0", look.foldClass)}
              style={{ backgroundColor: color.fold }}
            />
            {hasText && look.lines && (
              <span
                aria-hidden
                className="absolute inset-x-1 top-1.5 space-y-1"
              >
                {[100, 80, 55].map((w) => (
                  <span
                    key={w}
                    className="block h-px opacity-40"
                    style={{ width: `${w}%`, backgroundColor: color.ink }}
                  />
                ))}
              </span>
            )}
          </motion.span>
        )}
      </Button>

      {/* The open note, pinned top right (portal: clear of any transformed
          or clipped parent). */}
      {hydrated &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="note"
                ref={panelRef}
                layoutId={layoutId}
                transition={SPRING}
                role="dialog"
                aria-label={`Your notes on ${street}`}
                style={{
                  backgroundColor: color.paper,
                  color: color.ink,
                  clipPath: foldClip(28),
                  rotate: 1.5,
                }}
                className="fixed top-16 right-4 z-50 flex h-[min(24rem,calc(100svh-6rem))] w-[min(22rem,calc(100vw-2rem))] flex-col shadow-[0_24px_48px_-16px_rgb(0_0_0/0.35)] sm:right-6"
              >
                <span
                  aria-hidden
                  className="absolute right-0 bottom-0 size-7"
                  style={{ backgroundColor: color.fold }}
                />
                {/* Content fades in once the note has landed (the flight
                    scales it), and out first on close. */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { delay: 0.2 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex items-start gap-2 px-4 pt-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">My notes</p>
                      <p className="truncate text-xs opacity-65">{street}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Close notes"
                      onClick={close}
                      className="-mt-1 -mr-2 text-current hover:bg-black/10 hover:text-current"
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <Textarea
                    autoFocus
                    value={text}
                    maxLength={10_000}
                    onChange={(e) => {
                      dirty.current = true;
                      setText(e.target.value);
                    }}
                    placeholder="Your thoughts on this property…"
                    aria-label="Notes"
                    className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-4 py-2 text-[15px] leading-relaxed text-current shadow-none placeholder:text-current placeholder:opacity-45 focus-visible:ring-0 dark:bg-transparent"
                  />
                  <p className="px-4 pb-3 text-[11px] opacity-60">
                    {saving
                      ? "Saving…"
                      : "Saved to this report · only you can see it"}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
