# Goblin Tavern

A text-based goblin tavern management simulation built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

## Current Status

Phases 1–40 are **implemented**. The headless simulation lives under `src/sim/` (core engine, registries, ~26 domain modules under `src/sim/modules/`, a content layer under `src/sim/content/` covering naming, cultures, factions, suppliers, npc, staff, tavern, events, and text, state with Zod schemas, and testing utilities). Phase-by-phase coverage runs from `tests/sim/phase2.structure.test.ts` through `tests/sim/phase40.expandedReadiness.test.ts`. Run `npm test` (Vitest) and `npm run typecheck` (TypeScript) to validate changes.

Current work is the **post-Phase-40 repair pass** tracked in [`docs/ISSUE_TRACKER.md`](docs/ISSUE_TRACKER.md). That file is the authoritative source for what needs to change, evidence, scope, dependencies, and test approach for each repair bundle. Phases 1–40 left real gaps (silent calculators, dead consumers, thin rosters, no-op response pipeline); the tracker bundles those fixes into 24 issues.

**Phase numbering for the repair pass:** each `ISSUE-NNN` in the tracker becomes a phase offset by 40 — `ISSUE-001` → phase 41, `ISSUE-002` → phase 42, …, `ISSUE-024` → phase 64. Phase plan files for repair work land under `docs/plans/` named by phase number (e.g. `phase-41-response-pipeline.md`).

Per-issue workflow: the user puts Claude Code in plan mode, Claude reads the matching tracker entry, produces a phase plan file in `docs/plans/`, then implements. Update the issue's `Status` and `Phase` fields in the tracker inline as work progresses; closed issues stay in the tracker as history.

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
docs/
  ISSUE_TRACKER.md                                                      # Post-Phase-40 repair pass — current work
  plans/
    phase-01-simulation-contract.md                                     # Vision, pillars, core gameplay model
    phases-02-05.md                                                     # Project structure, calendar, RNG, state
    phases-06-10.md                                                     # Areas, stock, economy, customers
    phases-11-15.md                                                     # Staff, service loop, owner actions, weekly, monthly
    phases-16-20.md                                                     # Memories, causes, pressures, issue seeds, card-ready output
    phase-21-expansion-contract.md                                      # Expansion arc vision and scope rules
    phases-22-25-expansion-structure-calendar-rng-state.md              # Content folders, calendar tags, RNG streams, world state
    phases-26-30-expansion-validation-hooks-areas-suppliers-cultures.md # Cross-ref validation, new phase hooks, area traits, suppliers, cultures
    phases-31-35-expansion-staff-scenes-projects-community-arcs.md      # Staff identity, service scenes, owner projects, weekly community, seasonal arcs
    phases-36-40-expansion-memory-attribution-pressures-seeds-readiness.md # Entity-scoped memory, attribution, pressure webs, expanded seeds, final readiness
    phase-41-*.md … phase-64-*.md                                       # Repair-pass plans, one per ISSUE-NNN in ISSUE_TRACKER.md (added as each phase starts)

src/sim/                # Phases 1–40 implementation (headless, pure)
  core/                 # engine, context, rng, phases, diff, effect, reports, types
  state/                # TavernState, schemas (zod), validation, migrations
  registries/           # Registry<T> + concrete registries (areas, stock, customers, staff, actions, pressures, …)
  modules/              # Domain modules: areas, attribution, calendar, causes, cultures, customers,
                        # economy, factions, feedback, history, issues, issueSeeds, localArcs,
                        # memories, monthly, ownerActions, pressures, regulars, reports, responses,
                        # service, staff, stock, suppliers, weekly, world
  content/              # Identity / world-content (Phase 22+): naming, cultures, factions, suppliers,
                        # npc, staff, tavern, events, text
  testing/              # simRunner, createTestState, runDay/Week/Month, fixtures
  utils/                # ids, math, clamp
tests/sim/              # phase2.structure.test.ts … phase40.expandedReadiness.test.ts
```

## Working on This Repo

- **Read the relevant phase doc before implementing.** Each phase doc has explicit "Acceptance Criteria" and "Do Not Do" sections. Respect both.
- **Repair-pass work (phases 41–64) is driven by `docs/ISSUE_TRACKER.md`.** Before planning a repair phase, read the matching `ISSUE-NNN` entry — it carries the full Evidence, Impact, Scope, Depends on, and Test approach. The tracker's `Depends on` field is hard: a dependency issue must reach `done` before dependent work starts. Update an issue's `Status` and `Phase` fields inline as work progresses; closed issues stay in the tracker as history, not noise.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential for a reason.
- **No `Math.random()` in sim code.** Even for one-off helpers — use the seeded RNG from context.
- **No browser/runtime dependencies in `src/sim/`.** The simulation must run headless in tests and (eventually) in any host environment.
- **Keep state serializable.** If you find yourself reaching for a `Map` or class, convert at the boundary.
- **Use named RNG streams for identity** once Phase 24 lands. Do not call `ctx.rng` for name generation or anything whose stability across re-renders matters — use `ctx.getRngStream(streamId)`.
- **No card prose in Phases 21–40 either.** Phase 21 explicitly forbids finished card text across the whole expansion arc; produce structured "text ingredients" only until the card layer is built.
- **Integrate additively during the expansion arc.** Phases 28–35 call for light, additive integration with existing modules (e.g. "do not deeply rewrite customerModule"). Add fields and hooks rather than rewriting working systems.
