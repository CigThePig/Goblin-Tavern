# Goblin Tavern — Day-Clock & Time Economy Contract

## Document Purpose

This document defines the conversion of the day from a *narrated* sequence
of beats into a *mechanically real* sequence of segments, and the
conversion of the action-point budget into a time budget. It bears the
same shape as `phase-01-simulation-contract.md` and `game-loop-and-ux.md`
so it slots into the existing series.

It exists because of a single structural problem, stated here so no future
session loses it:

> **Today the day is presented as time passing, but mechanically it is one
> simultaneous turn.** Every card response and every owner action is only
> *queued*; nothing resolves until `runDay` bundles all of it into one
> `simulateDay` call. The beats (`morning → plan → service → closing →
> report`) are a fiction of time laid over a mechanic where no time passes
> until the end. Cards are trapped in the gap between those two truths —
> which is why their placement has never felt right and why the wrongness
> resists local description.

The fix is to **expose the day-clock the engine already has** rather than
build a second one. `SIMULATION_PHASES` already runs the day as an ordered
sequence, and it already separates the player's two inputs in time:
`applyOwnerActions` runs *before* service, `applyResponses` runs *after*
service. The UI currently flattens that separation. This contract un-flattens it.

The design sentence:

> **Make the mechanic match the fiction: run the day in real segments, let
> the player act with knowledge that genuinely accrues as the day unfolds,
> and let time be the currency they spend.**

This phase covers two coupled changes: (1) running the day as real,
ordered segments with two player pause points, and (2) converting the
daily action-point budget into a daily time budget. The time budget is a
quantity drawn down as the player spends it — identical in shape to the
current action-point budget, only denominated in minutes instead of
points.

**Explicitly out of scope for this phase:** turning the day into a genuine
timeline — events arriving at specific clock times, service resolving
*over* time rather than in one step, or an action and an event competing
for the same moment. That is a much larger change (it would require
rewriting how `service` resolves and how the day's RNG threads through
sub-day ticks) and is deliberately deferred. The model defined here keeps
the day as a sequence of discrete segments; it does **not** introduce a
continuous timeline. See §6 for what is left undecided and why.

---

# 1. Grounded findings from the codebase

Everything in this section was read from the current code, and is recorded
here so build sessions do not re-derive it. Each finding cites where in the
repo it can be confirmed.

## 1.1 The engine has no time — only causal ordering

`SIMULATION_PHASES` is a *dependency sort*, not a *timeline*. `closing`
does not occur "late in the day"; it occurs "after `service` in the
order." Service resolves in a single `resolveService` shot from a forecast
turnout number — nobody arrives over time, nothing has duration. This is
why the out-of-scope timeline approach (§6) would be a rewrite while the
segmented model defined here is not: the segmented model never introduces a
timeline, so it never fights this fact.

## 1.2 The runtime is transient; only `TavernState` crosses a pause

`simulateDay` constructs `EngineRuntime` fresh per call — cloned state,
reports, logs, `ChangeTracker`, cause counter — and none of it persists.
A mid-day pause therefore cannot "save the engine"; it can only save
`TavernState`. This is the single most important architectural constraint
in the whole plan, and it is *favourable*: state is already plain JSON and
already persisted across refreshes (Phase 96).

## 1.3 RNG is fully resumable and per-day sub-seeding is already the idiom

`RngState` is `{ seed, calls }`; `createRng(seed, calls)` fast-forwards via
`prando.skip(calls)`. The codebase already re-seeds per day and threads
named identity streams so a service roll cannot shift a generated name.
**Per-segment sub-seeds are a natural extension of the mechanism already in
use.** Segmentation needs *zero* RNG serialization — only `TavernState`
crosses the pause.

## 1.4 Seeds are currently pre-baked the night before — this is the root

`issueSeedModule` generates **all** of tomorrow's seeds (morning,
during-service, and closing alike) during `generateReports` — the
second-to-last phase of the day — and writes them to `seedsToday`. The
next day merely *displays* that frozen set, sorted into beat-slots by each
seed's `timing` tag. The `startDay` hook deliberately does **not** clear
`seedsToday`, so a response intent can still resolve against a seed
generated yesterday.

