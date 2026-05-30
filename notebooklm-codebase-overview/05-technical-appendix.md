# Goblin Tavern — Technical Appendix

*A more detailed, accurate record for a technical reviewer (or a future version of the creator). It explains acronyms and avoids unnecessary jargon, but it goes deeper than the other documents. All figures were measured from the repository on the working branch as of this writing.*

## 1. Repository metrics

Measured directly from the repo (excluding `node_modules` and `.git`):

| Area | Files | Lines | Notes |
|---|---|---|---|
| Simulation + game logic (`src/`, `.ts`) | 575 | ~101,600 | The bulk of the project; headless, pure TypeScript |
| Tests (`tests/`, `.ts`) | 240 (231 are `*.test.ts`) | ~79,000 | Vitest suite, mirrors `src/` structure |
| Web UI (`web/src/`, `.svelte`) | 66 | ~15,700 | Plus 18 `.ts` files in `web/src` |
| Planning docs (`docs/`, `.md`) | 109 | ~46,000 | Of which 107 are in `docs/plans/` |
| Card specs (`specs/cards/`, `.yaml`) | 20 | — | One design spec per card type |
| Root project log (`CLAUDE.md`) | 1 | ~172 (very long lines) | Detailed phase-by-phase build log |

Other structural counts:
- **Simulation domain modules** (`src/sim/modules/`): **29** subfolders.
- **Card templates** (`src/cards/templates/`): **22** (21 situational templates + `fallback.ts`).
- **Snippet-pool files** (`src/cards/compose/pools/`): **143** `.ts` files across ~21 pool directories.
- **Quality gates** (`src/cards/compose/gates/`): ~12 distinct gate modules (plus shared helpers like `levenshtein.ts`, `runAllGates.ts`, `types.ts`).
- **Web screens** (`web/src/lib/screens/`): 6 active screens + 1 unused `ComingSoon.svelte` placeholder.
- **Reputation axes**: 10. **Pressures**: ~21 (10 canonical + 11 expanded). **Issue-seed families**: ~20. **Banded signals** (`src/sim/signals/`): ~17 entity/meter pairs.

Per the `CLAUDE.md` build log, the full Vitest suite stands at roughly **3,187 tests across ~230 files** at the most recent recorded baseline. (See §6 for what was independently re-run here.)

## 2. Technology stack

- **Language:** TypeScript (strict), ES modules.
- **Simulation dependencies:** intentionally minimal — `prando` (seeded pseudo-random number generator) and `zod` (runtime schema validation). No framework, no browser/runtime dependencies inside `src/sim/`.
- **Web UI:** Svelte 5 (using runes / `$state`) + Vite.
- **Test runner:** Vitest 1.6, with `jsdom` for component tests and `@testing-library/svelte`.
- **Type checking:** `tsc --noEmit`; Svelte checking via `svelte-check`.
- **Test wrapper:** `scripts/run-tests.mjs` wraps Vitest to fail the run if a worker drops mid-suite or the collected-vs-run test count disagrees (Vitest 1.6 otherwise exits 0 while silently dropping tests).

Key commands (from `package.json`):
- `npm test` — full Vitest suite via the hardened wrapper.
- `npm run typecheck` — TypeScript no-emit type check.
- `npm run check` — Svelte type checking against `tsconfig.web.json`.
- `npm run dev` / `npm run build` / `npm run preview` — Vite dev server / production build / preview.

Diagnostic scripts (`scripts/`): `diagnoseImpactScore.ts`, `diagnoseReadiness.ts` — read-only analysis tools for the issue-seed/consequence machinery.

## 3. Architecture, in implementation terms

### Engine entry point
`src/sim/core/engine.ts` exports `simulateDay(previousState, input, runConfig)` returning a `SimResult` of `{ state, reports, diffs, issueSeeds, logs, validation, debug }`. A day runs through an ordered pipeline of ~24 named phases defined in `src/sim/core/phases.ts` (`SIMULATION_PHASES`), from `startDay` → `identityGeneration` → various world updates → `forecastTraffic` → owner-action phases → `service` → `closing` → `applyResponses` → `endDay`/`endWeek`/`endMonth` → `generateReports` → `validate` → `advanceCalendar`.

### Module system
`src/sim/core/module.ts` defines `SimulationModule`. Each module registers state defaults, phase hooks, and (where relevant) issue-seed generators, report sections, and actions. The engine topologically sorts modules by declared dependencies and runs each phase's hooks in dependency order. This is the project's defence against "god files" — behaviour is partitioned across ~29 modules.

