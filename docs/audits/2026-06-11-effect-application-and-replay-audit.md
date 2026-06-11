# Codebase audit — 2026-06-11 (II): card effects that never land, a rent card that bricks the save, and a mid-day reload that changes the game

A third audit pass, run after the mid-day-save fixes merged in PR #218
(`c542f6b`). The two prior 2026-06-1x audits covered the persistence
quota family end-to-end; this pass deliberately hunted elsewhere —
**effect application, money conservation, replay/round-trip
determinism, the card truth contract, and long-run state health** — with
the same methodology: static review plus empirical `tsx` probes (replay
comparisons, 130–200-day runs, policy-bot active play, full-card-surface
enumeration). All probes lived in `/tmp`; nothing was added to the repo.

Baseline at HEAD (`4ba3fe2`): `npm run typecheck` clean; fast tier green
(266 files, 3,461 tests). Nothing below is caught by the suite — each
section notes the oracle gap.

Two findings are **critical and systemic** (§1, §2). Both sit in the
response/effect pipeline, which has never had an audit pass of its own:
previews, gates, and the choice audit all reason about effect
*metadata*, while nothing in the repo closes the loop to the *applied
state delta*. That blind spot is where both critical issues lived.

Known/fixed findings from `2026-06-10-recipe-consumption-audit.md`,
`2026-06-10-persistence-quota-audit.md`,
`2026-06-11-midday-save-and-report-reload-audit.md`, the committed
`card-choice-audit.md` baseline (re-run: byte-identical), ISSUE-144, and
the open ISSUE-141…148 content matrix were excluded. Everything below is
new, except §9 which materially escalates a tracked backlog item.

---

## 1. CRITICAL — Card coin costs apply unclamped; the rent card is offered exactly when the player is broke; one tap bricks the save

**Verified empirically on this commit.** Every other spending path in
the sim gates or clamps coin — owner actions check `canAfford`
(`src/sim/modules/ownerActions/quoteOwnerAction.ts:414`), service tabs
cap at current coin (`resolveService.ts:311-317` even carries a comment
about preserving "the strict non-negative-coin schema invariant"),
wages are all-or-nothing. The card-response path does not:

- `src/sim/modules/responses/ctxApplier.ts:147-160` routes a negative
  coin `state_change` straight into `spendCoin(ctx, -amount, …)`;
- `spendCoin` (`src/sim/modules/stock/ledger.ts:63-84`) never checks
  `ctx.state.coin`;
- `modifyCoin` (`src/sim/core/engine.ts:914-930`) adds the raw delta.

Meanwhile `debt_rent` **only generates when the player is broke or
pressured** — `generateDebtRent` bails unless `coin ≤ 50` or
debt/landlord pressure ≥ 30 (`issueSeedGenerators.ts:2550`) — and its
"Pay what we owe" slot charges the full rent,
`-(rent.monthlyAmount ?? 30)`, typically **−120**
(`issueSeedGenerators.ts:2608`). Neither the sim nor the web UI gates
card choices on affordability. So the unaffordable choice is guaranteed
to be offered precisely when it cannot be afforded.

### The kill chain, reproduced

```
coin 30, debt_rent 'pay' (-120)  →  coin after day: -8
coin 2,  debt_rent 'pay' (-120)  →  coin after day: -118
result.validation.errors: [{"path":"coin","code":"too_small"}]   (every subsequent day; never self-heals)
JSON round-trip → safeValidateState (the loader pipeline): success = false
```

`TavernStateSchema` declares `coin: z.number().int().min(0)`
(`src/sim/state/schemas.ts:729`), and the web load path
(`web/src/lib/sim/persistence.ts:505-512`, surfaced via
`web/src/App.svelte`) treats a failed parse as an unreadable save:
**"We couldn't read your last save. Start over to play."** The autosave
happily persists the negative-coin state; the next refresh loses the
campaign.

### Why no test caught it

