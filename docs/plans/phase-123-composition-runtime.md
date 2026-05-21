# Phase 123 — Composition Runtime (Living Cast arc, Phase C)

> Implements Phase C of [`living-cast-arc.md`](./living-cast-arc.md).
> Tracker entry: `ISSUE-092` in
> [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md).
> Locked contracts honoured:
> [`card-composition-framework.md §2–3, §5, §8`](./card-composition-framework.md),
> [`cards-contract.md §6`](./cards-contract.md),
> [`living-cast-arc-phase-b.md`](./living-cast-arc-phase-b.md)
> (the spec + pool this phase wires through the runtime).

## Context — why this change

The Living Cast arc gives every character a recognizable voice without
hand-writing dialogue. Phase A (ISSUE-090, phase 121) shipped the
*selection vocabulary* — bounded `CastAttributes` on staff and regulars.
Phase B converged a `drink_order` template + snippet pool by hand, and
fed back two structural findings: (1) Phase A stores voice as
**structured scalars** (`CastAttributes.voice.axes[axis] ∈ {0,1,2}` +
optional `verbalTic` id), not flat trait strings, so the framework's
`actorTrait` condition cannot match voice via exact-string equality;
(2) the assembled pool needs a **single-axis middle rung** because two-
extreme conditions are too rare given the `[-1,0,0,1]` perturbation.

Phase C builds the bottom half the framework specifies — the
**compositional runtime**: snippet types, eleven data conditions plus
the two Phase-B condition forms, the deterministic slot assembler, and
the `defineCompositionalCard` factory. It then wires the Phase-B
`drink_order` template through the assembler as the **first live
compositional card**, so a real seed renders a composed `CardView`
in-game alongside the eight existing hand-written templates.

This is the only phase where these pipes get wired; Phase D adds the
six structural test gates, Phase E adds the generation pipeline, Phase F
scales out across situations and voices.

## Locked decisions

| Question | Decision |
|---|---|
| Where does the compose slice live? | New folder `src/cards/compose/` (mirrors framework appendix). One file per concern: `types.ts`, `conditions.ts`, `assemble.ts`, `defineCompositionalCard.ts`, plus `pools/drinkOrder/<slot>.ts` for committed pool data. |
| Which seed does `drink_order` ride? | `regular_customer` family, `relationship_test` type, `during_service` timing. **No card currently covers `regular_customer/relationship_test`** — it falls through to fallback today (verified in `src/sim/modules/issues/expandedSeedGenerators.ts:1063–1120`; only `customerComplaintCard` covers the sibling `complaint` type at higher irritation). No new seed family, no new emitter, no priority fight. `primaryActor` is already a regular ref. |
| Two new SnippetConditions for voice | Add `{ kind: 'voiceAxis', role, axis, atLeast }`, the `atMost` variant, and `{ kind: 'verbalTic', role, tic }`. These are the Phase-B bridge for structured-scalar voice; `actorTrait` exact-string is **rejected** because two-extreme snippets become unreachably rare under Phase A's distribution. Keep `actorTrait` declared in the union as a forward seam (framework §5) — it just never matches today since no actor carries a `trait: string` field. |
| Is this DSL expansion? | No — the arc doc's "don't add DSL primitives beyond the eleven" guards against OR/NOT/nesting (framework §2.3, §9). The two new forms are flat, inspectable, generatable, enumerable leaf conditions. Phase B settled this. |
| `VoiceRegisterId` representation | Plain string type alias. No registry — content discovered by authoring per framework §9. Phase B's only register is `'tavern_floor'`. |
| FNV-1a helper | Extract to shared `src/sim/utils/fnv.ts` (alongside `clamp.ts`, `ids.ts`, `math.ts`, `object.ts`). `src/sim/content/text/descriptors.ts` and `src/cards/voice/composer.ts` both import the same function. The new compose slice imports it too. |
| `sim_backed_hook` slot | **DISABLED for spike, ships empty.** Phase B verified the sim does not emit `repeatCount`/`subjectTag` tracking and `stock_shortage` pressure id is unconfirmed. Wiring the design-intent snippets now would create dead pool entries or assert unbacked facts. Re-enable per-snippet only after backing signals exist. |
| Migration / state changes | **None.** Phase C is pure card-layer; no `TavernState` change, no Zod regen. Phase A already shipped the readable fields. |

## The two new conditions (Phase B bridge)

