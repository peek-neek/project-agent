// Removes one line from @clerk/nextjs that breaks partial prerendering.
//
// Clerk's Pages Router provider (dist/{esm,cjs}/pages/ClerkProvider.js) renames
// the shared @clerk/react provider on load:
//   ReactClerkProvider.displayName = "ReactClerkProvider";
// Any client component importing "@clerk/nextjs" pulls that file in, so the
// provider's name depends on module load order. The build-time prerender of a
// page records "ReactClerkProvider"; the request-time resume sees
// "ClerkProvider". React compares names along the path, finds a mismatch and
// falls back to client rendering ("Expected the resume to render
// <ReactClerkProvider> in this slot but instead it rendered <ClerkProvider>").
//
// Idempotent; warns (and changes nothing) once Clerk no longer has the line.
// Runs on postinstall. Remove when a Clerk release drops the rename.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// The package doesn't export package.json: walk up from its main entry to the
// package.json named @clerk/nextjs (dist/ has nested ones without a name).
const isRoot = (dir) => {
  const file = join(dir, "package.json");
  return existsSync(file) && JSON.parse(readFileSync(file, "utf8")).name === "@clerk/nextjs";
};
let root = dirname(require.resolve("@clerk/nextjs"));
while (!isRoot(root)) {
  if (dirname(root) === root) throw new Error("clerk: @clerk/nextjs root not found");
  root = dirname(root);
}
const RENAME = /^.*\.displayName = "ReactClerkProvider";\r?\n/m;

let patched = 0;
for (const format of ["esm", "cjs"]) {
  const file = join(root, "dist", format, "pages", "ClerkProvider.js");
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!RENAME.test(source)) continue;
  writeFileSync(file, source.replace(RENAME, ""));
  patched++;
}

const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
console.log(
  patched
    ? `clerk: removed the ReactClerkProvider rename (${patched} files, @clerk/nextjs ${version})`
    : `clerk: no ReactClerkProvider rename in @clerk/nextjs ${version} (already patched or fixed upstream)`,
);
