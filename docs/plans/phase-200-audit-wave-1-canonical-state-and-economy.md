# Phase 200 — Gameplay audit, Wave 1: canonical state and economy

Wave doc for `ISSUE-166` / Wave 1 of
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`. Depends on
Wave 0 (phase 199), which is closed.

**Findings:** `P7-EXP-001` (High/P1), `P7-EXP-002` (High/P1),
`P4-SEAM-003` (High/P1), `P7-EXP-004` (Med/P1), `P4-SEAM-001` (Med/P2).

**Gate (Phase 8 §7):** `coin >= 0` throughout every supported route; rent
payment applies once and updates rent state; all purchasable ordinary
stock obeys the intended minimum price; compact pressure equals rich
pressure at every stable beat; one significant pressure change creates one
canonical cause; eight shared-seed 28-day strategies validate throughout.

---

## 1. Decisions taken (user, 2026-07-27)

The audit flags three of these as decisions, not defects. Recorded here
and in the queue.

**DC-07 — response-portfolio resource policy: gate at selection, re-check
atomically.** A choice is disabled with a readable reason when its coin
cost exceeds what is left after the choices already committed today; the
whole portfolio is re-validated when the day resolves, and anything that
no longer fits is skipped whole, never partially applied. `coin >= 0` is
preserved as a hard invariant — no modelled debt.

**`P7-EXP-002` — price floor: a minimum of 1 coin per unit.** `priceBias`
stays additive and keeps its current tuning; the effective unit price is
clamped so zero is structurally unreachable. Chosen over percentage bias
because it does not re-tune every supplier's real price, and Wave 1 must
not move the economy under Wave 7's balance evaluation.

**`P4-SEAM-003` — direct response pressure effects persist.** A response
that eases Maintenance by 10 keeps easing it: the delta is recorded as an
adjustment that the calculator's derived value is combined with, decaying
to nothing over `PRESSURE_ADJUSTMENT_DECAY_DAYS`. The alternative — the
calculator supersedes it and the pressure rebounds next morning — would
make the card's own preview untrue by the following day, which the Core
Design Rule forbids.

## 2. One pressure authority (`P4-SEAM-003`, `P7-EXP-004`, `P4-SEAM-001`)

These three are one defect wearing three hats: nothing owns the pressure
value, so the compact store, the rich snapshot and the report can all
disagree, and the one change that does get logged gets logged twice.

Today `calculatePressures` runs once, at `closing`:

- it reads `previousValue` from the **rich snapshot** and writes the
  **compact** value only when `|delta| >= 2`, so a sub-threshold move
  leaves the two stores permanently apart;
- a delayed response that fired at `startDay` moved compact but not the
  snapshot, so the calculator measures its delta against a stale
  `previousValue`, computes 0, declines to write compact, and leaves
  compact at 2 while the snapshot says 12 (the audit's exact repro);
- `closing` is before `applyResponses`, so the report and the next
  morning read a pre-response snapshot;
- and the significant-change branch calls `ctx.modifyPressure(id, delta,
  causeDraft)` — which the engine already logs — *and* `ctx.addCause(the
  same draft)`, on a stale comment claiming the engine does not log.

The contract this wave establishes:

> **`state.pressures[id].value` is the canonical pressure value.** The
> module's rich snapshot is a record of how it got there and always
> carries the same number. Every stable beat, `compact.value ===
> snapshot.value`.

Implementation:

1. **The value.** `value = clamp(calculator result + active adjustments)`.
   Adjustments live in the module slice, are appended whenever a response
   applies a direct pressure effect (`ctxApplier`, which is the single
   path for both immediate and drained-pending effects), and decay
   linearly to zero over five days.
2. **Two passes, one owner.** The `closing` pass computes values and syncs
   compact, so closing-time seed generation still reads today's pressure —
   but emits no cause and no history. A second pass on `endDay` (which
   runs immediately after `applyResponses`) recomputes against
   post-response state, syncs compact again, and is the *only* place that
   emits the day's pressure causes and history entries. That is
   `P7-EXP-004` fixed — the report, the ribbon and the next morning all
   read the same post-response truth — and `P4-SEAM-001` fixed by
   construction: one pass, one cause.
3. **Day-over-day honesty.** `previousValue` comes from `openingValues`,
   written at the end of each day's `endDay` pass, so it is yesterday's
   final value and is not disturbed by the closing pass or by a delayed
   effect draining at `startDay`. A delayed −10 therefore reports as
   12 → 2, which is what the player saw.
4. **One cause, right amount.** The cause is emitted once via
   `ctx.addCause` with the day-over-day amount; compact is synced with
   `ctx.modifyPressure(id, syncDelta)` passing **no** cause metadata, so
   the engine does not log a second one. (The audit suggested the mirror
   fix — drop `addCause`, keep the engine's. Either gives one cause; this
   one keeps the amount equal to the day's actual movement and the target
   stable at `pressure:{id}`, which the drilldowns key on.)

## 3. Rent (`P7-EXP-001`)

The `pay_profile` on the debt/rent seed spends `rent.monthlyAmount` and
stops there: it never marks `paidThisMonth`, never clears arrears, and is
offered again the next day, and the next. Meanwhile nothing checks whether
the coin exists — the audit's route paid 120 five times from a 98-coin
till and finished at −473 with the state schema failing on `coin`.

1. **One rent transition.** `monthly/rent.ts` grows `payRentInFull`, the
   affordability check plus the whole `paidThisMonth`/arrears/memory/
   history/cause transition that the monthly resolver already had
   correct. `resolveRent` now calls it, and so does the card.
2. **The card routes through it.** A new effect target,
   `monthly.rent.payment`, dispatches to that transition in both appliers
   (engine and clone). The `pay` profile's coin effect becomes this
   target, so paying from the card and paying at month end are the same
   transition and cannot drift.
3. **Atomic affordability.** `applyResponsesHook` prices each intent's
   immediate coin cost up front (`responseCost.ts`) and applies intents in
   order; an intent whose cost exceeds the coin actually on hand at its
   turn is skipped **whole** — never partially applied — logged, and
   recorded on the resolved-intent record as `skipped_unaffordable` so the
   report can say so.
4. **A floor under the ledger.** `spendCoin` throws when the spend would
   take coin below zero. Every ordinary spend path is now required to
   check first; the throw is the backstop that keeps a future path from
   quietly reintroducing the same defect.
5. **Gated at selection.** The web card layer disables a choice whose coin
   cost exceeds coin minus the cost of the choices already committed
   today, with a readable reason. Preview and application share one cost
   function, so the number the player is shown is the number that is
   checked.

## 4. Supplier pricing (`P7-EXP-002`)

`getEffectiveBasePrice` is `basePrice + priceBias`, then market and
relationship multipliers. Mushrooms and Ingredients have base price 1
against a −1 bias, Stew has 2 against −2, so all three reach 0 and
`pickRestockSupplier` prefers exactly those suppliers because it sorts by
cheapest. Six restocks in one day delivered 240 units for nothing.

The floor moves into `getEffectiveBasePrice` itself rather than its
callers, so the quote, the application, the report and the supplier screen
cannot disagree about it. `MIN_UNIT_PRICE = 1`.

## 5. Evidence

`tests/sim/phase200.wave1.canonicalStateAndEconomy.test.ts`, plus the
existing `fixtures/phase7-whole-experience-probes.ts` strategy matrix for
the eight-strategy half of the gate:

- rent at 119 / 120 / 121 coin against 120 due; one rent response alone;
  several individually affordable choices whose aggregate is not; repeated
  days after a successful payment; the Day 28 monthly boundary; and that
  a paid month is not offered again;
- every stock × supplier × market-condition combination quotes a unit
  price `>= 1`, and quote, application and report agree;
- `compact.value === snapshot.value` for every pressure at every stable
  beat across segments A/B/C, for immediate, delayed, ambient and
  monthly-arc mutations;
- a delayed −10 reports as 12 → 2 and does not rebound the next morning;
- one significant pressure change yields exactly one cause and one
  drilldown line;
- `coin >= 0` across eight shared-seed 28-day strategy runs, with the
  state schema valid on every day.