```ts
// Reads state.<staff|world.regulars>[ref.id].castAttributes.voice.axes[axis]
// for the resolved actor. Gracefully returns false if the actor or
// castAttributes is missing (framework §5 forward-seam pattern).
| { kind: 'voiceAxis'; role: string; axis: VoiceAxisId; atLeast: VoiceAxisValue }
| { kind: 'voiceAxis'; role: string; axis: VoiceAxisId; atMost: VoiceAxisValue }
// Reads CastAttributes.voice.verbalTic for the resolved actor.
| { kind: 'verbalTic'; role: string; tic: VerbalTicId }
```

Actor resolution: `role: 'primaryActor'` reads `seed.primaryActor`;
named-entity roles (e.g. `'complainant'`) match
`seed.textIngredients.namedEntities[].role` and resolve via the same
`EntityRef`. Lookup table by `EntityRef.kind` (matches the precedent in
`src/cards/templates/staffRequest.ts:30–31` and `customerComplaint.ts:32–35`):

```ts
staff    -> state.staff[ref.id]?.castAttributes
regular  -> state.world.regulars[ref.id]?.castAttributes
// every other kind -> undefined (no cast attributes elsewhere yet)
```

Per framework §5, an unresolvable actor or missing `castAttributes`
makes the condition return `false` silently — no errors, just lower-
specificity snippets win.

## Files

### New — compose slice

- **`src/cards/compose/types.ts`** — `Snippet`, `SnippetPool`,
  `SnippetCondition` (the eleven framework primitives + the two
  Phase-B forms), `SlotSpec`, `CompositionalCardTemplate`,
  `FilledSlots`, `VoiceRegisterId` (plain string alias). Re-exports
  `VoiceAxisId`, `VoiceAxisValue`, `VerbalTicId` from
  `src/sim/content/cast/` so consumers import one place.
- **`src/cards/compose/conditions.ts`** — `evalCondition(c, seed, state)`.
  One small function per `kind`; the `voiceAxis`/`verbalTic` arms call
  a private `resolveActorCastAttributes(role, seed, state)` helper.
  Pure, no closures stored anywhere.
- **`src/cards/compose/assemble.ts`** — `assembleSlots(slots, seed, state)`,
  `pickSnippet(slot, seed, state)`, `specificityOf(snippet)`. Tie-break
  via shared FNV helper, keyed by `${seed.id}::${slot.id}`.
- **`src/cards/compose/defineCompositionalCard.ts`** — the factory.
  Wraps a `CompositionalCardTemplate` into a `CardDefinition` so the
  existing `cardRegistry`, `pickCard`, and `CardRenderer` do not learn
  this layer exists.
- **`src/cards/compose/index.ts`** — re-export surface.
- **`src/cards/compose/pools/drinkOrder/orderLine.ts`** — the committed
  `SnippetPool` for the `order_line` slot. 17 snippets verbatim from
  Phase B (`living-cast-arc-phase-b.md` "Candidate snippet pool" §):
  fallback + 5 single-axis (middle rung) + 5 two-axis (top rung) +
  7 verbal-tic. Conditions written in the new `voiceAxis`/`verbalTic`
  forms.
- **`src/cards/compose/pools/drinkOrder/mannerNote.ts`** — the
  committed `SnippetPool` for `manner_note`. 5 snippets verbatim from
  Phase B. Optional slot — empty result is permitted.
- **`src/cards/compose/pools/drinkOrder/index.ts`** — slot manifest.

### New — the template

