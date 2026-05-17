# Phase 87 — Web Chassis & GitHub Pages Foundation

> Pre-card UI scaffolding. The renderer chassis the card layer plugs
> into. Implements the structural decisions from `cards-contract.md` §9
> and `game-loop-and-ux.md` §3, §6, §7. Numbered 87 per the roadmap in
> `game-loop-and-ux.md` §10, displacing the original "card-layer
> foundation" framing of phase 87, which becomes phase 88 (card
> registry + selection algorithm + 8 starter templates).

## Why

The simulation is complete (phases 1–86) but had no player surface.
`cards-contract.md` locks the card layer's read/write contract;
`game-loop-and-ux.md` locks the player experience. Both documents
deliberately defer the question of *where* and *how* cards render —
that's this phase. The deliverable is a public, mobile-first website
that:

- Deploys via GitHub Actions to GitHub Pages at
  `https://cigthepig.github.io/goblin-tavern/`.
- Renders the visual chassis (palette, typography, layout) all
  subsequent UI phases inherit.
- Provides `<CardRenderer>` as the integration point for the future
  card layer.
- Runs the real sim end-to-end (`createInitialTavernState` →
  `simulateDay`) and surfaces pressures, coin, day header, and the
  daily diff directly from state — proving the wiring before cards
  exist.

## Locked Decisions

- **Stack**: Svelte 5 + Vite + TypeScript. Two tsconfigs — root stays
  DOM-free per CLAUDE.md rule 1; `tsconfig.web.json` adds `DOM` lib
  scoped to `web/**`.
- **Project shape**: `web/` at repo root; single root `package.json`;
  sim consumed via direct relative imports.
- **Build base**: `/goblin-tavern/` (project Pages URL).
- **Routing**: in-memory `$state` route enum — five screens, no deep
  links needed for foundation. Swap to a router lib when phase 89+
  earn it.
- **State boundary**: `web/src/lib/sim/gameStore.svelte.ts` is the
  SOLE caller of `simulateDay`. Every screen reads from
  `gameStore.state`; every mutation flows through `runDay(input)`.
- **Visual baseline**: Cinzel display + EB Garamond body + IBM Plex
  Mono data; dark "tavern at night" default with parchment via
  `prefers-color-scheme: light`; all motion ≤ 220ms and gated on
  `prefers-reduced-motion`.
- **Card integration**: `<CardRenderer card={cardView}/>` accepts the
  `CardView` shape from cards-contract §6. A throwaway
  `mockCardRegistry.ts` wraps real `IssueSeed`s into `CardView`s so
  the chassis is proven against actual sim output (delete when
  `src/cards/` lands in phase 88).

## Delivered

### Deploy infrastructure
- `.github/workflows/deploy.yml` — Pages artifact + `deploy-pages@v4`
  on `push: main` + `workflow_dispatch`; runs `npm run check`,
  `typecheck`, `build` before upload.
- `vite.config.ts` (root) — `root: 'web'`, `base: '/goblin-tavern/'`,
  `build.outDir: '../dist'`.
- `tsconfig.web.json` — extends root, adds DOM lib, includes
  `web/**` + `src/sim/**`.
- `svelte.config.js` — runes enabled.
- `package.json` — adds `dev`, `build`, `preview`, `check` scripts.

### Design system
- `web/src/lib/design/global.css` — palette, semantic tokens,
  typography scale, motion primitives, reduced-motion overrides,
  parchment-mode override.
- `web/src/lib/design/tokens.ts` — runtime-side palette/spacing
  exports + `pressureColor(value)` interpolator.
- Fonts via Google Fonts `<link>` in `web/index.html` (subset
  pre-pinned). Future optimization: self-host with woff2 subset.

### Sim integration
- `web/src/lib/sim/gameStore.svelte.ts` — class-based store with
  `state`, `latestResult`, `seedString` reactive fields; `runDay`,
  `reset`, `todaysSeeds` API. Imports `FULL_PIPELINE` from
  `src/sim/testing/simRunner.ts` as the canonical module list.
- `web/src/lib/sim/significantDiffs.ts` — projection helper from
  `SimResult.diffs` to UI rows.

### Card layer chassis
- `web/src/lib/cards/types.ts` — `CardView`, `CardChoice`,
  `CardDefinition` mirroring contract §6 shapes (becomes a
  re-export when `src/cards/types.ts` lands).
- `web/src/lib/cards/CardRenderer.svelte` — pure presentational
  component: title + body + stakes + choices + always-visible
  ignore + wax-seal accent on severity ≥ 70.
