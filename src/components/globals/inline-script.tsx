"use client";

/**
 * Client component on purpose (as in the Next.js guide): `typeof window`
 * must be evaluated in the browser so client renders emit text/plain.
 *
 * Runs during HTML parsing on full page loads (before first paint). On the
 * client it renders as text/plain so React doesn't warn about <script> tags;
 * scripts inserted during client navigation never execute anyway.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