The pure-resolver path used by tests and preview drivers,
`cloneApplier.ts:93-106`, **does** clamp coin at 0 and ledgers only the
applied delta. The engine path (`ctxApplier`) and the pure path disagree
in exactly the case that matters, so every harness that exercises card
resolution through the clone applier sees healthy behaviour.

### Fix direction

Mirror `cloneApplier`'s `Math.max(0, before + amount)` +
ledger-the-applied-delta semantics in `ctxApplier` (or clamp inside
`modifyCoin` with a cause entry), **and** gate unaffordable slots at
seed/selection time so the player isn't offered a payment they cannot
make. Add a regression test that resolves a costed card slot at
`coin < cost` through the *engine* path and asserts schema validity.

---

## 2. CRITICAL — A large class of previewed card effects silently never applies (faction, culture, supplier, regular, and `global.*` targets)

**Verified empirically on this commit.** The `state_change` dispatch in
**both** appliers — `applyEffectViaCtx`
(`src/sim/modules/responses/ctxApplier.ts:135-307`) and the clone
applier (`cloneApplier.ts:100-202`) — supports exactly six target
prefixes: `coin`, `areas.`, `stock.`, `staff.`, `customers.`,
`reputation.`. Anything else falls through to
`{ applied: false, notes: ['unsupported target …'] }`
(`ctxApplier.ts:307`).

But the seed generators emit `state_change` effects far outside that
set — 30+ sites in `expandedSeedGenerators.ts` alone:

- `factions.<id>.relationship/trust/fear/influence` (11 sites, e.g.
  `expandedSeedGenerators.ts:2288-2424`);
- `cultures.<id>.tension/comfort/familiarity` (10 sites);
- `world.suppliers.<id>.relationship/reliability` (4 sites, e.g.
  `:1641-1689`);
- `world.regulars.<id>.loyalty` (`:1174`; also regular-loyalty effects
  in `issueSeedGenerators.ts`);
- `global.service_capacity` / `global.owner_time` /
  `global.service_quality` (5 sites, e.g. `:389,587,713,788`).

`SimContext` *has* the mutators these need — `modifyFaction`,
`modifyCulture`, `modifySupplier`, `modifyRegular`
(`src/sim/core/context.ts:219-222`) — the appliers simply never route
to them.

### Measured blast radius

A probe driving `resolveResponseIntent` over every unique
(family, type, slot) from a 40-day run produced 9 immediate
`unsupported target` no-ops; a 120-day walk over all 1,089 collected
seeds' consequence profiles found **46 unique (family, slot, target)
no-op combinations**. Concretely:

- **`faction_request` — all six slots.** Every
  `factions.town_watch.relationship ±15/−25/+18/+10/+5/−20` (and
  trust/fear/influence) movement no-ops. The family's entire
  relationship mechanic is decorative.
- **`culture_conflict`** — `mediate_groups`, `honour_custom`,
  `offer_discount`, `ask_staff_to_intervene`: every culture
  tension/comfort/familiarity movement no-ops. The committed choice
  audit shows the preview "Local Goblins Familiarity +15 … Coin −10" —
  the player **pays the coin (which applies) and receives nothing**.
- **`supplier_relationship`** — `negotiate_supplier`-style
  relationship/reliability movements no-op.
- **`customer_complaint`** — `comp_table`/`discount`/
  `side_with_regular`: `world.regulars.<id>.loyalty +6/+10/+12` no-op;
  "loyalty would warm a step with the regular" is false.
- **`area_atmosphere close_area_temporarily`, `staff_identity`** — the
  `global.service_capacity`/`global.owner_time` **costs** no-op, so
  those choices are secretly cost-free, inverting the previewed
  trade-off.

### 2b. Drained delayed effects are recorded "applied" even when they no-op

`applyPendingEntry` (`src/sim/modules/responses/responsesModule.ts`,
drain loop at `:138-156`) calls `applyEffectViaCtx` and **discards the
`EffectResult`**; `recordPendingApplied` then increments `totalApplied`
unconditionally. A delayed `factions.*` effect fails silently *and* is
counted as applied in the module's own bookkeeping and report ("Pending
applied today: N"). No log, no cause entry — a causality-rule violation
(Architectural Rule 6) that also makes §2 invisible to any
report-reading oracle.

