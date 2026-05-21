## Phase B — The Spike (the gate) — COMPLETE (revised against shipped Phase A)

**Provisional:** phase 122 / ISSUE-091. **Status:** complete as a hand-authored spec artifact.

**Purpose.** Phase B is the convergence gate between bounded character attributes and the future composition runtime. It does not build code. It proves the first template shape, the slot boundaries, the voice axes actually used, and the difference between safe flavor and sim-backed claims.

**Chosen situation:** `drink_order`.

Why this situation is the right spike:

- It is mostly voice, not world-state exposition.
- It can be short enough to make voice differences obvious.
- It can use Phase-A `voice.axes` without requiring the full card runtime yet.
- It exposes the most important rule early: a colorful line is allowed only when it does not invent checkable history.

---

### Phase-A reconciliation (READ THIS FIRST — it is the substance of the revision)

This spec was revised after reading the **shipped** Phase A code (`src/sim/content/cast/`). Phase A made three decisions that the first draft of this spec guessed wrong about. The spec now matches the code. The corrections:

**1. Voice is stored as STRUCTURED SCALARS, not flat strings.** Phase A stores `voice.axes.terseness = 2` — a `Record<VoiceAxisId, 0|1|2>` plus an optional `verbalTic` id (`castTypes.ts`). It does **not** store flat trait strings like `"voice.terseness.2"`. Therefore the framework's `actorTrait: { role, trait: string }` condition cannot match voice as-is. **Phase C must bridge with comparison operators on axes, not exact-string equality.** See "The actorTrait bridge" below. This is the one genuine Phase-C decision the spike surfaced, stated explicitly instead of buried in an implementation note.

**2. The axis distribution makes two-extreme snippets RARE.** The factory seeds each axis from a culture default, then perturbs by `[-1, 0, 0, 1]` and clamps to `[0, 2]` (`createCastAttributes.ts`). So a single axis reaches an extreme often enough, but a snippet requiring *two* axes both at extremes (e.g. `terseness=2 AND warmth=0`) needs the product of two partial probabilities — uncommon. A pool whose only specific snippets are two-condition pairs will collapse onto the fallback in play. **Fix: the pool now has a real gradient — single-axis (`atLeast`/`atMost`) snippets as the common middle rung, two-axis pairs as the rare top rung, fallback at the base.** This is the structural fix; the first draft had a cliff from two-condition straight to fallback with no rung between.

**3. No new voice axis is required — confirmed against the registry.** Phase A's `VOICE_AXIS_IDS` are exactly `terseness, warmth, formality, floridity` (`voiceAxes.ts`), and the verbal-tic registry holds seven tics (`verbalTics.ts`): `trails_off, interrupts_self, understates, repeats_for_emphasis, qualifies_everything, italicises_stakes, quotes_someone_else`. Do **not** add new axes for "angry," "drunk," "old," "heroic," "shady," "noble," or "goblin." Those are culture defaults, specialty/affinity signals, seed context, or exemplar clusters — not new global axes. (This spec now covers all seven tics; the first draft used only five.)

---

### The actorTrait bridge (Phase-C decision, settled here)

The framework's `actorTrait` condition is `{ kind: 'actorTrait', role, trait: string }`. Phase A's voice is structured scalars. Rather than flatten voice into strings at runtime (lossy, and it makes `atLeast`-style gradients impossible), Phase C should read the actor's `CastAttributes.voice` and support **three comparison forms** against an axis. Proposed condition extension, to be confirmed in the Phase-C plan:

```ts
// Reads CastAttributes.voice.axes[axis] for the resolved actor.
| { kind: 'voiceAxis'; role: string; axis: VoiceAxisId; atLeast: VoiceAxisValue }
| { kind: 'voiceAxis'; role: string; axis: VoiceAxisId; atMost: VoiceAxisValue }
// Reads CastAttributes.voice.verbalTic for the resolved actor.
| { kind: 'verbalTic'; role: string; tic: VerbalTicId }
```

