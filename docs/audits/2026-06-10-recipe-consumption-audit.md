# Codebase audit — 2026-06-10: recipe input over-consumption + supporting findings

A targeted bug-hunt across `src/sim/`, `src/cards/`, and `src/reports/`,
focused on the architectural invariants in `CLAUDE.md` (determinism,
purity, serializability, causality) plus economy/ledger math. One
high-severity latent bug was found and empirically reproduced; three
lower-severity architectural hazards were noted along the way. Several
areas suspected of being fragile were probed and verified clean (see
§5).

---

## 1. HIGH — `sellRecipe` consumes the uncapped request, not the bottleneck-capped amount

**File:** `src/sim/modules/service/recipes.ts:149-160`
**Status:** Latent but armed — masked today only because every shipped
recipe is 1 input × quantity 1. The function is the designed integration
point for multi-input recipes (its own doc comment says so), and the
moment any recipe with a second input or a `quantity > 1` is registered,
stock, coin, and the shortage pipeline all go wrong at once.

### The bug

`sellRecipe()` first computes the bottleneck correctly — the maximum
servings the tightest ingredient can back:

```ts
// recipes.ts:138-144 — correct
let maxServings = servings
for (const input of def.inputs) {
  const available = ctx.state.stock[input.ingredientId]?.quantity ?? 0
  const capacity = Math.floor(available / input.quantity)
  if (capacity < maxServings) maxServings = capacity
}
const sold = Math.max(0, maxServings)
```

…then ignores it when actually consuming stock. The loop computes the
correct capped amount into `toSell`, but passes the **uncapped**
`requested` to `sellStockItem`, and discards `toSell` with a `void`:

```ts
// recipes.ts:149-160, 179
for (const input of def.inputs) {
  const requested = servings * input.quantity   // uncapped demand
  const toSell = sold * input.quantity          // correct capped amount
  ...
  const sale = sellStockItem(ctx, input.ingredientId, requested, sellOptions)
  //                                               ^^^^^^^^^ BUG: should be toSell
  ...
  void toSell                                   // correct value, discarded
}
```

`sellStockItem` (`src/sim/modules/stock/sales.ts:77-112`) clamps each
request to availability and records a `ShortageRecord` whenever
`requested > available` — so every non-bottleneck input is drained
beyond what the served dishes need, and the bottleneck input generates a
spurious shortage that `sellRecipe`'s own cap was supposed to prevent.

### Empirical reproduction (verified on this commit)

Registered a 2-input recipe (`2× stew + 1× ale`), stocked 5 stew / 50
ale, requested 3 servings via a probe module inside `simulateDay` (same
harness as `tests/sim/phase65.stockRecipeModel.test.ts`). Bottleneck:
`floor(5/2) = 2` servings, so correct consumption is 4 stew + 2 ale.
Actual output:

```
servings reported sold:         2
stew consumed (actual/correct): 5 / 4
ale consumed (actual/correct):  3 / 2
earned (actual/correct):        24 / 18
shortage records:               [{"stockId":"stew","requested":6,"available":5,"day":1,"reason":"sale"}]
itemsConsumed:                  [{"stockId":"stew","quantity":5},{"stockId":"ale","quantity":3}]
```

### Impact (all four confirmed by the reproduction)