### Why no gate catches it

The faithfulness gate (`src/cards/compose/gates/faithfulness.ts`) audits
rendered preview *lines* against effect metadata; the card-choice audit
script "does not apply any responses" (its own header). Preview
formatting (`formatEffectPreview.ts`) derives from the same
`EffectPreview` objects the appliers consume, so previews are faithful
*to the metadata* by construction — nothing anywhere asserts the
metadata reaches state.

This is the sharpest available violation of the Core Design Rule: the
card promises simulation truth the simulation never enacts, across
roughly eight families' headline effects. Faction standing, culture
meters, supplier relationship, and regular loyalty are currently
**unreachable through cards**.

### Fix direction

Route `factions.` / `cultures.` / `world.suppliers.` /
`world.regulars.` prefixes through the existing `ctx.modify*` mutators
in both appliers; decide whether `global.*` meters exist (and stop
previewing them if not); make `applyPendingEntry` log and count
`applied: false`. Add a closed-loop gate: enumerate every
`state_change` target the generators can emit and assert each resolves
to a supported dispatch arm (a pure-static test can do this — no
simulation run needed).

---

## 3. HIGH — The rent card takes the money but the rent system never hears about it (phantom payment, then a double charge or a missed-payment penalty)

**Verified empirically on this commit.** The `debt_rent` "pay" profile
(`issueSeedGenerators.ts:2604-2613`) promises
`expectedEffects: ['clear arrears', 'spend coin']` but its effects are
only: coin −monthlyAmount, landlord pressure −15, debt pressure −10,
and a `rent_paid_recently` memory. It never touches
`modules.monthly.rent` — whose only writer is
`src/sim/modules/monthly/rent.ts`.

```
rent state before card pay:  {"monthlyAmount":120,"paidThisMonth":false,"missedPayments":0,"arrears":0}
rent state after  card pay:  identical                       (coin −120 taken)
rent state at month close:   {"paidThisMonth":false,"missedPayments":1,"arrears":120}
```

The player paid 120 coin to "pay what we owe"; the sim then recorded a
**missed payment**, rolled 120 into arrears, and raised landlord
pressure. If the player still has coin at month end, `resolveRent`
charges the full amount **again** (double charge); if not — likely,
since the card just drained them, see §1 — they take the missed-payment
penalty *despite having paid*. A direct "pretend past decisions did not
happen" violation, and the natural feeder into §1's kill chain.

**Fix:** make the pay profile settle rent through the monthly module
(set `paidThisMonth` / clear arrears via a proper mutator), or reprice
the slot as a partial appeasement and reword the label/expected effects.

---

## 4. HIGH — Mid-day save/reload produces a different game: `weeklyModule`'s cross-segment closure breaks the segment contract

**Verified empirically on this commit.** The Phase 186 day-clock
contract says only `TavernState` crosses a pause (zero RNG
serialization; `engine.ts:237-255`, `segments.ts:67-88`). One module
violates it with process-local state:

- `src/sim/modules/weekly/weeklyModule.ts:287` — `let priorDamageTotal
  = 0` (module-scope closure);
- written in `startDayHook` (`:305`, segment **A**);
- read in `endDayHook` (`:360`,
  `damageGained = Math.max(0, damageNow - priorDamageTotal)`, segment
  **C**) — across both player pauses;
- reset to 0 after use (`:440`).

The comments at `:283-287` and `:436-440` justify the pattern with "the
engine processes phases sequentially within a single `simulateDay`
call" — true before Phase 186; `advanceDaySegment` invalidated it. After
a mid-day save → fresh process → reload, the closure is `0`, so segment
C computes `damageGained` as the tavern's **total standing damage**
instead of today's delta. Past the early game total damage is almost
always ≥ 4, so `signals.ts:102-104` fires `dangerous += 2` plus a
phantom note **"Damage rose noticeably today."** on nearly every
reloaded day.

### Reproduction (day-21 mid-day save, seed `audit-roundtrip`, no inputs)