### State
`src/sim/state/TavernState.ts` defines `TavernState` as plain, JSON-serialisable data (a hard architectural rule: no class instances, functions, Maps/Sets, or circular references in state). Top-level slices: `meta`, `calendar`, `coin`, `areas`, `stock`, `staff`, `customerGroups`, `reputation`, `recipes`, `expeditions`, `world` (cultures, factions, suppliers, regulars, notable NPCs, hireable adventurers, local events, social rumours, tavern identity), `memories`, `history`, `causes`, `pressures`, and a `modules` bag for per-module private slices. Validated with Zod schemas (`schemas.ts`, `validation.ts`); save/load uses a versioned envelope (`saveEnvelope.ts`) with migrations (`migrations.ts`).

### Determinism & RNG
`src/sim/core/rng.ts` wraps `prando`. `createRng(seed, calls)` produces a reproducible stream; the engine also exposes **named RNG streams** (`ctx.getRngStream(streamId)`) so identity-style randomness (names, rosters) is isolated from ad-hoc per-day rolls — preventing an extra roll in one system from shifting outcomes in another. Architectural rule #5: no `Math.random()` anywhere in sim code.

### Causality
`src/sim/modules/causes/` + `attribution/` record a `CauseEntry` (`source`, `sourceType`, `target`, `amount`, `weight`, `readable`, `tags`) whenever a meaningful value changes, feeding reports, tooltips, and future card text.

### Signals
`src/sim/signals/` is the read-only query surface for the card layer: `querySignal(state, signalId, entityRef)` returns a banded reading (`low`/`mid`/`high`) or `missing`, plus pressure-trend and repeat-count helpers. This is the enforced boundary that lets cards read sim truth without duplicating it.

### Card composition
`src/cards/compose/` implements a slot/snippet/condition model:
- A template (`src/cards/templates/*.ts`) declares `appliesTo` (which seed family/type/timing it handles), an ordered list of `SlotSpec`s, and a `toCardView(filled, seed, state)` projection.
- `assemble.ts` (`assembleSlots` / `pickSnippet` / `pickSnippetTrace`) evaluates each snippet's flat-data `conditions`, keeps matches, and selects the highest-specificity candidate; ties are broken by an FNV hash of the seed, making selection deterministic but spread.
- `conditions.ts` / `types.ts` define ~13 flat-data condition primitives (`seedFamily`, `severityBelow`/`severityAtLeast`, `pressureRising`, `memoryPresent`, `repeatCount`, `hasTag`, `signalEquals`, `voiceAxis`, `verbalTic`, `responseVerb`/`responseShape`/`responseSlot`, `effectKind`/`effectTag`/`effectTargetKind`/`effectDirection`/`effectMagnitudeBand`, `inactionPreview`). All graceful-degrade to `false` when their context field is absent.
- `composeChoicesFromSeed` composes choice labels and per-effect previews from pools while keeping the mechanical truth (verb, target, effect kind/amount/tags) sourced from the sim.

