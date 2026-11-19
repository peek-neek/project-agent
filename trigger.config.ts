import { prismaExtension } from "@trigger.dev/build/extensions/prisma";
import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Trigger.dev project "project-agent"
  project: "proj_nzybxurqjjqrogojstbs",
  dirs: ["./src/trigger"],
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    extensions: [
      // Prisma 7 (prisma-client generator + driver adapter). Run
      // `npm run db:generate` before `npm run dev:trigger`.
      prismaExtension({ mode: "modern" }),
    ],
  },
});
