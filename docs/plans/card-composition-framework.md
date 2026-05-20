# Card Composition Framework — Slots, Snippets, and Deterministic Assembly

**Status:** Draft framework contract. Not yet committed.
**Sits below:** [`cards-contract.md`](cards-contract.md) (LOCKED).
**Resolves:** `cards-contract.md §9` open question "Tone/presentation pipeline."
**Amends:** `cards-contract.md §5 rule 5` (descriptor pools as the primary flavour source).
**Companion to:** `design-decisions-2026-05-20.md §9–10` (compositional content + model-authored pipeline).

---

## 0. What this document is, and is not

`cards-contract.md` defines the **top half** of the card layer and that half is built and shipped:

- The simulation emits an `IssueSeed` (the truth a card reveals).
- A `CardDefinition` declares `appliesTo` + a `render(seed, state) → CardView`.
- `pickCard` selects one definition per seed by `priority → specificity → id`, with a guaranteed fallback.
- `CardRenderer.svelte` paints the `CardView` in the Day beats (morning / service / closing).

None of that changes. This document defines the **bottom half** — what happens *inside* `render()`. Today `render()` is thin: it glues `seed.textIngredients` together and sprinkles ≤4-word adjectives from `voice/tonePools.ts`. That is the "pure template slot-filling" end of the spectrum (`design-decisions §9`) — Mad Libs with flavour. This framework replaces the content role of that thin composer with a **compositional snippet layer**: typed slots, condition-gated authored snippets, a specificity gradient, and deterministic assembly.

This document defines the **moving parts at the base**. It does **not** author any templates, snippet pools, voice registers, exemplars, or the generation pipeline. Those grow up from this base in later work. Where the design-decisions doc warns against building tooling around an unvalidated structure, this contract holds the structure still and stops there.

---

## 1. The layer stack

Bottom to top. Everything from `IssueSeed` up already exists; everything inside `render()` is what this framework specifies.

```
  CardRenderer.svelte         ── paints CardView in the Day beats          [EXISTS]
        ▲
  CardView                    ── { title, body[], stakes[], choices[] }    [EXISTS]
        ▲
  render(seed, state)         ── one per template; pure                    [EXISTS, thin]
        │  ┌──────────────────────────────────────────────────────────┐
        │  │  assembleSlots(slots, seed, state) → FilledSlots          │  ← THIS DOC
        │  │      per slot: pick highest-specificity snippet           │
        │  │      whose conditions hold; deterministic tie-break       │
        │  └──────────────────────────────────────────────────────────┘
        ▲
  SnippetPool[]               ── committed data; the only place prose lives [GENERATED]
        ▲
  IssueSeed + TavernState     ── the truth; read-only                       [EXISTS]
```

The single rule that makes the whole stack safe: **the assembler chooses among ways to *say* what the seed already knows. It never adds a fact the seed and state don't already carry.** This is `cards-contract.md §1` ("compose, don't invent") pushed down into the snippet layer.

---

## 2. New types

These are the only new types the framework introduces. They live in a new slice (proposed `src/cards/compose/`) so the registry, selection, and template files stay where they are.

### 2.1 Snippet — the unit of authored prose

```ts
export type Snippet = {
  /** Stable id, unique within its pool. Used in the deterministic tie-break key. */
  id: string
  /** The authored prose. THIS IS THE ONLY PLACE CARD PROSE LIVES. */
  text: string
  /** Conditions, combined by implicit AND. Empty array = unconditional fallback. */
  conditions: SnippetCondition[]
  /**
   * Optional explicit specificity override. When omitted, specificity is
   * derived as `conditions.length`. Override only when a single condition
   * is genuinely more specific than its count implies (rare; document why).
   */
  specificity?: number
}
```

Authoring note: every `text` must fit the field it lands in (§4). Snippets are complete lines, never fragments to be concatenated (`design-decisions §9`, "selection not concatenation").

### 2.2 SnippetPool — the candidates for one slot

```ts
export type SnippetPool = {
  slotId: string
  /**
   * Candidate snippets. A pool feeding a REQUIRED slot must contain at least
   * one snippet with `conditions: []` (the generic fallback). A pool feeding
   * an OPTIONAL slot may legitimately produce nothing. Enforced by the
   * coverage test (§6).
   */
  snippets: Snippet[]
}
```

Pools are **committed static data**. They are generated against a spec (`design-decisions §10`) but, once committed, the runtime reads them as plain data. The framework neither knows nor cares whether a human or the model wrote them.

### 2.3 SnippetCondition — the small declarative DSL

