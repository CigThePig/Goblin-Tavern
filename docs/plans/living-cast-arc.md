# The Living Cast Arc — Character Depth → Voiced Cards at Scale

**The centerpiece.** This arc makes each character feel unique — not by hand-writing dialogue, but by giving characters bounded attributes, then generating per-voice prose against a tested spec. The payoff (Phase 6) is hundreds of in-voice lines per character in an evening. Phases 1–5 are the machine that makes that step *safe* instead of chaotic.

**Pairs with:** [`card-composition-framework.md`](card-composition-framework.md) (the runtime) and [`cards-contract.md`](cards-contract.md) (LOCKED, the truth rules).

**How to use this doc.** Each phase is standalone: a goal, what to read, the work, a "done when," a "do not do," and a copy-paste **Claude Code prompt** that kicks off your usual plan-mode loop (Claude reads the contracts → writes the phase plan in `docs/plans/` → implements). Phase numbers and ISSUE ids below are **provisional labels, not a ladder** — register them in `ISSUE_TRACKER.md` when you commit, and walk them in order.

---

## The spine at a glance

```
  A  Character Depth      give characters bounded attributes (incl. voice)   ← the vocabulary
  B  The Spike            hand-iterate ONE template + spec to convergence    ← the gate
  C  Composition Runtime  build the assembler; one template renders in-game  ← the framework, real
  D  Test Harness         the six structural gates                           ← what replaces review
  E  Generation Pipeline  spec in → tested pool out, via CI                  ← the scale engine
  F  Scale Out            templates × voices; the centerpiece lands          ← "hundreds in an hour"
  G  Finish               play, tune, prune the gradient                     ← never strictly done
```

**You are here:** framework + this roadmap drafted, nothing built yet. Next is Phase A.

**The one ordering rule:** A before B before C before D before E before F. It's a spine on purpose — no "what first" decision at any step. Expect *one* loop back from B to A (that's healthy, see Phase A's note), and nothing else loops.

---

## Phase A — Character Depth (the vocabulary)

**Provisional:** phase 121 / ISSUE-090.

**Goal.** Give staff and regulars mechanically-loaded, *bounded* attributes — stored as persistent, serializable state — that the card layer can select against. No prose here. This is the vocabulary every later phase speaks in.

**The attributes (v1, deliberately small):**

- **specialty** — the slice of their role's domain they're sharp on.
- **blindspot** — the slice they're weak on. (Specialty + blindspot = a real reason to hire complementary staff.)
- **affinity** — one or two axes biasing attention toward/away from entity types (orcs, nobles, a faction).
- **voiceProfile** — *the enabler for the whole arc.* A small **fixed** set of axes — e.g. terseness, warmth, formality, floridity — each a short enum or 0–2 scale, plus an optional single verbal-tic id.

**The hard lesson, baked in.** The 20-line demo failed for the sim because it minted fresh tags per line (`fae_touched_wanderer`, `anti_mage`). At 3,000 lines that's unselectable noise. Here the axes are **bounded and fixed**, so the runtime can deterministically pick the right line for the right character. Keep the axis set as *data* (a tiny registry/enum), not deeply wired — so Phase B's feedback is a one-line data edit, not a refactor.

**Read first.** `cards-contract.md §3` (state shapes), `CLAUDE.md` (architectural rules), `card-composition-framework.md §5` (the `actorTrait` seam these attributes will satisfy), `design-decisions-2026-05-20.md §6`.

**Done when.** A staff member and a regular each carry the bounded attribute set in `TavernState`; attributes are generated once at creation via a named RNG stream and stable across re-render; Zod schema + migration + defaults in place; `npm test` and `npm run typecheck` green.

**Do not do.** No dialogue or prose. No open-ended invented tags. No voice-transformer. Don't touch the card layer yet.

**Expect one loop.** Phase B will probably tell you to add or rename one voice axis. That's the system working, not rework — it's exactly why the axes are kept as cheap data.

```
Enter plan mode. We're starting the Living Cast arc, Phase A (Character Depth).
Read CLAUDE.md, cards-contract.md §3, card-composition-framework.md §5, and
design-decisions-2026-05-20.md §6. Then write a phase plan in docs/plans/ for
adding a bounded, serializable attribute set to staff and regulars:
specialty, blindspot, 1–2 affinity axes, and a fixed voiceProfile (a few enum
axes + optional verbal-tic id). Attributes are SELECTION VOCABULARY, not prose
— author no dialogue. Keep the voice axes as data (small registry/enum) so they
are cheap to change later. Honor every architectural rule: pure sim, no
Math.random, named RNG stream for identity, JSON-serializable state, Zod schema,
migration, defaults. Plan the tests (stable-across-re-render, schema round-trip)
before implementing. Wait for my approval of the plan before writing code.
```

---

