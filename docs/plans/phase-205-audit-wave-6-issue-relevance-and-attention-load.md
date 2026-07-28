# Phase 205 — Audit Wave 6: issue relevance and attention load

Plan for Wave 6 of the 2026-07-26 gameplay-audit remediation arc
(ISSUE-166). Queue: `docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`.
Findings: `P5-PLAY-005` (P5 §6), `P7-EXP-005` (P7 §7).

Wave gate (Phase 8 §7):

- no off-menu unused item claims recent demand;
- long-run card and rendered-choice ceilings meet an **approved** design
  target;
- recurring issues preserve state and escalation without appearing as
  context-free fresh incidents;
- urgent Service incidents remain reachable.

## 1. Measured starting point (post-Wave-5 build)

`npx tsx docs/audits/2026-07-26-gameplay-audit/fixtures/phase7-whole-experience-probes.ts pacingAndCoachingProbe`
on the 28-day passive Standard route:

| Metric | Audit (pre-Wave-0) | This build |
|---|---:|---:|
| Exposed cards / day (avg) | 5.61 | 4.93 |
| Exposed cards / day (max) | 7 | 7 |
| Rendered choices / day (avg) | 31.82 | 27.64 |
| Rendered choices / day (max) | — | 35 |
| Rendered choices, 28 days | 891 | 774 |

Longest consecutive-day family streaks: `area_atmosphere` 27,
`customer_complaint` 27, `staff_identity` 25, `stock_shortage` 25.
`policy_backlash` no longer reaches 20 (Wave 1/2 changed its cause
emission), but the four families above still run essentially every day.

So the finding reproduces on the current build: the per-generation seed
cap bounds one ranked pass, not the day, and recency rotates the entity
inside a family without ever cooling the family down.

## 2. DC-06 — approved targets (decision taken by the user, 2026-07-28)

Phase 8 §9 `DC-06` asks for a measurable target. Approved:

| Dimension | Target |
|---|---|
| Cards per full day (Morning ∪ Service) | **5**, hard |
| Rendered choice buttons per full day | **24**, hard |
| Family recurrence | **2 consecutive days, then one rest day**, unless the issue materially worsened or is urgent |
| Urgent Service incidents | admitted even at a full ceiling — they **displace** the weakest non-urgent card from the visible hand rather than being dropped |
| Persistent threads | rendered as a **continuing thread**: a continuity line naming days standing and the prior decision, plus a **trimmed choice set** |
| Periodic / teleology reserve | preserved — the Morning pass keeps a reserve slot for teleology and for triage, and one card slot of the ceiling is held back for Service |

Two consequences of the "hard ceiling" wording worth stating exactly,
because the regression tests assert them separately:

- the **visible hand** is bounded by 5 at every pause, always;
- the **day's exposure ledger** (what the player was shown across the
  whole day) is bounded by 5 too, *except* when an urgent Service
  incident displaces an already-exposed card — displacement cannot
  un-show a card, so the ledger can reach 6, and every entry past 5 is
  urgent by construction.

## 3. `P5-PLAY-005` — shortage cards invent demand

Confirmed source cause (audit): `generateStockShortage()` takes every
stock item at `quantity <= 30`, scores by `30 - quantity` — which makes
every never-stocked rare ingredient (`quantity: 0` from the registry
defaults) score the maximum, ahead of a real depleted staple — and then
unconditionally writes `<item> sales heavy this week` and
`<item> may run out`.

Fix, at the source rather than in the copy:

1. **Demand gate.** A candidate needs a real use signal, in this
   priority order: a shortage recorded against it in today's service
   (`modules.stock.shortages`), a recipe consuming it served within the
   last 7 days (`recipes[].lastServedDay` / `daysSinceLastServed`), or a
   recipe consuming it currently `onMenu`. An item with none of the
   three is not a candidate at all — that is the whole of "no off-menu
   unused item claims recent demand". Upkeep items (firewood, mugs, raw
   ingredients) qualify through consumption and today's shortage
   records, not through the menu, so they are unaffected.
