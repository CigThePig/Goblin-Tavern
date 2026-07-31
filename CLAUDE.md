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

npm run ledger:check      # Validate docs/plans/expansion/ledger.csv + hook coverage
npm run baseline:probes   # Diff the frozen expansion baseline probes
npm run repo:map          # Diff the frozen repository map
```

Run `npm test` and `npm run typecheck` to validate every change; run
`npm run test:full` before merging.

**Test tiers.** A few multi-day playtests dominate the wall clock
(`tests/sim/phase20.cardlessPlaytest.test.ts` alone runs ~349s and sets the
~6 min full-suite floor), so `npm test` runs a fast tier that excludes them.
The heavy-file list lives only in `vitest.config.ts` (`HEAVY_TEST_GLOBS`) —
add a file there and nowhere else when it grows into a multi-minute
playtest. Tier selection is `--tier=fast|heavy|all` via
`scripts/run-tests.mjs`; a bare `vitest run` stays complete.

**In a remote / Claude-Code-on-the-web session,** run the suite in a single
foreground call. Don't background it — `&` is blocked in the sandbox and a
detached run is orphaned on suspend/resume. Both tiers fit the foreground
budget.

## Current status

> ### 🔒 All development is paused outside `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` (2026-07-29)
>
> The **Simulation Expansion and Obligation-Closure plan** is the only unpaused work. It is a standalone implementation document — no earlier audit, report, or conversation is needed to execute it — and it runs as **ISSUE-170…183 (repo phases 207–220)**, one issue per plan phase 0–13. **ISSUE-170…174 (Phases 0–4) are done — next is ISSUE-175 (Phase 5 — economy: quality→cash feedback, operating costs, failure/recovery, adaptive demand, enforceable policies).** `OBL-01` is closed and so is the staff half of `OBL-02`.
>
> - **The goal is causal completeness:** every promise the game makes joins to a discoverable player capability and an authoritative simulation outcome. Nine broken obligations (`OBL-01…OBL-09` — uninstallable upgrades, future hooks that drain without firing, inspections that never visit, supplier credit with no invoices, difficulty that only changes opening values, unreachable Quick Day, inverted queued-action Help, uncovered causal changes, unearnable nicknames) plus the depth gaps behind them.
> - **Order:** hard-ordered by the plan's §7 map. Only Phases 2 and 3 may run in parallel, and only after Phase 1. §5 is the per-phase work protocol and lists the eight conditions that **fail** a phase — a data model or UI alone, a test that injects impossible state, a card promising a consequence no domain owns, or a system whose only consequence is a direct meter adjustment.
> - **Baseline frozen by Phase 0 (2026-07-29, no behavior change):** three derived, test-gated artifacts under `docs/plans/expansion/` are the arc's authoritative before-picture — `ledger.csv` (now 134 rows: `OBL-01…09`, `DEP-01…20`, one `HOOK-*` row per future-hook family), `baseline-probes.json` (13 route snapshots), `repo-map.json` (pipeline, slices, RNG streams, migrations, inventory, glossary promises). Regenerate with `npm run ledger:check` / `baseline:probes` / `repo:map` — **update them in place as phases land, and never rewrite a frozen file just to make a red test green.**
> - **Carried into the arc:** ISSUE-167/168/169 are absorbed by Phases 13/5/11 rather than run separately (plan §6.1), and Quick Day (OBL-06) **reverses** the recorded `DC-01` retirement — flagged in plan §6.2 for the user to settle before Phase 12.
>
> **Paused, not cancelled:** the Complete Surface arc (ISSUE-141…148), Tier 4 Progressive Onboarding (ISSUE-060…077), and the standing tails (ISSUE-153, ISSUE-130). They keep their status; the tracker's "Current work" holds their resume points.

Progress before the expansion arc (the tracker's **"Current work"** holds the live picture):

- **Phases 1–40 — foundation (done).** The headless simulation under `src/sim/`: core engine, registries, ~26 domain modules, a content layer (naming, cultures, factions, suppliers, npc, staff, tavern, events, text), Zod-schema state, and testing utilities.
- **Phases 41–198 — repair pass, then the card layer.** Post-40 fixes (Tiers 0–3), the Rare Ingredients economy (Tier 1.5), UI/UX clarity (Tier 5), and the card-layer arcs (Living Cast → Voiced → Legible → Faithful → Complete Surface) that build the compositional card runtime under `src/cards/compose/` and the report projection layer under `src/reports/`.
- **Phases 207–211 — the expansion arc so far (ISSUE-170…174, done).** The frozen baseline and implementation ledger; the seven shared contracts under `src/sim/contracts/` (typed scheduled events, obligations, persistent ruleset, causality, meters, the actor interface, architecture checks); functional areas with a complete upgrade lifecycle (**OBL-01 closed**); a persistent workforce with employment terms, shifts, stations, absence, cross-training, promotion, relationships, wage arrears and real resignation — founding staff included (**staff half of OBL-02 closed**); and a capacity-constrained service flow under `src/sim/modules/service/flow/` where patrons arrive as parties across six waves, compete for seating/kitchen/delivery/reset throughput, choose dishes on a scored comparison, run out of patience, run tabs, and regulars remember the visit and decide whether to return.
- **Phases 199–206 — the gameplay-audit remediation arc (ISSUE-166, closed 2026-07-28).** All **29 audit defects fixed and gate-verified across Waves 0–7**, ending in a recorded balance verdict: no dominant strategy on any of the 15 difficulty × variant slices, agency positive, four distinct reputation identities on the standard route. Closed record: `docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md` (including design decisions `DC-01`…`DC-08`; `DC-09`/`DC-10` remain open and gate the paused arcs). Balance instrument: `npm run balance:matrix` (baselines under `baselines/`).

`docs/ISSUE_TRACKER.md` is the **authoritative record**: an index row per `ISSUE-NNN` and a full entry for live work only. Don't maintain a duplicate changelog here; read its **"Current work"** callout for what's next.

**Phase numbers are a file-naming convention only.** Execution order comes from the tracker's "Current work" and hard `Depends on` chains, not from phase-number arithmetic.

**Documentation was cut hard on 2026-07-26** — closed issues' write-ups, ~115 per-phase plan docs, the superseded 2026-06 audits, and the regenerable card baselines are gone from the tree and live in git history (`git log --diff-filter=D -- docs/`; the baselines regenerate via `npm run sample:card-choices` / `npm run audit:card-choices`). A few surviving docs and source comments still cite deleted `docs/plans/phase-*.md` files — that's expected; recover from history rather than rewriting the reference. **Don't re-expand the docs tree:** record fix detail in the expansion arc's implementation ledger (`docs/plans/expansion/ledger.csv`, created in Phase 0) or in the code, not in new per-phase prose.

## Where things are documented

- `docs/plans/GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` — **the active work.** The expansion arc's own authority: per-phase objective, required work, required tests, and completion gate, plus the obligation table (§4.1), the work protocol (§5), the phase→issue map (§6), the dependency map (§7), and the final target-state checklist (§9). Read the phase's section before implementing it; **do not write per-phase plan docs for this arc** — the work plan is the arc doc.
- `docs/plans/expansion/` — **the expansion arc's frozen baseline (Phase 0).** Three data files, all derived from the live code and all gated by `tests/sim/phase207.*`: `ledger.csv` (the implementation ledger — one row per obligation, depth gap, and future-hook family), `baseline-probes.json` (13 deterministic route snapshots), `repo-map.json` (pipeline, phases, segments, module-owned slices, RNG streams, save migrations, §3 inventory, Help/glossary promises). Generators and validators: `scripts/expansion-{ledger,baseline,repo-map}.ts`. **Update these in place as later phases land — never fork a private copy, and never re-write a frozen file just to make a red test green.**
- `docs/audits/2026-07-26-gameplay-audit/` — the closed remediation arc. `REMEDIATION_QUEUE.md` (closed queue + recorded design decisions), `reports/` (per-phase evidence, Phase 8 is the consolidated deliverable), `GAMEPLAY_AUDIT_FRAMEWORK.md` (method + repository/route map, R01–R15), `fixtures/` (probes that import the live `src/` tree — reuse them as Phase 0 baseline probes and regression harnesses rather than rebuilding those routes).
- `docs/ISSUE_TRACKER.md` — the tracker: an index row per issue, full entries for live work only.
- `docs/plans/` — 21 surviving docs: the expansion work plan above, the locked contracts below, the arc roadmaps holding paused work (`complete-surface-arc.md` for ISSUE-136…148, `legible-surface-arc.md`, `choice-preview-legibility-arc.md`), and a few records that source comments cite as their design authority.

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
| `docs/plans/phase-186-day-clock-time-economy.md` | Day clock: the player's budget is time, not action points. |

**Which contracts each expansion phase must read first** (the plan expands these systems; it does not repeal their contracts): Phase 2 → `phase-186-day-clock-time-economy.md` (§2.5 keeps the 360-minute owner budget; scheduled work blocks sit *inside* it) and `phase-21-expansion-contract.md`; Phases 3–4 and 8–10 → `phase-21-expansion-contract.md` (identity, culture, place, and relationships are persistent state before they are flavour); Phase 11 → `cards-contract.md` + `card-composition-framework.md` (a card still may not invent truth — §11.1 makes that stricter, not looser); Phase 12 → `game-loop-and-ux.md` (planning horizon, Quick Day, Help derived from shared rule metadata). Where the plan and a locked contract genuinely disagree, raise it rather than choosing — one such conflict is already recorded (plan §6.2, Quick Day vs. `DC-01`).

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
docs/           # ISSUE_TRACKER.md + plans/ (locked contracts + arc docs; the
                #   expansion work plan is the active arc's authority)
                # + audits/2026-07-26-gameplay-audit/ (the closed remediation arc)
```

