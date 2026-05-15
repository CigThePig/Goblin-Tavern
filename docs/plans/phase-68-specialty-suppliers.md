# Phase 68 — Specialty supplier expansion (ISSUE-028)

Implements ISSUE-028 per `docs/ISSUE_TRACKER.md` and the locked design
contract at `docs/plans/rare-ingredients-economy.md` (sections §6.2).

This phase fills out the supplier roster so the `supplier_distrust`
calculator's "switch to alternate" recommendation has real targets, and
adds a low-effort baseline route to uncommon-tier ingredients before
players commit to expeditions (phase 70).

## Scope

- Add one alternate supplier per existing category (food_cart, brewer,
  caravan, butcher_or_salvage_food), each carrying a different
  trade-off profile (cheap-unreliable vs expensive-stable).
- Add a new `specialty_goods` category with one starter supplier
  carrying 2–3 uncommon-tier ingredients from the phase-66 catalog.
- At least two of the alternates carry one uncommon-tier ingredient in
  their `goodsProvided`, giving the player a deterministic
  non-expedition route to uncommon goods.
- Existing `state.world.suppliers` defaults populate from the registry
  via `createInitialSuppliers()` — no defaults file edit needed.

## Critical files

- `src/sim/content/suppliers/supplierRegistry.ts` — append new
  definitions to `REQUIRED_SUPPLIERS`.
- `tests/sim/phase68.specialtySuppliers.test.ts` — **NEW.**

## Test approach (ISSUE-028 verification)

- Cross-reference validation passes — every `goodsProvided` id exists
  in `stockRegistry`.
- The supplier roster now has ≥ 9 entries; each existing category has
  ≥ 2 suppliers; the new `specialty_goods` category exists with ≥ 1
  supplier carrying ≥ 2 uncommon-tier ingredients.
- The supplier roster appears in the named-entity-repetition report
  with hit counts diluting the prior `brakka_mushroom_cart = 35`
  concentration (verified via a 28-day cardless run).

## Out of scope (do not do)

- The `switch_supplier` response slot already includes the chosen
  supplier as its target; rewiring it to pick a same-category
  alternate is a phase 73 polish task per ISSUE-033.
- Specialty supplier expedition tie-ins (phase 70).
- Uncommon ingredient flow from supplier deliveries — phase 28's
  delivery scheduling handles this once goods land in stock.