Rationale: `atLeast`/`atMost` give the specificity gradient real rungs (an `atLeast: 2` snippet fires whenever the axis is 2, regardless of other axes), and the dedicated `verbalTic` form is cleaner than overloading `actorTrait` with a magic string. This is **two small data-condition forms, not DSL expansion** in the dangerous sense — they are still flat, inspectable, generatable, and enumerable, satisfying every framework §6 test. If the Phase-C author prefers to keep the single `actorTrait` primitive and encode comparison in the string (`"voice.terseness.>=2"`), that is acceptable *only if* the evaluator parses the comparison — exact-string equality is rejected, because it reintroduces the two-extreme rarity problem.

Throughout the pool below, conditions are written in the `voiceAxis` / `verbalTic` form. If Phase C lands a different bridge spelling, these map mechanically — the *gradient structure* is what must survive, not the syntax.

---

### Phase B locked rule — claims vs flavor

Every snippet in this template must be sorted into one of two buckets.

#### Bucket 1 — flavor, relaxed coherence

A flavor line may imply attitude, personality, urgency, taste, or mood. It must not assert a specific event, relationship, injury, debt, victory, named person, faction outcome, or prior tavern incident.

Safe examples:

- `Ale. Now. Before my patience sobers up.`
- `Something dark, cold, and less judgmental than the room.`
- `Your loudest ale, poured quietly.`

These lines do not require a memory, cause, actor history, or seed condition. They can live in an optional flavor slot or in the main order slot with only voice conditions.

#### Bucket 2 — sim-backed, strict coherence

A sim-backed line asserts a checkable fact. It may only fire when the seed or state guarantees the fact through explicit conditions.

Unsafe without conditions:

- `I survived three goblins and a tax collector.`
- `The miners cheated me again.`
- `Put it on Old Brakka's tab.`
- `After last night's brawl, I deserve the first pour.`

These are not "better flavor." They are claims. They require conditions such as `hasNamedEntity`, `memoryPresent`, `repeatCount`, `hasTag`, `seedType`, or an eventual actor/history condition. Until the condition exists *and the sim actually emits it*, leave the line out.

**Reality check added in revision.** `repeatCount`/`subjectTag` and the `stock_shortage` pressure id are **framework-spec primitives that the sim does not yet emit** (verified: no `subjectTag` or `repeatCount` tracking exists in `src/`). So the `sim_backed_hook` slot is **defined but DISABLED for the spike** — its snippets are retained below as *design intent only*, clearly marked, and must not be wired into Phase C's live pool until the underlying sim signal exists. Shipping them now would produce snippets that can never fire (dead pool entries) or, worse, fire on a condition the evaluator stubs to `true` and thereby assert an unbacked fact. Either way it fails the sim-coherence gate. Leave the slot dark.

**Locked conclusion.** The first `drink_order` pool should be mostly flavor, built on a single-axis gradient. Sim-backed variants wait for real sim signals.

---

### Completed generation spec

```yaml
templateId: drink_order
voiceRegister: tavern_floor
status: phase_b_complete_revised
purpose: >
  Generate short in-character drink-order lines for a staff-facing or
  player-facing tavern card without inventing unsupported facts. Voice
  variation is driven by the shipped Phase-A CastAttributes.voice scalars.

slots:
  - id: order_line
    required: true
    claims: flavor
    maxWords: 12
    description: >
      The actual request for ale, beer, or a house drink. It may show mood,
      personality, and voice. It must not claim a specific past event.

  - id: manner_note
    required: false
    claims: flavor
    maxWords: 10
    description: >
      A tiny optional beat showing delivery, posture, impatience, or social
      texture. Omitted rather than weak.

  - id: sim_backed_hook
    required: false
    claims: sim-backed
    maxWords: 12
    status: DISABLED_FOR_SPIKE
    description: >
      Reserved for a line referencing a real seed/state condition (repeat
      visit, named actor, rising pressure, memory). DISABLED until the sim
      actually emits the backing signal. Do not wire into Phase C's live pool.

voiceAxesInPlay:
  terseness:  { 0: full clause, 1: compact, 2: clipped imperative }
  warmth:     { 0: prickly/distant, 1: neutral, 2: familiar/inviting }
  formality:  { 0: casual/slang, 1: plain, 2: titled/ceremonious }
  floridity:  { 0: literal, 1: one image allowed, 2: vivid but short, no lore }

verbalTicsCovered:   # all seven from the shipped registry
  - trails_off
  - interrupts_self
  - understates
  - repeats_for_emphasis
  - qualifies_everything
  - italicises_stakes
  - quotes_someone_else

allowedTargets:
  - ale
  - beer
  - house ale
  - dark ale
  - small beer
  - bitter
  - stout
  - whatever is cold

mustNotInvent:
  - named NPCs
  - named factions
  - specific injuries
  - specific battles
  - debt history
  - previous tavern incidents
  - who paid whose tab
  - claims about supply unless the seed/state says so

hardBounds:
  order_line: <= 12 words
  manner_note: <= 10 words
  sim_backed_hook: <= 12 words
  punctuation: normal prose punctuation only
  noFragmentsThatRequireConcatenation: true
  noMadLibPlaceholders: true
  noModernSlang: true
  noEarthIdioms: true
  noDirectMechanicalLanguage: true

gradientPolicy:
  base:   one unconditional fallback (always fires)
  middle: single-axis snippets (voiceAxis atLeast/atMost) — the COMMON rung
  top:    two-axis snippets — the RARE rung, sharpens when both extremes land
  tic:    single verbalTic snippets — independent of the axis rungs
```

