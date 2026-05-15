# Phase 67 — Culinary renown reputation axis (ISSUE-027)

Implements ISSUE-027 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §4.6,
§5.5, §6.6).

This phase introduces the reputation axis the loop's positive feedback
accumulates against. The axis has no consumer yet (phase 72's niche
customer groups will gate on it) and not all producers (expeditions
arrive in phase 70). This phase wires the axis itself plus producers
that lie within the recipe-and-stock domain.

## Scope

- Add `culinary_renown: number` to `ReputationState` (initial value 10
  per §5.5).
- Add field to `ReputationStateSchema` Zod object.
- Register `culinary_renown` in `reputationRegistry` (the registry's
  first real consumer).
- Wire producers within the existing module boundaries:
  - `serviceModule`: positive drift when an uncommon-tier+ recipe is
    served. Larger positive drift when the demand-tier matches the
    rarity (e.g. a rare-tier recipe with rare-tier ingredient is +X;
    a common recipe with rare ingredient is just +smaller). Every
    drift writes a cause with `relatedActors` including the customer
    group and the recipe.
  - `stockModule`: negative drift when a rare-tier+ ingredient
    spoils — emit a `rare_ingredient_spoiled` memory + cause.
  - Slow natural decay (−1 per 30 days) when only common-tier dishes
    have been served in the past 30 days. Implement in a monthly tick
    or by reading `state.recipes[*].timesServed` and
    `daysSinceLastServed` against rarity.
- Hooks for producers that come online later:
  - Expedition resolution renown drift wires in phase 70 — declared
    as a hook surface but not exercised by this phase.
  - Botched preparation drift wires in phase 71 — same.

## Critical files

- `src/sim/state/TavernState.ts` — `ReputationState.culinary_renown`.
- `src/sim/state/schemas.ts` — `ReputationStateSchema.culinary_renown`.
- `src/sim/state/defaults.ts` — initial value 10.
- `src/sim/registries/reputationRegistry.ts` — register
  `culinary_renown` axis.
- `src/sim/modules/service/resolveService.ts` (or recipe sale path) —
  positive drift on uncommon+ recipe served.
- `src/sim/modules/stock/spoilage.ts` (or stockModule endDay hook) —
  negative drift + memory write on rare-tier+ spoilage.
- Define a small shared helper `applyRenownDrift(ctx, delta, draft)`
  in `src/sim/modules/service/renown.ts` (or similar) so producers
  share the cause-emission contract.
- `tests/sim/phase67.culinaryRenown.test.ts` — **NEW.**

## Test approach (ISSUE-027 verification)

- Reputation round-trips through Zod with `culinary_renown` present.
- Serving an uncommon+ recipe at sufficient stock generates a
  positive drift with a cause entry carrying non-empty
  `relatedActors`.
- Rare-tier+ ingredient spoilage causes a negative drift +
  `rare_ingredient_spoiled` memory.
- A 30-day playtest serving only common dishes shows
  `culinary_renown` drifting slowly downward toward 0.

## Out of scope (do not do)

- Niche customer group threshold gating (phase 72).
- Expedition success/failure drift (phase 70).
- Botched-prep negative drift (phase 71 — soft-gate prep check).
- Splitting renown into sourcing vs execution axes (§12 "Do Not Do").

## Notes

- Reputation drift goes through `ctx.modifyReputation` per the Phase
  15 §15.5 helper signature. Each call carries a `CauseDraft` with
  `target: 'reputation:culinary_renown'`, `targetType: 'reputation'`,
  `relatedActors` populated.
- Following the §11 acceptance criterion that every cause has
  non-empty `relatedActors`, every producer below records at least
  one ref:
  - service drift → recipe (`{ kind: 'recipe', id }` — see note
    below) + customer group + cook.
  - spoilage drift → stock item + (optional) storage area.
- `EntityRef.kind` doesn't yet include `recipe`. Phase 67 adds it.
  Reference validation handles unknown recipe ids identically to
  `stock` and `staff` (lookup against `state.recipes`).
- The natural decay rule reads `state.recipes` and checks the
  serving history across the past 30 days. A simple implementation:
  every day, if no uncommon+ recipe was served in the past 30 days
  (per `lastServedDay`), apply −1/30 drift. Operationally this can
  emit a small fractional decay daily or a −1 decay on day 30
  exactly.
