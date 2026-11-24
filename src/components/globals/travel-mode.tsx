"use client";

import {
  BikeIcon,
  CarIcon,
  FootprintsIcon,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useSyncExternalStore,
} from "react";
import { cn } from "cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  parseTravelMode,
  TRAVEL_MODE_COOKIE,
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

/** Mirror the mode into a cookie so the server renders the same times. */
function writeCookie(mode: TravelMode) {
  document.cookie = `${TRAVEL_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

function read(): TravelMode {
  if (current) return current;
  try {
    current = parseTravelMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    current = "walk";
  }
  // Saved before the cookie existed: add it, so the next load matches.
  if (!document.cookie.includes(`${TRAVEL_MODE_COOKIE}=${current}`)) {
    writeCookie(current);
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
  writeCookie(mode);
  listeners.forEach((l) => l());
}

/**
 * The mode the server rendered with (from the cookie), so hydration uses
 * the same times and the page doesn't flash walk times first. Outside a
 * provider (the static app shell) it's "walk".
 */
const ServerModeContext = createContext<TravelMode>("walk");

export function TravelModeProvider({
  mode,
  children,
}: {
  mode: TravelMode;
  children: React.ReactNode;
}) {
  return <ServerModeContext value={mode}>{children}</ServerModeContext>;
}

const subscribeNothing = () => () => {};
/** False during server render and hydration, true after. */
export const useHydrated = () =>
  useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );

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
 * Server render and hydration use the cookie's mode (via TravelModeProvider).
 */
export function useTravelMode() {
  const serverMode = useContext(ServerModeContext);
  const mode = useSyncExternalStore(subscribe, read, () => serverMode);
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
  // The selection underline slides between the three modes.
  const underlineId = `${useId()}-travel`;
  // The header is prerendered without the saved mode: fade in once known,
  // rather than showing "Walk" pressed and then switching.
  const hydrated = useHydrated();
  return (
    <ToggleGroup
      aria-label="Show travel times for"
      className={cn(
        "transition-opacity duration-200",
        hydrated ? "opacity-100" : "opacity-0",
      )}
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
                  // Selected: an underline (no fill) and full-strength text.
                  className="relative gap-1.5 bg-card px-2.5 text-foreground/60 hover:text-foreground aria-pressed:bg-card aria-pressed:text-foreground data-pressed:bg-card data-pressed:text-foreground dark:border-muted dark:bg-muted dark:hover:bg-accent dark:aria-pressed:bg-muted dark:data-pressed:bg-muted"
                />
              }
            >
              <Icon aria-hidden />
              <span className="hidden sm:inline">{TRAVEL_MODES[m].label}</span>
              {mode === m && hydrated && (
                <motion.span
                  layoutId={underlineId}
                  transition={{
                    type: "spring",
                    bounce: 0.2,
                    visualDuration: 0.3,
                  }}
                  className="absolute inset-x-1.5 bottom-0 h-0.5 bg-primary"
                />
              )}
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
