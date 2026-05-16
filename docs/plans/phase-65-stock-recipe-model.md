# Phase 65 — Stock-and-recipe model extension (ISSUE-025)

Implements ISSUE-025 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.1,
§4.2, §5.1, §5.2, §6.1).

This is the foundation phase for the Rare Ingredients Economy arc.
Phases 66–73 build on the rarity field and the recipe registry
introduced here.

## Scope

- Add required `rarity: 'common' | 'uncommon' | 'rare' | 'legendary'`
  field to `StockDefinition`, `StockState`, and `StockItemStateSchema`.
- Classify the existing six stock items as `common`.
- New `recipeRegistry` mirroring the `stockRegistry` shape, with
  `ensureRequiredRecipesRegistered()` bootstrap.
- New `RecipeDefinition` carrying `inputs`, `prepDifficulty`,
  `demandTier`, `culturalTags`, `tags`.
- New `state.recipes: Record<string, RecipeState>` top-level slice with
  Zod schema; defaults populated from registry.
- Six 1:1 starter recipes `dish_<stockId>` for the existing stock
  items. All `demandTier: 'common'`, `prepDifficulty: 20`,
  `onMenu: true`.
- Extend cross-reference validation: every recipe input ingredient id
  must exist in `stockRegistry`.
- Rewire `customers/purchases.ts` basket flow so customer orders
  resolve to recipe ids, recipe `inputs` decrement from stock, and
  sale price is computed from the recipe's served quality (cook prep
  multiplier defaults to 1.0; phase 71 will vary it).

## Critical files

- `src/sim/registries/stockRegistry.ts` — add `rarity` to definitions.
- `src/sim/state/TavernState.ts` — add `rarity` to `StockState`; add
  `RecipeState` type; add `recipes` field to `TavernState`.
- `src/sim/state/schemas.ts` — extend `StockItemStateSchema`; add
  `RecipeStateSchema`; thread into `buildTavernStateSchema`.
- `src/sim/state/defaults.ts` — `createInitialRecipes()`; new field on
  `createInitialStock` spread.
- `src/sim/state/referenceValidation.ts` — new
  `validateRecipeReferences()` checking every recipe input id exists.
- `src/sim/registries/recipeRegistry.ts` — **NEW.** Registry, types,
  REQUIRED_RECIPES, `ensureRequiredRecipesRegistered()`.
- `src/sim/modules/service/recipes.ts` — **NEW.** `sellRecipe(ctx,
  recipeId, quantity, options)` helper that consumes recipe inputs
  via `sellStockItem` and tracks recipe state. Public helper consumed
  by customer purchases path. Returns `{ sold, earned, shortages }`.
- `src/sim/modules/customers/purchases.ts` — basket switches from
  stock-ids to recipe-ids; calls `sellRecipe` per basket item.
- `tests/sim/phase65.stockRecipeModel.test.ts` — **NEW.**

## Test approach (ISSUE-025 verification)

- Rarity field round-trips through Zod (existing schema test patterns).
- Cross-reference validation rejects a recipe whose `inputs` reference
  an unknown ingredient id.
- `state.recipes` round-trips through the top-level state schema.
- 7-day playtest using only the starter 1:1 recipes produces
  identical coin/turnout/memory output versus a pre-extension
  baseline. The simplest baseline check: run 7 days from default
  state, assert the same coin total a clean Phase 44 run produces.
  Equivalently, assert determinism: same seed + same input two ways
  (recipe path) produces stable totals across a 7-day window.

## Out of scope (do not do)

- Per-batch ingredient identity (§12 of design doc).
- Multi-input recipes (§13 — future).
- Quality/prep-multiplier variance (phase 71 wires this).
- Renown axis (phase 67) or producers writing to it.

## Notes

- Existing `phase09.stock.test.ts` and `phase12.service.test.ts`
  should continue to pass without modification because the 1:1
  starter recipes preserve end-to-end stock consumption and coin
  earnings.
- `sellRecipe` calls `sellStockItem` per input. With 1:1 starter
  recipes (1 input × 1 quantity), each "recipe sold" produces
  identical state mutations to the prior "stock item sold" code path.
