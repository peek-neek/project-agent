"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

// A thin progress bar under the app header while something loads: a page
// navigation (started by links via `startNavigationProgress`) or a page's
// content streaming in (any mounted `<LoadingSignal />`, e.g. inside the
// report and chat skeletons).

type Phase = "idle" | "loading" | "done";

let loaders = 0;
let navigating = false;
let phase: Phase = "idle";
let navTimer: ReturnType<typeof setTimeout> | undefined;
let doneTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Recompute the phase after any change: loading → done → idle. */
function emit() {
  const busy = loaders > 0 || navigating;
  if (busy) {
    // Cancel a pending fade only when loading starts again.
    clearTimeout(doneTimer);
    phase = "loading";
  } else if (phase === "loading") {
    phase = "done";
    doneTimer = setTimeout(() => {
      phase = "idle";
      listeners.forEach((l) => l());
    }, 450);
  }
  listeners.forEach((l) => l());
}

/** Call when a navigation starts (e.g. a Link's `onNavigate`). */
export function startNavigationProgress() {
  navigating = true;
  clearTimeout(navTimer);
  // Same-URL clicks never change the path: don't spin forever.
  navTimer = setTimeout(() => {
    navigating = false;
    emit();
  }, 8000);
  emit();
}

const phase_ = () => phase;

function endNavigation() {
  if (!navigating) return;
  navigating = false;
  clearTimeout(navTimer);
  emit();
}

/** Keeps the bar running while mounted (place inside loading skeletons). */
export function LoadingSignal() {
  useEffect(() => {
    loaders += 1;
    emit();
    return () => {
      loaders -= 1;
      emit();
    };
  }, []);
  return null;
}

/**
 * The bar itself: creeps toward 90% while busy, then fills and fades. Sits
 * at the bottom edge of its (relative) parent, the header.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const phase = useSyncExternalStore(
    subscribe,
    () => phase_(),
    () => "idle" as Phase,
  );

  // A new path means the navigation landed (its content may still stream).
  useEffect(() => {
    endNavigation();
  }, [pathname]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
        style={{
          width: phase === "idle" ? "0%" : phase === "loading" ? "90%" : "100%",
          opacity: phase === "idle" ? 0 : 1,
          transition:
            phase === "loading"
              ? "width 8s cubic-bezier(0.1, 0.6, 0.2, 1), opacity 150ms"
              : phase === "done"
                ? "width 200ms ease-out, opacity 250ms ease-out 200ms"
                : "none",
        }}
      />
    </div>
  );
}
