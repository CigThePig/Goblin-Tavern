# Phase 79 — Broaden `culinary_renown` consumers (ISSUE-039)

See `docs/ISSUE_TRACKER.md` ISSUE-039 for full evidence and impact.

## Context

`culinary_renown` had only two consumers — niche-group activation
(`customerModule.evaluateNicheThresholds`) and the hireable-adventurer
soft-cap (`adventurersModule.softCapForRenown`). A player who built
renown to 70+ unlocked those two effects and got nothing on the
day-to-day satisfaction or pricing loop.

## Implementation

`src/sim/modules/customers/forecast.ts`:
- New `RARITY_PREFERENCE_TAGS` set covering the tag vocabulary used
  across `customerRegistry` to flag rarity-appetite groups:
  `rare`, `legendary`, `prized`, `mythic`, `exotic`,
  `quality_sensitive`. (No production group uses literal
  `rare`/`legendary`; the existing niche groups use `prized`,
  `mythic`, `exotic`; the `merchants` group uses
  `quality_sensitive`.)
- `groupCaresAboutRarity(group)` predicate over that set.
- `renownAttractionModifier(group, state)` returns
  `Math.round(renown * 0.05)` for rarity-loving groups, 0 otherwise.
  Renown 100 → +5 visitors. Renown 0 → 0. The producer side
  already has an idle-decay safety valve (`recipesDaily.ts:71-95`),
  so the loop has a natural ceiling.
- `priceToleranceMultiplier(group, state)` returns a multiplier in
  `[0.85, 1.0]` for rarity-loving groups, multiplied into the
  existing `pricePenalty` calculation. Renown 100 = 15% softer
  price penalty.
- `forecastTrafficForGroup` includes `renownPull` in the visitor sum
  and emits a `notes` entry when the lift is positive.

## Verification

`tests/sim/phase79.renownConsumers.test.ts` (new, 5 tests):
- rarity group's forecast lifts when renown moves 10 → 80;
- common (non-rarity) group's forecast is unchanged;
- the same rarity group's `pricePenalty` drops at high renown;
- the new note appears at high renown;
- renown 0 produces no note (no false positives).

Adjacent suites still green: `phase67.culinaryRenown` (9),
`phase72.nicheCustomers` (8), `phase10.customers` (16).

## Files

- `src/sim/modules/customers/forecast.ts`
- `tests/sim/phase79.renownConsumers.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
