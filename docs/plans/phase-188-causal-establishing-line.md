# Phase 188 — Causal Establishing Line: the body names the event the sim recorded

**Provisional:** ISSUE-155. **Phase doc:** `docs/plans/phase-188-causal-establishing-line.md`.

**This document is self-contained.** Every claim below is grounded in a file path (and, where useful, a symbol or line reference) inside this repository. Nothing here depends on any external conversation, chat log, or document not in the repo. The *Evidence* reproduction uses only `createInitialTavernState` (`src/sim/state/defaults.ts`), `simulateDay` (`src/sim/core/engine.ts`), `FULL_PIPELINE` (`src/sim/canonicalPipeline.ts`), and `pickCard` (`src/cards/index.ts`).

---

## The defect in one screen

The simulation records *why* a value moved and attaches it to the seed, but the card body never states it. Every `customer_complaint` body is composed from the cohort's standing **levels and trends** — never the **event** that triggered the complaint — so a complaint caused by a stock shortage and one caused by a filthy room render with the same vocabulary, and the body reads the same on the day a problem first appears as it does a month later.

- The seed carries `causes: CauseEntry[]` (`src/sim/modules/issues/issueSeedTypes.ts`, the `IssueSeed` type), and `generateCustomerComplaint` (`src/sim/modules/issues/issueSeedGenerators.ts`, ~line 1238) populates it from real attribution (`recentCauseEntries(...)` and `pressureCauseRefsAsEntries(...)`, ~lines 1328–1337). `CauseEntry` (`src/sim/state/TavernState.ts:424`) carries `source`, `target`, `amount`, `direction`, `weight`, `tags: string[]`, `readable`, and `ageDays` — a fully classified, human-readable record of the triggering event.
- The card-composition layer never reads it. A search for `seed.causes` (or `.causes`) under `src/cards/` returns nothing. The only world-state facts a body line can assert are the ones the snippet-condition vocabulary exposes: signal bands (`signalEquals`), pressure trends (`pressureRising`), memory presence (`memoryPresent`), and repeat counts (`repeatCount`) — see the `SnippetCondition` union in `src/cards/compose/types.ts` and the evaluators in `src/cards/compose/conditions.ts`. None of these reads a cause.
- The `customer_complaint` establishing pool (`src/cards/compose/pools/customerComplaint/establishingLine.ts`) is therefore built entirely from satisfaction/loyalty bands, five pressure trends, and the `complaint`/`customer` memory tags. It is correct about the *standing* of the cohort and says nothing about what happened.
- The seed's own `textIngredients.recentContext` is hardcoded to `['main room dirty all week']` (`generateCustomerComplaint`, ~line 2039) and `problemNoun` to `'cold welcome'` (~line 2034), regardless of the actual cause — so even the non-compositional consumers receive a fixed, frequently-false fragment.

This is the Core Design Rule (`CLAUDE.md`) half-applied: causes are computed as truth but discarded before they reach the card. `CLAUDE.md` Architectural Rule 6 states the intent directly — *"When a major value changes, the sim must record why. Cause entries feed reports, tooltips, and card text."* They feed reports; they do not yet feed card text.

## Evidence (reproducible from the repo)

```ts
const result = simulateDay(createInitialTavernState(), { seed: 'alpha' }, FULL_PIPELINE)
const seeds = (result.state.modules['issueSeeds'] as any).seedsToday ?? []
const complaint = seeds.find((s: any) => s.family === 'customer_complaint')
console.log(complaint.causes.map((c: any) => `${c.readable} [${c.target} ${c.amount}] ${c.tags}`))
console.log(pickCard(complaint, result.state).body)
```

Observed today: `complaint.causes` includes an entry whose `readable` is `"Merchants hit 2 shortage(s)."` tagged `['service','satisfaction','merchants','shortage']` — the actual reason the cohort is unhappy. The rendered `body` states bands and an "unanswered complaint" and never mentions the shortage.

## The principle

**The body's lead fact is the event the sim attributed, when one is classifiable; the cohort's standing is the supporting beat.** A cause-backed line is a `sim_backed` claim like any band line — it reads structured truth off the seed (`seed.causes`) and is validated by the same coherence gate. The card still *reveals* simulation truth; it does not invent it.

## The work

**A. A single source of truth for "what was the dominant cause" (sim, pure).**
- Add two pure helpers to the causes module (`src/sim/modules/causes/`, beside the existing cause utilities): `pickDominantCause(causes: CauseEntry[]): CauseEntry | undefined` and `classifyCause(cause: CauseEntry): CauseClass | undefined`. `pickDominantCause` selects among entries with `direction === 'decrease'` (equivalently `amount < 0`), ranking by `Math.abs(amount) * weight` and tie-breaking by lowest `ageDays`. `classifyCause` maps `cause.tags` to a small closed `CauseClass` union — start with `'shortage' | 'cleanliness' | 'price' | 'danger' | 'rumour' | 'wait'` and ground each mapping in the tags the cause writers actually emit (e.g. `shortage` from the `shortage` tag; `cleanliness` from `cleanliness`/`mess`/`filth`; `danger` from `danger`/`violence`/`rowdy`; `rumour` from `rumour`/`bad_reputation`; `wait` from the slow-service tags; `price` from the price/expensive tags). Return `undefined` when no class applies. Keep these pure (no RNG, no state writes) so both the seed generator and the card condition can import them without drift.

