# Phase 84 — Supplier relationship + reliability affect pricing & delivery (ISSUE-044)

See `docs/ISSUE_TRACKER.md` ISSUE-044 for full evidence and impact.

## Context

`getEffectiveBasePrice` ignored `supplier.relationship` entirely;
`supplier.reliability` only fed a tiny relationship-drift loop. The
supplier report surfaced both meters to the player as if they
mattered, but neither fed pricing, delivery, or stock decisions.
Switching suppliers was purely a `priceBias` + `goodsProvided` call.

## Implementation

`src/sim/modules/suppliers/pricing.ts`:
- New `getRelationshipPriceMultiplier(supplier)` — pure helper,
  `(supplier.relationship - 50) * 0.001` clamped to ±5%; returns
  `1 - bounded` so relationship 80 → 0.97 (3% off), 30 → 1.02 (2%
  surcharge), 50 → 1.0.
- `getEffectiveBasePrice` multiplies its result by
  `getRelationshipPriceMultiplier(supplier)` when a supplier is
  given. Other callers' contracts unchanged (signature is the same).
- New `getMissedDeliveryProbability(supplier)` — pure helper,
  `(60 - reliability) * 0.005`, clamped to [0, 0.5]. Reliability ≥ 60
  never misses; reliability 40 misses ~10% of attempts; reliability 0
  is hard-capped at 50%.

`src/sim/core/rng.ts`:
- New `supplier_delivery` named stream in the `RngStreamId` union
  and `ALL_STREAM_IDS` array. Keeps the missed-delivery roll from
  shifting the daily service order, and vice versa.

`src/sim/modules/suppliers/supplierModule.ts`:
- `supplierUpdateHook` now runs a per-supplier daily roll using the
  new stream. When a roll lands, the supplier picks one stock id
  from `goodsProvided`, records a `SupplierMissedDelivery` entry on
  `state.modules.suppliers.missedDeliveriesToday`, and emits a
  matching cause (`source: suppliers.missed_delivery`,
  `targetType: 'supplier'`, neutral direction — the missed delivery
  records the event, the cause documents it).

`src/sim/modules/suppliers/supplierReport.ts`:
- Suppliers line now shows the effective discount/surcharge as a
  percentage when the relationship multiplier moves off 1.0.

## Verification

`tests/sim/phase84.supplierPricingDelivery.test.ts` (new, 7 tests):
- relationship 80 < 30 on effective base price;
- relationship 50 → multiplier 1.0;
- relationship effect bounded ±5%;
- `getMissedDeliveryProbability` monotonic in reliability;
- low-reliability supplier (30) misses deliveries over 60 days, while
  a high-reliability supplier (90) never does;
- high-relationship supplier shows "discount" in the report;
- low-relationship supplier shows "surcharge" in the report.

Adjacent suites still green: `phase29.suppliersMarketGoods` (22),
`phase68.specialtySuppliers` (6). Typecheck clean.

## Files

- `src/sim/modules/suppliers/pricing.ts`
- `src/sim/modules/suppliers/supplierModule.ts`
- `src/sim/modules/suppliers/supplierReport.ts`
- `src/sim/core/rng.ts`
- `tests/sim/phase84.supplierPricingDelivery.test.ts` (new)
- `docs/ISSUE_TRACKER.md`
