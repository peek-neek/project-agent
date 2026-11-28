// Shared by Next.js and Trigger.dev tasks (no "server-only" import).

/**
 * Transaction limits for dataset imports (replace a whole table at once).
 * Prisma's defaults (start within 2 s, finish within 5 s) are too short
 * here: a Trigger.dev run opens a fresh TLS connection to the database,
 * which can take a few seconds, and inserting thousands of rows takes
 * longer than 5 s. The rows are still swapped all or nothing.
 */
export const BULK_TRANSACTION = { maxWait: 30_000, timeout: 300_000 } as const;

/** Rows per INSERT: keeps each query (and the memory to build it) small. */
export const INSERT_CHUNK = 1_000;

/** `rows` in slices of INSERT_CHUNK, for createMany one slice at a time. */
export function chunks<T>(rows: T[], size = INSERT_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