Save after segment A or B → JSON round-trip → the production
`validatePersistedSession` pipeline → resume; canonical deep-compare vs
the uninterrupted run:

- 8 divergent paths at end of the reloaded day:
  `modules.weekly.signals.dangerous: 14 != 16`, the phantom
  `signalNotes` entry, mirrored into `weeklyHistory[2]`,
  `lastWeeklyResult`, and `modules.monthly.accumulator`
  (`dangerous: 49 != 51`).
- 7 days later the contamination reaches the monthly rollup:
  `lastMonthlyResult.reputationShifts[3].reasons[0]: "weekly dangerous
  signal 61" != "… 63"`. In this seed the reputation value stayed in
  band; repeated mid-day reloads (+1–2 dangerous per reloaded day) will
  cross monthly shift thresholds and move reputation itself.

So mid-day refresh-and-resume — the headline Phase 96 / Day-Clock
Cluster 5 feature, freshly un-bricked by the quota fixes — silently
gives the reloading player a worse-reputed tavern and a weekly-report
claim the simulation never recorded. Violates both determinism ("same
seed + same input = same result") and "cards/reports must not invent
truth".

### Why no test caught it

`tests/sim/phase186.segmentedEngine.test.ts:252` re-runs only segments
A and B from checkpoints — never C, the only segment that reads the
closure — and every equivalence test starts from quiet day-1 states
where total damage ≈ 0, masking delta-vs-total confusion.

**Fix direction:** persist the start-of-day damage total in the weekly
module **slice**, or derive the delta from the engine's `dayBaseline`
bracket, which crosses pauses correctly. Regression test: run segment C
from a JSON round-tripped checkpoint on a state with nonzero standing
damage.

**Related (LOW, latent):** `serviceModule.ts:125` (`let snapshot`) is
the same pattern, currently safe only because `beforeService` →
`service` both live inside segment B. These two are the only
non-`initialized`-latch module-scope mutables in `src/sim/`. Worth a
lint/grep gate.

---

## 5. HIGH — Synthesized attribution memories are immortal: the one state slice that still grows without bound

**Verified empirically on this commit** (200-day run, seed
`growth-audit`). The good news first: the prior audits' raw-state growth
(571k → 2,014k chars) is a **ramp to a plateau**, not divergence — total
state oscillates at ~2.0–2.1M chars from day ~90 through day 200
(attribution, history, and causes are all windowed). One leak remains:

- `propagateToMemories`
  (`src/sim/modules/attribution/attributionModule.ts:327-345`) creates a
  memory for every strong (≥ 60), public (≥ 40) attribution.
- When no specific definition maps, `pickMemoryDefinition` falls back to
  a synthesized id **unique per attribution** —
  `` `attribution_${a}__${attribution.id}` ``
  (`attributionModule.ts:388`).
- That id is not in the memory registry, so `buildMemoryFromDraft`
  (`src/sim/core/engine.ts:399-415`) defaults it to `type: 'timed'`,
  `strength: 50`, **no `durationDays`, no `decayRate`**.
- `stepMemory` (`src/sim/modules/memories/memoryDecay.ts:44-60`) treats
  missing `decayRate` as 0 — strength never falls — and `isExpired`
  (`:62-71`) only fires on elapsed duration or strength ≤ 0. With
  neither set, the memory lives forever. No count cap exists anywhere on
  `state.memories`.

Measured: immortal non-fact memories 2 (d10) → 9 (d60) → 24 (d200);
the slice grows 6,874 → 19,121 chars, **strictly linearly, the only
slice still growing at day 200**. The oldest entry
(`attribution_distrust__attr-7-10`) is 196 days old, still strength 50,
while its parent attribution expired long ago
(`ageAttributions`, `attributionModule.ts:299-323`).

Bytes are modest in a no-input run (~35k chars/year; faster in
blame/rumour-heavy play, which produces more strong public
attributions). The semantic problem is worse than the bytes: memory
queries, pattern detection, and memory-conditioned seeds/cards treat a
day-7 distrust as **current truth at day 200+**, contradicting the
decay design. Also affected (bounded count via replace-stacking, but
each stale forever): `local_arc_started:*`
(`localArcsModule.ts:321`), `excellent_preparation`,
`adventurer_joined_roster`.

**Fix:** give definition-less drafts a default `durationDays` or
`decayRate` in `buildMemoryFromDraft`, and/or cap the memories slice.

---

## 6. MEDIUM — "Borrow coin" mints money with no repayment mechanic

The `debt_rent` borrow profile (`issueSeedGenerators.ts:2616-2632`)
grants `coin +40` immediately; its only counterweights are a decaying
`pressure:debt +12` and a `loan_due_soon` future hook. A fired
`future_hook` merely emits a neutral, weight-0 cause
(`responsesModule.ts:71-84`); **nothing in `src/` consumes
`loan_due_soon`**. Probe: borrow applied (+40 ledgered as
`response.borrow`); the following 30 days contain zero repayment ledger
entries and no surviving pending hooks. Since the seed is
poverty-gated, it reappears reliably for a broke player — an
exploitable faucet with no conservation counterpart. Implement loan
collection or remove the grant.

---

## 7. MEDIUM — Weekly economy totals never include rent; weekly `net` is overstated by the rent amount one week in four

Rent is spent at `endMonth` (`src/sim/modules/monthly/rent.ts:36`),
which runs **after** the weekly module's endDay ledger fold
(`weeklyModule.ts:309-321`) and endWeek (`src/sim/core/phases.ts:80-84`);
the day ledger resets next `startDay`. The weekly module already
special-cases exactly this problem for wages with a post-endDay mirror
(`weeklyModule.ts:443-458`) — rent never got the same treatment, so
`weekly.economy.rent` is structurally always 0.

Probe (130-day run, every month):

```
week 4: reported net=-33 sales=0 wages=33 rent=0 | ACTUAL coin delta=-153 | discrepancy=-120
```

Downstream: the debt-pressure calculator reads
`modules.weekly.economy.net`
(`src/sim/modules/pressures/calculators/debt.ts:70-88`), so
`weekly_loss_heavy/light` causes can fail to fire in exactly the week
rent hammers the till, and the weekly report header contradicts the
(correct) per-day ledger. Mirror the rent spend the way wages are
mirrored, or fold the ledger after `endMonth`.

---

## 8. MEDIUM — ~45–50 authored snippets and their salience reads are permanently dead: phantom condition vocabulary

The condition DSL's free-string fields (`hasTag`, `memoryPresent.tag`,
`pressureRising.pressureId`, `effectTag`) evaluate silently false on
values the sim never produces. A probe enumerated all 16,431 snippet
instances across `src/cards/compose/pools/` + `src/cards/templates/`,
validated every free-string value against a 120-day live-run universe,
then statically confirmed each survivor against the generators
(template-literal emissions like `rumour.*` were ruled out as
reachable). Confirmed dead:

| Dead value | Where (snippets + salience) | Why it can never match |
| --- | --- | --- |
| `pressureRising: 'customer_complaint'` | `pools/monthlyReview/establishingLine.ts:75,178`, `mannerNote.ts:91`; `salience.ts:583` | no pressure with that id exists (registry has `regular_customer_loss` etc.) |
| `memoryPresent: 'bribed_inspector'`, `'inspection_prep_recently'` | inspection pools (`establishingLine.ts:88,95,227` + reaction/manner); `salience.ts:422-423` | these are memory **ids**; the drafts' tags are `['bribe','corruption','grudge','attribution']` / `['inspection','cleanliness','attribution']` (`issueSeedGenerators.ts:2987,3034`); ids are never folded into tags |
| `hasTag: 'rent_due_soon'` | debtRent pools (~13 snippets); `salience.ts:119` | the generator reads the calendar tag only to bump severity (`issueSeedGenerators.ts:2558`) — it never lands on seed domain/toneHints/stakes; the pool comment asserting it "flowed through seed.domain" describes plumbing that doesn't exist |
| `hasTag: 'inspection_relevant'`, `'fire_risk'`, `'merchant_sensitive'`, `'inspection_negative'` | foodSafety/inspection/maintenance/areaAtmosphere pools; `salience.ts:300-317,396,424` | area/upgrade-registry tags are never copied onto seeds |
| `hasTag: 'market_day'`, `'payday'`, `'brawl_night'` | `pools/stockShortage/reactionLine.ts:29-40` | day types never reach seed tags (empirically absent across 120 days incl. paydays) |
| `hasTag: 'festival'`, `'ritual'` | cultureConflict pools; `salience.ts:255-256` | culture_conflict seeds carry exactly `domain ['cultures','social']`, `toneHints ['culture','tension']` |
| `effectTag: 'regulars'` | `pools/drinkOrder/effectPreview.ts:30,38,…` | generators emit `'regular'` — singular/plural typo |
| `effectTag: 'arc'`; `memoryPresent: 'festival'` | seasonalArc pools; `salience.ts:602` | effects carry `['pressure']/['coin']/['staff']`; festival memories are tagged `['arc','faction','hosted_event','attribution']` etc. |