---

### Positive exemplars — hand-converged

The highest-leverage artifact from Phase B. First generation examples for `drink_order`.

```yaml
positiveExemplars:
  - id: terse_prickly_plain
    claims: flavor
    voice: { terseness: 2, warmth: 0 }
    order_line: "Ale. Now. Before my patience sobers up."
    manner_note: "They tap two coins once."
    why_it_works: "Strong personality, no world claim, fits a card slot."

  - id: warm_informal_plain
    claims: flavor
    voice: { warmth: 2, formality: 0 }
    order_line: "House ale, friend. The kind that forgives a long day."
    manner_note: "Their grin arrives before the coin."
    why_it_works: "Warm without backstory. 'Long day' is mood, not a specific event."

  - id: formal_restrained
    claims: flavor
    voice: { formality: 2, floridity: 0 }
    order_line: "A small beer, if the house can spare it."
    manner_note: "They wait with careful hands."
    why_it_works: "Formality through phrasing, not added lore."

  - id: florid_road_voice
    claims: flavor
    voice: { floridity: 2, terseness: 0 }
    order_line: "Bring me something dark enough to hide my thoughts."
    manner_note: "They smile like a locked chest."
    why_it_works: "Vivid but non-factual. No named history."

  - id: clipped_warm
    claims: flavor
    voice: { terseness: 2, warmth: 2 }
    order_line: "Big mug. Good ale. You know the one."
    manner_note: "The counter creaks under one friendly elbow."
    why_it_works: "Distinct rhythm from warmth + terseness; generic physical beat."

  # — single-axis exemplars: the COMMON middle rung the first draft lacked —
  - id: just_terse
    claims: flavor
    voice: { terseness: 2 }
    order_line: "Ale. The usual size."
    manner_note: "No wasted motion."
    why_it_works: "Fires on terseness alone — common, anchors the middle rung."

  - id: just_warm
    claims: flavor
    voice: { warmth: 2 }
    order_line: "Whatever's good tonight — surprise me kindly."
    why_it_works: "Fires on warmth alone. Open, generous, no claim."

  - id: just_formal
    claims: flavor
    voice: { formality: 2 }
    order_line: "An ale, when it is convenient to pour one."
    why_it_works: "Hedged courtesy carries formality with no lore."

  - id: just_florid
    claims: flavor
    voice: { floridity: 2 }
    order_line: "Your darkest pour, the colour of a closed door."
    why_it_works: "One image, still short, claims nothing checkable."

  - id: just_plain_cold
    claims: flavor
    voice: { warmth: 0 }
    order_line: "An ale. That's all."
    why_it_works: "Low warmth alone reads as curt without needing terseness too."

  # — verbal tics: all seven covered —
  - id: tic_qualifies
    claims: flavor
    voice: { verbalTic: qualifies_everything }
    order_line: "A mild ale, I think. Nothing too heroic, more or less."
    manner_note: "They count the price twice."
    why_it_works: "Hedges land the tic without overwhelming the line."

  - id: tic_interrupts
    claims: flavor
    voice: { verbalTic: interrupts_self }
    order_line: "Dark ale — no, bitter. Whichever bites first."
    why_it_works: "Self-reversal changes sentence motion; stays compact."

  - id: tic_understates
    claims: flavor
    voice: { verbalTic: understates }
    order_line: "A stout, please. Something with a bit of spine."
    manner_note: "Their coat is wetter than they admit."
    why_it_works: "'A bit of spine' downgrades stakes; no checkable claim."

  - id: tic_repeats
    claims: flavor
    voice: { verbalTic: repeats_for_emphasis }
    order_line: "Ale. A proper ale — proper, mind you."
    why_it_works: "Doubled word lands the tic in four words."

  - id: tic_trails_off
    claims: flavor
    voice: { verbalTic: trails_off }
    order_line: "Just ale. Something quiet, if there's… you know."
    why_it_works: "Mid-clause fade is the whole tic; still parses as a request."

  - id: tic_italicises
    claims: flavor
    voice: { verbalTic: italicises_stakes }
    order_line: "An ale. A good one — that part matters."
    why_it_works: "One weighted beat lands the stress tic, no lore."

  - id: tic_quotes_someone
    claims: flavor
    voice: { verbalTic: quotes_someone_else }
    order_line: "Ale, as my old captain always ordered it."
    why_it_works: >
      Borderline-safe: 'old captain' is a generic attribution, not a named
      NPC or checkable relation. If a reviewer reads it as a claim, demote to
      'as the saying goes' — included to test exactly that edge with the gate.
```

