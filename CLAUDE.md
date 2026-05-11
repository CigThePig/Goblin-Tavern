# Goblin Tavern

A text-based goblin tavern management simulation built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

## Current Status

Phases 1–20 are **implemented**. The headless simulation lives under `src/sim/` (core engine, registries, ~20 domain modules, state with Zod schemas, testing utilities) with phase-by-phase coverage under `tests/sim/` (`phase2.structure.test.ts` … `phase20.cardlessPlaytest.test.ts`). Run `npm test` (Vitest) and `npm run typecheck` (TypeScript) to validate changes.

Phases 21–40 (the "expansion arc") are specified under `docs/plans/` but not yet implemented. They add identity, culture, place, and relationship systems on top of the existing simulation.

Work proceeds against whatever branch is checked out; coordinate branch and merge decisions with the user before pushing or opening pull requests.

## Core Design Rule

> The simulation is the source of truth. Cards reveal, interpret, escalate, or resolve simulation truth — cards must not invent truth.

A card may surface a problem the sim already understands. A card may **not** apply arbitrary effects, contradict known state, or pretend past decisions did not happen. Keep this rule in mind for every change.

Phase 21 extends this principle for the expansion arc: **identity, culture, place, and relationships must become persistent simulation facts before they become card flavour.** Generated people and world entities are state, not throwaway display strings.

## Architectural Rules

These apply to all simulation code from Phase 2 onward:

1. **Pure by default.** No DOM, React, browser storage, network, timers, global mutable state, or `Math.random()` inside simulation logic.
2. **Serializable state.** `TavernState` must be plain JSON-compatible data. No class instances, functions, Maps/Sets, or circular references in state.
3. **Modular systems.** No god-files. Each module registers its own state defaults, phase hooks, actions, report sections, and (later) issue seed generators.
4. **Registries for expandable concepts.** Areas, stock items, customer groups, staff roles, owner actions, reputation axes, pressure types, issue seed families, and sim modules all go through registries — never hardcode expandable lists into the engine.
5. **Deterministic RNG.** Use a seeded PRNG (`prando` preferred, `seedrandom` acceptable) threaded through `SimContext`. Same seed + same input = same result. Replay must work.
6. **Causality.** When a major value changes, the sim must record *why*. Cause entries feed future reports, tooltips, and card text.
7. **Named RNG streams for identity** (Phase 24+). Identity-style randomness — names, supplier rosters, regular customer rosters — must use named streams via `ctx.getRngStream(streamId)` so an extra service roll doesn't shift a generated name. `ctx.rng` remains for ad-hoc per-day rolls.
8. **Persistent identity is state, not display** (Phase 21+). Generated people (staff, suppliers, regulars, NPCs) and named world entities (cultures, factions, local arcs) live in `TavernState`. Generate names once at creation, store them, reuse them — never regenerate when a report is re-viewed.

The engine shape future code targets:

```ts
const result = simulateDay(previousState, playerInput, runConfig)
// result: { state, reports, diffs, issueSeeds, debug }
```

## Repo Layout

```
docs/plans/
  phase-01-simulation-contract.md                                       # Vision, pillars, core gameplay model
  phases-02-05.md                                                       # Project structure, calendar, RNG, state
  phases-06-10.md                                                       # Areas, stock, economy, customers
  phases-11-15.md                                                       # Staff, service loop, owner actions, weekly, monthly
  phases-16-20.md                                                       # Memories, causes, pressures, issue seeds, card-ready output
  phase-21-expansion-contract.md                                        # Expansion arc vision and scope rules
  phases-22-25-expansion-structure-calendar-rng-state.md                # Content folders, calendar tags, RNG streams, world state
  phases-26-30-expansion-validation-hooks-areas-suppliers-cultures.md   # Cross-ref validation, new phase hooks, area traits, suppliers, cultures
  phases-31-35-expansion-staff-scenes-projects-community-arcs.md        # Staff identity, service scenes, owner projects, weekly community, seasonal arcs
  phases-36-40-expansion-memory-attribution-pressures-seeds-readiness.md# Entity-scoped memory, attribution, pressure webs, expanded seeds, final readiness

src/sim/                # Phases 1–20 implementation (headless, pure)
  core/                 # engine, context, rng, phases, diff, effect, reports, types
  state/                # TavernState, schemas (zod), validation, migrations
  registries/           # Registry<T> + concrete registries (areas, stock, customers, staff, actions, pressures, …)
  modules/              # Domain modules: areas, calendar, customers, economy, stock, staff, service,
                        # ownerActions, weekly, monthly, memories, causes, pressures, issueSeeds,
                        # issues, feedback, history, reports, responses
  testing/              # simRunner, createTestState, runDay/Week/Month, fixtures
  utils/                # ids, math, clamp
tests/sim/              # phase2.structure.test.ts … phase20.cardlessPlaytest.test.ts
```

Phase 22 will introduce `src/sim/content/` (naming, cultures, factions, suppliers, npc, tavern, events, text) — planned, not yet present. Follow the structure defined in each phase doc before adding new folders.

## Working on This Repo

- **Read the relevant phase doc before implementing.** Each phase doc has explicit "Acceptance Criteria" and "Do Not Do" sections. Respect both.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential for a reason.
- **No `Math.random()` in sim code.** Even for one-off helpers — use the seeded RNG from context.
- **No browser/runtime dependencies in `src/sim/`.** The simulation must run headless in tests and (eventually) in any host environment.
- **Keep state serializable.** If you find yourself reaching for a `Map` or class, convert at the boundary.
- **Use named RNG streams for identity** once Phase 24 lands. Do not call `ctx.rng` for name generation or anything whose stability across re-renders matters — use `ctx.getRngStream(streamId)`.
- **No card prose in Phases 21–40 either.** Phase 21 explicitly forbids finished card text across the whole expansion arc; produce structured "text ingredients" only until the card layer is built.
- **Integrate additively during the expansion arc.** Phases 28–35 call for light, additive integration with existing modules (e.g. "do not deeply rewrite customerModule"). Add fields and hooks rather than rewriting working systems.