- `web/src/lib/cards/mockCardRegistry.ts` — throwaway adapter
  composing `CardView` from `seed.textIngredients` using the
  descriptor pools in `src/sim/content/text/descriptors.ts`.

### Screens & navigation
- `web/src/lib/screens/StartScreen.svelte` — single-screen landing
  with candle-flicker accent, "Open the Tavern" CTA, advanced
  disclosure for seed override.
- `web/src/lib/screens/DayScreen.svelte` — morning briefing (Beat 1)
  + Run Service button → end-of-day report dialog (Beat 5 trimmed
  to header + top significant diffs).
- `web/src/lib/screens/ComingSoon.svelte` — single shared placeholder
  for Reports / Tavern / World tabs.
- `web/src/lib/components/{AppShell, TopBar, BottomNav, PressureRibbon, Icon}.svelte`
  — layout primitives. PressureRibbon reads `state.pressures` directly
  (no card needed for early-warning signal).

### App entry
- `web/index.html`, `web/src/main.ts`, `web/src/App.svelte` — route
  enum, mounts AppShell + active screen.

## Critical Files Referenced (read-only)

- `src/sim/core/engine.ts:1460` — `simulateDay`
- `src/sim/state/defaults.ts:620` — `createInitialTavernState`
- `src/sim/testing/simRunner.ts:62` — `FULL_PIPELINE` (the canonical
  module list passed to `simulateDay`)
- `src/sim/state/TavernState.ts:685` — full state shape
- `src/sim/modules/issues/issueSeedTypes.ts` — `IssueSeed`,
  `TextIngredients`, `ResponseIntent`
- `src/sim/content/text/descriptors.ts` — `pickSeverityAdjective`,
  `severityTier`
- `docs/plans/cards-contract.md` §6 — locked CardView/CardDefinition
- `docs/plans/game-loop-and-ux.md` §3, §6, §7 — beat structure,
  screen map, mobile considerations

## Verification

1. `npm test` (sim) — passes unchanged (no sim files modified).
2. `npm run typecheck` (root tsconfig) — passes; sim stays DOM-free.
3. `npm run check` (web tsconfig via `svelte-check`) — passes.
4. `npm run build` — emits `dist/` with `/goblin-tavern/` base paths;
   gzipped JS bundle < 80 KB target.
5. Local `npm run dev` — landing → Open the Tavern → DayScreen → Run
   Service → diff dialog → Next Day → repeat 7+ days with no crash.
6. Cards: at least one `morning_prep` seed appears within first 7
   days; `<CardRenderer>` renders it via `mockCardRegistry`; both
   choice tap and Ignore advance cleanly.
7. Mobile shape: tested at 390×844 — no horizontal scroll, all tap
   targets ≥ 44pt, bottom nav reachable in thumb zone.
8. `prefers-reduced-motion: reduce` — flicker stops, transitions
   collapse to ~0ms.
9. GitHub Pages deploy: workflow runs green on push to `main`;
   published site loads at `https://cigthepig.github.io/goblin-tavern/`.

## Explicitly Out of Scope

- **Real `cardRegistry` in `src/cards/`** — phase 88.
- **Owner action picker** + **staff priority sheet** — phase 88.
- **`during_service` / `closing` card beats** — phase 88.
- **Full Beat 5 report** (causes drilldown, future_hooks, etc.) — phase 89.
- **Weekly / Monthly screens** — phases 90, 91.
- **Reputation bar chart** — phase 91 (text-line stand-in for now).
- **Tavern + World screen content** — phases 92, 93.
- **History / Tavern Log** — phase 94.
- **Save / load (browser storage)** — future phase. Foundation runs
  in-memory; closing the tab loses progress.
- **PWA / install prompts / push notifications** — likely never
  (see game-loop §7.5).

## Risks / Notes

- **Vite base path**: any runtime asset reference must use
  `import.meta.env.BASE_URL`. Fonts live in `<link>` in
  `index.html` and are rewritten by Vite automatically; favicon
  follows the same pattern.
- **Svelte 5 type ergonomics**: `$props()` rune + strict TS works,
  but optional props with `exactOptionalPropertyTypes` need explicit
  `| undefined` types (used throughout).
- **`CardView` type drift**: `web/src/lib/cards/types.ts` currently
  defines the contract types ahead of `src/cards/`. When phase 88
  lands the real types under `src/cards/types.ts`, the web file
  should become a re-export rather than the source of truth.
- **Font hosting**: Google Fonts via `<link>` is the foundation
  choice. A small follow-up phase can subset and self-host to drop
  one external request and improve LCP.
- **Card output quality**: `mockCardRegistry` does the minimum to
  prove the chassis. Card writing voice is phase 95+ work.
