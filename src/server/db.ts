import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Shared by Next.js and Trigger.dev tasks, so no "server-only" import here
// (it throws outside Next's server bundle).

// Prisma Postgres caps *direct* connections low (10 on Free/Starter, 5 kept
// for the platform), and every process here (Next.js, each Trigger.dev run,
// Vercel functions) opens its own pool. So:
// - App traffic uses the pooled endpoint (pooled.db.prisma.io) when
//   DATABASE_POOLED_URL is set; DATABASE_URL (direct) stays for migrations.
// - Pools stay small and drop idle connections quickly, so a few parallel
//   report steps can't exhaust the direct limit on their own.
const pooledUrl = process.env.DATABASE_POOLED_URL;
const connectionString = pooledUrl || process.env.DATABASE_URL!;
const maxConnections =
  Number(process.env.DATABASE_POOL_MAX) || (pooledUrl ? 5 : 1);

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: maxConnections,
      // Give idle connections back fast (direct slots are scarce).
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
    }),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
