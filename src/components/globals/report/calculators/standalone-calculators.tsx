"use client";

import { useState, useSyncExternalStore } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type SavedCalculators,
  savedCalculatorsSchema,
} from "@/lib/finance/scenario";
import { CalculatorsTab } from "./calculators-tab";

/** Bump the suffix if the stored shape ever changes incompatibly. */
const STORAGE_KEY = "calculators:standalone:v1";

/** This browser's figures, if any and still valid; null otherwise. */
function readStored(): SavedCalculators | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = savedCalculatorsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

const subscribe = () => () => {};

/**
 * The calculators with no report behind them: figures autosave to this
 * browser. Server render and hydration show a skeleton, so the stored
 * figures appear without a flash of the example ones.
 */
export function StandaloneCalculators() {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  // Read once; CalculatorsTab only uses `saved` for its first state.
  const [saved] = useState(() =>
    typeof window === "undefined" ? null : readStored(),
  );
  if (!inBrowser) return <Skeleton className="h-[40rem] w-full" />;
  return (
    <CalculatorsTab
      storageKey={STORAGE_KEY}
      listPrice={null}
      city={null}
      province={null}
      propertyType={null}
      saved={saved}
    />
  );
}