The sharpest rows are `bribed_inspector` / `inspection_prep_recently`:
the sim *remembers* the bribe and the prep, but every snippet written to
acknowledge them can never fire — cards effectively pretend those past
decisions didn't happen. The rest degrade to generic fallbacks (no
invented truth), so the cost is dead authored content and lost salience.
The matching `SALIENCE_TABLES` entries share the identical phantom
vocabulary, so multi-fact establishing lines lose these facts too. The
existing reachability allowlist (`unreachableCells.ts`) only models
signal-band cells, not this vocabulary class — add a gate that
enumerates pool free-string vocabulary against generator/registry
emissions.

---

## 9. MEDIUM — Escalation of tracked AUD-CONTENT-009-001: every long campaign eventually enters a *permanently* validation-failing state

`generateDebtRent` computes `severity = Math.max(40, debt, landlord) +
(rentDueSoon ? 10 : 0)` (max 110) and `urgency = Math.max(45, landlord
+ 10) + (rentDueSoon ? 10 : 0)` (max 120)
(`issueSeedGenerators.ts:2687-2688`); `buildSeed`
(`generatorHelpers.ts:575-629`) never clamps; `validateIssueSeeds`
(`issueSeedModule.ts:304-325`) then errors. Previously believed
bot-specific (auto_miner_focused, days 85–88, "plain runs clean through
150 days"). New fact: a **plain no-input 200-day run** starts erroring
at ~day 169 and then errors **every day** while in arrears — at day 200:
coin 19, debt pressure pinned at 100, `arrears: 240` — that's the
steady state. Consequences: `validatedThroughout` fails for any long
playtest, daily validation noise masks real errors, and out-of-contract
values flow into card ranking. Verified it does **not** brick saves
(`seedsToday` is `z.array(z.unknown())` in the slice schema; the day-200
state passes the full load path). The fix is a one-line clamp at the two
formula sites or in `buildSeed`.

---

## 10. Smaller findings collected along the way

- **LOW — supplier market-condition nudges double-emit causes.**
  `supplierModule.ts:167-178` passes the cause draft to
  `ctx.modifyPressure` (which records it on change, `engine.ts:980`)
  *and* calls `ctx.addCause` with the same draft → duplicate
  (double-weighted) cause entries; and when the pressure is clamped at
  100, the explicit `addCause` records a change that didn't happen.
  Dormant — nothing populates `activeMarketConditions` yet — but armed
  for the moment market conditions ship.
- **LOW — "missed restock" claims the order is queued; no queue
  exists.** `actionDefinitions.ts:320-324`: the report text promises
  later delivery; the action is consumed, nothing arrives. Coin is
  correctly not spent (verified) — a truth-contract communication gap,
  not a money leak.
- **LOW — locale-sensitive collation decides which card renders.**
  Extends the prior audit's §6 (bare `localeCompare` in
  defaults/migrations): the card-selection final tiebreak
  (`src/cards/selection.ts:95`) and report projections
  (`worldOverviewProjection.ts:391,425`, `tavernOverviewProjection.ts:344`,
  `tavernLogProjection.ts:259,276` — the latter sorting generated NPC
  *names*) also use bare `localeCompare`. All current ids are ASCII so
  this is theoretical today, but `selection.ts:95` is the one spot where
  host locale could change visible card choice rather than list order.