---

### Negative examples — locked failure modes

```yaml
negativeExamples:
  - id: mad_lib_flatness
    line: "The customer wants ale."
    fails: [specificity-gradient, voice-bounds]
    reason: "Mechanically true but dead; invites placeholder prose."

  - id: unsupported_backstory
    line: "After killing three cave trolls, I need your strongest ale."
    fails: [sim-coherence]
    reason: "Invents combat history; needs a memory/seed condition, not valid as flavor."

  - id: lore_overreach
    line: "By decree of the Sapphire Baron, pour me a lawful stout."
    fails: [sim-coherence, voice-bounds]
    reason: "Invents an authority and setting object. Formality is not lore licence."

  - id: modern_slang
    line: "Hit me with whatever ale is trending tonight."
    fails: [voice-bounds]
    reason: "Register breaks tavern-fantasy voice."

  - id: overlong_florid
    line: "Bring forth a thunder-dark cathedral of barley where my ruined hopes may kneel."
    fails: [length, voice-bounds]
    reason: "Floridity is not permission to become a parody cannon."

  - id: conditional_without_condition
    line: "Put it on the miner captain's tab again."
    fails: [sim-coherence]
    reason: "Needs named entity + tab relation + repeat history; no condition guarantees them."

  - id: two_extreme_overreliance   # NEW — encodes the gradient lesson as a gate
    line: "(a pool whose only specific snippets each require two axis extremes)"
    fails: [specificity-gradient, diversity]
    reason: >
      Not a single bad line but a bad POOL SHAPE. Given the [-1,0,0,1]
      perturbation, two-extreme snippets fire rarely, so the pool collapses
      onto the fallback in play. The gradient test must assert a single-axis
      middle rung exists, not merely 'a fallback and a specific snippet'.
```

---

### Candidate snippet pool for Phase C

Not final volume. The seed pool Phase C wires through the first `CompositionalCardTemplate` to prove selection, the gradient, fallbacks, and optional-slot omission. Conditions use the `voiceAxis`/`verbalTic` bridge forms above.

