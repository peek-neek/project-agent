// Shared by Next.js and Trigger.dev tasks (no "server-only" import).

/**
 * Transaction limits for dataset imports (replace a whole table at once).
 * Prisma's defaults (start within 2 s, finish within 5 s) are too short
 * here: a Trigger.dev run opens a fresh TLS connection to the database,
 * which can take a few seconds, and inserting thousands of rows takes
 * longer than 5 s. The rows are still swapped all or nothing.
 */
export const BULK_TRANSACTION = { maxWait: 30_000, timeout: 300_000 } as const;
