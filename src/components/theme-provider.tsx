"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Light / dark / system theme (next-themes, as in the shadcn guide): puts
 * the `dark` class on <html>, which globals.css's `.dark` tokens and the
 * `dark:` variant key off. Remembered per browser.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