```yaml
snippetPools:
  - slotId: order_line
    required: true
    snippets:
      # — base —
      - id: order_fallback_plain
        text: "An ale, please. Whatever the house recommends."
        conditions: []

      # — middle rung: single-axis (the COMMON, gradient-anchoring tier) —
      - id: order_terse
        text: "Ale. The usual size."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: terseness, atLeast: 2 }
      - id: order_warm
        text: "Whatever's good tonight — surprise me kindly."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atLeast: 2 }
      - id: order_cold
        text: "An ale. That's all."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atMost: 0 }
      - id: order_formal
        text: "An ale, when it is convenient to pour one."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: formality, atLeast: 2 }
      - id: order_florid
        text: "Your darkest pour, the colour of a closed door."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: floridity, atLeast: 2 }

      # — top rung: two-axis (RARE, sharpens when both extremes land) —
      - id: order_terse_cold
        text: "Ale. Cold. No speech with it."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: terseness, atLeast: 2 }
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atMost: 0 }
      - id: order_terse_warm
        text: "Big mug. Good ale. You know the one."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: terseness, atLeast: 2 }
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atLeast: 2 }
      - id: order_warm_informal
        text: "House ale, friend. The kind that forgives a long day."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atLeast: 2 }
          - { kind: voiceAxis, role: primaryActor, axis: formality, atMost: 0 }
      - id: order_formal_plain
        text: "A small beer, if the house can spare it."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: formality, atLeast: 2 }
          - { kind: voiceAxis, role: primaryActor, axis: floridity, atMost: 0 }
      - id: order_florid_open
        text: "Bring me something dark enough to hide my thoughts."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: floridity, atLeast: 2 }
          - { kind: voiceAxis, role: primaryActor, axis: terseness, atMost: 0 }

      # — tic rung: independent of axes, all seven registry tics —
      - id: order_tic_qualifies
        text: "A mild ale, I think. Nothing too heroic, more or less."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: qualifies_everything }]
      - id: order_tic_interrupts
        text: "Dark ale — no, bitter. Whichever bites first."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: interrupts_self }]
      - id: order_tic_understates
        text: "A stout, please. Something with a bit of spine."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: understates }]
      - id: order_tic_repeats
        text: "Ale. A proper ale — proper, mind you."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: repeats_for_emphasis }]
      - id: order_tic_trails_off
        text: "Just ale. Something quiet, if there's… you know."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: trails_off }]
      - id: order_tic_italicises
        text: "An ale. A good one — that part matters."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: italicises_stakes }]
      - id: order_tic_quotes
        text: "Ale, as my old captain always ordered it."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: quotes_someone_else }]

  - slotId: manner_note
    required: false
    snippets:
      - id: manner_warm_coin
        text: "Their grin arrives before the coin."
        conditions: [{ kind: voiceAxis, role: primaryActor, axis: warmth, atLeast: 2 }]
      - id: manner_cold_coin
        text: "They tap two coins once."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atMost: 0 }
          - { kind: voiceAxis, role: primaryActor, axis: terseness, atLeast: 2 }
      - id: manner_formal_wait
        text: "They wait with careful hands."
        conditions: [{ kind: voiceAxis, role: primaryActor, axis: formality, atLeast: 2 }]
      - id: manner_florid_smile
        text: "They smile like a locked chest."
        conditions:
          - { kind: voiceAxis, role: primaryActor, axis: floridity, atLeast: 2 }
          - { kind: voiceAxis, role: primaryActor, axis: warmth, atMost: 0 }
      - id: manner_nervous_count
        text: "They count the price twice."
        conditions: [{ kind: verbalTic, role: primaryActor, tic: qualifies_everything }]

  # — sim_backed_hook: DISABLED FOR SPIKE. Design intent only. Do NOT wire live. —
  # Each snippet below gates on a signal the sim does NOT yet emit (verified:
  # no repeatCount/subjectTag tracking in src/; stock_shortage pressure id
  # unconfirmed). Wiring these now creates dead or incoherent pool entries.
  # Re-enable per-snippet only after the backing signal exists AND is verified.
  - slotId: sim_backed_hook
    required: false
    status: DISABLED_FOR_SPIKE
    snippets: []   # intentionally empty in the live pool
    designIntentOnly:
      - id: hook_repeat_visit
        text: "They have asked, just so, several nights running."
        blockedOn: "sim must emit a per-actor repeat-visit count + subjectTag"
      - id: hook_pressure_supply
        text: "The order lands heavier with the cellar running low."
        blockedOn: "confirm a real 'stock_shortage' (or equivalent) pressure id"
        coherenceNote: >
          Even once unblocked, 'lands heavier' is a narrator reading. Prefer a
          line that states the condition plainly over one that interprets it.
      - id: hook_named_actor
        text: "The room turns a little toward the speaker."
        blockedOn: "seed must carry a resolved named primaryActor entity"
```

---

### Diversity target for the first runtime test