- **`src/cards/templates/drinkOrder.ts`** — declares the
  `CompositionalCardTemplate`:
  - `id: 'regular_customer.drink_order'` (family.situation, matches
    existing template id convention).
  - `appliesTo: { seedFamilies: ['regular_customer'], seedTypes: ['relationship_test'], timings: ['during_service'], custom }`.
    `custom` returns `false` unless `seed.primaryActor?.kind === 'regular'`
    AND that regular has `castAttributes` populated (graceful no-op
    when Phase A migration hasn't reached an older save).
  - `priority: 60` — below crisis/complaint, above fallback. No
    overlap with `customerComplaintCard` (`complaint` type only).
  - `voiceRegister: 'tavern_floor'`.
  - `slots`: `order_line` (required) + `manner_note` (optional).
  - `toCardView`: the `order_line` snippet is body-budget (12 words
    per Phase B), so it lands as `body[0]` — NOT in the title. Title
    is `${regular.name.display}: orders a drink` formatted via
    existing `formatTitle` (6-word cap). `body[1]` is the optional
    `manner_note` snippet when present; `body[2]` is the seed's
    `recentContext[0]` for grounding. `stakes` and `choices`
    projected from the seed via `buildStakes` + `buildChoicesFromSeed`
    (existing `src/cards/cardHelpers.ts` — same helpers all hand-
    written templates use). `severity` and `tag` set via
    `makeCardView`'s family-tag path.

The template is wrapped via `defineCompositionalCard(...)` and exported
as the existing `CardDefinition` so `REQUIRED_CARDS` treats it
identically.

### Edits — wiring

- **`src/cards/templates/index.ts`** — import `drinkOrderCard`; add
  it to `REQUIRED_CARDS` (anywhere before `fallbackCard`); re-export.
- **`src/cards/index.ts`** — re-export `drinkOrderCard` and the
  compose-slice public types (matches existing template-export
  pattern).
- **`src/sim/utils/fnv.ts`** — NEW. Single shared `fnvIndex(key, modulo)`
  implementation. Other slices import from here.
- **`src/sim/content/text/descriptors.ts`** — remove the inline FNV
  (lines 75–83); import from `../../utils/fnv`. Behaviour identical;
  determinism gates already in place via descriptor pool tests.
- **`src/cards/voice/composer.ts`** — remove the inline FNV
  (lines 36–44); import from `../../sim/utils/fnv`. `__internal.fnvIndex`
  export kept as a re-export so existing tests (`tests/cards/voice/`)
  stay green without edits.

### New — tests

- **`tests/cards/compose/conditions.test.ts`** — unit tests for
  `evalCondition`:
  - Each of the eleven framework primitives — one positive + one
    negative case per kind, using `makeSeed` from
    `tests/cards/cardFactories.ts` and `makeTavernState` from
    `src/sim/testing/stateFactories.ts`.
  - `voiceAxis atLeast` / `atMost` — positive on a regular with the
    matching axis value; negative when the axis is below threshold;
    `false` when the regular has no `castAttributes`; `false` when
    `primaryActor` is missing.
  - `verbalTic` — positive when actor's `voice.verbalTic` matches;
    negative when no tic; negative when wrong tic.
  - `actorTrait` (forward seam) — always `false` today; documents the
    seam doesn't fire and that's intentional.

- **`tests/cards/compose/assemble.test.ts`** — assembler properties:
  - **Determinism**: same `(seed, state)` returns same `FilledSlots`
    across 10 invocations.
  - **Tie-break stability**: a synthetic pool with two
    equal-specificity matches resolves to the same one across
    `structuredClone(state)`.
  - **Graceful degradation**: when no condition matches a required
    slot, the unconditional fallback wins (zero specificity).
  - **Optional-slot omission**: when an optional slot has no matching
    snippet, `pickSnippet` returns `undefined`; `toCardView` omits it.
  - **Specificity ordering**: among three matching snippets with
    specificities `0, 1, 2`, the `2` wins.

- **`tests/cards/templates.drinkOrder.test.ts`** — live integration:
  - Build a `TavernState` with a regular that has cast attributes
    (use `createInitialTavernState()` — Phase A already populates
    day-one regulars via `createRegularCastAttributes`); build a
    minimal `regular_customer/relationship_test/during_service` seed
    via `makeSeed` with `primaryActor: regularRef(id)`.
  - `pickCard(seed, state)` returns `drinkOrderCard` (not the fallback
    or `customerComplaintCard`).
  - `render(seed, state)` returns a `CardView` whose `title` is one
    of the 17 `order_line` snippet texts (clamped to title budget),
    `body[0]` is either a manner-note snippet or projected ingredient,
    `choices` are non-empty and verbs are in `seed.responseSlots[*].allowedVerbs`,
    `tag` is `'regular_customer/relationship_test'`.
  - **Determinism**: re-rendering with `structuredClone(state)` yields
    a byte-identical `CardView`.
  - **Graceful degradation**: rendering with `castAttributes`
    deleted from the regular produces the unconditional-fallback
    snippet (`order_fallback_plain`), `manner_note` omitted, and
    `pickCard` still returns `drinkOrderCard` only if the `custom`
    predicate gates on castAttributes presence — assert the predicate
    rejects the cast-less actor and `pickCard` falls through to a
    different card (likely fallback). This proves the seam fails
    *safe*: no broken card, just demotion.
  - **No state mutation**: `render(seed, structuredClone(state))`
    leaves the clone byte-equal to the original.

### Tracker

- **`docs/ISSUE_TRACKER.md`** — add `ISSUE-092` (Tier 6, Phase C,
  status `done` on close), index row, "Current work" pointer.
  Implementation record: this plan file → `docs/plans/phase-123-composition-runtime.md`
  on commit (rename from the plan-mode draft).

## The toCardView shape (worked example)

For a `regular_customer/relationship_test` seed where the regular's
`voice.axes.terseness === 2` and `voice.axes.warmth === 0`:

```
order_line pool candidates (matches only):
  order_fallback_plain     (spec 0)  "An ale, please. Whatever the house recommends."
  order_terse              (spec 1)  "Ale. The usual size."
  order_cold               (spec 1)  "An ale. That's all."
  order_terse_cold         (spec 2)  "Ale. Cold. No speech with it."
→ winner: order_terse_cold (highest specificity, unique)

manner_note pool candidates (matches only):
  manner_cold_coin         (spec 2)  "They tap two coins once."
→ winner: manner_cold_coin

toCardView output (snippet text is body-budget, not title-budget):
  title:   "<RegularName>: orders a drink"     // formatTitle, 6-word cap
  body:    [
             "Ale. Cold. No speech with it.",  // order_line winner
             "They tap two coins once.",       // manner_note winner
             <seed.textIngredients.recentContext[0]?>  // grounding line
           ]
  stakes:  buildStakes(seed, 2)         // straight projection
  choices: buildChoicesFromSeed(seed)   // existing helper
  tag:     familyTag(seed)              // "regular_customer"
  severity: seed.severity
```

If the regular has no extreme axes, the order_line fallback fires:
`"An ale, please. Whatever the house recommends."` lands as `body[0]`
and `manner_note` is omitted — no error, no missing data, the card
still renders.

## Verification

| Check | How | Expected |
|---|---|---|
| Types | `npm run typecheck` | Clean. |
| Compose unit tests | `npm test -- --run tests/cards/compose/` | All pass. |
| Drink-order integration | `npm test -- --run tests/cards/templates.drinkOrder.test.ts` | All pass. |
| Full regression | `npm test -- --run` | No regressions; existing `tests/cards/templates.test.ts`, `templates.voice.test.ts`, `registry.test.ts`, `intentRoundtrip.test.ts`, Phase 121 cast tests, descriptor-pool tests all green. The FNV extraction is identity-preserving — descriptor and composer determinism gates already cover this. |
| Live in-game | Run the web app (`npm run dev`), advance days until a `regular_customer/relationship_test/during_service` seed fires (irritation ≤ 60, see expandedSeedGenerators.ts:1066). Card title should read as one of the Phase-B `order_line` snippets in voice, not as the generic fallback prose. |

## Do not do

- **Do not migrate any of the other eight templates.** REQUIRED_CARDS
  holds the new compositional card next to the hand-written eight,
  unchanged. (Framework §2.5: "the migration path is per-template and
  non-breaking.")
- **Do not add DSL primitives beyond the eleven + two.** Specifically
  no OR / NOT / nesting, no new state-shape conditions. Phase D adds
  test gates; Phase E adds the generation pipeline.
- **Do not wire `sim_backed_hook`.** Slot stays empty until backing
  signals are verified — Phase B settled this.
- **Do not redesign the Phase-B spec.** Pool data is committed
  verbatim from `living-cast-arc-phase-b.md`.
- **Do not change Phase A's attribute shape** — it is roll-order
  locked. Phase C only *reads* `CastAttributes`.
- **Do not build a `voiceRegisterRegistry` or any auto-tooling.**
  Plain string alias only.
- **Do not introduce `Math.random()`** anywhere in the new code.
  Determinism stays via the shared FNV tie-break.
- **Do not mutate state in `render`** — assembler and template
  remain pure over `(seed, state)`.

## Expected loop

Phase D (test harness) is the next phase. It will exercise the six
structural gates against the committed pools — coverage,
specificity-gradient, voice-bounds, sim-coherence, determinism,
diversity. The pool shape here is already designed for those gates
(Phase B's gradient rung, voice-bounds budgets, sim-coherence-by-
empty-sim_backed_hook), so the loop is expected to be ratification,
not rework.

If a Phase-D gate finds a missing snippet, it goes through the
generation pipeline (Phase E), not back to Phase C.
