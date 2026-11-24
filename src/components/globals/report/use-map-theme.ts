"use client";

import { useTheme } from "next-themes";
import type { MapTheme } from "./map-style";

/** The map palette for the app's current (resolved) light or dark theme. */
export function useMapTheme(): MapTheme {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}
