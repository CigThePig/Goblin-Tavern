# Phase 95 — Voice & Identity Pass

> Lands the **voice/style pass** that the roadmap in
> [`game-loop-and-ux.md §10`](./game-loop-and-ux.md) slots for Phase 95+,
> and that Phase 94's "Out of scope" section explicitly deferred ("Style/voice
> pass on existing producer summaries. Deferred to Phase 95+."). Closes the
> voice question raised in `game-loop-and-ux.md §9.7` and the identity
> question in §9.5. Honors [`cards-contract.md §1`](./cards-contract.md):
> the simulation stays the source of truth — composition selects between
> *renderings* of existing facts; it never invents new ones.

## Context — why this change

Phases 87–94 shipped a complete mobile-first surface on top of the sim:
five-beat day loop, 9 card templates, the daily report, weekly overview,
monthly overview, tavern panels, world panels, pressures dashboard,
glossary, tavern log. They are mechanically complete and correct — but
they read flat. Three concrete pain points motivate the pass:

1. **`toneHints` is dead metadata.** All 9 card templates declare
   tone hints (`['urgent', 'visceral']`, `['internal', 'personal']`,
   `['strategic', 'reflective']`, …) and the seed generators emit
   their own. The card renderer reads none of them. The mechanism
   documented in `cards-contract §5 rule 5` and `game-loop-and-ux §6.3`
   is wired up to a wall.

2. **`TavernIdentityStrip` displays nothing meaningful.** The state
   slot `state.world.tavernIdentity` exists with `knownFor`,
   `houseRules`, `atmosphereTags`. The strip is wired to display them.
   The engine API (`modifyTavernIdentity`) exists. But no module ever
   calls it — the strip falls through to "no atmosphere recorded yet"
   forever.

3. **Identity-as-perception is invisible.** Attribution data carries
   rich "what does the world think about us" data. The World panels
   surface per-entity attribution rows. But the *aggregate* view —
   "miners respect this place; some call it the Soup Hole" — is
   nowhere. §9.5 option 2 calls for exactly this surface.

Phase 95 closes the loop.

## Locked decisions

| Question | Decision |
|---|---|
| Sim-side identity ownership | A new `tavernIdentityModule` writes the three existing state fields via `ctx.modifyTavernIdentity` on the `endDay` hook. Identity is state, not display. No schema migration — fields already exist. |
| Attribution-based hints | Computed at projection time in `worldOverviewProjection.ts`, surfaced as new `attributionHints` and `nicknames` fields on `TavernIdentityData`. Not on state — cheap to re-derive. |
| Card voice layer | New `src/cards/voice/` slice. Pure, deterministic via FNV hash of seed id (mirrors `descriptors.ts`). |
| `toneHints` consumption | Templates merge their declared `toneHints` with the seed's, pass them to the composer with the seed id as hash key. |
| Word-budget enforcement | Composer honours the existing 6-word title / 12-word line caps. Never invents facts outside the ingredient set. |
| Renderer changes | None to `CardRenderer.svelte` or `CardView` shape. |
| Daily Report voice | `dayLabel` and quiet-day lede get tone-aware composition. Diff-derived sections stay factual. |
| Returning-player / Quick Day | Out of scope; Phase 96 candidates. |
| Iconography | Deferred to Phase 96+. |
| Glossary | Add `voice`, `atmosphere`, `known_for`, `house_rules`, `attribution_hint`. |

## Files

### New — Sim slice

- `src/sim/modules/tavernIdentity/tavernIdentityModule.ts` — pure
  `SimulationModule` registered in `FULL_PIPELINE`. `endDay` hook
  recomputes the three identity arrays and writes via
  `ctx.modifyTavernIdentity` when any field changed.
- `src/sim/modules/tavernIdentity/labels.ts` — label tables
  (`AXIS_KNOWN_FOR`, `POLICY_HOUSE_RULE`, `ATMOSPHERE_TAG_MAP`) and
  thresholds.
- `src/sim/modules/tavernIdentity/index.ts` — re-exports.

Computation rules (pure, no RNG):
- `knownFor`: top reputation axes with `value ≥ 50`, mapped through
  `AXIS_KNOWN_FOR`. Sorted by value desc, capped at 3.
- `houseRules`: enabled policies from
  `state.modules.ownerActions.policies`, mapped through
  `POLICY_HOUSE_RULE`. Order matches policy iteration.
- `atmosphereTags`: combination of aggregate area conditions (≥ 50%
  of areas crossing a threshold) and dominant cultures
  (`familiarity ≥ 50 && comfort ≥ 50`). Capped at 5.