2. **Already out ≠ running low.** `quantity <= 0` gets its own stake
   wording, problem noun and an `already_out` tone hint, so the card can
   say the shelf is empty instead of warning it may empty.
3. **Recent context is derived, not asserted.** The `recentContext`
   ingredient is built from the signal that qualified the item, so the
   card's "why now" line is the reason the sim admitted it.
4. **Time-relative title conditions verify their own claim.** The
   `stock_shortage` title snippet `last week was already stretched`
   gains `minAgeDays: 7` (a memory that old guarantees a prior week
   exists) and a new `sharesSeedTag` scope so the memory must be about
   *this* item — a watered-ale memory can no longer title a truffle
   card. `sharesSeedTag` is an optional field on the existing
   `memoryPresent` primitive (no new condition kind), matching the
   memory's tags against the seed's own tag set.

## 4. `P7-EXP-005` — attention load and repetition

Four mechanisms, all sim-side so replay stays deterministic.

### 4.1 Full-day attention ledger (`handBudget.ts`)

`applyHandBudget` bounded one ranked pass. `selectVisibleHand` now selects
against the day's **exposure ledger**:

- a seed already exposed today costs nothing more to keep visible — its
  card slot and choice buttons are already spent — so exposed seeds are
  carried first and stop being displaced by later passes;
- new seeds are admitted in reserve-then-rank order while **both** budgets
  hold: `ledgerCards < cardBudget` and
  `ledgerChoices + cost(seed) <= choiceBudget`;
- the Morning pass holds back one card slot **and one card's worth of
  buttons** (`SERVICE_CHOICE_RESERVE`, 7) for Service. Reserving the slot
  alone proved useless: a Morning that had spent 20 of 24 buttons left a
  five-option brawl a slot it could not afford;
- an urgent seed that does not fit is admitted anyway, displacing the
  lowest-ranked non-urgent member of the visible hand (which stays
  resolvable through `surfacedToday`, as displaced seeds already did).
  Displacement reclaims budget only when the victim has not yet been
  exposed — a card the player already read cannot un-spend its buttons.

Reserves and budgets resolve in **one** admission pass. Selecting winners
by card count first and testing affordability second let an unaffordable
high-ranked seed occupy the day's last slot and block a cheaper one behind
it — measurably: a five-button brawl was withheld because an eight-button
complaint had claimed the slot and then failed to pay for it.

`cost(seed)` is the sim's upper bound on what the card layer will
render: `min(slots, 6)` (`+1` for the inaction carve-out past the cap)
plus one for the renderer's generic Ignore when no slot carries the
`ignore` verb. The per-card cap constant moves into the sim and
`cards/cardHelpers.ts` re-exports it, so `DEFAULT_LEGIBLE_CHOICE_CAP`
and the budget cannot drift apart.

### 4.2 Family cooldown (`issueThreads.ts`)

A per-family streak ledger records the last day the family surfaced, the
consecutive-day count and the severity it last carried. A candidate is
withheld (with a reason in `rejectedToday`) when its family surfaced
yesterday, has already run `FAMILY_STREAK_LIMIT` (2) consecutive days and
has not materially worsened. Cooldown is keyed on **family**, not
family+entity, because entity rotation is exactly how the 27-day streaks
stayed invisible.

"Materially worsened" = severity crossed a quarter band (25 / 50 / 75)
or rose by at least 8.

**Urgency is not an exemption**, which is not what this plan first
assumed. `customer_complaint` is a `during_service` family that sat at
urgency 80 for nineteen consecutive days on the measured route while
rotating its customer group (ogres → merchants → local goblins → miners →
adventurers), so exempting urgency — or exempting a "new" thread — hands
the streak straight back. Reachability for urgent incidents is enforced
where starvation actually happens, at the ceiling, by displacement.

**One exemption is keyed on the thread:** an issue the player ANSWERED
last time it appeared (`lastAnsweredDay >= lastSurfacedDay`) is not
rested. A venture being invested in on consecutive days is engagement, not
noise, and resting it strands a loop the player is deliberately running.
This cannot reopen the streaks — it requires a recorded decision on that
same thread, and the audit's route answered nothing at all.

### 4.3 Continuity threads

