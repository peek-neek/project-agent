import "server-only";

import { headers } from "next/headers";

export type RateLimitRule = {
  /** Max requests allowed in each window. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  { success: true } | { success: false; retryAfterMs: number };

type Counter = { count: number; resetAt: number };

// In-memory fixed-window counters. They live in one server process, so on a
// multi-instance host (e.g. Vercel) each instance counts separately. Swap the
// store for Redis (e.g. @upstash/ratelimit) when deploying there; callers only
// depend on `check`.
const globalForLimits = globalThis as {
  __rateLimitCounters?: Map<string, Counter>;
};
const counters = (globalForLimits.__rateLimitCounters ??= new Map());

let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, counter] of counters) {
    if (counter.resetAt <= now) counters.delete(key);
  }
}

export function createRateLimiter(name: string, rules: RateLimitRule[]) {
  return {
    /** Counts one request for `key` against every rule. */
    check(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);

      const windows = rules.map((rule) => {
        const id = `${name}:${rule.windowMs}:${key}`;
        let counter = counters.get(id);
        if (!counter || counter.resetAt <= now) {
          counter = { count: 0, resetAt: now + rule.windowMs };
          counters.set(id, counter);
        }
        return { rule, counter };
      });

      const blocked = windows.filter(
        ({ rule, counter }) => counter.count >= rule.limit,
      );
      if (blocked.length > 0) {
        const retryAt = Math.max(...blocked.map((w) => w.counter.resetAt));
        return { success: false, retryAfterMs: retryAt - now };
      }

      for (const { counter } of windows) counter.count += 1;
      return { success: true };
    },
  };
}

/** Best-effort client IP from proxy headers (set by Vercel and most hosts). */
export async function getClientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
