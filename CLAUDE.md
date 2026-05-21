# Goblin Tavern

A text-based goblin tavern management simulation built **simulation-first**: a headless rules engine ships before any card content, UI, or narrative writing is added on top.

## Current Status

**Phases 1–40 (initial build + expansion arc): done.** The headless simulation lives under `src/sim/` (core engine, registries, ~26 domain modules under `src/sim/modules/`, a content layer under `src/sim/content/` covering naming, cultures, factions, suppliers, npc, staff, tavern, events, and text, state with Zod schemas, and testing utilities). Phase-by-phase test coverage runs from `tests/sim/phase2.structure.test.ts` through the repair-pass tests (currently up to `phase97.missedOpportunityRoundtrip.test.ts`). Run `npm test` (Vitest) and `npm run typecheck` (TypeScript) to validate changes.

**Phases 41–97 + 117–120 (post-Phase-40 repair pass + UI/UX clarity + web test stack): done.** The repair pass landed Tier 0 infrastructure (ISSUE-001…004), Tier 1 roster grows (ISSUE-010…012; ISSUE-005…009 superseded by the Tier 1.5 arc), the **Tier 1.5 Rare Ingredients Economy** arc (ISSUE-025…033, phases 65–73), Tier 2 family rewrites (ISSUE-013…019), Tier 3 polish + audit fixes (ISSUE-020…057), the Tier 5 UI/UX clarity passes (ISSUE-078/079, phases 117–118), and the combined web test-coverage + `$derived` audit (ISSUE-058/059, phases 119–120). The web "More" tab + save slots + first-encounter hints + difficulty work (phase 98) shipped as part of the web chassis and is tracked retroactively as ISSUE-080.

**Phase 121 (Living Cast arc, Phase A): done.** Bounded selection vocabulary attached to staff and regulars (`specialty`, `blindspot`, `affinity[]`, `voiceProfile` with 4 axes + optional verbal-tic). Lives under `src/sim/content/cast/`; reuses the `staff_identity` / `regular_identity` named RNG streams; stored as plain JSON on `StaffState.castAttributes` and `RegularWorldState.castAttributes`. Tracked as ISSUE-090.