## Working conventions

- **Read the matching tracker entry (and its arc doc, if any) before implementing.** `Depends on` is hard — the dependency must be `done` first. Update `Status`/`Phase` in the index as work progresses; closed issues keep their index row as history.
- **Workflow per issue:** plan mode → read the tracker entry → implement → keep the tracker current. Write a `docs/plans/*.md` doc only for a whole wave or arc, never per fix.
- **Workflow during the expansion arc (now):** take the next issue from the tracker's Tier 8 table → read that phase's section in `GOBLIN_TAVERN_SIMULATION_EXPANSION_WORK_PLAN.md` → follow its §5 protocol: rediscover the current code by symbol (never by remembered line numbers), update the implementation ledger, **write the failing contract tests first** (reached through natural player setup, not fixture injection), name the one domain that owns each transition, then land state + rules + player capability + autonomous behavior + reporting + persistence *together* → run focused tests, then the full gates, then full-day-vs-segmented equivalence and a save/reload at every day beat the new lifecycle crosses → update the tracker index. **No per-phase plan docs for this arc** — the work plan is the arc doc; record detail in the ledger or the code.
  - A phase is not done if only the data model or UI exists, if a test reaches the feature by injecting impossible state, if a card promises a consequence no domain owns, if it works in batch but not the segmented route, if save/load changes the outcome, or if the system's only consequence is a direct pressure/reputation adjustment (plan §5).
  - Every new persistent collection needs a declared cap, pruning, expiry, or archival rule in the same phase (§5.11), and every persisted field needs its schema migration in the same phase (§5.7).
  - Design questions belong to the user, not to an implementation guess — that includes the two the arc inherits open (`DC-09`, `DC-10`) and the Quick Day reversal recorded in plan §6.2.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential by design.
- **No `Math.random()` and no browser/runtime deps in `src/sim/`.** Use the seeded RNG from context; the sim must run headless.
- **Keep state serializable.** Convert any `Map`/class/closure to plain JSON at the boundary.
- **Integrate additively during the expansion arc.** Add fields and hooks rather than rewriting working modules.
- **Coordinate branch and merge decisions with the user before pushing or opening PRs.**
