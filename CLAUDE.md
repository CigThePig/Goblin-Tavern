# Goblin Tavern

A text-based goblin tavern management simulation built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

## Dev commands

```
npm test            # Fast Vitest tier (~3 min) — run on every change
npm run test:full   # Complete suite incl. heavy playtests (~6 min) — pre-merge
npm run test:heavy  # Only the heavy multi-day playtest files
npm run typecheck   # tsc --noEmit
npm run dev         # Vite dev server (web UI)
npm run build       # Vite production build
```

Run `npm test` and `npm run typecheck` to validate every change; run
`npm run test:full` before merging.

### Test tiers (why `npm test` is a subset)

A handful of multi-day playtest/simulation files dominate the suite
wall-clock — `tests/sim/phase20.cardlessPlaytest.test.ts` alone runs ~349s
serial in one worker and sets the full-suite floor (~6 min). `npm test`
runs a **fast tier** that excludes those files so day-to-day validation
finishes in ~3 min; `npm run test:full` runs everything. The heavy-file
list is the single source of truth in `vitest.config.ts`
(`HEAVY_TEST_GLOBS`) — when a file grows into a multi-minute playtest, add
it there and nowhere else. Tier selection is the `--tier=fast|heavy|all`
flag wired through `scripts/run-tests.mjs`; a bare `vitest run` (no tier)
stays complete.

**Running tests in a remote / Claude-Code-on-the-web session:** run the
suite in a **single foreground call** — e.g. `npm run test:full`. Do not
background it (`&` is blocked in the sandbox, and a detached run is
orphaned when the session is suspended/resumed, leaving a log that never
gets an exit marker). Both `npm test` (~3 min) and `npm run test:full`
(~6 min) fit inside the foreground execution budget when run directly.

## Current status

> ### 🛑 All feature development is paused — gameplay-audit remediation only
>
> The 2026-07-26 eight-phase gameplay audit confirmed **29 defects** in the shipped build (1 Critical, 9 High, 16 Medium, 3 Low), including a deterministic save failure that loses every run on reload. Fixing them is **the only active work** (tracked as **ISSUE-166**).
>
> - **Work queue:** `docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md` — per-finding checklist, ordered into Waves 0–7. Start at Wave 0 (`P2-RT-001`); waves are sequential and each ends at an evidence gate, not at code completion.
> - **Why / detail:** `docs/audits/2026-07-26-gameplay-audit/reports/GOBLIN_TAVERN_AUDIT_PHASE_08_FINAL_FINDINGS_AND_PRIORITIZATION.md` (§4 order, §6 clusters, §7 waves, §8 regression, §9 design questions, §11 acceptance gates). Per-phase evidence sits beside it in `reports/`; runnable probes in `fixtures/`.
> - **Track per-finding status in the queue file, not in the tracker** — `docs/ISSUE_TRACKER.md` carries one entry (ISSUE-166) for the whole arc.
> - **Do not start card-layer, onboarding, content, or UI work** while this arc is open. No balance or content conclusion from the current build is trustworthy until Wave 1 restores canonical state and economy.

Progress up to the pause (unchanged, and resumable — the tracker's **"Current work" → "Paused arcs — resume points"** holds the exact restart point for each):

- **Phases 1–40 — foundation (done).** The headless simulation under `src/sim/`: core engine, registries, ~26 domain modules, a content layer (naming, cultures, factions, suppliers, npc, staff, tavern, events, text), Zod-schema state, and testing utilities.
- **Phases 41–198 — repair pass, then the card layer.** Post-40 fixes (Tiers 0–3), the Rare Ingredients economy (Tier 1.5), UI/UX clarity (Tier 5), and the card-layer arcs (Living Cast → Voiced → Legible → Faithful → Complete Surface) that build the compositional card runtime under `src/cards/compose/` and the report projection layer under `src/reports/`.
- **Paused mid-arc:** Complete Surface (resume at ISSUE-141…148), Choice-Preview Legibility part (b) (ISSUE-153), Legible Surface standing recalibration (ISSUE-130). **Paused before starting:** Tier 4 Progressive Onboarding (ISSUE-060…077) — audit record `DC-09` questions onboarding vs. complete-surface exposure, so settle that before it restarts.

`docs/ISSUE_TRACKER.md` is the **authoritative record** of what shipped and what's next — every phase has an `ISSUE-NNN` entry there with status, phase number, evidence, scope, dependencies, and test approach. Do not maintain a duplicate changelog here; read the tracker's **"Current work"** callout for the next-up issue. Per-phase design/implementation detail lives in `docs/plans/phase-NNN-*.md`.

**Phase numbers are a file-naming convention only.** Execution order is set by the tracker's `ISSUE-NNN` ordering and hard `Depends on` chains — start with whatever "Current work" names, regardless of phase number.

## Where things are documented

- `docs/audits/2026-07-26-gameplay-audit/` — **the active work.** `REMEDIATION_QUEUE.md` (queue + status), `reports/` (per-phase evidence, Phase 8 is the consolidated deliverable), `GAMEPLAY_AUDIT_FRAMEWORK.md` (method + repository/route map, R01–R15), `fixtures/` (probes that import the live `src/` tree; reuse them as regression harnesses).
- `docs/ISSUE_TRACKER.md` — authoritative tracker (current work, full per-issue detail, status legend, how to add an issue).
- `docs/plans/phase-NNN-*.md` — one plan per phase, each with explicit "Acceptance Criteria" + "Do Not Do" sections. Read the matching plan before implementing.

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
                # + audits/2026-07-26-gameplay-audit/ (the active remediation arc)
```

## Working conventions

- **Read the matching tracker entry and phase doc before implementing.** The tracker carries Evidence/Scope/Depends-on/Test-approach; `Depends on` is hard (the dependency must be `done` first). Update an issue's `Status`/`Phase` fields inline as work progresses; closed issues stay in the tracker as history.
- **Workflow per issue:** plan mode → read tracker entry → write a `docs/plans/phase-NNN-*.md` plan → implement → keep the tracker current.
- **Workflow during the audit arc (now):** pick the next wave from `REMEDIATION_QUEUE.md` → read each finding's phase report section → write one `docs/plans/phase-NNN-audit-wave-N-*.md` plan for the wave → reproduce each finding on its audit route *before* fixing → fix → add the regression coverage Phase 8 §8 requires → flip that finding's `St` in the queue. A finding is only `done` once its route fails before the fix and passes after, with an automated assertion behind it. A wave is only closed when its evidence gate passes. Design records (`P2-OBS-001`, `P3-DC-001`, `DC-01…DC-10`) need a decision from the user, not an implementation guess — record the answer in the queue.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential by design.
- **No `Math.random()` and no browser/runtime deps in `src/sim/`.** Use the seeded RNG from context; the sim must run headless.
- **Keep state serializable.** Convert any `Map`/class/closure to plain JSON at the boundary.
- **Integrate additively during the expansion arc.** Add fields and hooks rather than rewriting working modules.
- **Coordinate branch and merge decisions with the user before pushing or opening PRs.**
