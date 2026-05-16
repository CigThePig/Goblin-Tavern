# Phase 70 — Expedition subsystem (ISSUE-030)

Implements ISSUE-030 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.4,
§5.3, §6.3, §6.6).

This phase introduces the player's core agency in the rare-ingredient
loop. The player commissions a hireable adventurer (phase 69) to fetch
rare or legendary ingredients; the expedition resolves end-only at a
deterministic seed.

## Scope

- New `Expedition` and `ExpeditionRecord` types; new
  `state.expeditions: { active: Expedition[]; completed: ExpeditionRecord[] }`
  top-level slice with Zod schema and defaults
  (`{ active: [], completed: [] }`).
- New `commissionExpedition` owner action validating runner
  availability and player coin. Action spends coin up-front.
- New `expeditionsModule` with `startDay` hook implementing the
  daily-tick + resolution per §6.3:
  - Increment `daysElapsed` for each active expedition.
  - Resolve any expedition where `daysElapsed >= daysTotal` using
    the per-expedition named RNG stream
    (`expedition_<expeditionId>`).
  - Outcome roll biased by runner experience, reliability, target
    tier, and mode. Four outcome types:
    `success`, `partial`, `failure`, `runner_lost`.
  - Successful outcomes write ingredients to stock with quality
    rolled from `ingredient_quality_<expeditionId>`.
- New `getRngStreamByName(name: string)` SimContext method for
  dynamic stream ids. Existing named streams remain in the enum;
  dynamic ones derive their seed from `baseSeed:name` and are not
  tracked in the snapshot (each call re-derives the same seed for
  idempotency).
- Memory writes per §8: `expedition_success`, `expedition_failure`,
  `runner_lost`.
- Cause entries against `culinary_renown` per §6.6 (positive on
  success, negative on `runner_lost` with named runner).
- `runner_lost` removes the runner from
  `state.world.hireableAdventurers`.
- The `completed` log caps at 50 most recent entries.

## Critical files

- `src/sim/state/TavernState.ts` — `Expedition`, `ExpeditionRecord`,
  `ExpeditionsState`; `TavernState.expeditions`.
- `src/sim/state/schemas.ts` — schemas; thread into
  `buildTavernStateSchema`.
- `src/sim/state/defaults.ts` — `createInitialExpeditionsState`.
- `src/sim/core/context.ts` and `src/sim/core/rng.ts` — add
  `getRngStreamByName(name: string)` to `SimRngStreams` and surface
  it via `SimContext`.
- `src/sim/modules/expeditions/expeditionsModule.ts` — **NEW.**
- `src/sim/modules/expeditions/commissionExpedition.ts` — **NEW**
  owner action.
- `src/sim/modules/expeditions/index.ts` — **NEW** module surface.
- `src/sim/modules/ownerActions/index.ts` — register the new
  action.
- `src/sim/testing/simRunner.ts` — wire `expeditionsModule` into
  `FULL_PIPELINE`.
- `tests/sim/phase70.expeditions.test.ts` — **NEW.**

## Test approach (ISSUE-030 verification)

- Determinism: same initial state + same `commissionExpedition`
  input + same days = same outcome.
- Save mid-expedition (`daysElapsed = 3` of 7) and reload — the
  state round-trips through Zod and the resolution on day 7
  produces the same outcome.
- An extra niche-customer-arrival roll on day 5 does not shift the
  day-7 expedition outcome (named-stream isolation): toggling an
  unrelated stream consumer must not change the expedition outcome
  for the same seed.
- `runner_lost` outcome removes the runner from
  `hireableAdventurers`.
- State round-trips through Zod across an active expedition
  (`active` and `completed` slices both shape-valid).
- The `completed` log caps at 50 entries.

## Out of scope (do not do)

- Pre-resolution previews of outcomes (§12 "Do Not previewable
  expedition outcomes").
- Daily expedition events / sub-decisions during travel — §13 marks
  these as a future expansion. Phase 70 ships end-only resolution.
- Cross-module `onExpeditionResolved` hook — phase 73 may wire it
  if needed; phase 70 instead invokes the adventurer-stat update
  inline at resolution time.

## Notes

- Mode `open` returns *something* most of the time but the
  ingredient depends on the roll; mode `targeted` requires a
  specific ingredient id and has lower base success rate but
  guaranteed-on-success ingredient.
- Costs and `daysTotal` are caller-supplied via the
  `commissionExpedition` action (the action validates ranges).
  Real cost balancing is future work.
- After resolution, the runner's stats update:
  - On `success`: `experience +5`, `reliability +5`,
    `relationship +5`, `daysSinceLastJob = 0`.
  - On `partial`: `experience +3`, `reliability +1`,
    `relationship +2`, `daysSinceLastJob = 0`.
  - On `failure`: `reliability -5`, `daysSinceLastJob = 0`.
  - On `runner_lost`: runner removed.