## Phase B — The Spike (the gate)

**Provisional:** phase 122 / ISSUE-091. **This is authorial hand-work, not a Claude Code phase.**

**Goal.** Pick ONE card situation and hand-iterate it to convergence: slots, a generation spec, 3–5 exemplars, negative examples, and a handful of snippets — run through the model by hand until the spec produces clean output *you don't have to fix*. This gate teaches the real slot shape and which Phase-A attributes actually get used.

**Pick the drink-order situation.** You already have 20 proto-exemplars for it (the demo), and it's the easy case for coherence: an order line *claims almost nothing the sim must back* — pure voice. That makes it the perfect first spike and the cleanest place to prove voice-as-a-generation-dimension.

**The split this phase makes concrete.** "Ale. Now. Before my patience sobers up." claims no checkable fact → it lives in an **optional flavor slot** where the sim-coherence gate is relaxed. "I survived three goblins and a tax collector" *does* claim facts → it cannot fire unless the sim backs that history. Sort your exemplars into those two buckets; that sorting is half the design work.

**The generation spec is the artifact.** Skeleton:

```
TEMPLATE: drink_order            VOICE REGISTER: <one per template>
SLOT: <e.g. order_line>          CLAIMS: none (flavor) | sim-backed
CONDITIONS the snippets must fire under:
  <data conditions from the framework DSL — seedType, hasNamedEntity, actorTrait…>
LENGTH BOUNDS: <title ≤6 words / body line ≤12 words>
VOICE AXES IN PLAY: <which voiceProfile axes vary the output>
POSITIVE EXEMPLARS (3–5, hand-curated — the highest-leverage artifact):
  - …(your demo lines, sorted + trimmed to fit slot + made sim-honest)…
NEGATIVE EXAMPLES (2–3 failure modes to avoid):
  - Mad-libs flatness:  "<entity> wants <item>."
  - Voice drift:        <line that breaks the register>
  - Sim-incoherent:     <claims a fact no condition guarantees>
MUST PASS: coverage · specificity-gradient · voice-bounds · sim-coherence · determinism · diversity
```

**Done when.** The spec generates clean, in-voice, sim-coherent, slot-fitting snippets across a run *without you editing the output* — and you can name which Phase-A attributes the spec actually reached for (feed that back to lock Phase A).

**Do not do.** Don't build the runtime, harness, or pipeline. Don't generate at volume. Output is throwaway — the *spec* is what you keep.

```
(For this phase, work it by hand with me — paste the spec draft and a few
generated snippets, and we iterate the spec until the output needs no fixing.
No Claude Code, no repo changes yet.)
```

---

## Phase C — Composition Runtime (the framework, for real)

**Provisional:** phase 123 / ISSUE-092.

**Goal.** Build the types and assembler from the framework doc, and wire the Phase-B template through `defineCompositionalCard` so a live seed renders a composed card in the running game.

**Read first.** `card-composition-framework.md §2–3` (types + assembler) and `§8` (the worked example), `cards-contract.md §6` (the `CardDefinition`/`CardView` shapes you must not change).

**Done when.** The one template renders deterministic composed cards in-game; `REQUIRED_CARDS` holds a mix of old hand-written cards and the new compositional one with nothing broken; conditions are data (not closures); ties resolve by FNV key; unmatched conditions degrade gracefully; tests + typecheck green.

**Do not do.** Don't migrate the other templates yet. Don't add DSL primitives beyond the eleven. Don't build the pipeline.

```
Enter plan mode. Living Cast arc, Phase C (Composition Runtime).
Read card-composition-framework.md (esp. §2, §3, §8) and cards-contract.md §6.
Write a phase plan in docs/plans/ to implement the compose slice under
src/cards/compose/: Snippet, SnippetPool, SnippetCondition (the 11 data
primitives, implicit AND, no OR/NOT), SlotSpec, CompositionalCardTemplate,
FilledSlots; evalCondition; assembleSlots/pickSnippet with FNV tie-break;
defineCompositionalCard. Wire the Phase-B template through it so a real seed
renders a composed CardView via the existing pickCard → CardRenderer path,
with REQUIRED_CARDS holding old + new cards together. Conditions must be DATA.
Plan determinism + graceful-degradation tests before coding. Wait for plan
approval before implementing.
```

---

## Phase D — Test Harness (what replaces review)

**Provisional:** phase 124 / ISSUE-093.

**Goal.** Implement the six structural gates against the Phase-B pools. These are what let generation replace human review — without them, volume is unsafe.

**The six (framework §6):** coverage (every required slot has an unconditional fallback) · specificity-gradient (no pool all-generic or all-specific) · voice-bounds (length/register) · sim-coherence (a snippet only asserts what its conditions guarantee) · determinism (same seed+state → same card) · diversity (a pool of N yields ≥M distinct cards).

