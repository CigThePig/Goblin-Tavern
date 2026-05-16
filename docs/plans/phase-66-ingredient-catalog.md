# Phase 66 — Ingredient + starter recipe catalog grow (ISSUE-026)

Implements ISSUE-026 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.1,
§6.2).

This phase populates the data layer the rest of the arc reads from.
Phase 65 created the `rarity` field and the `recipeRegistry` shape;
this phase grows both rosters across the four rarity tiers.

## Scope

- Register 12–18 new ingredients in `stockRegistry`, distributed across
  the four tiers per §4.1:
  - **0 new common** (the six starters already cover common).
  - **4–6 uncommon** — moderate spoilage, 2–3× sale price, sourceable
    via specialty suppliers (phase 68).
  - **5–8 rare** — aggressive spoilage, 5–8× sale price, sourceable
    only via expeditions (phase 70).
  - **2–4 legendary** — aggressive + unstable spoilage, 10–20× sale
    price, targeted expeditions only.
- For each new ingredient, register a 1:1 starter recipe
  `dish_<ingredientId>` with `prepDifficulty` set per tier (uncommon
  40, rare 65, legendary 85) and `demandTier` matching rarity.
- New recipes ship with `onMenu: false` — they activate only when the
  player has the ingredient in stock and chooses to feature it. The
  service flow already gates orders on `recipe.onMenu` from phase 65.
- Tag culturally-bound ingredients with appropriate cultural tags so
  cross-cutting cultures (phase ISSUE-010 work) can hook them later.

## Critical files

- `src/sim/registries/stockRegistry.ts` — new ingredient definitions
  appended to `REQUIRED_STOCK`.
- `src/sim/registries/recipeRegistry.ts` — corresponding starter
  recipes appended to `REQUIRED_RECIPES`.
- `tests/sim/phase66.ingredientCatalog.test.ts` — **NEW.**

## Test approach (ISSUE-026 verification)

- All new ingredients pass cross-reference validation against the
  recipe registry (every recipe input points at a real ingredient).
- Each new ingredient has a corresponding 1:1 starter recipe.
- Spoilage-rate test: rare and legendary items decay ~2× faster than
  common across a 14-day controlled window.
- `createInitialTavernState` includes the new ingredients (initial
  quantity 0 for non-starter rarities, so the default state remains
  identical to phase 65 in terms of "what's currently in stock" —
  rare/legendary items are *known to exist* as ingredient types but
  the tavern has none on day zero).

## Out of scope (do not do)

- Multi-input recipes (§13 — future).
- Specialty supplier rosters (phase 68, ISSUE-028).
- Wiring the renown axis (phase 67, ISSUE-027) to spoilage causes —
  the negative-drift hook lives in phase 67's scope.

## Notes

- The default tavern has 0 quantity of every new ingredient.
  `createInitialStock` seeds the registry's `defaultState.quantity`
  for each item; setting that to 0 means rare ingredients are
  "discoverable" but not stockpiled. This is intentional: the loop's
  acquisition path (expeditions in phase 70) is what fills them.
- All new recipes start `onMenu: false`. A future player action
  ("feature a dish") will flip the flag once the player has the
  ingredient.
- Cultural tags follow the convention introduced by `mushrooms`
  (`goblin_favourite`): when an ingredient has a clear cultural
  affinity, tag it so phase 67/72 renown drift and niche customer
  groups can read it.

## Ingredient roster (decision plan)

The exact set lands in implementation. Direction-setting examples:

- **Uncommon (5):** `bog_truffle`, `frost_cap_mushroom`, `river_eel`,
  `wild_thyme`, `smoked_boar_haunch`.
- **Rare (6):** `moonpetal_mushroom`, `kraken_ink`, `dragontongue_pepper`,
  `silvercap_truffle`, `ironbark_honey`, `cave_pearl_oyster`.
- **Legendary (3):** `phoenix_pepper`, `wyrmheart_tea_leaves`,
  `sunblood_orange`.

Total: 14 ingredients across the three non-common tiers, with 14
matching 1:1 starter recipes.