Threads are keyed `family:entity` (the location, else the primary actor,
else `global`) and hold: first/last surfaced day, times surfaced,
consecutive days, last and peak severity, the slot ids already tried,
and the label of the last decision the player made on the thread (folded
in from `responses.resolvedToday` by a new `endDay` hook — `responses`
cannot be a dependency of `issueSeeds`, but `applyResponses` runs before
`endDay`, so the records are there to read).

A seed whose thread has surfaced before within the last 4 days carries
`seed.continuity`. Two effects:

- **Presentation.** `factProjection` emits one high-salience continuity
  fact, so the card's History section states the thread's age and either
  the prior decision or that it went unanswered — the Wave 3 `DC-02`
  distinction is preserved (a deliberate Ignore reads differently from
  no answer).
- **Trimming.** A thread on at least its second appearance that has not
  escalated is trimmed to `CONTINUATION_CHOICE_CAP` (3) slots: the
  inaction slot plus the best-utility slots the player has not already
  tried on this thread (`profileUtility`, the Wave 2 signed-utility
  helper). Trimming edits `responseSlots` — the offer set is simulation
  truth, and an option that is not offered must not be applicable —
  while every `consequenceProfile` stays on the seed.

Threads older than 28 days are pruned so the ledger cannot grow without
bound (the arc's standing quota warning).

### 4.4 Urgency

`isUrgentSeed` = `urgency >= 70`. Urgent seeds are never trimmed and are
admitted at a full ceiling by displacement. That, plus the Service card +
choice reserve, is the gate's "urgent Service incidents remain reachable".

### 4.5 Generation vs. presentation

A budget that withholds seeds breaks anything that reached for a family's
seed through the visible hand — nine test files did, and so did the two
card-choice scripts. They were asking a generation-level question (what
shape does this family's generator produce?) through a presentation-level
query. `getGeneratedSeedsToday` answers the first: the hand, plus anything
displaced from it, plus a new day-scoped `withheldToday`. Product code
keeps `getAllSeedsToday` (the visible hand) and `getResolvableSeedsToday`
(what a response may bind to) untouched.

Cost of the two new day-scoped fields at day 28: 19 KB of withheld seeds
and 6 KB of attention ledger against a 1 591 KB state. The thread ledger
prunes at 28 days.

## 5. Regression coverage (Phase 8 §8)

- `tests/sim/phase205.wave6.issueRelevance.test.ts` — the mixed stock
  state the finding asks for (on-menu consumed item at low stock,
  off-menu never-served rare item at zero, deception memory for a
  different item, Week 1 and Week 2 positions); already-out vs
  running-low wording; the demand-derived recent context; family
  cooldown, continuity, trimming and urgent bypass as unit-level
  behaviour on the real pipeline.
- `tests/cards/phase205.wave6.attentionLoad.test.ts` — a 28-day passive
  run asserting the approved ceilings against **rendered** cards and
  choices (`pickCard`, plus the renderer's generic-Ignore rule), that the
  sim's cost estimate is never below what the card layer renders, that
  periodic/teleology content still reaches the hand, and that the
  week-1 title no longer claims last week.

## 6. Result against the gate

The audit's own probe, re-run on the fixed build:

| Metric | Audit | Pre-Wave-6 | Now |
|---|---:|---:|---:|
| Cards / day (avg · max) | 5.61 · 7 | 4.93 · 7 | 3.46 · 5 |
| Rendered choices / day (avg · max) | 31.82 · — | 27.64 · 35 | 15.68 · 24 |
| Rendered choices, 28 days | 891 | 774 | 439 |
| Longest family streaks | 27 / 27 / 25 / 20 | 27 / 27 / 25 / 25 | 3 / 2 / 3 / 2 |

Weekly boundaries still land on 7/14/21/28 and the monthly on 28;
`violence`, `debt_rent`, `opening` and `staff_arc` still reach the hand.

**Left for a decision, not taken here:** the shortage card still offers
"Stretch what is left" (`water_down`, +20 quantity) on an item at zero.
It is the same surface-truth class as `P5-PLAY-005`, but no finding covers
it and suppressing the slot is a mechanical change.