**Read first.** `card-composition-framework.md §6`, and `§4` (the rules the gates enforce).

**Done when.** A deliberately bad snippet — over-budget, sim-incoherent, or an all-fallback pool — fails a gate automatically; gates run on committed pools as plain data; tests + typecheck green.

**Do not do.** Don't build the pipeline yet. The harness must work on hand-committed pools first.

```
Enter plan mode. Living Cast arc, Phase D (Test Harness).
Read card-composition-framework.md §4 and §6. Write a phase plan in docs/plans/
for a Vitest suite implementing the six gates — coverage, specificity-gradient,
voice-bounds, sim-coherence, determinism, diversity — running over the committed
snippet pools as data. Include intentionally-bad fixtures proving each gate
fails when it should. Wait for plan approval before implementing.
```

---

## Phase E — Generation Pipeline (the scale engine)

**Provisional:** phase 125 / ISSUE-094.

**Goal.** The build-time loop: a spec goes in, the model generates, the harness runs, failures retry, near-duplicates get pruned, a committed pool comes out. Runs as a GitHub Action so you wake up to PRs.

**Only now.** This is built *after* one spec hand-converged (B) and the gates exist (D). Building it earlier is tooling around an unvalidated spec format — the trap.

**Read first.** `design-decisions-2026-05-20.md §10`, `card-composition-framework.md §7`.

**Done when.** Adding or editing a spec produces a tested, committed pool through CI without you touching individual snippets; you review the *spec*, not the output. (~500–1000 lines; fits the mobile + Actions workflow.)

**Do not do.** No authoring GUI. Keep the spec format exactly the one validated in B — don't redesign it here.

```
Enter plan mode. Living Cast arc, Phase E (Generation Pipeline).
Read design-decisions-2026-05-20.md §10 and card-composition-framework.md §7.
Write a phase plan in docs/plans/ for a build-time pipeline: read a generation
spec → call the model → run the Phase-D gates on output → retry failures →
dedupe near-duplicates → emit a committed SnippetPool. Wire it as a GitHub
Action that opens a PR. The spec format is FIXED to the one validated in Phase B
— do not redesign it. Runtime selection stays deterministic; only generation is
non-deterministic, at build time. Wait for plan approval before implementing.
```

---

## Phase F — Scale Out (the centerpiece lands)

**Provisional:** phases 126+ / ISSUE-095…

**Goal.** Repeat cheaply across situations and voices. Each card situation gets a template + spec; each voice register gets exemplars; the pipeline fills the pools. **This is where "hundreds of lines, many personalities, in an evening" actually happens** — and where a single character speaks in a *consistent* voice across ordering, complaining, reacting to a brawl, grumbling about rent.

**The key move.** Voice is a **generation dimension**, not a runtime transformer. You generate a voice-tagged pool per register; the assembler's existing condition system selects by the character's `voiceProfile`. No new runtime — the machine from C/D/E already does this.

**Work.** Enumerate the situations (map to seed families/types in `cards-contract.md §3.3`). Build a template + spec per situation. Write exemplars per voice register. Run the pipeline. Add specific snippets up the gradient as they occur to you.

**Done when.** Multiple situations render voiced, character-consistent cards in play; the same character is recognizably themselves across different situations.

**Do not do.** Don't hand-edit generated snippets — fix the *spec*. Don't expand the DSL unless a concrete, named gap forces it.

```
Enter plan mode. Living Cast arc, Phase F (Scale Out), situation: <name>.
Read cards-contract.md §3.3 (seed families/types) and the existing compose
slice. Write a phase plan in docs/plans/ for one new compositional template +
its generation spec for this situation, reusing the Phase-C runtime and Phase-E
pipeline unchanged. Voice is a generation dimension: exemplars per voice
register; the assembler selects by character voiceProfile. Author exemplars and
the spec; let the pipeline fill the pool. Wait for plan approval before
implementing.
```
*(Repeat this prompt per situation. That repetition is the whole point — each one is cheap.)*

---

## Phase G — Finish (never strictly done)

**Provisional:** ongoing.

**Goal.** Play it. Find the flat characters and thin pools. Add specific snippets up the gradient where a moment deserves more; delete dead snippets whose conditions stopped firing. Tune the voiceProfile axes if a kind of character isn't landing.

**Done when.** It's a game you enjoy playing and the cast feels alive in play. There's no final checkmark here, and that's correct — the gradient is meant to deepen forever at zero structural cost.

---

## If you only remember three things

1. **The spec and the exemplars are what you author.** Snippets are generated and tested; you almost never touch them by hand.
2. **Voice is a generation dimension, not runtime code.** Your big vision needs no new architecture — it needs per-voice exemplars.
3. **It's a spine, not a beast.** One order, one expected loop (B→A), one prompt per phase. You never have to hold more than the phase you're in.
