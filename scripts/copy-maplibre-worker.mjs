// Copies MapLibre's web worker into public/ so it's served same-origin.
// Turbopack bundles maplibre-gl into a chunk, which breaks the worker URL
// MapLibre derives from its own file location. Runs on postinstall.
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const outDir = join(process.cwd(), "public", "vendor");
mkdirSync(outDir, { recursive: true });
// Remove workers from older versions.
for (const f of readdirSync(outDir)) {
  if (f.startsWith("maplibre-gl-worker-")) rmSync(join(outDir, f));
}
const target = join(outDir, `maplibre-gl-worker-${version}.mjs`);
copyFileSync(join(dirname(pkgPath), "dist", "maplibre-gl-worker.mjs"), target);
console.log(
  `maplibre worker → public/vendor/maplibre-gl-worker-${version}.mjs`,
);
