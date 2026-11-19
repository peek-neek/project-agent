"use client";

import {
  BikeIcon,
  CarIcon,
  FootprintsIcon,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TRAVEL_MODES,
  type TravelMode,
  travelModes,
  type TravelTimes,
  travelTime,
} from "@/lib/travel";

export const TRAVEL_ICONS: Record<TravelMode, LucideIcon> = {
  walk: FootprintsIcon,
  bike: BikeIcon,
  drive: CarIcon,
};

/** Beyond this, a walk time isn't useful: show the distance instead. */
const WALKABLE_METERS = 2500;

// App-wide travel mode: one small store, remembered in this browser.
const STORAGE_KEY = "travel-mode";
const listeners = new Set<() => void>();
let current: TravelMode | null = null;

function read(): TravelMode {
  if (current) return current;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    current = saved && saved in TRAVEL_MODES ? (saved as TravelMode) : "walk";
  } catch {
    current = "walk";
  }
  return current;
}

export function setTravelMode(mode: TravelMode) {
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private mode / blocked storage: still works for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in step.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    current = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The selected travel mode, plus helpers to show any place's time in it.
 * Server render (and hydration) uses "walk"; the saved mode applies after.
 */
export function useTravelMode() {
  const mode = useSyncExternalStore(subscribe, read, () => "walk" as const);
  const time = useCallback(
    (place: TravelTimes) => travelTime(place, mode),
    [mode],
  );
  /** "~12 min" (with "~" when estimated). */
  const minutes = useCallback(
    (place: TravelTimes) => {
      const t = travelTime(place, mode);
      return `${t.estimated ? "~" : ""}${t.minutes} min`;
    },
    [mode],
  );
  /** Walking is only worth quoting nearby; beyond that show distance. */
  const showsTime = useCallback(
    (place: { distanceMeters: number }) =>
      mode !== "walk" || place.distanceMeters <= WALKABLE_METERS,
    [mode],
  );
  return {
    mode,
    showsTime,
    icon: TRAVEL_ICONS[mode],
    /** "walk" / "bike" / "drive", e.g. "12 min walk". */
    verb: TRAVEL_MODES[mode].verb,
    time,
    minutes,
  };
}

/** Walk / Cycle / Car switch for the app header. */
export function TravelModeToggle() {
  const { mode } = useTravelMode();
  return (
    <ToggleGroup
      aria-label="Show travel times for"
      value={[mode]}
      onValueChange={(value) => {
        const next = value[0] as TravelMode | undefined;
        if (next) setTravelMode(next);
      }}
      variant="outline"
      size="sm"
      spacing={0}
    >
      {travelModes.map((m) => {
        const Icon = TRAVEL_ICONS[m];
        return (
          <Tooltip key={m}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={m}
                  aria-label={`${TRAVEL_MODES[m].label} times`}
                  className="gap-1.5 bg-card px-2.5 data-pressed:bg-foreground data-pressed:text-background"
                />
              }
            >
              <Icon aria-hidden />
              <span className="hidden sm:inline">{TRAVEL_MODES[m].label}</span>
            </TooltipTrigger>
            <TooltipContent>
              Show {TRAVEL_MODES[m].label.toLowerCase()} times everywhere
            </TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
