# Phase 124 — Test Harness (Living Cast arc, Phase D)

> Implements Phase D of [`living-cast-arc.md`](./living-cast-arc.md).
> Tracker entry: `ISSUE-093` in
> [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md).
> Locked contracts honoured:
> [`card-composition-framework.md §4, §6`](./card-composition-framework.md),
> [`living-cast-arc-phase-b.md "Must-pass gates"`](./living-cast-arc-phase-b.md).

## Context — why this change

Phase C (ISSUE-092, phase 123) shipped the compositional runtime and
wired Phase B's hand-iterated `drink_order` template through it. The
assembler, conditions, and `defineCompositionalCard` factory are live;
`drinkOrderCard` renders deterministic composed cards in-game alongside
the eight hand-written templates.

Phase C's tests prove the **runtime** is correct (per-condition arms,
specificity ordering, FNV tie-break, optional-slot omission, integration
on a real seed). What they don't prove is that the **committed pool data
itself** is safe to scale. As more templates land in Phases F–G and the
generation pipeline (E) starts filling pools at volume, "Claude reviews
each line" stops working. Framework §6 names six structural gates that
catch the failure modes generation produces — coverage holes, all-
fallback flat pools, over-budget lines, sim-incoherent claims,
non-determinism, low-diversity collapse. Phase B's "Must-pass gates for
this template" block already specifies what these mean for `drink_order`.

Phase D builds those gates **as a reusable library** (`src/cards/compose/
gates/`) so Phase E's generation pipeline can call them at build time on
generated output, and runs them as a Vitest suite against the committed
`drinkOrder` pools. Each gate ships with intentionally-bad fixtures that
prove it fails when it should — the harness is only useful if its
failure mode is sharp.

This phase **only adds** library code, tests, and two optional data
fields on `SlotSpec` (authoring affordances that the gates read). No
runtime behaviour changes; no other template is touched.

## Locked decisions

| Question | Decision |
|---|---|
| Where do the gate functions live? | New library slice at `src/cards/compose/gates/` — one file per gate plus a composite runner. **Phase E's pipeline imports the same functions**, so gates are not test-only code. Tests live at `tests/cards/compose/gates/`. |
| How does `voice-bounds` know each slot's budget? | Authored as data on the slot: a new optional `wordBudget?: number` on `SlotSpec`. Gate reads `slot.wordBudget ?? DEFAULT_BODY_WORD_BUDGET` (12, framework §4). DrinkOrder's `order_line` slot gets `wordBudget: 12`; `manner_note` gets the tighter `wordBudget: 10` Phase B locks. The gate also accepts a `config.perSlot` override for ad-hoc test-time use, but production code lives on the slot. |
| How does `sim-coherence` work without claim metadata on every snippet? | A new optional `claimMode?: 'flavor' \| 'sim_backed'` on `SlotSpec` (default `'flavor'`). For `'flavor'` slots the gate runs three structural checks against snippet text: (a) no display-name tokens drawn from a representative state sample appear in any text; (b) any history-claim phrase requires a `memoryPresent` or `repeatCount` condition; (c) any role-claim phrase ("your cook", "the cleaner") requires a `hasNamedEntity` condition. For `'sim_backed'` slots, every non-fallback snippet must carry at least one state-lookup condition (`pressureRising`, `memoryPresent`, `repeatCount`, `hasNamedEntity`). Phase E's spec layer can extend this with explicit per-snippet claim lists; Phase D's structural version catches Phase B's named negative examples ("your faithful Krenn", "three times now") today. |
| How does `determinism` get tested? | Against the **real** drinkOrder template across a hand-picked deterministic sample of `(seed, state)` pairs that exercises every snippet rung at least once (neutral + each single-axis extreme + each two-axis exemplar pair + each verbal tic — ≥ 15 samples). Render each twice with `structuredClone(state)`; assert byte-equal `CardView` and no state mutation. A "bad fixture" is structurally impossible at the assembler layer (conditions are data, FNV tie-break, no `Math.random`), but the gate also detects template-level state mutation in `toCardView` — proven by a planted mutating template in the bad-fixture half of the test. |
| How does `diversity` sample cast attributes? | Use `createRegularCastAttributes` from `src/sim/content/cast/` with a `prando`-seeded RNG to mint N (= 100) cast profiles drawn from the real `[-1,0,0,1]` perturbation. For each profile, replace the regular's `castAttributes` on a base state, render the card with a unique seed id, collect `view.body[0]` (the order_line) and `view.body[1]` (manner_note if present). Assert ≥ 6 distinct `order_line` outputs (Phase B's locked threshold). The gate API is slot-level: it takes a `SnippetPool`, a sampler, and a config `{ sampleSize, minDistinct }`. |
| New `SlotSpec` fields — is this DSL expansion? | No. Framework §9 freezes the condition primitive set; the slot-level authoring fields (`wordBudget`, `claimMode`) are orthogonal to that and are exactly the "data, inspectable" pattern the framework asks for. Both are optional with sensible defaults, so no existing slot needs touching. |
| Do we migrate Phase B's locked numbers? | Yes — `order_line ≤ 12 words` and `manner_note ≤ 10 words` move from the doc into `drinkOrder.ts` slot data. Single source of truth. |

