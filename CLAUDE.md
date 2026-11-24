# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Next.js version caveat

This project runs **Next.js 16.4 / React 19.3**, which may differ from what you were trained on. Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (`01-app/` covers the App Router: getting-started, guides, api-reference) and follow any deprecation notices. `next.config.ts` turns on `cacheComponents`, `partialPrefetching` and `experimental.agentFeedback`, so caching and prerendering behave differently from older Next versions. Route and layout props use the generated global types (for example `LayoutProps<"/">` in `src/app/layout.tsx`).

## Commands

```bash
npm run dev     # next dev (Turbopack), http://localhost:3000
npm run build   # next build
npm run start   # serve the production build
npm run lint    # eslint (flat config: next core-web-vitals + typescript)
npx tsc --noEmit  # type-check (no script for it)
```

No test framework is set up yet.

## Architecture

### tRPC + TanStack Query (`src/trpc/`)

The API is a tRPC v11 router served through a Next route handler and used through the `@trpc/tanstack-react-query` integration (the `queryOptions` style, not the older `@trpc/react-query` hooks).

- `init.ts` creates the tRPC instance and exports `createTRPCRouter`, `baseProcedure` and `createCallerFactory`. `createTRPCContext` is wrapped in React `cache()` and for now returns a hard-coded `{ userId: "user_123" }`. Auth isn't wired up yet.
- `routers/_app.ts` is the root `appRouter`; it exports the `AppRouter` type. Add procedures or sub-routers here.
- `src/app/api/trpc/[trpc]/route.ts` exposes the router at `/api/trpc` (GET and POST) via `fetchRequestHandler`.
- `server.tsx` (`server-only`) is for Server Components. It provides `trpc` (an options proxy bound to a per-request `getQueryClient`), `prefetch()`, `HydrateClient` (dehydrates into a `HydrationBoundary`) and `caller` for direct server-side calls. The usual pattern: `prefetch(trpc.x.queryOptions(...))` in a Server Component, wrap the children in `<HydrateClient>`, then `useQuery(useTRPC().x.queryOptions(...))` in a Client Component.
- `client.tsx` (`"use client"`) provides `TRPCReactProvider` and `useTRPC`. The browser keeps a single QueryClient; the server makes a new one per call. **`TRPCReactProvider` is not yet mounted in `src/app/layout.tsx`**, so wrap the app in it before using `useTRPC` on the client.
- `query-client.ts` sets `staleTime: 30s`, dehydrates pending queries (so streamed prefetches work) and turns off error redaction (Next.js needs those errors to detect dynamic rendering). `superjson` is installed, but the transformer is commented out in `init.ts`, `client.tsx` and `query-client.ts`. To enable it, change all three together.

### UI (`src/components/ui/`)

These are shadcn components in the **`base-nova`** style, built on **Base UI (`@base-ui/react`)**, not Radix. Primitives use Base UI APIs, such as the `render` prop rather than `asChild`. Add components with `npx shadcn add <name>`, which reads `components.json` (aliases `@/components`, `@/components/ui`, `@/lib`, `@/hooks`). The set includes chat/agent-oriented pieces (`message`, `message-scroller`, `bubble`, `attachment`, `trace`, `code-block`, `questionnaire`).

- Class merging uses the `cn` npm package (a compiled replacement for clsx + tailwind-merge). Components import it from `"cn"` directly; `@/lib/utils` re-exports it.
- Styling is Tailwind CSS v4, configured CSS-first in `src/app/globals.css` with no `tailwind.config`. It imports `tw-animate-css` and `shadcn/tailwind.css`, defines theme tokens as CSS variables in `@theme inline`, and implements dark mode as a `.dark` class variant. Turbopack processes CSS with `@tailwindcss/turbopack` (set in `next.config.ts`).
- Syntax highlighting: `src/lib/highlighter.tsx` keeps one lazily created Shiki core highlighter (JS regex engine, github light and dark themes) and loads languages on first use from an allowlist. To support a new language, add it to the `languages` map. `src/hooks/use-highlighted-code.ts` highlights code incrementally as it streams, carrying Shiki grammar state between lines, so only new lines get re-tokenized.

### Path alias

`@/*` → `./src/*`.

### Agent skills

`.claude/skills/` and `.agents/skills/` contain Clerk skills installed from `clerk/skills` (pinned in `skills-lock.json`). The Clerk SDK isn't in `package.json` yet. Use the `clerk-setup` / `clerk-nextjs-patterns` skills when adding auth, which would replace the stub `userId` in `createTRPCContext`.

### USE SHADCN COMPONENTS WHEREVER YOU CAN

Build every piece of UI from `src/components/ui` (shadcn, base-nova): `Button`, `Input`, `Dialog`/`AlertDialog`, `Alert`, `Badge`, `Item`, `Progress`, `ToggleGroup`/`ButtonGroup`, `Tooltip`, `Skeleton` and the rest. Don't hand-roll a raw `<button>`, `<input>`, `<select>`, dialog or pill styled with Tailwind when a shadcn component exists, and that includes UI rendered into third-party containers (map controls, portals, popups). Links that look like buttons are `Button` with `nativeButton={false}` and `render={<Link … />}` (or `<a>`). If a needed component is missing, add it with `npx shadcn add <name>` instead of writing one. If a third-party stylesheet would restyle a shadcn component (e.g. MapLibre's `.maplibregl-ctrl-group button`), keep the shadcn component and drop the conflicting class.

<!-- TRIGGER.DEV SKILLS START -->
## Trigger.dev agent skills

This project has Trigger.dev agent skills installed in `.claude/skills/`. Before writing or changing Trigger.dev code (background tasks, scheduled tasks, realtime, or chat.agent AI agents), load the most relevant skill: `trigger-authoring-chat-agent`, `trigger-authoring-tasks`, `trigger-chat-agent-advanced`, `trigger-cost-savings`, `trigger-getting-started`, `trigger-realtime-and-frontend`.
<!-- TRIGGER.DEV SKILLS END -->
