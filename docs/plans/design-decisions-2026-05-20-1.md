# Design Decisions — Compositional Content & the Voiced Card Layer

**Conversation date:** 2026-05-20.
**Status:** Captured design record. It sits one level above the `docs/plans/` contracts and holds the *why* behind the card-composition framework and the Living Cast / Voiced Surface arcs. It is not itself a contract; where a contract disagrees, the contract wins.
**Informs:** [`card-composition-framework.md`](card-composition-framework.md), [`living-cast-arc.md`](living-cast-arc.md), [`voiced-surface-arc.md`](voiced-surface-arc.md).

Goblin Tavern is built simulation-first: the headless engine shipped before any card content. That left one open question this record answers — *how does authored content get onto the sim at scale, on a 1–2 hour/day mobile workflow, without drifting in voice or contradicting the sim?* Sections 9–10 carry the load; sections 3–8 are the supporting principles the framework and arcs cite by number.

---

## 1. What this document is

A condensed record of the architectural decisions that produced the compositional card layer. Read it before planning work in that layer; read the contracts it informs for the binding rules.

## 2. The reframe: under-surfaced, not over-built

The simulation isn't over-built — it's *under-surfaced*. Cards were always the plan for making the sim visible, and cards hadn't been authored at scale. Late binding of content to an evolving sim is correct strategy for **engine substrate** (save schemas, registries, projection plumbing) — that can be rewritten freely and never touches cards. It **weakens for content-shaped substrate**: the attributes and slot structures that determine what cards can *express*. Those are the vocabulary content is written in; get them wrong and content has to be rewritten. So: build the content-shaped substrate (character attributes, slot structure, condition language) deliberately and early, and treat snippet prose as the cheap, deepenable layer on top.

## 3. Graceful degradation

Every reference resolves or degrades — it never errors. A card that would name an entity it can't resolve (a regular who left, a faction not yet met) falls back to a less specific form rather than failing. This is what lets specific snippets reference rich state safely: when the state isn't there, a generic snippet wins and the card still renders. The framework's "`actorTrait` simply never matches" and "unresolvable `EntityLink` degrades" behaviours are both this rule.

## 4. Silence beats weak copy

An optional slot with nothing strong to say omits itself rather than emitting filler. A shorter card that says one true thing well beats a padded one. Optional slots are a feature, not a gap: they let a pool stay silent until a snippet genuinely earns its place.

## 5. Voice: where it lives

Three options were weighed:

- **Voice per snippet** — every line hand-tuned. Expensive; seams between authored lines show.
- **Voice per character via a render-time transform** — differentiation for free, but a transform system is non-trivial and easy to do badly. The trap.
- **Voice per template register, with character bias on selection** — snippets are authored within one register; character attributes decide *which* snippet is selected. **This is the decision**, with one extension the Living Cast arc added: a small fixed set of bounded **voice axes** on the character (`terseness`, `warmth`, `formality`, `floridity`, each `0–2`, plus an optional verbal tic) lets selection vary register too. That is still pure *selection of pre-authored lines* — never a machine transform. Character voice comes through in what they notice and which authored line fits them, not in rephrased prose.

## 6. Character depth is selection vocabulary, not bespoke prose

NPC depth felt missing — but the sim already has identity (stable names, persistent relationships). What was missing was *differentiating, selectable attributes*. The fix is a small, **bounded, fixed** attribute set — specialty, blindspot, one or two affinity axes, and the voice axes above — stored as state. The hard lesson, learned from an early demo: do **not** mint fresh open-ended tags per line (`fae_touched_wanderer`, `anti_mage`). At thousands of lines that is unselectable noise. Bounded, fixed axes are what make deterministic selection possible. Depth is the vocabulary; it is not the prose.

## 7. Tests are the quality gate, not human review

Because pools and conditions are data, quality is structural. Six gates stand in for review: **coverage** (every required slot has an unconditional fallback), **specificity-gradient** (no pool all-generic or all-specific), **voice-bounds** (length and register), **sim-coherence** (a snippet asserts only what its conditions guarantee present), **determinism** (same seed + state → same card), **diversity** (a pool of N yields ≥ M distinct cards across sampled state). A snippet that fails a gate is regenerated. The human reviews the spec and exemplars, not the output.

## 8. Determinism at runtime, variation at authoring

Runtime selection from a committed pool is deterministic — same seed + state → same card, every render — via a named RNG / FNV tie-break, matching the engine's "no `Math.random`, named streams for identity" rule. Variation lives at *authoring* time, not runtime. Pools are committed static data; the runtime only ever reads them.

## 9. Compositional content architecture

Cards are assembled, not written whole. A template declares a few typed **slots** (observer / observation / interpretation / aside …); each slot draws from a **snippet pool**; each snippet carries data **conditions**; the assembler picks the most specific snippet whose conditions hold. Three commitments make this scale:

- **Select whole snippets; do not concatenate fragments.** Concatenation incurs a permanent grammar tax — agreement, pronouns, punctuation — and rarely beats one well-written line. If a slot's space is so combinatorial it seems to need concatenation, that is a signal to split it into more slots or more cards. (This is exactly the rule the old fragment-dump cards violate when they glue `reliability 45` and `tight jaw` together.)
- **The specificity gradient.** A pool runs from a generic unconditional fallback up to highly specific conditioned lines, and the assembler always prefers the most specific that fires. Authoring a sharper line *later* enriches the card with zero structural change — every snippet is permanent value-add, never a rewrite — while dead snippets (conditions that stopped firing) are removed at leisure and fallbacks keep cards working. This is the answer to late binding: ship generic fallbacks first, deepen opportunistically.
- **A deliberately small condition DSL.** Roughly 8–15 primitives composing by implicit AND. Resist OR, NOT, and nesting until 100+ snippets exist and a concrete gap demands them. **Premature DSL expressiveness is the silent killer** of these systems — it turns every snippet into a code review.

The spectrum this picks a point on: pure template slot-filling (flat Mad Libs) → fully authored conditional cards (beautiful but unscalable, breaks on every new variable) → **structured snippet composition with authored variation** (the chosen middle). Slot structure is sim-shaped substrate — get it wrong and cards rewrite; get it right and thousands of snippets ride unchanged templates. Author the first template's slots by hand before building any tooling around them.

## 10. The generation strategy

The unit of authorship is the **generation specification**, not the snippet. A spec carries the slot structure, the conditions snippets must fire under, the voice register, length bounds, 3–5 hand-curated **exemplars** (the highest-leverage artifact — they anchor voice across a whole pool), and 2–3 negative examples (Mad-Libs flatness, voice drift, sim-incoherence). Snippets are produced against the spec and gated by §7; the author reviews the spec, never the lines.

Generation runs as a **Claude Code plan-mode phase run**: the author commits a spec, a Claude Code run authors the pool in-repo and iterates it to green against the gates, and the committed pool is read deterministically at runtime. *(An earlier build implemented generation as a model-via-API GitHub Action under `scripts/generate-pool/`; that form is deprecated in favour of phase runs. The spec-as-unit-of-authorship, the gates, and runtime determinism are all unchanged — only the generator moved.)* Before a spec is repeated at scale, hand-iterate **one** spec to convergence first (the Living Cast "spike"), so the format survives contact with reality before it is relied on.

---

**If you only remember one thing:** the unit of authorship is the generation spec — slots, gates, the gradient, and determinism all fall out of that, and the prose is the cheap layer that deepens forever on top.