## Files

### New — gate library

- **`src/cards/compose/gates/types.ts`** — common shapes:
  ```ts
  export type GateViolation = {
    slotId: string
    snippetId?: string
    reason: string
    detail?: string
  }
  export type GateReport = {
    pass: boolean
    violations: GateViolation[]
  }
  ```

- **`src/cards/compose/gates/coverage.ts`** —
  `checkCoverage(template): GateReport`. For every required slot, the
  pool must contain at least one snippet with `conditions.length === 0`.
  Optional slots are exempt (silence beats weak copy, framework §2.4).

- **`src/cards/compose/gates/specificity.ts`** —
  `checkSpecificityGradient(template): GateReport`. For every required
  slot, the pool must contain (a) ≥ 1 unconditional fallback AND (b) ≥ 1
  conditioned snippet. Pure-fallback pools collapse to one line; pure-
  conditional pools have no safety net.

- **`src/cards/compose/gates/voiceBounds.ts`** —
  ```ts
  export type VoiceBoundsConfig = {
    defaultWordBudget?: number      // defaults to 12
    perSlot?: Record<string, number> // ad-hoc override, beats slot.wordBudget
  }
  export function checkVoiceBounds(
    template: CompositionalCardTemplate,
    config?: VoiceBoundsConfig,
  ): GateReport
  ```
  Resolves each slot's budget as `config.perSlot[slot.id] ??
  slot.wordBudget ?? config.defaultWordBudget ?? DEFAULT_BODY_WORD_BUDGET`.
  Asserts every snippet's `text.trim().split(/\s+/).length <= budget`.
  Word-count helper matches the existing `wordCount` in
  `tests/cards/templates.voice.test.ts:27` for parity with the
  cards-contract §3.3 caps.

- **`src/cards/compose/gates/simCoherence.ts`** —
  ```ts
  export type SimCoherenceConfig = {
    /** Display names drawn from a representative state. The gate
     *  refuses any snippet text containing any of these substrings. */
    bannedDisplayNames: readonly string[]
    /** Optional per-template extension to the default detectors. */
    extraHistoryPatterns?: readonly RegExp[]
    extraRolePatterns?: readonly RegExp[]
  }
  export function checkSimCoherence(
    template: CompositionalCardTemplate,
    config: SimCoherenceConfig,
  ): GateReport
  ```
  Three default detectors, each scoped by the slot's `claimMode`:
  - `display_name`: scan text for any banned-display-name substring.
    Fails if found (no condition can guarantee that exact identity).
  - `history_claim`: regex `/\b(yesterday|last\s+(week|night|month)|twice\s+now|three\s+(times|weeks)|the\s+third\s+(time|week)|again[\s,—.])\b/i`. Fails if matched without a `memoryPresent` or `repeatCount` condition on the snippet.
  - `role_claim`: regex `/\b(your|the)\s+(cook|cleaner|server|guard|bouncer)\b/i`. Fails if matched without a `hasNamedEntity` condition on the snippet.
  For `claimMode: 'sim_backed'`, every non-fallback snippet must carry at least one of `pressureRising`, `memoryPresent`, `repeatCount`, `hasNamedEntity`.

- **`src/cards/compose/gates/determinism.ts`** —
  ```ts
  export type DeterminismSample = { seed: IssueSeed; state: TavernState }
  export function checkDeterminism(
    template: CompositionalCardTemplate,
    samples: readonly DeterminismSample[],
  ): GateReport
  ```
  For each sample: render twice, second time with `structuredClone(state)`;
  fail if `JSON.stringify(viewA) !== JSON.stringify(viewB)`. Also asserts
  no state mutation (`JSON.stringify(state)` byte-equal before/after).

- **`src/cards/compose/gates/diversity.ts`** —
  ```ts
  export type DiversitySampler = (i: number) => {
    seed: IssueSeed
    state: TavernState
  }
  export type DiversityConfig = {
    sampleSize: number      // e.g. 100
    minDistinct: number     // e.g. 6
  }
  export function checkPoolDiversity(
    slot: SlotSpec,
    sampler: DiversitySampler,
    config: DiversityConfig,
  ): GateReport
  ```
  Calls `pickSnippet(slot, seed, state)` for `sampleSize` samples,
  collects distinct results (excluding `undefined`), fails if
  `distinct.size < minDistinct`.

- **`src/cards/compose/gates/runAllGates.ts`** —
  ```ts
  export type DiversitySlotConfig = {
    slotId: string
    sampler: DiversitySampler
    config: DiversityConfig
  }
  export type AllGatesConfig = {
    voiceBounds?: VoiceBoundsConfig
    simCoherence: SimCoherenceConfig
    determinism: { samples: readonly DeterminismSample[] }
    diversity: readonly DiversitySlotConfig[]
  }
  export type DiversityReportEntry = GateReport & {
    slotId: string
    observed: DiversityObservation
  }
  export type AllGatesReport = {
    pass: boolean
    coverage: GateReport
    specificity: GateReport
    voiceBounds: GateReport
    simCoherence: GateReport
    determinism: GateReport
    diversity: DiversityReportEntry[]
  }
  export function runAllGates(
    template: CompositionalCardTemplate,
    config: AllGatesConfig,
  ): AllGatesReport
  ```
  Phase E will call this on generation output. The `diversity` field
  is a per-slot array because a template can declare diversity
  thresholds per slot (drinkOrder runs both `order_line` and
  `manner_note`). An unknown slot id surfaces as a
  `diversity_slot_not_found` violation rather than silently passing.
  Phase D wires it into the drinkOrder integration test.

- **`src/cards/compose/gates/index.ts`** — re-exports.

### Edits — framework type expansion

- **`src/cards/compose/types.ts`** — additive only:
  ```ts
  export type SlotClaimMode = 'flavor' | 'sim_backed'
  export type SlotSpec = {
    id: string
    role: string
    pool: SnippetPool
    optional?: boolean
    /** Per-slot word budget. Defaults to framework body cap (12). */
    wordBudget?: number
    /** Sim-coherence policy. Defaults to 'flavor' (no checkable claims). */
    claimMode?: SlotClaimMode
  }
  ```
  Both fields are optional, so no consumer needs updating.

- **`src/cards/templates/drinkOrder.ts`** — annotate the two existing slots
  (lines 65–73) with `wordBudget` + `claimMode: 'flavor'`. Behaviour
  unchanged; gate reads the new fields.

- **`src/cards/compose/index.ts`** — re-export the new gate surface
  + `SlotClaimMode`.

### New — fixtures and helpers

- **`tests/cards/compose/gates/fixtures.ts`** — intentionally-bad
  pool/template builders:
  - `noFallbackPool` — `order_line` pool stripped of `order_fallback_plain`.
  - `allFallbackPool` — only one snippet, `conditions: []`.
  - `overBudgetPool` — one snippet at 15 words.
  - `bannedNamePool` — a snippet text containing a planted regular display
    name (e.g. `"Krenn"`).
  - `unbackedHistoryPool` — a snippet text containing `"twice now"` with no
    `memoryPresent` / `repeatCount` condition.
  - `unbackedRoleClaimPool` — a snippet text containing `"your cook"` with
    no `hasNamedEntity` condition.
  - `simBackedMissingLookupPool` — a slot with `claimMode: 'sim_backed'`
    where a non-fallback snippet has only `voiceAxis` conditions (no
    state lookup).
  - `lowDiversityPool` — only the fallback + one conditioned snippet whose
    condition matches nothing in the sample.
  - `buildBadTemplate(slotOverride)` — wraps a bad pool in a minimal
    `CompositionalCardTemplate` so the per-template gates can run.

- **`tests/cards/compose/gates/samplers.ts`** — shared samplers:
  - `buildDeterminismSamples(count = 50)` — produces seeded `(seed, state)`
    pairs covering: neutral cast, one-axis-extreme, two-axis-extreme, each
    verbal tic. Uses `createInitialTavernState()` as the base; mutates a
    single regular's `castAttributes`.
  - `buildDiversitySampler(slotId, opts)` — returns a `DiversitySampler`
    that for sample `i` rolls a fresh `CastAttributes` via
    `createRegularCastAttributes({ rng: createRngStreams(`diversity-${i}`).regular_identity, ... })`,
    installs it on the first regular of a base state, and produces a
    `drink_order` seed targeting that regular with id `diversity-${i}`.
    Result: a 100-sample population drawn from the real `[-1,0,0,1]`
    distribution.
  - `representativeBannedNames(state)` — collects every regular and staff
    `name.display` from a state (for the sim-coherence default config).

### New — tests

- **`tests/cards/compose/gates/coverage.test.ts`**
  - Real `drinkOrder` template passes (`order_line` has
    `order_fallback_plain`; `manner_note` is optional and exempt).
  - `noFallbackPool` template fails with violation `{ slotId: 'order_line',
    reason: 'missing_unconditional_fallback' }`.
  - Optional slot with no fallback passes (manner_note structure).

- **`tests/cards/compose/gates/specificity.test.ts`**
  - Real `drinkOrder` `order_line` passes (1 fallback + 15 conditioned).
  - `allFallbackPool` fails with `reason: 'no_conditioned_snippet'`.
  - `noFallbackPool` fails with `reason: 'no_fallback'` (same root cause
    as coverage; both gates surface it because both bars must be cleared).

- **`tests/cards/compose/gates/voiceBounds.test.ts`**
  - Real `drinkOrder` passes — every `order_line` ≤ 12, every
    `manner_note` ≤ 10 (the locked Phase B budgets).
  - `overBudgetPool` fails with `reason: 'over_budget'`, detail naming the
    snippet id and word count.
  - `config.perSlot` override beats `slot.wordBudget` (set perSlot to 5 and
    confirm the real pool fails).
  - Default (no `wordBudget` on slot, no config) uses 12.

- **`tests/cards/compose/gates/simCoherence.test.ts`**
  - Real `drinkOrder` passes against
    `{ bannedDisplayNames: representativeBannedNames(createInitialTavernState()) }`.
  - `bannedNamePool` containing the literal `"Krenn"` fails with
    `reason: 'banned_display_name'`.
  - `unbackedHistoryPool` containing `"twice now"` without a backing
    condition fails with `reason: 'unbacked_history_claim'`.
  - Add `memoryPresent` to that snippet → gate passes.
  - `unbackedRoleClaimPool` containing `"your cook"` fails with
    `reason: 'unbacked_role_claim'`.
  - `simBackedMissingLookupPool` fails with
    `reason: 'sim_backed_missing_lookup'`.
  - Default-fallback snippets are exempt from the sim_backed lookup rule
    (specificity 0 snippets are the safety net).

- **`tests/cards/compose/gates/determinism.test.ts`**
  - Real `drinkOrder` over 50 samples: every render pair byte-equal; no
    state mutation. No bad fixture (assembler is structurally deterministic);
    comment explains why.

- **`tests/cards/compose/gates/diversity.test.ts`**
  - Real `orderLinePool` with the diversity sampler (100 samples) yields
    ≥ 6 distinct outputs. Records the observed count in a snapshot-style
    expectation comment so future drift is visible.
  - Real `mannerNotePool` (optional slot): yields ≥ 3 distinct *non-
    undefined* outputs across the same sample (Phase B doesn't lock this
    number; we set it to 3 — fallback + a few axis matches — and document
    the choice).
  - `lowDiversityPool` with the same sampler yields 1 distinct output;
    fails the `minDistinct: 6` config.

- **`tests/cards/compose/gates/runAllGates.test.ts`**
  - Integration: real `drinkOrderCard` template with all six gates
    configured passes `runAllGates`. Asserts `report.pass === true` and
    every sub-report's `pass === true`.
  - A template wrapping `overBudgetPool` returns `pass: false` and
    `report.voiceBounds.pass === false`, while the other gates report
    independently.

### Edits — tracker + roadmap

- **`docs/ISSUE_TRACKER.md`** —
  - Add row to index table:
    `| ISSUE-093 | Living Cast Phase D — six structural gates harness | thin | done | 124 |`
  - Add full entry under Tier 6, between ISSUE-092 and "Related notes",
    matching the shape of ISSUE-092 (Grade / Status / Phase /
    Implementation record / Evidence / Impact / Scope / Depends on /
    Test approach).
  - Update "Current work" §: after Tier 4 work, Tier 6 next-up is
    **Phase E** (the generation pipeline), unblocked by Phase D.

- **`CLAUDE.md`** — extend the "Phases 41–97 + 117–120" paragraph with a
  one-line Phase D done note (matches the Phase A / Phase C lines).

## Verification

| Check | How | Expected |
|---|---|---|
| Types | `npm run typecheck` | Clean. New `SlotSpec.wordBudget?` / `claimMode?` are additive optionals. |
| Gate unit tests | `npm test -- --run tests/cards/compose/gates/` | All pass. Each gate's bad fixture fails the expected violation; happy path passes for the real `drinkOrder` template. |
| Full regression | `npm test -- --run` | No regressions. Existing `templates.drinkOrder.test.ts`, `compose/conditions.test.ts`, `compose/assemble.test.ts`, Phase 121 cast tests, all card-layer tests stay green. |
| Phase B fidelity check | Inspect `drinkOrder.ts` after edits | `order_line` carries `wordBudget: 12, claimMode: 'flavor'`; `manner_note` carries `wordBudget: 10, claimMode: 'flavor'`. The Phase-B locked numbers now live in code, not just the doc. |
| Diversity observed | `tests/cards/compose/gates/diversity.test.ts` log/assert | Records the actual distinct-count observed for `order_line` across 100 samples; threshold is `>= 6` (Phase B's lock). Documents the observed count alongside the threshold so drift is visible. |

## Do not do

- **Do not build the generation pipeline.** Phase E's job. The gate library
  ships callable, but Phase D does not wire it to any CI / GitHub Action.
- **Do not add a `claims?: string[]` field to `Snippet`.** Phase D's
  structural sim-coherence (lexical + slot-level `claimMode`) catches
  Phase B's named negatives. Per-snippet claim metadata is a Phase E
  spec-layer concern.
- **Do not expand the DSL primitive set.** No OR / NOT / nesting; no new
  `SnippetCondition` kinds. Framework §9.
- **Do not migrate other templates.** The eight hand-written templates
  don't carry slots, so the gates are inapplicable. Phase F migrations
  bring them in one at a time.
- **Do not change `Phase A`'s attribute shape or roll order.** Diversity
  sampler uses `createRegularCastAttributes` exactly as it ships.
- **Do not introduce `Math.random()`.** Diversity sampler uses
  `createRngStreams` + `prando`; determinism sampler is fully seeded.
- **Do not over-fit the sim-coherence detectors.** Three default rules
  (display name, history claim, role claim) cover Phase B's negative
  examples; Phase E will refine with spec-driven claim lists.
- **Do not re-enable `sim_backed_hook`.** The slot still ships empty;
  Phase D gates apply only when a `claimMode: 'sim_backed'` slot has
  content, and the bad fixture is the only such case in Phase D's test
  bed.

## Expected loop

Phase E is the next phase. It calls `runAllGates` on generation output,
retries failed generations, dedupes near-duplicates, and emits committed
`SnippetPool` data via a GitHub Action. Phase D's gate library is the
exact surface Phase E imports — no redesign needed; the gates work on
plain `SnippetPool` and `CompositionalCardTemplate` data either coming
from the model or already committed.

If Phase E surfaces a concrete gap in the gates (e.g. a class of failure
the lexical sim-coherence detectors miss), the framework allows extending
the detector list; per-snippet claim metadata is the documented next
step. That's Phase E's loop, not Phase D's.
