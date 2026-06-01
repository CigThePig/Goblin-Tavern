# Phase 187 — Early-Game Complaint Fairness: a complaint reacts to an *unaddressed* problem

**Provisional:** ISSUE-154. **Phase doc:** `docs/plans/phase-187-early-game-complaint-fairness.md`.

**This document is self-contained.** Every claim below is grounded in a file path (and, where useful, a symbol or line reference) inside this repository. Nothing here depends on any external conversation, chat log, or document not in the repo. The reproduction in *Evidence* uses only the committed public APIs `createInitialTavernState` (`src/sim/state/defaults.ts`), `simulateDay` (`src/sim/core/engine.ts`), the canonical `FULL_PIPELINE` (`src/sim/canonicalPipeline.ts`), and `pickCard` (`src/cards/index.ts`).

---

## The defect in one screen

A brand-new save lands the player inside the `customer_complaint` family on the very first service, blaming them for the *starting* numbers and for a complaint they were never given a turn to answer.

Two mechanisms compound, both upstream of the card prose:

1. **The complaint generator fires on the current level, with no persistence requirement.** `generateCustomerComplaint` (`src/sim/modules/issues/issueSeedGenerators.ts`, function at ~line 1238) qualifies a customer group purely by `g.satisfaction <= 60` (the `groupCandidates` filter, ~lines 1265–1269). It is gated only by `CONTRADICTION_GUARDS.customer_complaint` (`src/sim/modules/issues/contradictionGuards.ts:102`) and a merchant-presence check — **there is no day-threshold and no "how long has this been true" gate anywhere in the issue generators.** The starting roster in `src/sim/registries/customerRegistry.ts` ships several groups at or below 60 out of the box: `merchants` start at `satisfaction: 40, loyalty: 25` (the `merchants` `defaultState` block), and other groups sit in the 40–55 range. So the condition is already met on Day 1 before the player has taken a single action.

2. **The "unanswered complaint" body line is satisfied by a same-day, possibly unrelated memory.** During Day-1 service, `src/sim/modules/service/serviceModule.ts` (~lines 247–256) writes a `merchants_unhappy_recently` memory whenever the merchants' satisfaction drops by ≥2. That memory is tagged `complaint` (`src/sim/modules/memories/memoryRegistry.ts`, the `merchants_unhappy_recently` entry, ~lines 178–186). The `customer_complaint` establishing pool (`src/cards/compose/pools/customerComplaint/establishingLine.ts`) then fires snippets like `est_complaint_memory` ("The last complaint they raised is still unanswered."), `est_loyalty_complaint` ("Loyalty thin and an unanswered complaint — bad pairing.") and `est_loyalty_complaint_memory`, all keyed on a `memoryPresent` condition with `tag: 'complaint'`. That condition (`src/cards/compose/conditions.ts`, `case 'memoryPresent'`, ~lines 144–148) is evaluated as `state.memories.some((m) => m.tags.includes(tag))` — **global (any group's memory satisfies it) and with no age check (a memory created the same evening satisfies it).** So on Day 1 the card asserts there is an "unanswered" complaint that was in fact created after the only service the player has played, before any decision pause existed.

The simulation is not wrong about the numbers; it is firing a *reaction-to-neglect* card before neglect was possible.

## Evidence (reproducible from the repo)

Construct a fresh state and simulate one day with no owner actions and no responses — a player who has done nothing:

```ts
import { createInitialTavernState } from '../src/sim/state/defaults'
import { simulateDay } from '../src/sim/core/engine'
import { FULL_PIPELINE } from '../src/sim/canonicalPipeline'
import { pickCard } from '../src/cards/index'

const result = simulateDay(createInitialTavernState(), { seed: 'alpha' }, FULL_PIPELINE)
const seeds = (result.state.modules['issueSeeds'] as any).seedsToday ?? []
const complaint = seeds.find((s: any) => s.family === 'customer_complaint')
console.log(pickCard(complaint, result.state).body)
```

Observed today: a `customer_complaint` seed is present on Day 1; `result.state.memories` already contains `merchants_unhappy_recently` (tagged `complaint`, created this same day); and the rendered body leads with the inherited-state corner `est_low_sat_low_loy` joined to the `est_loyalty_complaint` "unanswered complaint" line. The outcome is identical across different `seed` values, so this is the deterministic opening of every new game, not a tail case.

## Two principles this phase bakes in

1. **A complaint is a reaction to an *unaddressed* problem.** It may only fire once the dissatisfaction has survived at least one decision point — i.e., the player has had a real opportunity to respond and has not. This is the simulation-as-truth rule (`CLAUDE.md`, Core Design Rule) applied to timing: the card must not assert neglect the state does not yet support.
2. **The fix is additive and lives at the firing gate and the snippet conditions — never in the prose.** No establishing-line wording changes here; that surface is correct once it stops being *fed* a same-day, cross-group memory.