---

## 11. Probed and verified clean (evidence on this commit)

- **Replay determinism:** 60-day `runCardlessSim` twice, same seed —
  byte-identical final state and per-day state/reports/logs JSON.
- **End-of-day save/load round-trip:** 20 days → JSON round-trip →
  production `validatePersistedSession` (migrations + Zod + reference
  validation) → 15 more days: canonically identical to the uninterrupted
  35-day run. Not persisting RNG positions is by design and sound —
  per-day seeds (`${seedString}-d${totalDaysElapsed}`) and per-segment
  reseeding make every segment's streams derivable from state alone.
  (Caveat for tooling authors: Zod's `z.object` parse rewrites
  fixed-shape keys into schema order, so naive `JSON.stringify`
  equality across a load reports false diffs; no record keys or values
  change.)
- **Money conservation:** 130 passive days + 4 policy bots × 50 active
  days (owner actions, staff priorities, 146 resolved card intents each,
  delayed effects draining later): per-day `coin` delta ≡ ledger sum ≡
  coin-cause sum, cumulative drift exactly 0; no NaN/Infinity anywhere
  in state on any day; no negative/fractional stock, coin, prices, or
  wages.
- **Wages/staff:** all-or-nothing payment gated on coin; fired staff
  leave `state.staff` (no ghost wages); hire fee gated; monthly
  `net = Σ weekly nets − rent` arithmetic checks out internally.
- **Owner actions:** every coin-spending action validates affordability;
  quote and apply compute identical costs (single `Math.ceil`).
- **Expeditions / rare ingredients:** commission gated; hauls write
  additively with quantity-weighted quality blending; all registry stock
  ids are pre-seeded into `state.stock`, so paid hauls can't be dropped.
- **Static determinism sweep:** no `Math.random` / `Date.now` /
  `new Date(` / `performance.now` in production `src/sim`, `src/cards`,
  `src/reports`; no RNG consumption in the card/report layers; card-slot
  ties resolve via an FNV hash keyed on `seed.id::slot.id`
  (`assemble.ts:322-334`); `ctx.rng` callers are all per-day variance,
  not identity generation.
- **Identity regeneration:** no `content/naming` imports and no RNG in
  `src/cards/`, `src/reports/`, `web/src`; display names all come from
  stored state.
- **Long-run health:** per-day cost plateaus at ~150–175 ms/day (no
  superlinear growth through day 200); attribution/history/causes/
  rumours/rosters all windowed or capped (incl. c542f6b's
  `MAX_STICKY_FALSE_AGE_DAYS`); day-200 state passes the full
  migration + Zod load path in <100 ms; `freezeInDev` adds no measurable
  cost.
- **Card audit baseline:** `scripts/audit-card-choices.ts` re-run —
  byte-identical to the committed `docs/audits/card-choice-audit.md`.
- **`signalEquals` conditions:** `SignalId`/`BandId` are closed unions —
  typos in that class can't compile (unlike the free strings in §8).

---

## Suggested repair order

1. **§1 + §2 together** — they're the same applier surface: clamp coin
   on the engine path, route the four world-entity prefixes through
   `ctx.modify*`, decide `global.*`, make pending-drain record failures.
   §1 alone defuses the save-bricking chain.
2. **§3 + §6** — make the rent card settle rent and the loan collectable
   (or reprice both); these are content/profile fixes on top of 1.
3. **§4** — move the weekly damage snapshot into the module slice;
   regression-test segment C from a round-tripped checkpoint.
4. **§5 + §9** — one-line default decay for synthesized memories; one-line
   severity/urgency clamp.
5. **§7, §8, §10** — as capacity allows; §8 wants the vocabulary gate so
   the class can't recur.
