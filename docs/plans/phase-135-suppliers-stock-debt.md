# Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt)

**Second Movement II migration** after Phase 7 (`staff_burnout` + `staff_aside` sim-backed line) and Phase 8 (`regular_customer` + `customer_complaint` partition). Ships three compositional templates that finish the legacy-supplierOffer migration kicked off by the Phase-3 establishing-line spike (`specs/cards/supplier_reliability.spec.yaml`) and gives `stock_shortage` and `debt_rent` their first dedicated cards.

## Context

Three issue-seed families currently render through legacy paths:

- **`supplier_relationship` / `supplier_offer`** is handled by `src/cards/templates/supplierOffer.ts`, which glues `ti.marketContext[0]`, `"reliability ${value}"`, and `ti.recentContext[0]` through `composeBody` — the broken-screenshot template that started the arc. Phase 3 / ISSUE-098 already converged the replacement spec; Phase 9 emits it as TS pools and ships the template.
- **`stock_shortage` / `warning`** (`src/sim/modules/issues/issueSeedGenerators.ts:390-645`) has no dedicated template — falls through to `fallbackCard`. Seed has no `primaryActor`; subject is a stock item, `affectedActors` is a `customerRef('miners')` cohort.
- **`debt_rent` / `debt_pressure`** (`issueSeedGenerators.ts:2382-2563`) — also fallback. Seed has no `primaryActor` by design (audit pass 1 §5.3 — landlord is `systemRef`, not a real entity), `affectedActors: []`, timing `end_month`.

## Scope delivered

**Three new compositional templates** wired into `REQUIRED_CARDS`:

| Template | id | voiceRegister | actor model |
|---|---|---|---|
| `supplierReliabilityCard` | `supplier_relationship.supplier_offer` | `trade_floor` | actor-voiced via supplier `castAttributes` |
| `stockShortageCard` | `stock_shortage.warning` | `back_of_house` | narrator-voiced (no actor) |
| `debtRentCard` | `debt_rent.debt_pressure` | `office_quarters` | narrator-voiced (no actor) |

All three share the Phase 7/8 four-slot body shape: `title (≤6w, flavor)`, `establishing_line (≤14w, sim_backed)`, `reaction_line (≤12w, flavor)`, `manner_note (≤10w, flavor, optional)`, plus Phase-6 composed `choice_label` + `effect_preview` via `composeChoicesFromSeed`.

**The ownerless-framing decision.** For `stock_shortage` and `debt_rent`, snippet pools gate ONLY on sim/seed primitives (`signalEquals`, `pressureRising`, `memoryPresent`, `repeatCount`, `hasTag`, `severityAtLeast`, `seedType`). No `voiceAxis` / `verbalTic` conditions in any slot — the framework's actor resolution returns `undefined` for these seeds, so those primitives could never fire anyway. The diversity sampler perturbs **state** (pressures, memories, calendar tags, severity, day type) rather than cast attributes. Cohort routing for stock_shortage's miners is deferred as design-intent.

**Two new specs** at `specs/cards/stock_shortage.spec.yaml` and `specs/cards/debt_rent.spec.yaml` mirror the Phase-3 spec layout (slots, simSignalsInUse, hardBounds, positiveExemplars, negativeExamples, snippetPools, mustPass) but note the ownerless framing in `voiceAxesInPlay: (none — see voiceRegister)`. The existing `specs/cards/supplier_reliability.spec.yaml` is unchanged.

**Deleted:** `src/cards/templates/supplierOffer.ts` and the legacy `Template 3 — supplierOfferCard` / `supplierOfferCard voice` test blocks.

## Critical files

**Templates** (new):
- `src/cards/templates/supplierReliability.ts` — actor-voiced; title `${supplierDisplay}: ${snippet}` prefix; `custom` predicate requires supplier `castAttributes`.
- `src/cards/templates/stockShortage.ts` — narrator-voiced; title is snippet only (no prefix); no `custom` predicate.
- `src/cards/templates/debtRent.ts` — narrator-voiced; title is snippet only.

**Pools** (new — 21 files total):
- `src/cards/compose/pools/supplierReliability/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` — emits the Phase-3 spec verbatim.
- `src/cards/compose/pools/stockShortage/{...same 7...}.ts` — primitive-only conditions; reaction_line / manner_note vary on tags/memories/pressures/severity.
- `src/cards/compose/pools/debtRent/{...same 7...}.ts` — primitive-only; key tags `rent_due_soon` (calendar) and memories `rent_paid_recently` / `rent_delayed_recently` / `borrowed_coin_recently` / `eviction_threat_possible`.

**Registry:**
- `src/cards/templates/index.ts` — swap `supplierOfferCard` → `supplierReliabilityCard`; add `stockShortageCard` and `debtRentCard`.

**Tests:**
- `tests/cards/templates.supplierReliability.test.ts` — ~15 tests, mirrors `templates.staffBurnout.test.ts`.
- `tests/cards/templates.stockShortage.test.ts` — ~13 tests, ownerless variant.
- `tests/cards/templates.debtRent.test.ts` — ~13 tests, ownerless variant.
- `tests/cards/compose/gates/samplers.ts` — six new exported sampler functions (Supplier* actor-perturbation, Stock* and Debt* state-perturbation), plus Phase-6 context builders for the three new templates' choice/preview pools.
- `tests/cards/compose/gates/runAllGates.test.ts` — three new template integration blocks and three new choice-pool gate blocks.
- `tests/cards/templates.test.ts` — Template-3 block replaced by 3a/3b/3c blocks.
- `tests/cards/templates.voice.test.ts` — `supplierOfferCard voice` block replaced by three new blocks asserting no raw `reliability \d+` / `low stock` / `debt \d+` / `coin pile` mechanical readouts.

## Verification

```
npm test -- --run tests/cards/compose/gates/dedupe.test.ts
npm test -- --run tests/cards/compose/gates/
npm test -- --run tests/cards/templates.supplierReliability.test.ts
npm test -- --run tests/cards/templates.stockShortage.test.ts
npm test -- --run tests/cards/templates.debtRent.test.ts
npm run typecheck
npm test -- --run
```

## Out of scope

- No Movement I loopback (no new signal ids or condition primitives — the existing data primitives suffice).
- No cohort routing for stock_shortage's miners (deferred as design-intent).
- No `playerOwner` voice profile (Phase-2 universal cast surface stays as-is).
- No changes to seed generators (`generateSupplierOffer`, `generateStockShortage`, `generateDebtRent`).
- No changes to `composeBody` / `composeTitle` / `voice/tonePools.ts` (Phase 16 retires those).