Conditions are **data, not closures.** This is load-bearing: data conditions can be inspected by the generation pipeline, enumerated by coverage tests, and sampled by diversity tests. A closure (`(seed, state) => boolean`) could do none of those and would make the pool ungeneratable and untestable.

The v1 primitive set — deliberately small (`design-decisions §9`, "premature DSL expressiveness is the silent killer"). Implicit AND across the array. **No OR, no NOT, no nesting** until 100+ snippets exist and concrete gaps demand them.

```ts
export type SnippetCondition =
  // — seed shape —
  | { kind: 'seedFamily';      anyOf: IssueSeedFamilyId[] }
  | { kind: 'seedType';        anyOf: IssueSeedType[] }
  | { kind: 'timing';          anyOf: IssueSeedTiming[] }
  | { kind: 'severityAtLeast'; value: number }
  | { kind: 'severityBelow';   value: number }
  | { kind: 'hasTag';          tag: string }   // matches seed.domain ∪ toneHints ∪ stake tags
  // — entities present in the seed —
  | { kind: 'hasNamedEntity';  role?: string; entityKind?: EntityRefKind }
  // — state lookups (read-only) —
  | { kind: 'pressureRising';  pressureId: string }
  | { kind: 'memoryPresent';   tag?: string }
  | { kind: 'repeatCount';     subjectTag: string; atLeast: number } // the "third week running" gradient
  // — Character Depth seam (§5) —
  | { kind: 'actorTrait';      role: string; trait: string }
```

Eleven primitives. Each is trivially evaluable against `(seed, state)` and trivially inspectable as data.

### 2.4 SlotSpec and the template

A slot is a named position in a card. Slot roles (observer / observation / interpretation / aside) are **advisory labels**, not a fixed global enum — different templates declare different slots.

```ts
export type SlotSpec = {
  id: string                 // unique within the template
  role: string               // advisory: 'observer' | 'observation' | 'interpretation' | 'aside' | …
  pool: SnippetPool
  /** When true, an empty result omits the slot rather than forcing a fallback.
   *  Silence beats weak copy (design-decisions §4). */
  optional?: boolean
}

export type CompositionalCardTemplate = {
  id: string
  appliesTo: CardAppliesTo          // UNCHANGED — card-vs-card selection (cards-contract §6)
  priority?: number
  /** Exactly ONE voice register per template. This is "the right voices." (§5) */
  voiceRegister: VoiceRegisterId
  slots: SlotSpec[]
  /** Small, mechanical mapping of filled slots → CardView. No prose here —
   *  prose came from the snippets; this just places it. */
  toCardView: (filled: FilledSlots, seed: IssueSeed, state: TavernState) => CardView
}

export type FilledSlots = Record<string /* slotId */, string | undefined>
```

### 2.5 The factory — how a template becomes a `CardDefinition`

The registry and selection layers never learn that compositional cards exist. A factory wraps a template into the existing `CardDefinition` shape:

```ts
export function defineCompositionalCard(
  template: CompositionalCardTemplate,
): CardDefinition {
  return {
    id: template.id,
    appliesTo: template.appliesTo,
    priority: template.priority,
    toneHints: [template.voiceRegister],
    render: (seed, state) => {
      const filled = assembleSlots(template.slots, seed, state)
      return template.toCardView(filled, seed, state)
    },
  }
}
```

So the migration path is per-template and non-breaking: a template either ships the old hand-written `render` or is authored as a `CompositionalCardTemplate` and passed through `defineCompositionalCard`. `REQUIRED_CARDS` can hold a mix during migration.

---

## 3. The assembler

```ts
export function assembleSlots(
  slots: readonly SlotSpec[],
  seed: IssueSeed,
  state: TavernState,
): FilledSlots {
  const out: FilledSlots = {}
  for (const slot of slots) {
    out[slot.id] = pickSnippet(slot, seed, state)
  }
  return out
}

function pickSnippet(
  slot: SlotSpec,
  seed: IssueSeed,
  state: TavernState,
): string | undefined {
  const matches = slot.pool.snippets.filter((s) =>
    s.conditions.every((c) => evalCondition(c, seed, state)),
  )
  if (matches.length === 0) return undefined        // optional slot → omitted by toCardView
  const maxSpec = Math.max(...matches.map(specificityOf))
  const top = matches.filter((s) => specificityOf(s) === maxSpec)
  if (top.length === 1) return top[0].text
  // Deterministic tie-break among equally-specific snippets: stable pseudo-
  // random by FNV-1a hash, matching the precedent in voice/composer.ts and
  // descriptors.ts. Same seed + slot ⇒ same pick, every re-render.
  const idx = fnvIndex(`${seed.id}::${slot.id}`, top.length)
  return top[idx].text
}

const specificityOf = (s: Snippet) => s.specificity ?? s.conditions.length
```