### Gates
`src/cards/compose/gates/` — automated authoring QA, each a pure function returning a `GateReport`:
`coverage`, `specificity`, `voiceBounds`, `simCoherence`, `determinism`, `diversity`, `dedupe` (the seven always-on framework gates), plus `previewVariety` and `choiceDistinctness` (render-path gates), with `legibility`, `crossSituation`, `faithfulness`, and `reportLegibility` as multi-template/cross-cutting siblings. `runAllGates.ts` aggregates the per-template gates; harnesses in `tests/cards/compose/gates/` enforce that every shipped template is wired into the relevant gate registries (a completeness check, so a new template can't silently ship under-gated).

### Reports
`src/reports/` projects sim state/diffs into composed daily/weekly/monthly summaries (`dailyReportProjection.ts`, `yesterdayDigest`, `weeklyOverviewProjection`, `monthlyOverviewProjection`, `tavernLogProjection`, `worldOverviewProjection`), with its own snippet-pool/section composer mirroring the card layer's approach. Figures are sim-derived; only connective prose is composed.

### Web layer
`web/src/` is a thin Svelte shell. `web/src/lib/sim/gameStore.svelte.ts` is the **sole** caller of `simulateDay` in the web layer (`runDay(...)`), keeping all game logic in the engine. `App.svelte` routes between 6 screens; `persistence.ts` handles localStorage save/load with validation and graceful recovery.

## 4. Notable design discipline

- **Strict purity in `src/sim/`:** no DOM, network, timers, global mutable state, or `Math.random()`. The simulation runs headless in tests.
- **Registries for expandable concepts:** areas, stock, staff roles, actions, pressures, reputations, issue-seed families, and modules all route through `src/sim/registries/`, never hardcoded lists.
- **Identity is state, not display:** generated names/rosters are created once and stored, never regenerated on re-view (architectural rule #8).
- **Planning-led process:** `docs/plans/` contains locked design contracts (the founding simulation contract, the expansion arc, the cards contract, the game-loop/UX contract, the progressive-onboarding plan, and the card-composition framework) plus one plan per work phase, with `docs/ISSUE_TRACKER.md` as the authoritative work tracker.
- **Hardened test signal:** the `run-tests.mjs` wrapper exists specifically to prevent a known Vitest failure mode (silently dropped tests) from masking regressions.

## 5. Current limitations and unfinished areas

Stated honestly, grounded in the repo:

- **No production-grade visual UI.** The web UI is functional and playable but intentionally plain (text-led, minimal art/animation). `ComingSoon.svelte` exists but is not referenced by any active screen — a marker that some surfaces are still planned.
- **Card/report written content is still expanding.** The *composition machinery* (templates, pools, gates) is mature, and 21 of 22 templates are compositional; filling out rich, varied written content across all situations is ongoing playtest-driven work (the "Voiced Surface," "Legible Surface," and "Complete Surface" arcs in the build log are exactly this).
- **Progressive onboarding is designed but only partly implemented.** The Tier 4 onboarding arc (reframing Day 1 as "first time opening a tavern," unlocking systems gradually) has a locked design contract (`docs/plans/progressive-onboarding.md`) and tracker entries, but is listed as open work.
- **Depth-first balance.** The simulation is deep; the immediate pick-up-and-play accessibility layer is still being built on top. This is a foundation-first project at a foundation-mostly-complete stage.
- **Uncertainties for a reviewer:** the exact full-suite pass count and runtime were not re-measured end-to-end here (the full suite exceeds a single short timeout window — see §6). The `CLAUDE.md` figures (≈3,187 tests) are the project's own most recent record and were not contradicted by the subset re-run.

## 6. Verification performed for this document

Read-only inspection of the repository plus the following commands were run (no production files were modified; the only writes were the five markdown files in `notebooklm-codebase-overview/`):

- **Structure & metrics:** `find` / `wc -l` across `src/`, `tests/`, `web/src/`, `docs/`, `specs/` to produce the counts in §1. Verified directory layout of `src/sim/`, `src/cards/`, `src/reports/`, and `web/src/`.
- **Core reads:** `src/sim/core/engine.ts` (head), `phases.ts` (full), `rng.ts` (head), `effect.ts` (full); `src/sim/state/TavernState.ts` (type listing + top-level shape); `web/src/App.svelte` (head) and confirmation that `gameStore.svelte.ts` is the sole `simulateDay` caller; `src/cards/templates/drinkOrder.ts` (slot/projection wiring).
- **Test re-run (subset):** `npx vitest run tests/sim/phase2.structure.test.ts tests/cards/compose/gates/runAllGates.test.ts` →
  **58 tests passed (2 files)** in ~17s (17 structure tests + 41 gate tests). This independently confirms the simulation's initial-state validity and that all card templates pass the full gate battery.
- **Full-suite run:** attempted via `npm test` but exceeded the available 9-minute command timeout (the suite is large), so it was not run to completion here. The subset above passed cleanly, and the project's own build log records a green full suite.

## 7. Glossary of terms used in these documents

- **Simulation engine** — the headless code that computes how the tavern changes each day, independent of any UI.
- **Deterministic** — given the same inputs (including the random seed), the output is always identical; enables reliable replay and testing.
- **Seed / RNG** — a starting value for the pseudo-random number generator; the same seed reproduces the same "random" sequence.
- **State** — a complete snapshot of the tavern at one moment, stored as plain saveable data.
- **Pressure** — a 0–100 meter for a slow-building problem (burnout, debt, pests, etc.) with a trend and tracked causes.
- **Memory** — a recorded event with strength that fades over time, often attached to specific characters.
- **Cause / attribution** — the recorded reason a value changed, used to explain outcomes to the player.
- **Issue seed** — a structured description of a situation the tavern faces, generated from current state; the bridge to cards.
- **Card template / slot / snippet / pool** — a card is a template of slots; each slot is filled by picking the best-matching snippet from a pool of options.
- **Condition** — flat data attached to a snippet that decides whether it applies (e.g. "only if staff burnout is rising").
- **Gate** — an automated quality check on composed text (coverage, specificity, coherence, determinism, diversity, dedupe, etc.).
- **Signal** — a read-only, banded query (low/mid/high) the card layer uses to read sim state without duplicating it.
- **Voice profile** — a character's fixed personality dials (terseness, warmth, formality, floridity, optional verbal tic).