1. **Stock over-consumption / half-consumed inputs.** 5 stew destroyed
   for 2 servings (2.5 servings' worth) — directly violating the
   function's own comment at `recipes.ts:136-137`: *"we floor the
   bottleneck so we never half-consume an input."*
2. **Coin inflation.** The ledger earns coin for every raw unit sold
   (24 instead of 18 here) — revenue for ingredients no customer was
   served. This corrupts the Phase 9 ledger, daily/weekly economy
   reports, and anything downstream that trusts `earned`.
3. **Spurious shortage records.** The bottleneck input records a
   shortage (`requested: 6, available: 5`) even though `sellRecipe`
   already capped servings to what stock could back. Shortages feed the
   issue-seed and pressure pipelines, so this would surface phantom
   "we ran out" problems to the card layer — a violation of the Core
   Design Rule (cards must not be fed invented truth).
4. **Internally inconsistent result.** `result.sold = 2` (servings) but
   `itemsConsumed` reports the over-consumed quantities, so consumers of
   `SellRecipeResult` see a basket that doesn't match the servings count.

### Fix

One-line change at `recipes.ts:160` (plus deleting the `void toSell`
escape hatch at line 179):

```ts
const sale = sellStockItem(ctx, input.ingredientId, toSell, sellOptions)
```

Note: with `toSell` passed, `sale.shortage` can no longer fire in steady
state, so if the design wants a shortage signal for the *unmet demand*
(`servings - sold`), that should be recorded deliberately (once, for the
bottleneck ingredient) rather than as a side effect of over-requesting.

### Suggested regression test

Extend `tests/sim/phase65.stockRecipeModel.test.ts` with a transient
multi-input recipe (register/unregister pattern already used there at
line 96-132): stock 5+50, request 3, assert consumption `4/2`, earned
`2×(2·stewPrice + alePrice)`, and zero shortage records. The existing
phase-65 guard ("every registered recipe must be a 1:1 starter",
line 79-86) is exactly the assertion that currently masks this bug —
it should be relaxed in the same change that fixes the consumption.

---

## 2. MEDIUM — Four modules write world state directly, bypassing the `ctx.modify*` mutation protocol

**Files:**
- `src/sim/modules/regulars/regularModule.ts:161` (`ctx.state.world.regulars[id] = regular`) and `:316` (`delete ctx.state.world.regulars[removedId]`)
- `src/sim/modules/attribution/attributionModule.ts:501` (`ctx.state.world.socialRumours[rumour.id] = rumour`)
- `src/sim/modules/localArcs/localArcsModule.ts:80` (`ctx.state.world.localEvents[arc.id] = arc`)
- `src/sim/modules/weekly/community.ts:580` (`ctx.state.world.socialRumours[rumour.id] = persisted`)

All other state changes flow through `ctx.modify*` helpers; these four
sites assign into `ctx.state.world.*` containers directly. Each site's
comment acknowledges the deviation (each cites the regulars module as
the precedent), and the SimContext simply has no `addRegular` /
`addSocialRumour` / `addLocalEvent` creation helpers.

**Mitigating facts (verified, which is why this is medium not high):**
the engine deep-clones the input state (`cloneTavernState` →
`structuredClone`), so `previousState` is never mutated; day diffs are
produced by full-state snapshot comparison in
`src/sim/core/changeTracker.ts`, so the writes still appear in
`SimResult.diffs`; and each site records causality manually via
`ctx.addCause(...)` immediately after the write (e.g.
`regularModule.ts:162-172`).

**Why it still matters:** entity *creation* is invisible to whatever
per-change bookkeeping the `modify*` path performs, the pattern is
spreading by copy-paste (four modules and counting, each citing the
last), and a fifth copy that forgets the manual `addCause` would
silently break Architectural Rule 6. The fix the comments themselves
ask for: add `ctx.addRegular()` / `ctx.addSocialRumour()` /
`ctx.addLocalEvent()` (and a remove counterpart) to SimContext and
migrate the four sites.

---

## 3. MEDIUM-LOW — SimContext query helpers return live, mutable references into state

**File:** `src/sim/core/engine.ts:1325-1343` (world getters: `getCulture`,
`getFaction`, `getSupplier`, `getRegular`, `getNotableNpc`,
`getLocalEvent`, `getSocialRumour`), `:1370-1386` (memory getters),
`:1405-1441` (history/cause getters).

These return direct references (or filtered arrays of direct references)
into `runtime.current`. Any module that does
`ctx.getCulture(id).comfort -= 5` mutates state outside the sanctioned
path with no error and no record. No current caller does this (audited),
but it is an unguarded contract relied on across ~26 modules. Cheap
hardening options: return `structuredClone`d objects from the getters,
or `Object.freeze` in dev/test builds so an accidental write throws
under Vitest.

---

## 4. LOW — `StateDiff` `after` values alias the returned final state

**File:** `src/sim/core/diff.ts:115-116` (`pushScalarChange` stores
`before`/`after` by reference for non-scalar values).

`before` is safe (it comes from the `structuredClone` snapshot taken at
the day boundary), but `after` references objects inside the final state
that `simulateDay` returns to the caller. A caller that mutates
`result.state` after the fact would silently rewrite the diff's `after`
values. The web store currently treats results as immutable, so this is
a hazard, not an active bug.

---

## 5. Probed and verified clean

For completeness — areas a future audit can skip, all verified on this
commit:

- **Determinism:** two 14-day `runCardlessSim` runs with the same seed
  produce byte-identical final state (JSON-compared).
- **Save/reload replay:** 7 days → JSON round-trip → 7 more days is
  byte-identical to a continuous 14-day run. Mid-run persistence is
  sound.
- **Banned APIs:** zero `Math.random` / `Date.now` / `new Date` /
  `performance.now` calls in `src/sim`, `src/cards`, `src/reports`
  (only doc comments mention them).
- **Identity RNG streams:** name/roster generation consistently uses
  named streams (`ctx.getRngStream`), with registration order explicitly
  sorted before identity rolls (`src/sim/state/defaults.ts:372-374` et
  al.).
- **Ledger math:** wage accumulation/reset, rent arrears, restock
  costs, sign conventions, and `clampPercent`-style clamp ordering in
  the economy modules were checked for double-counting and sign errors —
  none found.
- **Suite health:** `npm run typecheck` clean; fast tier (`npm test`)
  266 files / 3460 tests, all passing (~4.5 min).