**B. A cause snippet condition (card layer).**
- In `src/cards/compose/types.ts`, add `{ kind: 'dominantCause'; anyOf: readonly CauseClass[] }` to the `SnippetCondition` union (beside the other world-state conditions, ~lines 79–81). Import `CauseClass` from the causes module — the card layer already depends on sim types; this does not violate purity (it imports a type + pure functions, not a report module).
- In `src/cards/compose/conditions.ts`, add `case 'dominantCause':` — compute `classifyCause(pickDominantCause(seed.causes))` and return true when the result is in `anyOf`. `evalCondition(condition, seed, state)` already receives `seed`, so this is a read-only addition with no new plumbing.
- In `src/cards/compose/gates/simCoherence.ts`, add `'dominantCause'` to `STATE_LOOKUP_KINDS` (the array at ~line 147). This is what lets a `sim_backed` snippet be backed by a cause condition; without it the gate's `sim_backed_missing_lookup` rule would reject every cause-typed snippet.

**C. A lead `cause_line` slot on the complaint card (card layer).**
- In `src/cards/templates/customerComplaint.ts`, add a new slot to `customerComplaintTemplate.slots`, placed **first** (so it leads the body): `{ id: 'cause_line', role: 'utterance', pool: causeLinePool, optional: true, wordBudget: 14, claimMode: 'sim_backed' }`. `optional: true` plus the cause condition gives graceful degradation per the framework's §5 — when no cause is classifiable the slot fills nothing and the body matches today's output exactly.
- Create the pool `src/cards/compose/pools/customerComplaint/causeLine.ts` (`SnippetPool` with `slotId: 'cause_line'`), one snippet per `CauseClass`, each carrying a single `{ kind: 'dominantCause', anyOf: ['<class>'] }` condition and `claimMode`-appropriate wording that names the event in cohort voice, e.g. shortage → "What they came in for, we'd run dry of."; cleanliness → "The room hadn't been touched, and they could see it."; price → "The reckoning came dearer than they'd planned for."; danger → "Last night's trouble still hung in the air, and they felt it."; rumour → "They'd heard the talk before they reached the door."; wait → "They waited, and waited, and watched us not come." **Do not** ship an unconditional fallback in this pool — an optional slot with no match must omit, not assert.
- Export the pool from `src/cards/compose/pools/customerComplaint/index.ts` and import it in the template.
- Update `buildCustomerComplaintBody` (in the same template file) so the body leads with `cause_line` when present and stays at three lines: when `cause_line` is filled, body = `[cause_line, establishing_line, reaction_line]`; when absent, body = today's `[establishing_line, reaction_line, manner_note]`. Both paths `.slice(0, 3)`.

**D. Stop the seed's hardcoded recentContext from lying (sim).**
- In `generateCustomerComplaint` (`issueSeedGenerators.ts`), replace the literal `recentContext: ['main room dirty all week']` (~line 2039) with the `readable` of `pickDominantCause(causes)` when one exists (fall back to a neutral fragment otherwise), and derive `problemNoun` (~line 2034) from `classifyCause` rather than the fixed `'cold welcome'`. This keeps the non-compositional consumers (legacy templates, validation, debugging) truthful and reuses the same helper as the card condition, so the seed's stated cause and the card's cause line can never disagree.

## Read first

`src/sim/state/TavernState.ts` (`CauseEntry`, ~line 424). `src/sim/modules/causes/` (existing cause utilities — the home for the two new helpers). `src/sim/modules/issues/issueSeedGenerators.ts` (`generateCustomerComplaint`: the `causes` assembly ~1328 and the `textIngredients` block ~2032–2045). `src/cards/compose/types.ts` (`SnippetCondition` union, `SlotSpec`). `src/cards/compose/conditions.ts` (`evalCondition`, the sibling world-state cases). `src/cards/compose/gates/simCoherence.ts` (`STATE_LOOKUP_KINDS`, ~line 147; the `checkSimBackedSnippet`/`hasConditionKinds` logic). `src/cards/templates/customerComplaint.ts` (the `slots` array, `buildCustomerComplaintBody`, `toCardView`). `src/cards/compose/pools/customerComplaint/establishingLine.ts` + `index.ts` (the existing pool shape to mirror). `docs/plans/card-composition-framework.md` §5 (graceful degradation for optional slots).

## Acceptance criteria (done when)

