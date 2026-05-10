# Goblin Tavern

A text-based goblin tavern management simulation built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

## Current Status

No code exists yet. The repo currently contains only the design and implementation plans under `docs/plans/`. Phase 1 (Simulation Contract) is complete on paper; Phases 2–20 are specified but not yet implemented.

Work proceeds against whatever branch is checked out; coordinate branch and merge decisions with the user before pushing or opening pull requests.

## Core Design Rule

> The simulation is the source of truth. Cards reveal, interpret, escalate, or resolve simulation truth — cards must not invent truth.

A card may surface a problem the sim already understands. A card may **not** apply arbitrary effects, contradict known state, or pretend past decisions did not happen. Keep this rule in mind for every change.

## Architectural Rules

These apply to all simulation code from Phase 2 onward:

1. **Pure by default.** No DOM, React, browser storage, network, timers, global mutable state, or `Math.random()` inside simulation logic.
2. **Serializable state.** `TavernState` must be plain JSON-compatible data. No class instances, functions, Maps/Sets, or circular references in state.
3. **Modular systems.** No god-files. Each module registers its own state defaults, phase hooks, actions, report sections, and (later) issue seed generators.
4. **Registries for expandable concepts.** Areas, stock items, customer groups, staff roles, owner actions, reputation axes, pressure types, issue seed families, and sim modules all go through registries — never hardcode expandable lists into the engine.
5. **Deterministic RNG.** Use a seeded PRNG (`prando` preferred, `seedrandom` acceptable) threaded through `SimContext`. Same seed + same input = same result. Replay must work.
6. **Causality.** When a major value changes, the sim must record *why*. Cause entries feed future reports, tooltips, and card text.

The engine shape future code targets:

```ts
const result = simulateDay(previousState, playerInput, runConfig)
// result: { state, reports, diffs, issueSeeds, debug }
```

## Repo Layout

```
docs/plans/
  phase-01-simulation-contract.md   # Vision, pillars, core gameplay model
  phases-02-05.md                   # Project structure, calendar, RNG, state
  phases-06-10.md                   # Areas, stock, economy, customers
  phases-11-15.md                   # Staff, service loop, owner actions, weekly, monthly
  phases-16-20.md                   # Memories, causes, pressures, issue seeds, card-ready output
```

When code lands, it should follow the structure defined in `docs/plans/phases-02-05.md` (`src/sim/{core,state,registries,modules,testing,utils}` with tests under `tests/sim/`).

## Working on This Repo

- **Read the relevant phase doc before implementing.** Each phase doc has explicit "Acceptance Criteria" and "Do Not Do" sections. Respect both.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential for a reason.
- **No `Math.random()` in sim code.** Even for one-off helpers — use the seeded RNG from context.
- **No browser/runtime dependencies in `src/sim/`.** The simulation must run headless in tests and (eventually) in any host environment.
- **Keep state serializable.** If you find yourself reaching for a `Map` or class, convert at the boundary.
