# Goblin Tavern

A text-based goblin tavern management simulation built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

## Dev commands

```
npm test            # Vitest suite
npm run typecheck   # tsc --noEmit
npm run dev         # Vite dev server (web UI)
npm run build       # Vite production build
```

Run `npm test` and `npm run typecheck` to validate every change.

## Current status

- **Phases 1–40 — foundation (done).** The headless simulation under `src/sim/`: core engine, registries, ~26 domain modules, a content layer (naming, cultures, factions, suppliers, npc, staff, tavern, events, text), Zod-schema state, and testing utilities.
- **Phases 41+ — repair pass, then the card layer (ongoing).** Post-40 fixes (Tiers 0–3), the Rare Ingredients economy (Tier 1.5), Progressive Onboarding (Tier 4), UI/UX clarity (Tier 5), and the card-layer arcs (Living Cast → Voiced → Legible → Faithful → Complete Surface) that build the compositional card runtime under `src/cards/compose/` and the report projection layer under `src/reports/`.

`docs/ISSUE_TRACKER.md` is the **authoritative record** of what shipped and what's next — every phase has an `ISSUE-NNN` entry there with status, phase number, evidence, scope, dependencies, and test approach. Do not maintain a duplicate changelog here; read the tracker's **"Current work"** callout for the next-up issue. Per-phase design/implementation detail lives in `docs/plans/phase-NNN-*.md`.

**Phase numbers are a file-naming convention only.** Execution order is set by the tracker's `ISSUE-NNN` ordering and hard `Depends on` chains — start with whatever "Current work" names, regardless of phase number.

## Where things are documented

- `docs/ISSUE_TRACKER.md` — authoritative tracker (current work, full per-issue detail, status legend, how to add an issue).
- `docs/plans/phase-NNN-*.md` — one plan per phase, each with explicit "Acceptance Criteria" + "Do Not Do" sections. Read the matching plan before implementing.
- `notebooklm-codebase-overview/` — narrative codebase tour (orientation, not a contract).

**Locked design contracts** — read the relevant one before planning work in its scope:

| Contract | Scope |
| --- | --- |
| `docs/plans/phase-01-simulation-contract.md` | Vision, pillars, core gameplay model (foundational). |
| `docs/plans/phase-21-expansion-contract.md` | Expansion arc: identity, culture, place, relationships become persistent state. |
| `docs/plans/rare-ingredients-economy.md` | Tier 1.5 economy arc. |
| `docs/plans/progressive-onboarding.md` | Tier 4 onboarding arc; amends `game-loop-and-ux.md §2.1`. |
| `docs/plans/cards-contract.md` | Bridge between headless sim and the card UI layer. |
| `docs/plans/card-composition-framework.md` | Compositional card framework — slots, snippets, deterministic assembly. Resolves `cards-contract.md §9`. |
| `docs/plans/game-loop-and-ux.md` | Game loop / UX working contract. |

## Core Design Rule

> The simulation is the source of truth. Cards reveal, interpret, escalate, or resolve simulation truth — cards must not invent truth.

A card may surface a problem the sim already understands. A card may **not** apply arbitrary effects, contradict known state, or pretend past decisions did not happen. Keep this rule in mind for every change.

Phase 21 extends this for the expansion arc: **identity, culture, place, and relationships must become persistent simulation facts before they become card flavour.** Generated people and world entities are state, not throwaway display strings.

## Architectural Rules

These apply to all simulation code from Phase 2 onward:

1. **Pure by default.** No DOM, React, browser storage, network, timers, global mutable state, or `Math.random()` inside simulation logic.
2. **Serializable state.** `TavernState` must be plain JSON-compatible data. No class instances, functions, Maps/Sets, or circular references in state.
3. **Modular systems.** No god-files. Each module registers its own state defaults, phase hooks, actions, report sections, and issue seed generators.
4. **Registries for expandable concepts.** Areas, stock items, customer groups, staff roles, owner actions, reputation axes, pressure types, issue seed families, and sim modules all go through registries — never hardcode expandable lists into the engine.
5. **Deterministic RNG.** Use a seeded PRNG (`prando` preferred, `seedrandom` acceptable) threaded through `SimContext`. Same seed + same input = same result. Replay must work.
6. **Causality.** When a major value changes, the sim must record *why*. Cause entries feed reports, tooltips, and card text.
7. **Named RNG streams for identity** (Phase 24+). Identity-style randomness — names, supplier rosters, regular rosters — uses named streams via `ctx.getRngStream(streamId)` so an extra service roll doesn't shift a generated name. `ctx.rng` remains for ad-hoc per-day rolls.
8. **Persistent identity is state, not display** (Phase 21+). Generated people (staff, suppliers, regulars, NPCs) and named world entities (cultures, factions, local arcs) live in `TavernState`. Generate names once at creation, store them, reuse them — never regenerate on re-view.

The engine shape future code targets:

```ts
const result = simulateDay(previousState, playerInput, runConfig)
// result: { state, reports, diffs, issueSeeds, debug }
```

## Repo layout

```
src/
  sim/          # Headless, pure simulation (Phases 1–40 + repair-pass extensions)
    core/         # engine, context, rng, phases, diff, effect, reports, types
    state/        # TavernState, Zod schemas, validation, migrations
    registries/   # Registry<T> + concrete registries (areas, stock, customers, staff, …)
    modules/      # ~26 domain modules (areas, customers, economy, staff, issues, pressures, …)
    content/      # Identity/world content: naming, cultures, factions, suppliers, npc, staff, cast, …
    signals/      # Banded signal surface read by the card layer
    testing/ utils/
  cards/        # Card layer (Living Cast arc onward)
    compose/      # Compositional runtime: assemble, conditions, salience, gates, pools, …
    templates/    # Per-family compositional card templates
  reports/      # Report projection layer + compositional report sections
web/            # Svelte web UI
specs/cards/    # Per-template authoring specs (design records for snippet pools)
scripts/        # Diagnostic + test-runner scripts (not sim code)
tests/          # sim/ cards/ reports/ web/ — per-phase + per-gate coverage
docs/           # ISSUE_TRACKER.md + plans/ (per-phase docs + locked contracts)
```

## Working conventions

- **Read the matching tracker entry and phase doc before implementing.** The tracker carries Evidence/Scope/Depends-on/Test-approach; `Depends on` is hard (the dependency must be `done` first). Update an issue's `Status`/`Phase` fields inline as work progresses; closed issues stay in the tracker as history.
- **Workflow per issue:** plan mode → read tracker entry → write a `docs/plans/phase-NNN-*.md` plan → implement → keep the tracker current.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential by design.
- **No `Math.random()` and no browser/runtime deps in `src/sim/`.** Use the seeded RNG from context; the sim must run headless.
- **Keep state serializable.** Convert any `Map`/class/closure to plain JSON at the boundary.
- **Integrate additively during the expansion arc.** Add fields and hooks rather than rewriting working modules.
- **Coordinate branch and merge decisions with the user before pushing or opening PRs.**