Three properties fall out of this, and they are the properties that make the system scale:

1. **A required pool always resolves** — its unconditional fallback (`conditions: []`, specificity 0) matches everything, so there is always at least one candidate.
2. **More specific always wins** — the `maxSpec` filter means a snippet gated on three conditions beats the generic fallback whenever its conditions hold. Authoring a more specific snippet *later* enriches the card with **zero structural change** (`design-decisions §9`, the specificity gradient).
3. **Determinism** — equal-specificity ties resolve by hashed key, never `Math.random`. Satisfies `cards-contract.md §5 rule 10` and the engine-wide "named streams / stable keys for identity" rule.

---

## 4. Budgets and reconciliation with the locked contract

Snippet `text` lands in `CardView.title` / `CardView.body`, so it inherits the existing caps (from `voice/composer.ts` and `TEXT_INGREDIENT_LIMITS` in `cards-contract.md §3.3`):

- Title: ≤ 6 words.
- Body: ≤ 3 lines, ≤ 12 words per line.
- A snippet feeding a title slot is authored to fit a title; one feeding a body line is authored to fit a body line. The voice test (§6) enforces this cheaply.

What this framework keeps from `cards-contract.md §5`, unchanged:

- **Rule 1 (read only), 7 (skip invalid seeds), 8 (no side effects), 9 (no card without a seed), 10 (stable re-render)** — fully preserved. The assembler is pure over `(seed, state)`.
- **Rule 2 (reference by id), 4 (compose, don't invent)** — pushed *into* snippet authoring: a snippet may only state facts its conditions guarantee are present. "Krenn's been here for years" requires a condition establishing Krenn is a long-tenured regular; otherwise it is an invented fact and the sim-coherence test (§6) rejects it.
- **Rule 6 (no `Math.random`)** — the assembler's tie-break uses the FNV helper, the established precedent.

What this framework changes:

- **Rule 5 (descriptor pools for flavour adjectives)** is demoted from *primary composition mechanism* to *one tool a snippet author may use*. The primary unit of prose is now the authored snippet. `voice/tonePools.ts` and the adjective-gluing in `voice/composer.ts` become **legacy** — retained for not-yet-migrated templates, deleted per-template as each migrates to a `CompositionalCardTemplate`. The composer's *deterministic-pick concept* survives intact; it has simply moved into the assembler and now picks whole authored lines instead of 4-word adjectives.

---

## 5. The Character Depth seam

The `actorTrait` condition is defined now and is a deliberate **forward seam** for the Character Depth arc (`design-decisions §6`). Until NPC depth lands, no actor carries traits, so `actorTrait` conditions simply never match — the snippet that needs them falls out of contention and a less-specific snippet wins. No errors, no warnings, graceful degradation, exactly like the `EntityLink`-for-unresolvable-entity rule (`design-decisions §3`).

This is the cheap, correct way to honour the design-decisions insight that character depth is **selection vocabulary, not bespoke prose**: when traits exist, trait-gated snippets become reachable and the same templates get sharper for free. We are not authoring trait prose; we are reserving the condition that will select it.

---

## 6. The tests the framework enables

Because pools are data and conditions are data, the quality gate is structural, not human review (`design-decisions §10`). Each maps directly onto the shapes above:

- **Coverage** — every required slot's pool contains an unconditional fallback; the assembler can never fail to fill a required slot.
- **Specificity gradient** — no required pool is all-fallback (functionally flat) and none is all-specific (no safety net). At least one generic + at least one conditioned.
- **Voice bounds** — every snippet's `text` fits its slot's word/line budget and stays within the template's register (cheap regex / word-count checks).
- **Sim-coherence** — every fact a snippet asserts is guaranteed by its conditions. Catches "your dwarf cook noticed" with no condition requiring a dwarf cook.
- **Determinism** — `render(seed, structuredClone(state))` equals `render(seed, state)`; same seed + slot ⇒ same tie-break pick.
- **Diversity** — a pool of size N produces ≥ M distinct cards across a sampled state range. Catches pools that are technically full but read repetitively.

A snippet failing any of these is regenerated; the human reviews the **spec and exemplars**, not the snippet. That is the scale story, and it is only possible because every type above is plain, inspectable data.

---

## 7. How the generation pipeline plugs in (reference only — not built here)

Per `design-decisions §10`, the unit of authorship is the **generation specification**, not the snippet. The framework's job is only to guarantee the three properties a generator and its tests require, and it does:

1. **Pools are plain committed data** — generable, diffable, reviewable as PRs.
2. **Conditions are data** — the generator can be told exactly which conditions a slot's snippets must fire under, and tests can enumerate the condition space.
3. **Selection is deterministic** — generation is non-deterministic at build time; runtime selection from the committed pool is stable.

A generation spec for a slot therefore carries: the slot, the conditions its snippets must satisfy, the template's voice register, length bounds, 3–5 **exemplars**, 2–3 **negative examples**, and the test suite that gates output. The pipeline that runs specs → generates → tests → dedupes → commits is **explicitly out of scope here** and must not be built until one spec has been hand-iterated to convergence (`design-decisions §10`, "write one generation spec by hand … *then* build the pipeline").

---

## 8. Worked example — a complaint, traced end to end

Seed: `family: 'customer_complaint'`, `type: 'complaint'`, `timing: 'during_service'`, a `namedEntities` entry `{ role: 'complainant', kind: 'regular', id: 'reg_krenn' }`, `problemNoun: 'the ale'`. State holds `regulars['reg_krenn'].name.display === 'Krenn'` and a memory tagged `ale_complaint` from two weeks running.

Template `complaint.during_service` declares three slots (`observer`, `observation`, `interpretation`) and a tiny `toCardView` that maps observer+observation → title, interpretation → body line, and projects `seed.stakes` and `seed.responseSlots` straight through (those are not snippet-driven — choices come from the seed).

Assembly, per slot:

- **observer** pool. Fallback `{ text: 'A patron', conditions: [] }` (spec 0) vs `{ text: 'Krenn', conditions: [hasNamedEntity{role:'complainant', entityKind:'regular'}] }` (spec 1). The named-entity condition holds → **"Krenn"** wins. (`toCardView` resolves the actual display name by id; the snippet establishes *that a named regular is the observer*, not the literal string — `cards-contract.md §5 rule 2`.)
- **observation** pool. Fallback `{ text: 'is unhappy with the ale', conditions: [] }` vs `{ text: "says the ale's gone flat", conditions: [seedFamily{anyOf:['customer_complaint']}, hasTag{tag:'stock_quality'}] }`. If the seed carries the `stock_quality` tag → the specific line wins.
- **interpretation** pool (optional). Fallback `{ text: "He's not pleased.", conditions: [] }` vs `{ text: "That's twice now — he's the sort who talks.", conditions: [repeatCount{subjectTag:'ale_complaint', atLeast:2}, memoryPresent{tag:'ale_complaint'}] }` (spec 2). Both conditions hold → the **specific** interpretation wins.

Result `CardView`: title *"Krenn says the ale's gone flat"*, body *"That's twice now — he's the sort who talks."*, stakes and choices straight from the seed. Drop the repeat history and the interpretation degrades gracefully to *"He's not pleased."* — same template, same slots, no structural change. Add `actorTrait` snippets later (Krenn `trait: 'proud'`) and a sharper line becomes reachable for free.

---

## 9. What this contract deliberately does NOT decide

Held open on purpose, to avoid building substrate on an unvalidated shape (`design-decisions §9–10`):

- **The slot taxonomy per template.** observer/observation/interpretation/aside is a starting vocabulary, not a locked schema. The first hand-iterated template decides its real slots.
- **The voice register list.** One register per template is the rule; *which* registers exist is content, discovered by authoring.
- **Exemplars and negative examples.** These are the highest-leverage artifacts and are written during the generation-spec step, not here.
- **The generation pipeline and any authoring tool.** Out of scope until one spec survives contact with reality.
- **DSL expansion.** The eleven v1 primitives stay frozen until 100+ snippets surface a concrete, named gap. OR/NOT/nesting are not added speculatively.

---

## Appendix: files this framework adds or touches

- **Adds** (proposed `src/cards/compose/`): `types.ts` (`Snippet`, `SnippetPool`, `SnippetCondition`, `SlotSpec`, `CompositionalCardTemplate`, `FilledSlots`), `conditions.ts` (`evalCondition`), `assemble.ts` (`assembleSlots`, `pickSnippet`, `specificityOf`), `defineCompositionalCard.ts`.
- **Reuses unchanged:** `src/cards/registry.ts`, `src/cards/selection.ts`, `src/cards/types.ts` (`CardDefinition`, `CardView`, `CardChoice`), `web/src/lib/cards/CardRenderer.svelte`.
- **Demotes to legacy (per-template removal during migration):** `src/cards/voice/tonePools.ts`, the adjective-gluing path in `src/cards/voice/composer.ts`. The FNV helper is retained.
- **Static committed data (generated):** `src/cards/compose/pools/<template-id>/<slot-id>.ts` — one committed `SnippetPool` per slot.