So a `during_service` card was not produced by service. It was produced
last night and *labelled* `during_service`. **Making seed generation
segment-local is the single change that converts the fiction into the
mechanic.**

## 1.5 `rankSeeds` is a pure sort with no cap and no cross-timing competition

`rankSeeds` sorts by `cardWorthiness → severity → urgency` and nothing
else. `seedsToday` is uncapped; every reader iterates the full array; the
web filters by timing at display via `seedsForTiming(timing)`. **Timings
do not compete for a global slot budget**, so splitting generation by
timing loses nothing.

## 1.6 The AP budget is already additive arithmetic

The budget gate is a single point: `ownerActionsModule.ts`, `if
(actionPointsUsed + def.actionPointCost > budget)`, with `budget =
DEFAULT_ACTION_POINT_BUDGET = 3` and an accumulator `actionPointsUsed +=
result.actionPointCost`. Every action's `actionPointCost` is a flat
literal `1` — so "3 action points" means "pick 3," but the *code* already
sums costs against a ceiling. **AP→time changes constants, not structure.**

## 1.7 No effect scales by AP cost; `amount` drives coin but never AP

A grep for effects scaling by cost came back empty: the engine reads
`actionPointCost` *only* for the budget gate. Recalibrating costs to
minute-values rebalances nothing downstream. Separately, `amount` (e.g.
restock quantity) drives **coin** cost (`Math.ceil(amount * unitPrice)`)
but never `actionPointCost`. There are already two parallel cost axes; time
replaces the flat AP axis and coin is untouched.

## 1.8 During-service generators read only early-day state