### Edit — Sim wiring

- `src/sim/testing/simRunner.ts` — add `tavernIdentityModule` to
  `FULL_PIPELINE`, after `monthlyModule` and before `historyModule`.
- `src/sim/state/defaults.ts` — seed `tavernIdentity.knownFor`,
  `atmosphereTags` with day-zero photo values.

### New — Card voice slice

- `src/cards/voice/tonePools.ts` — frozen record of tone → fragment
  pools covering the tones in use across templates and seeds.
- `src/cards/voice/composer.ts` — `composeTitle`, `composeBody`,
  `composeEmpty`, `pickFromPool`. Deterministic FNV-keyed picks.
- `src/cards/voice/index.ts` — re-exports.

### Edit — Card templates (9)

All templates migrate from `formatTitle` / `buildBody` to
`composeTitle` / `composeBody`, passing `{ toneHints, key: seed.id }`.

### Edit — Identity projection

- `src/reports/worldOverviewProjection.ts` — extend
  `TavernIdentityData` with `attributionHints: string[]` (≤ 4) and
  `nicknames: string[]` (≤ 2). `projectIdentity` populates both.
  `ATTRIBUTION_HINT_FRAGMENTS` pool keys off
  `attributionType` + perceiver kind.

### Edit — Daily Report voice

- `src/reports/dailyReportProjection.ts` — `buildHeader` adds
  `headerVoice?: string`; when `isQuiet === true`, attach
  `quietLine?: string`.
- `src/reports/types.ts` — add the two optional fields.

### Edit — Web components

- `web/src/lib/components/world/TavernIdentityStrip.svelte` — surface
  `attributionHints` ("Voices") and `nicknames`.
- `web/src/lib/components/DailyReport.svelte` — render `headerVoice`
  and `quietLine` when present.
- `web/src/lib/screens/DayScreen.svelte` — replace literal empty-state
  strings with `composeEmpty` calls.

### Edit — Glossary

- `src/reports/glossary.ts` — 5 new mechanic entries.

### Tests

- `tests/cards/voice/composer.test.ts` — determinism, tone routing,
  budget, no state-mutation.
- `tests/sim/phase95.tavernIdentityModule.test.ts` — endDay
  computation, idempotency, policy reactivity, stable multi-day runs.
- `tests/reports/worldOverviewProjection.identity.test.ts` —
  attribution hint filter/cap/dedup, nickname extraction, ordering.
- `tests/reports/dailyReportProjection.voice.test.ts` — voice
  attachment and stability.
- `tests/cards/templates.voice.test.ts` — per-template budget +
  determinism + tone landing.

## Verification

| Check | How |
|---|---|
| Tests | `npm test -- --run` |
| Types | `npm run typecheck` |
| Svelte | `npm run check` |
| Build | `npm run build` |
| Visual | `npm run dev`: identity strip populates after 7 days; cards re-render byte-identical; toggling a policy updates house rules next day. |

## Out of scope (deferred)

- Returning-player banner (§2.3) → Phase 96.
- Quick Day pattern (§3.7) → Phase 96.
- Missed-opportunity affordance (§9.4) → Phase 97.
- Iconography / portraiture → Phase 96+.
- Weekly/monthly digest voice — diff-derived; precision wins.
- `tavernIdentity` schema extension for new fields — projection-time
  is cheaper. Promote only when a sim consumer demands it.

## Critical files referenced

- `docs/plans/cards-contract.md §1, §5, §10`
- `docs/plans/game-loop-and-ux.md §9.5, §9.7, §10`
- `docs/plans/phase-94-tavern-log.md` "Out of scope"
- `src/cards/templates/*.ts` — 9 templates already declare toneHints
- `src/cards/cardHelpers.ts` — keep existing helpers
- `src/sim/content/text/descriptors.ts` — FNV pattern
- `src/sim/state/TavernState.ts:650` — `TavernIdentityState`
- `src/sim/core/engine.ts:1229` — `modifyTavernIdentity`
- `src/sim/testing/simRunner.ts` — `FULL_PIPELINE`
- `src/sim/modules/attribution/attributionTypes.ts`
- `src/sim/modules/ownerActions/types.ts:109` — `OwnerPolicyState`
- `src/reports/worldOverviewProjection.ts:295` — `projectIdentity`
- `src/reports/dailyReportProjection.ts:85` — `buildHeader`
- `web/src/lib/components/world/TavernIdentityStrip.svelte`
- `web/src/lib/screens/DayScreen.svelte`
