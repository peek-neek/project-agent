"use client";

import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";

/** Cookie written by shadcn's SidebarProvider whenever the sidebar toggles. */
export const SIDEBAR_COOKIE = "sidebar_state";
const COLLAPSED = new RegExp(`(?:^|; )${SIDEBAR_COOKIE}=false(?:;|$)`);

/**
 * Inline script for the layout, placed right after the sidebar: applies the
 * saved collapsed state before first paint, so the static (prerendered) shell
 * never flashes open. Next.js "preventing flash before hydration" pattern.
 */
export const SIDEBAR_STATE_SCRIPT = `(function(){try{if(${COLLAPSED}.test(document.cookie)){var el=document.querySelector('[data-slot="sidebar"][data-state]');if(el){el.setAttribute("data-state","collapsed");el.setAttribute("data-collapsible","icon")}}}catch(e){}})()`;

/**
 * SidebarProvider whose initial state reads the same cookie as the inline
 * script, so React's first client render matches the corrected DOM.
 */
export function PersistedSidebarProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [defaultOpen] = useState(() =>
    typeof document === "undefined" ? true : !COLLAPSED.test(document.cookie),
  );
  return (
    <SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>
  );
}