## The work

**A. Track persistence of dissatisfaction (state owner: customers module).**
- Add a serializable per-group counter `lowSatisfactionStreak: Record<string, number>` to the customer module state (`src/sim/modules/customers/customerModule.ts`; its state factory is `createInitialCustomerModuleState`, ~line 54, and its Zod schema lives beside it). Plain JSON, no Maps — same discipline as the existing module state.
- Maintain it in the customer module's post-service hook (the `afterService` satisfaction-update path that already calls `applySatisfactionUpdate`, `src/sim/modules/customers/satisfaction.ts`): for each group, increment the counter when end-of-service `satisfaction <= COMPLAINT_THRESHOLD`, and reset to `0` when above. Use a single shared `COMPLAINT_THRESHOLD` constant (value `60`, matching the current generator filter) exported from the customers module so the generator and the streak logic can never drift.

**B. Gate the complaint generator on persistence (no behavioral change to its rotation logic).**
- In `generateCustomerComplaint` (`issueSeedGenerators.ts`), change the `groupCandidates` qualification (~lines 1265–1269) from `g.satisfaction <= COMPLAINT_THRESHOLD` to additionally require `streak[g.id] >= 2`, reading the counter from the customers module slice. `>= 2` means the group was unhappy at the end of at least two evaluated services, so the player passed through at least one closing and one morning pause able to respond and did not recover the group. Leave the lowest-satisfaction-with-recency-penalty ranking (`ranked`, ~lines 1271–1279) untouched — this changes *who qualifies*, not *who is picked among qualifiers*.

**C. Make the "unanswered complaint" claim honest (snippet-condition scope + age).**
- In `src/cards/compose/types.ts`, extend the `memoryPresent` `SnippetCondition` variant (the union entry at ~line 80) with two **optional** fields: `scopeToActor?: string` (a role string such as `'primaryActor'`) and `minAgeDays?: number`. Optional fields preserve every existing `memoryPresent` usage and keep all current gate fixtures green.
- In `src/cards/compose/conditions.ts`, extend `case 'memoryPresent'` (~lines 144–148): when `scopeToActor` is set, resolve the role via the existing `resolveActorRef` helper (used by the `signalEquals`/`voiceAxis` cases) and require the memory's `actors` to include a ref matching that entity (`kind` + `id`); when `minAgeDays` is set, require `state.calendar.totalDaysElapsed - m.createdAt.absoluteDay >= minAgeDays`. Memories already carry `createdAt.absoluteDay` — the sibling `repeatCount` case (~lines 150–157) reads exactly this field through `repeatCountByTag`, so no schema change is needed.
- In `establishingLine.ts`, update the three complaint-memory snippets — `est_complaint_memory`, `est_loyalty_complaint`, `est_loyalty_complaint_memory` — to use `{ kind: 'memoryPresent', tag: 'complaint', scopeToActor: 'primaryActor', minAgeDays: 1 }`. After this, the "unanswered complaint" line only appears when *this* group has a complaint memory that predates today.

Gate B alone removes the Day-1 firing; Gate C is the independent correctness fix that prevents a different group's memory, or a same-day memory, from ever backing an "unanswered" claim once the family does fire.

## Read first

`src/sim/registries/customerRegistry.ts` (the `defaultState` blocks and their starting `satisfaction`/`loyalty`). `src/sim/modules/issues/issueSeedGenerators.ts` (`generateCustomerComplaint`, the `groupCandidates`/`ranked` blocks). `src/sim/modules/issues/contradictionGuards.ts` (`customer_complaint`). `src/sim/modules/customers/customerModule.ts` + `satisfaction.ts` (state factory, schema, the `afterService` satisfaction path). `src/sim/modules/service/serviceModule.ts` (~lines 247–256, the `merchants_unhappy_recently` write). `src/sim/modules/memories/memoryRegistry.ts` (the `merchants_unhappy_recently` tags). `src/cards/compose/types.ts` + `src/cards/compose/conditions.ts` (the `memoryPresent` variant and `resolveActorRef`). `src/cards/compose/pools/customerComplaint/establishingLine.ts` (the three complaint-memory snippets).

## Acceptance criteria (done when)