- `pickDominantCause` and `classifyCause` are pure, unit-tested against representative `CauseEntry[]` (a shortage cause classifies as `shortage`; a positive/`increase` cause is never selected as the dominant negative cause; an unclassifiable cause yields `undefined`).
- `dominantCause` is a valid `SnippetCondition`, evaluates against `seed.causes`, and is listed in `STATE_LOOKUP_KINDS`, so `sim_backed` cause snippets pass `simCoherence`.
- For the default Day-1 `customer_complaint` seed, `pickCard(...).body[0]` is the shortage cause line (test asserts the body leads with the cause, not the band corner), and the band/standing line still appears as the second beat.
- When `seed.causes` contains no classifiable negative cause, the body is byte-identical to the pre-change output (graceful degradation test).
- `seed.textIngredients.recentContext` reflects the dominant cause's `readable` rather than the hardcoded string.
- `runAllGates` (`src/cards/compose/gates/runAllGates.ts`) and the `customer_complaint` gate/template tests pass, including the determinism gate (cause selection is a deterministic function of the deterministic `seed.causes`); `npm test` and `npm run typecheck` are green.

## Do not do

- Do **not** read `seed.causes` as free text — classify via `classifyCause` and assert only the classified event, so the claim stays checkable by the gate.
- Do **not** add an unconditional fallback to the `cause_line` pool; an optional `sim_backed` slot must omit when nothing matches.
- Do **not** rewrite or reorder the existing `establishingLine.ts` snippets, and do **not** touch `salience.ts` — the new lead slot is composed independently of the establishing slot's salience ranking.
- Do **not** import anything from `src/reports/` into `src/cards/` — keep the card layer pure; the cause helpers live in `src/sim/modules/causes/`.
- Do **not** widen this beyond the `customer_complaint` family in this phase. Other families have their own `causes` and their own pools; rolling the cause line out to them is follow-on work, not this issue.

## Tracker entry (add to `docs/ISSUE_TRACKER.md`)

Index row:

```
| ISSUE-155 | Causal establishing line — surface seed.causes as the customer_complaint body's lead fact | thin | open | 188 |
```

Full entry:

> **ISSUE-155 — Causal establishing line.** *Status:* open. *Phase:* 188. *Depends on:* none.
> *Evidence:* `seed.causes` (`issueSeedTypes.ts`/`TavernState.ts:424`) is populated by `generateCustomerComplaint` (`issueSeedGenerators.ts` ~1328) with classified, human-readable triggers (a default Day-1 seed carries `"Merchants hit 2 shortage(s)."` tagged `shortage`), but `grep seed.causes src/cards/` is empty: the `customer_complaint` establishing pool composes only from bands/pressures/memory tags (`establishingLine.ts`), and the seed's `recentContext` is hardcoded to `'main room dirty all week'` (`issueSeedGenerators.ts` ~2039).
> *Scope:* add pure `pickDominantCause`/`classifyCause` to `src/sim/modules/causes/`; add a `dominantCause` snippet condition (`types.ts`/`conditions.ts`) and register it in `simCoherence.ts` `STATE_LOOKUP_KINDS`; add an optional lead `cause_line` slot + pool to the `customer_complaint` template with one snippet per cause class; lead the body with it; replace the hardcoded `recentContext`/`problemNoun` with cause-derived values. Additive; graceful degradation when no class applies; `customer_complaint` only.
> *Test approach:* Day-1 default `customer_complaint` body leads with the shortage cause line; classifier unit tests; byte-identical body when no classifiable cause; `recentContext` reflects the dominant cause; `runAllGates` + determinism gate green.

## Plan-mode prompt (copy-paste)

```
Enter plan mode. Causal Establishing Line (provisional ISSUE-155, phase 188).
Read src/sim/state/TavernState.ts (CauseEntry ~424), src/sim/modules/causes/
(existing utilities), src/sim/modules/issues/issueSeedGenerators.ts
(generateCustomerComplaint: causes assembly ~1328, textIngredients ~2032-2045),
src/cards/compose/types.ts (SnippetCondition, SlotSpec), src/cards/compose/conditions.ts
(evalCondition + sibling world-state cases), src/cards/compose/gates/simCoherence.ts
(STATE_LOOKUP_KINDS ~147), src/cards/templates/customerComplaint.ts (slots,
buildCustomerComplaintBody, toCardView), src/cards/compose/pools/customerComplaint/
(establishingLine.ts + index.ts), and docs/plans/card-composition-framework.md §5.
Write a phase plan in docs/plans/ implementing exactly: (A) pure pickDominantCause +
classifyCause in src/sim/modules/causes/, classifying tags into
shortage|cleanliness|price|danger|rumour|wait; (B) a dominantCause SnippetCondition
+ evaluator, registered in STATE_LOOKUP_KINDS; (C) an OPTIONAL lead cause_line slot
+ pool (one sim_backed snippet per class, NO unconditional fallback), with the body
builder leading on cause_line when present at a 3-line cap; (D) replace the hardcoded
recentContext/problemNoun in generateCustomerComplaint with cause-derived values via
the same helpers. Then implement, add the Acceptance-Criteria tests, and take
npm test + npm run typecheck + runAllGates to green. customer_complaint only; do not
import src/reports into src/cards; do not touch salience.ts or the existing snippets.
```