All three `during_service` generators (`generateRegularCustomer`,
`generateFactionRequest`, `generateCultureConflict`) guard on the same
families: a pressure snapshot (`pressureSnapshotById` → reads the *stored*
snapshot written at the **previous** day's `closing`), a `world.*`
collection, `calendar`, memories, and causes. **None reads `service`,
`closing`, `economy`, `stock`, or turnout** — nothing that settles late in
the day. Pressures are recomputed at `closing` (`closing:
[calculatePressuresHook]`), *after* service. Under seed-split, service-segment
generation runs before this day's `closing`, so it reads the same
prior-closing snapshot the old model read. **Seed-split does not change
which pressure value any during-service guard sees**, provided
service-segment generation runs before this day's `calculatePressuresHook`
(structurally guaranteed: service precedes closing).

## 1.9 One resolution path serves every card, regardless of timing

`responsesModule` on `applyResponses` matches *any* `responseIntent`
against `seedsToday` by slot id; it is timing-agnostic. Morning cards,
service cards, and periodic choice-seeds all resolve through the identical
path. Re-homing a card from one beat to another needs **no new resolution
plumbing** — only a change to which beat renders it.

## 1.10 Periodic seeds can carry real player choices

Periodic seeds are not merely informational digests; some carry genuine
player decisions. The `end_month` `debt_rent` seed carries real choices —
`makeProfile` entries with `responseSlotId`s (`delay`, `raise_prices`),
`immediateEffects`/`delayedEffects`, and real `stakes` (rent missed,
landlord eviction). `end_week`/`end_month` are first-class members of the
timing union. The web currently concatenates `closing + end_week +
end_month` into one closing deck (`DayScreen.svelte:79–82`). Because a
periodic seed can be a decision rather than a summary, where it surfaces is
a design ruling rather than a free choice — recorded in §3.5.

---

# 2. The day as the engine actually runs it

The two pause points, located against the real phase order. Phases that
carry meaningful work are annotated; the rest are setup/wrap mechanics.

```txt
SEGMENT A — Setup → the morning the player sees
  startDay · identityGeneration · cultureUpdate · supplierUpdate
  · factionUpdate · regularCustomerUpdate · localEventUpdate
  · rumourUpdate · forecastTraffic
  → world advances; today's traffic is forecast.

⏸ PAUSE 1 — MORNING PLAN  (sits at the beforeOwnerActions seam)
  Player commits owner actions (spends time) + staff priorities.

SEGMENT B — Proactive moves → the day happening
  applyOwnerActions (player's time spend) · afterOwnerActions
  · assignStaffPriorities · beforeService · service · afterService
  · closing  ← pressures + feedback computed here, AFTER service
  → the day plays out; outcomes settle.

⏸ PAUSE 2 — SERVICE REACT  (sits at applyResponses)
  Player answers the emergent cards produced by Segment B's service.

SEGMENT C — Wrap-up (no decisions; pure aftermath)
  endDay · endWeek · endMonth · generateReports · validate
  · advanceCalendar
  → rollups, seed generation for tomorrow, validation, clock tick.
```

Two pauses, mapped 1:1 onto the engine's two input phases. This is the
clean, engine-aligned foundation. Additional mid-service pauses are a
later, more-alive option and are out of scope here.

---

# 3. Locked design rulings

These are decided. Build sessions implement them; they do not reopen them.

## 3.1 Foreseeability — morning shows standing conditions, hides emergent events

The morning (Segment A output) shows *standing conditions* truthfully — a
stressed staffer, a shaky supplier, an unpaid debt: things the pre-service
phases already know. **Emergent events stay hidden until service runs.**
This gives real planning without killing surprise, and it is what makes the
foreseeable/emergent distinction meaningful rather than cosmetic.

## 3.2 Two pause points — morning-plan and service-react

Exactly two, for this contract. They map to `applyOwnerActions` and
`applyResponses`. No mid-service interrupt pause.

## 3.3 Reactivity is card responses only — no second time budget at Pause 2

Pause 2 reactivity flows entirely through `applyResponses` card responses.
**No reactive time/AP economy is added.** The morning time budget is the
only budget. (If service later feels too passive, a reactive budget is a
future option — but adding it before the two-pause loop is *felt* is
exactly the premature complexity that sinks attempts.)

## 3.4 Pressures + feedback are the day-bridge, not a pause

Pressures and feedback compute at `closing` (Segment B, *before* Pause 2's
`applyResponses`) and are read by the *next* morning. They are analysis,
not decisions. They belong to neither pause; they are the bridge between
days. This is the same standing-conditions surface as §3.1.

> **Accepted consequence:** a reactive response at Pause 2 *cannot* move
> *today's* pressure reading (computed before `applyResponses`); it shows
> the next morning. This is correct and intended, not a bug to fix.

## 3.5 Periodic content splits: digests → report, choices → morning pause

- **Weekly/monthly summary digests** (the `projectDigest` report sections)
  are informational → they surface in the **report** (Segment C aftermath).
- **Choice-bearing periodic seeds** (e.g. `debt_rent`) are decisions → they
  surface at the **morning pause** of the day they fire, *not* in the
  closing deck (their current home) and *not* in the read-only report.
  Burying a "pay rent or risk eviction" choice in the aftermath would let
  the moment to act pass before the player sees it.

Implementation note: resolution already handles these (§1.9); only the
beat that *renders* them changes. The change is at the seed→beat routing
(`DayScreen.svelte:79–82` and `seedsForTiming` usage), not in the engine.

## 3.6 Forecast is shown as expectation, not fact

`forecastTraffic` runs just before Pause 1, so the morning *can* show it —
but the player's Pause-1 moves then change actual turnout. Show it framed
honestly as **"expected, before your moves,"** or hold it. It must not read
as a settled number.

## 3.7 Attribution is cross-cutting, not a beat

The attribution/accuracy layer threads across `afterService` / `endDay` /
`endWeek` / `startDay`. It is not a moment; it modulates *how confidently*
everything else is shown. It maps to no pause and no segment boundary. No
build session should try to pin it to one beat.

## 3.8 Time economy shape

- `DEFAULT_ACTION_POINT_BUDGET` (`3`) becomes a **day length in minutes**
  (working name `DAY_MINUTES`). Starting value is a calibration decision,
  not fixed here; it must be a single constant.
- Each action's `actionPointCost: 1` literal becomes a **minute cost**.
  Costs become expressive (a quiet word with a regular is cheap; re-flagging
  the cellar eats most of the day). Per-action values are a calibration
  pass, not fixed here.
- The budget gate stays structurally identical: `used + cost > budget`,
  with constants reinterpreted as minutes. No new gate logic.
- **Open design choice, deliberately deferred to the calibration pass:**
  whether time *also* scales with `amount` (e.g. "restock 10 barrels" costs
  more minutes than "restock 2"). The engine has *no* amount→AP coupling
  today (§1.7), so this is a free choice with no hidden breakage. If taken,
  the budget gate must compute cost dynamically from `amount` and the plan
  UI must show a cost that updates as the player sets the amount.

---

# 4. The work, clustered by dependency

The clusters below follow the actual coupling structure, not a fixed count.
Each is sized to run as its own Claude Code session. Order matters: later
clusters depend on earlier ones. Two **gates** must be satisfied as part of
their cluster, called out inline.

## 4.1 Cluster 1 — Seed lifecycle rewrite (highest risk; do with most care)

**Why first among the engine changes:** this is where carefully-tuned
existing timing gets *inverted*, and it is the change most likely to
produce silent, hard-to-debug behaviour (cards vanishing, duplicating, or
responses no-oping).

Scope:
- Flip the lifecycle: **clear `seedsToday` at Segment A entry**, then
  **generate morning seeds at `startDay`** and **during-service seeds inside
  the `service` segment**, retiring the end-of-day `generateReports` lump.
- Verify intent→seed matching tolerates **same-day multi-pass generation**:
  a Pause-2 response must still resolve against a seed generated earlier the
  same day across two separate passes (§1.9 makes this matching
  timing-agnostic, but the *timing of the clear* is the hazard).
- Preserve cooldown/novelty threading through `TavernState` (running
  morning-then-service generation in temporal order makes this *more*
  correct, not less — §1.4/§1.5).

**GATE A (verify, already largely confirmed):** each `during_service`
generator's guards must read only state available at the service moment.
§1.8 confirmed all three current generators read only prior-closing
pressure snapshots + `world.*` + calendar/memories/causes. The gate is: any
*new or modified* during-service generator must hold the same property, and
the service-segment generation must run before this day's
`calculatePressuresHook`.

## 4.2 Cluster 2 — Segmented engine entry + full-day diff thread

Scope:
- Add a segmented entry — working name `advanceDayPhase(state, input)` or
  three segment-scoped calls — that runs one segment and yields a
  serializable checkpoint (`TavernState` only; §1.2/§1.3).
- **Keep `simulateDay` as the run-all-segments path**, unchanged. The
  cardless test runner and every determinism test keep calling it. Assert
  the invariant: segmented run and `simulateDay` produce **identical final
  state** for the same inputs.
- Derive per-segment sub-seeds (`…:day-N:seg-{A,B,C}`) — no RNG
  serialization (§1.3).

**GATE B (must not be skipped — silent-failure risk):** `buildDailyReport`
and `missedOpportunityProjection` both depend on a **single full-day diff**
via `result.diffs.find(d => d.boundary === 'day')`. A naive per-segment run
would shatter this into a partial diff and the report would silently show a
fraction of the day's changes. **Thread the Segment-A baseline
`TavernState` through so the day-diff is computed start-of-day →
end-of-day.** The diff machinery already does two-state diffs; the store
already persists state, so holding the baseline is one field. (Phase 76
already removed the sub-day diff boundaries because nothing consumed them —
so this restores one correct full-day bracket rather than fighting a
consumer.)

## 4.3 Cluster 3 — AP → time recalibration

Scope:
- Rename/retune `DEFAULT_ACTION_POINT_BUDGET` → `DAY_MINUTES`; convert each
  `actionPointCost` literal to a minute cost (§3.8).
- Gate stays additive; only constants change (§1.6).
- Resolve the amount→time design choice from §3.8 (or explicitly defer it,
  documented).
- Update every AP-facing display string (the budget is now time, shown as
  time).

No downstream effect rebalancing is required (§1.7).

## 4.4 Cluster 4 — Periodic-choice re-homing

Scope:
- Re-point choice-bearing periodic seeds (`end_week`/`end_month` with
  response slots, e.g. `debt_rent`) from the closing deck to the **morning
  pause** of the firing day (§3.5).
- Route informational weekly/monthly digests to the **report** (§3.5).
- Touchpoint: `DayScreen.svelte:79–82` and `seedsForTiming` usage. No engine
  change; resolution is already timing-agnostic (§1.9).

## 4.5 Cluster 5 — Store / UI flow integration

Scope:
- Turn the single `runDay` into the three segment calls behind the existing
  beat structure, so the beats now *bracket real segments* instead of
  narrating a parallel timeline.
- Morning beat shows real Segment-A outcomes + foreseeable standing
  conditions (§3.1) + any periodic choice-seed (§4.4) + forecast-as-expected
  (§3.6).
- Service beat: service runs (Segment B), emergent cards surface at the
  moment they are produced.
- One card surface, appearing when relevant — collapse the
  inconsistent-placement problem (`CardRenderer` vs `CardDeck` vs report) by
  making "where events live" singular and honest.
- Extend `DaySessionSnapshot` (`daySession.ts`) with a serializable
  **current-segment** field so mid-day resume Just Works (state *is* the
  checkpoint; §1.2).

## 4.6 Cluster 6 — Report-as-unfolding

Scope:
- Narrate what actually happened across the segments, now that the segments
  are real. The report stops being a flat end-of-day dump and becomes the
  day's story.

## 4.7 Cluster 7 — In-flight save migration (do not omit)

**Why it is easy to forget and expensive to skip:** the codebase prides
itself on refresh-resume; a player who updates *mid-day* resumes into an
engine that disagrees with their saved day. A save can carry (a)
`seedsToday` generated by the old end-of-day model, (b) a beat that no
longer maps to the new segments, and (c) AP-costed picks.

Scope:
- A migration that either finishes the in-flight day under old rules then
  hands off, or resets cleanly to the next morning. Cheap to build; only
  bites at the update boundary, which is exactly why it must be deliberate.

---

# 5. Risk ledger (carry into the build)

Recorded so each session knows what is dangerous and what is settled.

| Item | Status | Where handled |
| --- | --- | --- |
| Seed lifecycle inversion (clear/generate/resolve timing) | **Real risk — highest** | Cluster 1 + Gate A |
| `boundary === 'day'` diff shattering → silent partial report | **Real risk — silent** | Cluster 2 + Gate B |
| In-flight save migration across version boundary | **Real risk — boundary-only** | Cluster 7 |
| Contradiction guards at new generation moments | Verify (largely confirmed §1.8) | Gate A |
| Amount → time cost coupling | Design choice, no hidden breakage | Cluster 3 (§3.8) |
| RNG across a mid-day pause | **Cleared** — resumable; per-segment sub-seeds are the existing idiom | §1.3 |
| Effects secretly scaling by AP cost | **Cleared** — none; gate-only read | §1.7 |
| Feedback reasoning about unused AP | **Cleared** — no such logic | §1.7 |
| `rankSeeds` cross-timing competition lost by split | **Cleared** — pure sort, no cap | §1.5 |
| Week/month losing agency by moving to report | **Cleared via §3.5** — split ruling; choices → morning, digests → report | §1.10, §3.5 |
| Pressures/feedback day-bridge sequencing | **Cleared** — documented constraint, not a fix | §3.4 |
| Attribution pinned to a beat | **Cleared** — cross-cutting by design | §3.7 |

---

# 6. What this contract deliberately does not decide

So a future session knows these are *open*, not overlooked:

- The numeric value of `DAY_MINUTES` and each action's minute cost
  (calibration pass — playtest to tune, not engineer).
- Whether time scales with `amount` (§3.8).
- Whether a reactive time budget is ever added at Pause 2 (§3.3 — out for
  now; revisit only after the two-pause loop is felt).
- A continuous day timeline, in its entirety — events arriving at specific
  clock times, service resolving over time rather than in one
  `resolveService` step, and an action competing with an event for the same
  moment. Not designed here. If it is ever pursued, the first decision to
  evaluate is **turn-structured time** (the clock advances only when the
  player chooses their next move) versus **real-time** (service ticks
  autonomously while the player watches). Turn-structured is almost
  certainly correct for a mobile, text-forward, resume-anywhere game and is
  far cheaper to build: it needs no autonomous loop and keeps mid-day resume
  trivial because the clock only moves on player input. This is noted only
  so a future phase has a starting point; nothing here depends on it.
