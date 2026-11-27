import {
  additionalFiles,
  aptGet,
} from "@trigger.dev/build/extensions/core";
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
    // Native binaries (Remotion's Rust compositor and FFmpeg): installed in
    // the image for Linux instead of bundled.
    external: ["@remotion/renderer"],
    extensions: [
      // Prisma 7 (prisma-client generator + driver adapter). Run
      // `npm run db:generate` before `npm run dev:trigger`.
      prismaExtension({ mode: "modern" }),
      // MP4 export (report-video-render): the Remotion site, bundled ahead
      // of time by `npm run video:bundle`...
      additionalFiles({ files: ["build/remotion/**"] }),
      // ...and the shared libraries Chrome Headless Shell needs on Debian
      // (https://www.remotion.dev/docs/miscellaneous/linux-dependencies),
      // plus a fallback font so text can never render blank.
      aptGet({
        packages: [
          "libnss3",
          "libdbus-1-3",
          "libatk1.0-0",
          "libgbm-dev",
          "libasound2",
          "libxrandr2",
          "libxkbcommon-dev",
          "libxfixes3",
          "libxcomposite1",
          "libxdamage1",
          "libpango-1.0-0",
          "libcairo2",
          "libcups2",
          "libatk-bridge2.0-0",
          "fonts-dejavu-core",
        ],
      }),
    ],
  },
});
