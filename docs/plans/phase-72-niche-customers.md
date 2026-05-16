# Phase 72 — Niche customer groups (ISSUE-032)

Implements ISSUE-032 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.7,
§5.6, §6.7).

This phase closes the demand-side of the rare-ingredient loop:
`culinary_renown` now has real consumers — niche customer groups whose
arrival is gated on the renown threshold.

## Scope

- Add optional `minRenownThreshold?: number` to
  `CustomerGroupDefinition` and `CustomerGroupState` plus Zod schema
  (default 0 — existing groups remain always-available).
- Add 4 new niche customer groups to `customerRegistry`:
  - `gourmand` (threshold 30) — tips well, prefers uncommon recipes.
  - `food_critic` (threshold 50) — rare visits, writes a memory.
  - `foreign_envoy` (threshold 55) — large groups, relationship
    sensitive.
  - `eccentric_noble` (threshold 70) — very rare; high spend;
    intolerant of filth.
- New `niche_customer_arrival` RNG stream registered in `rng.ts`.
- Niche groups seed with `patronage: 0` and `loyalty` low — they
  exist in state from day zero but don't visit until activated.
- Customer module hook (added to existing `forecastTraffic` slot)
  evaluates each niche group:
  - If `culinary_renown >= minRenownThreshold` and group's
    patronage is below `activationFloor` (15), ramp patronage to
    `activationFloor` and write a `niche_visitor_arrived` memory
    with `relatedActors: [customer_group]`.
  - If patronage > 0 and `culinary_renown < minRenownThreshold − 5`
    (small hysteresis), decay patronage by 2 per day toward 0.

## Critical files

- `src/sim/state/TavernState.ts` — `CustomerGroupState.minRenownThreshold?`
- `src/sim/state/schemas.ts` —
  `CustomerGroupStateSchema.minRenownThreshold` optional.
- `src/sim/registries/customerRegistry.ts` — add 4 niche group
  definitions; threshold field on defaultState.
- `src/sim/core/rng.ts` — add `'niche_customer_arrival'` to
  `RngStreamId` union + `ALL_STREAM_IDS`.
- `src/sim/modules/customers/customerModule.ts` — add new hook /
  helper for threshold evaluation. Reuses existing `forecastTraffic`
  hook.
- `tests/sim/phase72.nicheCustomers.test.ts` — **NEW.**

## Test approach (ISSUE-032 verification)

- With `culinary_renown < 30`, no niche group has positive
  patronage.
- Raising renown across thresholds activates the corresponding
  groups in order: gourmand at 30, food_critic at 50, etc.
- Each activation writes a `niche_visitor_arrived` memory with
  non-empty `relatedActors`.
- Dropping renown below `threshold − 5` decays the patronage back
  toward 0.

## Out of scope (do not do)

- Niche groups consuming specific rare recipes (the existing
  `recipeMatchesPreferences` filter handles this naturally via
  `preferredStockTags`).
- Pre-Phase-72 customer groups gaining a threshold field — they
  remain always-available (`minRenownThreshold` defaults to 0).

## Notes

- Per the design doc §4.7, niche groups' decay rule reads recently
  served recipes; for phase 72 the simpler renown-threshold
  hysteresis covers the test approach. A future polish phase can
  fold in per-group decay-on-unmet-preferences.
- The `niche_customer_arrival` RNG stream isn't actually consumed
  in phase 72 — declared for future polish (variance on
  activation-day patronage ramp) but the hook keeps the stream
  ready.