- A fresh `createInitialTavernState()` run through `simulateDay(FULL_PIPELINE)` for Day 1 produces **no** `customer_complaint` seed for any group (add a sim test asserting `seedsToday` contains no `customer_complaint` entry on Day 1 from a default start).
- A scripted two-service run in which a group is held at `satisfaction <= 60` across both services **does** produce the complaint on the second day (test asserts the streak gate opens at `>= 2`, not on Day 1).
- The `memoryPresent` condition accepts the optional `scopeToActor`/`minAgeDays` fields, defaults unchanged when they are absent, and the three complaint-memory snippets no longer match a same-day or cross-group complaint memory (unit test against `evalCondition` with a same-day memory and with a different group's memory).
- `lowSatisfactionStreak` round-trips through state serialization/validation.
- `npm test` and `npm run typecheck` are green.

## Do not do

- Do **not** change starting `satisfaction`/`loyalty` values in `customerRegistry.ts` to dodge the threshold; that distorts the economy and masks the real defect. The fix is the persistence gate, not the starting numbers.
- Do **not** add a hardcoded "first N days" suppression; gate on observed persistence so the rule generalizes to a group that recovers and later relapses.
- Do **not** change the global semantics of `memoryPresent` for callers that omit the new fields, and do **not** change the establishing-line wording.
- Do **not** alter the generator's group-rotation ranking or the contradiction guard.
- Do **not** build any system-unlock or onboarding gating here — that is the separate, locked Progressive Onboarding arc (`docs/plans/progressive-onboarding.md`, ISSUE-060…077). This phase is a firing-fairness correctness fix that remains correct whether or not customers are later unlock-gated; the streak simply counts from the first day the family is allowed to evaluate.

## Tracker entry (add to `docs/ISSUE_TRACKER.md`)

Index row:

```
| ISSUE-154 | Early-game complaint fairness — gate customer_complaint on persistence; scope the "unanswered complaint" claim | broken | open | 187 |
```

Full entry:

> **ISSUE-154 — Early-game complaint fairness.** *Status:* open. *Phase:* 187. *Depends on:* none.
> *Evidence:* A default `createInitialTavernState()` → `simulateDay(FULL_PIPELINE)` Day-1 run fires a `customer_complaint` seed because `generateCustomerComplaint` qualifies groups on `satisfaction <= 60` with no persistence gate (`issueSeedGenerators.ts` ~1265) and the roster ships `merchants` at 40/25 (`customerRegistry.ts`); the rendered body asserts an "unanswered complaint" backed by a same-day, globally-scoped `merchants_unhappy_recently` memory (`serviceModule.ts` ~247, `memoryRegistry.ts` ~178, `conditions.ts` `memoryPresent` ~144).
> *Scope:* add a per-group `lowSatisfactionStreak` to customer state, maintained on `afterService`; require `streak >= 2` in the complaint generator's candidate filter; add optional `scopeToActor`/`minAgeDays` to the `memoryPresent` snippet condition and rewire the three complaint-memory establishing snippets to require an own-group complaint memory older than today. Additive; no prose changes; no registry value changes.
> *Test approach:* Day-1 default run yields no `customer_complaint` seed; a two-service held-low run opens the complaint on day 2; `evalCondition` rejects same-day and cross-group complaint memories under the scoped condition; streak field round-trips serialization.

## Plan-mode prompt (copy-paste)

```
Enter plan mode. Early-Game Complaint Fairness (provisional ISSUE-154, phase 187).
Read src/sim/registries/customerRegistry.ts (defaultState satisfaction/loyalty),
src/sim/modules/issues/issueSeedGenerators.ts (generateCustomerComplaint:
groupCandidates + ranked), contradictionGuards.ts (customer_complaint),
src/sim/modules/customers/customerModule.ts + satisfaction.ts (state factory,
schema, afterService satisfaction path), src/sim/modules/service/serviceModule.ts
(~247 merchants_unhappy_recently write), src/sim/modules/memories/memoryRegistry.ts
(merchants_unhappy_recently tags), src/cards/compose/types.ts +
src/cards/compose/conditions.ts (memoryPresent variant + resolveActorRef), and
src/cards/compose/pools/customerComplaint/establishingLine.ts (est_complaint_memory,
est_loyalty_complaint, est_loyalty_complaint_memory).
Write a phase plan in docs/plans/ implementing this issue exactly as scoped:
(A) add a serializable per-group lowSatisfactionStreak to customer state,
incremented/reset on afterService against a shared COMPLAINT_THRESHOLD=60;
(B) require streak>=2 in generateCustomerComplaint's candidate filter, leaving
ranking untouched; (C) add OPTIONAL scopeToActor + minAgeDays to the memoryPresent
condition (defaults preserve all existing behavior) and rewire the three
complaint-memory snippets to {tag:'complaint', scopeToActor:'primaryActor',
minAgeDays:1}. Then implement, add the tests in the Acceptance Criteria, and take
npm test + npm run typecheck to green. Do not touch starting registry values,
establishing-line wording, group rotation, or onboarding gating.
```