For a small seeded sample of cast members, `drink_order` should show visible variation along at least these paths. **Because the middle rung is single-axis, these now fire at realistic rates** (the first draft's two-extreme-only pool would have failed this on a random sample):

```yaml
diversityCases:
  - terseness>=2 alone            -> clipped demand
  - warmth>=2 alone               -> open, generous request
  - warmth<=0 alone               -> curt request
  - formality>=2 alone            -> careful/hedged request
  - floridity>=2 alone            -> one vivid image, still short
  - terseness>=2 AND warmth<=0    -> rare sharpened cold demand (top rung)
  - any verbalTic present         -> one sentence-motion variant
  - no matching condition         -> plain fallback (allowed plain, never dead)
```

---

### Must-pass gates for this template

```yaml
mustPass:
  coverage:
    rule: required slot order_line has at least one unconditional fallback
    current: order_fallback_plain

  specificityGradient:
    rule: >
      pool contains (a) fallback, (b) single-axis middle-rung snippets that
      fire on ONE axis, (c) two-axis top-rung snippets, and (d) tic snippets.
      The single-axis rung is mandatory — a fallback + two-axis-only pool FAILS.
    current: true   # five single-axis order_line snippets present

  voiceBounds:
    rule: every order_line <= 12 words; every manner_note <= 10 words
    current: true

  simCoherence:
    rule: >
      flavor slots assert no checkable history; sim_backed_hook is DISABLED
      and ships empty until backing signals are verified to exist.
    current: true

  determinism:
    rule: same seed + same state + same slot returns same snippet after tie-break
    current: to be proven by Phase C/D code

  diversity:
    rule: >
      sample pool yields >= 6 distinct order_line outputs across a RANDOM cast
      sample drawn from the real [-1,0,0,1]-perturbed distribution (not a
      hand-picked extreme sample).
    current: to be proven by Phase D harness
```

---

### Done when

Phase B is done when this file contains a locked `drink_order` spec, positive exemplars, negative examples, a starter pool **with a real single-axis gradient rung**, the claim/flavor split, the disabled-sim-hook decision, and the `actorTrait`→`voiceAxis` bridge written as explicit Phase-C guidance reconciled with shipped Phase A. **That is now complete.** Phase C can proceed without hand-authoring more Phase B.

### Do not do

- Do not ask the user to manually author more Phase-B examples before Phase C.
- Do not build a generation pipeline yet.
- Do not generate hundreds of snippets yet.
- Do not change the Phase-A attribute shape (it is shipped and roll-order-locked).
- Do not add runtime voice transformation.
- Do not wire the `sim_backed_hook` snippets into the live pool until their backing sim signals exist and are verified.
- Do not implement `actorTrait` as exact-string equality — use parsed comparison (`voiceAxis atLeast/atMost`).

### Claude Code prompt for Phase C handoff

```text
Enter plan mode. Living Cast arc Phase B is complete and revised inside docs/plans/living-cast-arc-phase-b.md, reconciled with the shipped Phase A code. Do not ask the user to hand-author Phase B.

Read:
- docs/plans/living-cast-arc-phase-b.md (esp. "Phase-A reconciliation" and "The actorTrait bridge")
- docs/plans/card-composition-framework.md §2–3 and §8
- docs/plans/cards-contract.md §6
- src/sim/content/cast/* (castTypes.ts, createCastAttributes.ts, voiceAxes.ts, verbalTics.ts)

Plan Phase C only: implement the composition runtime and wire the drink_order template through it as the first live compositional card, using the Phase-B snippet pools as seed data.

Key bridge requirement: Phase A stores voice as structured scalars (CastAttributes.voice.axes[axis] in {0,1,2} plus optional verbalTic id), NOT flat trait strings. Implement two data conditions that read the resolved actor's CastAttributes:
  - { kind: 'voiceAxis', role, axis, atLeast } and the atMost variant
  - { kind: 'verbalTic', role, tic }
Do NOT implement actorTrait as exact-string equality. Conditions stay as inspectable data.

Ship the sim_backed_hook slot DISABLED (empty live pool) — its design-intent snippets gate on signals the sim does not yet emit (no repeatCount/subjectTag tracking exists; stock_shortage pressure id unconfirmed). Do not stub those conditions to true.

Do not redesign the Phase-B spec, do not generate volume, do not build the pipeline. Write the implementation plan in docs/plans/ before coding and wait for approval.
```
