# Phase 73 — Storage areas + integration polish (ISSUE-033)

Implements ISSUE-033 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.8,
§5.7, §6.8, §9, §11).

The capstone phase for the Rare Ingredients Economy arc. Adds the
gameplay-bearing storage areas, un-pins `main_room` from hardcoded
seed-generator writes, and runs an integration audit confirming the
arc's memory + cause + pressure web is fully wired.

## Scope

- Add optional `ingredientYield?` and `spoilageModifier?` fields to
  `AreaDefinition`; Zod-optional on `AreaStateSchema` (defaults
  preserve existing behaviour).
- Add 4 new area definitions:
  - `herb_garden` — `ingredientYield` produces 1–2 wild_thyme per
    week, boosted by `growing_season` calendar tag.
  - `cold_cellar` — `spoilageModifier` halves spoilage rate on
    `rare`/`legendary` ingredients stored there.
  - `private_booth` — atmosphere area (customer-facing, intimate).
  - `stage_corner` — atmosphere area (customer-facing, performance).
- Wire `cold_cellar.spoilageModifier` consumer in
  `applyDailySpoilage` so rare/legendary items stored there decay
  more slowly.
- Wire `herb_garden.ingredientYield` consumer via a new weekly
  hook in the existing `areasModule` (or a small new module). The
  hook reads the herb garden's yield definition, adds the
  ingredient to stock, optionally boosts by calendar tag.
- De-pin `main_room` from the 8 hardcoded `areaRef('main_room')`
  writes in `src/sim/modules/issues/issueSeedGenerators.ts` plus
  the 1 in `expandedSeedGenerators.ts`. Replace each with picker-
  driven selection (filter areas by tag matching the seed family's
  intent — `customer_facing`, `kitchen_adjacent`, etc.) or
  state-driven rotation.
- Integration audit (test-driven): verify every new memory key from
  the arc has at least one downstream consumer or seed generator
  reading it. Verify every new cause type has non-empty
  `relatedActors`. Confirm pressure interactions per §9 are wired.

## Critical files

- `src/sim/state/TavernState.ts` — extend `AreaDefinition` /
  `AreaState` types with `ingredientYield?` and `spoilageModifier?`.
- `src/sim/state/schemas.ts` — extend `AreaStateSchema` with new
  optional fields.
- `src/sim/registries/areaRegistry.ts` — add 4 new area definitions.
- `src/sim/modules/stock/spoilage.ts` — consume
  `spoilageModifier` per item's `storageAreaId`.
- `src/sim/modules/areas/areasModule.ts` — new weekly hook for
  `ingredientYield`.
- `src/sim/modules/issues/issueSeedGenerators.ts` — replace
  hardcoded `areaRef('main_room')` writes (priority on the ones
  affecting customer-facing seed families).
- `tests/sim/phase73.storageIntegration.test.ts` — **NEW.**

## Test approach (ISSUE-033 verification)

- Area registry round-trips through Zod with the new fields.
- Cold cellar halves spoilage rate on rare/legendary in a
  controlled 14-day test (compared against the same items in
  default storage).
- Herb garden produces a weekly trickle of wild_thyme; the count is
  predictable across a 28-day deterministic run.
- Sweep `state.causes` after a multi-week run: every cause produced
  by phase 65–72 producers carries non-empty `relatedActors`.
- Sweep `state.memories` after the run: every new memory key
  (`expedition_success`, `expedition_failure`, `runner_lost`,
  `excellent_preparation`, `botched_preparation`,
  `rare_ingredient_spoiled`, `served_rare_dish`,
  `niche_visitor_arrived`) is producible from gameplay.
- Pressure web: rare ingredient spoilage shows up as a contributor
  to `stock_shortage` and `food_safety`; staff burnout includes
  `botched_preparation`-derived signal. (For phase 73, the test
  exercises the producer side and confirms the pressure
  calculators consume the memory keys; the full numerical
  balancing is future work.)

## Out of scope (do not do)

- A full 90-day system-level acceptance playtest with hardcoded
  threshold assertions — these are the §11 acceptance criteria but
  are too brittle for committed CI tests. The phase 73 tests cover
  the structural properties (cause attribution, memory wiring,
  area-driven spoilage modulation); the §11 free-form playtest
  belongs in a manual verification log.
- New pressure types (§9 explicitly does not add any).

## Notes

- The `growing_season` calendar tag isn't yet a registered calendar
  tag in the codebase. The herb garden yield uses it as a hint;
  if the tag isn't present on a given week, the base yield still
  applies (no harm, no boost).
- The 4 new areas seed via the existing `createInitialAreas`
  spread; no defaults.ts edit needed.
- For the `main_room` un-pin: rather than rewrite every seed
  generator at once, phase 73 lays the picker helper and rewires
  the highest-impact 2–3 sites. The remaining hardcoded writes
  are flagged in the integration audit test for follow-up.