**Phase 123 (Living Cast arc, Phase C): done.** Compositional card runtime — typed `Snippet` / `SnippetPool` / `SnippetCondition` (eleven framework primitives + Phase-B's `voiceAxis` atLeast/atMost + `verbalTic` reads of `CastAttributes`), deterministic `assembleSlots` / `pickSnippet` with shared FNV tie-break, and the `defineCompositionalCard` factory. First live compositional template `drinkOrderCard` rides `regular_customer / relationship_test / during_service` seeds with Phase B's 17-snippet `order_line` pool + 5-snippet `manner_note` pool. The eight hand-written templates ship unchanged; `REQUIRED_CARDS` holds the mix. Tracked as ISSUE-092.

**Open work** — see [`docs/ISSUE_TRACKER.md`](docs/ISSUE_TRACKER.md) for full evidence, scope, dependencies, and test approach:

1. **Tier 4 Progressive Onboarding arc** — ISSUE-060…077, phases 99–116. Locked design contract at [`docs/plans/progressive-onboarding.md`](docs/plans/progressive-onboarding.md). Reframes Day 1 as "first time opening a tavern" and unlocks simulation systems one at a time across the first ~10 weeks of in-game time.
2. **Tier 6 Living Cast arc Phases D–G** — locked roadmap at [`docs/plans/living-cast-arc.md`](docs/plans/living-cast-arc.md), framework contract at [`docs/plans/card-composition-framework.md`](docs/plans/card-composition-framework.md). Phase A (ISSUE-090, phase 121) and Phase C (ISSUE-092, phase 123) are done; Phase B is the hand-authored convergence artifact at `docs/plans/living-cast-arc-phase-b.md` (no Claude Code involvement); Phases D–G land as separate ISSUE entries when they start.

The tracker carries **81 issues across 6 tiers** (Tier 0 infrastructure; Tier 1 + 1.5 roster grows + Rare Ingredients; Tier 2 family rewrites; Tier 3 polish + audit; Tier 4 onboarding; Tier 5 UI/UX clarity; Tier 6 Living Cast). 59 are `done`, 17 are `open`, 5 are `superseded` by the Rare Ingredients arc. ISSUE_TRACKER.md is the authoritative source for what changes; the "Current work" callout at the top of that file names the next-up issue.

**Phase numbering.** ISSUE-001…057 follow `phase = 40 + N` (phases 41–97). Phase 98 belongs to the retroactive ISSUE-080. Tier 4 onboarding (ISSUE-060…077) → phases 99–116. Tier 5 UI/UX clarity (ISSUE-078/079) → phases 117–118. ISSUE-058/059 take the next free integers, phases 119/120. Tier 6 Living Cast Phase A (ISSUE-090) → phase 121, Phase C (ISSUE-092) → phase 123 (phase 122 is reserved for the hand-authored Phase B artifact). **Phase numbers are a file-naming convention; execution order is set by ISSUE-NNN ordering and the `Depends on` chains, not by phase number** — start with whatever the tracker's "Current work" callout names, even if its phase number is higher than a later-tier issue.

**Locked design contracts** (read these before planning work in their scope):

- `docs/plans/phase-01-simulation-contract.md` — vision, pillars, core gameplay model (foundational, phase 1).
- `docs/plans/phase-21-expansion-contract.md` — expansion arc (phases 21–40): identity, culture, place, and relationships become persistent state, not card flavour.
- `docs/plans/rare-ingredients-economy.md` — Tier 1.5 arc (ISSUE-025…033, phases 65–73).
- `docs/plans/cards-contract.md` — bridge between headless sim and card UI layer (for the eventual card-layer work).
- `docs/plans/game-loop-and-ux.md` — game loop / UX working contract (§8–9 explicitly open).
- `docs/plans/progressive-onboarding.md` — Tier 4 arc (ISSUE-060…077, phases 99–116); amends `game-loop-and-ux.md §2.1`.
- `docs/plans/living-cast-arc.md` — Living Cast arc roadmap (Phase A = ISSUE-090 / phase 121, done; Phases B–G upcoming). Pairs with `card-composition-framework.md`.
- `docs/plans/card-composition-framework.md` — locked compositional framework for the card layer (slots, snippets, deterministic assembly). Sits below `cards-contract.md`; resolves its §9 "tone/presentation pipeline" question.

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
  ISSUE_TRACKER.md                                                      # Authoritative repair-pass tracker — 79 issues, current work
  P20F1.md                                                              # Investigation: response_impact gate at 28/70 (2026-05-13)
  plans/
    phase-01-simulation-contract.md                                     # LOCKED: vision, pillars, core gameplay model (phase 1)
    phases-02-05.md                                                     # Project structure, calendar, RNG, state
    phases-06-10.md                                                     # Areas, stock, economy, customers
    phases-11-15.md                                                     # Staff, service loop, owner actions, weekly, monthly
    phases-16-20.md                                                     # Memories, causes, pressures, issue seeds, card-ready output
    phase-21-expansion-contract.md                                      # LOCKED: expansion arc vision and scope rules
    phases-22-25-expansion-structure-calendar-rng-state.md              # Content folders, calendar tags, RNG streams, world state
    phases-26-30-expansion-validation-hooks-areas-suppliers-cultures.md # Cross-ref validation, new phase hooks, area traits, suppliers, cultures
    phases-31-35-expansion-staff-scenes-projects-community-arcs.md      # Staff identity, service scenes, owner projects, weekly community, seasonal arcs
    phases-36-40-expansion-memory-attribution-pressures-seeds-readiness.md # Entity-scoped memory, attribution, pressure webs, expanded seeds, final readiness
    rare-ingredients-economy.md                                         # LOCKED: Tier 1.5 design contract (ISSUE-025…033, phases 65–73)
    cards-contract.md                                                   # LOCKED: card-layer contract (8 templates; for eventual card work)
    game-loop-and-ux.md                                                 # Working contract: game loop / UX; §8–9 open
    progressive-onboarding.md                                           # LOCKED: Tier 4 design contract (ISSUE-060…077, phases 99–116)
    seven-pass-investigation-plan.md                                    # Cross-cutting audit that informed ISSUE-034…057
    phase-53-59-tier2-followups.md                                      # Perf notes from Tier 2 pass (phase20 OOM, phase40 runtime) — not tracked as ISSUE
    phase-41-*.md … phase-120-*.md                                      # Per-phase plans, mostly one per ISSUE-NNN in ISSUE_TRACKER.md (created as each phase starts)

src/sim/                # Phases 1–40 (initial build + expansion) + repair-pass extensions; headless, pure
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
tests/sim/              # phase2.structure.test.ts … phase97.*.test.ts (per-phase coverage through the repair pass)
web/                    # Svelte web UI (phases 87–98, 117–118; Tier 4 onboarding will land here)
```

## Working on This Repo

- **Read the relevant phase doc before implementing.** Each phase doc has explicit "Acceptance Criteria" and "Do Not Do" sections. Respect both.
- **Repair-pass work (phases 41–120, ongoing) is driven by `docs/ISSUE_TRACKER.md`.** Before planning a repair phase, read the matching `ISSUE-NNN` entry — it carries the full Evidence, Impact, Scope, Depends on, and Test approach. The tracker's `Depends on` field is hard: a dependency issue must reach `done` before dependent work starts. Update an issue's `Status` and `Phase` fields inline as work progresses; closed issues stay in the tracker as history, not noise. Phases 65–73 additionally implement against the locked rules in `docs/plans/rare-ingredients-economy.md`, and phases 99–116 against `docs/plans/progressive-onboarding.md` — per-issue phase plans for those arcs reference the design doc rather than restating it.
- **Do not skip ahead.** Don't add cards, UI, narrative text, or issue-seed *content* before the phase that introduces them. The plans are sequential for a reason.
- **No `Math.random()` in sim code.** Even for one-off helpers — use the seeded RNG from context.
- **No browser/runtime dependencies in `src/sim/`.** The simulation must run headless in tests and (eventually) in any host environment.
- **Keep state serializable.** If you find yourself reaching for a `Map` or class, convert at the boundary.
- **Use named RNG streams for identity** once Phase 24 lands. Do not call `ctx.rng` for name generation or anything whose stability across re-renders matters — use `ctx.getRngStream(streamId)`.
- **No card prose in Phases 21–40 either.** Phase 21 explicitly forbids finished card text across the whole expansion arc; produce structured "text ingredients" only until the card layer is built.
- **Integrate additively during the expansion arc.** Phases 28–35 call for light, additive integration with existing modules (e.g. "do not deeply rewrite customerModule"). Add fields and hooks rather than rewriting working systems.
