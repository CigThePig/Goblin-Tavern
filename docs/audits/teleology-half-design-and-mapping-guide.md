# Goblin Tavern — The Teleology Half: Design & Codebase Mapping Guide

## Purpose of this document

This document has two jobs. First, it captures the complete design for a major new half of the game and the reasoning behind each decision, so the intent survives independent of any conversation. Second, it is a **mapping instrument**: each design section ends with a list of questions to answer against the current codebase. Fill those answers in (inline, in a companion doc, or as code references) before sequencing implementation phases. Nothing here assumes knowledge of how the current code is structured — the whole point is to discover that during mapping.

Do not begin writing feature code from this document. It is upstream of the phase plan. The phase plan is written **after** the mapping questions are answered, because the order and shape of the phases depends on what the mapping reveals.

---

## 1. The core frame: two machines

The game as it currently stands is, in effect, an **entropy engine**. It generates erosion, friction, and texture. Pressures rise on their own; the player spends resources to damp them back toward baseline. The daily question it asks is *"what do you ignore today?"* This is not a flaw — it is a finished, working machine that produces ongoing reactive texture. It should not be promoted into being "the whole game," and it should not be torn out.

What is being added is its mirror: a **teleology engine**. A system where things move only because the player pushes them, and where movement **ratchets** (permanently advances) instead of **damping** (returning to baseline). Its daily question is *"what are you building toward?"*

These are genuinely different machines. The failure mode to avoid is trying to extract teleology behavior from the entropy architecture by bending it — that is the wall. Instead, the teleology half is built as its own set of modules that **share rendering and persistence infrastructure** with the existing half, and that are deliberately coupled to the entropy half at the level of *meaning* (see §6).

The relationship between the halves is what makes this architecture rather than a bolt-on: **they give each other stakes.** Reactive triage is low-stakes when nothing exists beyond the meters themselves. Once the player is building toward something, a crisis the week before a critical milestone becomes genuinely threatening — the entropy half becomes the *risk surface* that menaces momentum. And the teleology half stays grounded because the entropy engine continuously taxes it. Each half is the other's reason to care.

### Mapping questions — the existing entropy half
- What is the canonical name, location, and shape of the "pressure"/meter system? How does a pressure rise, and what damps it?
- What is the daily loop, concretely? Where is the "hand" of cards for a day assembled, and what feeds it?
- Where do reactive problems originate (the "issue seed" mechanism or its equivalent)? What is the contract/shape of a seed?
- What is the resource the player spends to damp pressures (time-as-budget, action points, money, etc.), and where is it tracked?
- Is there anything in the day loop that *assumes* every card is reactive / damping in nature? List each assumption found.

---

## 2. The four new primitives

Every element of the existing half has a complement in the new half. Naming below is provisional; pick final names during mapping.

### 2.1 Ventures (the spine)
Player-pursued, multi-stage state objects that **only advance when invested in**. They have stages, milestones, requirements, deadlines, and failure states. They are to the teleology half what pressures are to the entropy half: the load-bearing spine everything else hangs on.

### 2.2 Openings (the entry path)
The world proposing **opportunities**, generated as a function of active ventures, relationships, and identity state. Same seed-shaped contract as reactive issue seeds, **opposite valence**. An opening is the membrane between the two machines: commit to it and it becomes an active venture (teleology); ignore it and it drifts under simulation pressure (entropy). See §5 for the full entry model.

### 2.3 Transformations (the ratchet)
Milestone effects that **permanently change what the tavern is**, which then gate content in *both* halves. Becoming licensed, renowned, faction-aligned, etc., retires some content families and unlocks others. This is the mechanism that makes movement ratchet rather than reset. It is the only new system that reaches **back into** the existing entropy engine to retire/unlock families, so it is the highest-integration-risk system and is deliberately built last among the mechanics (see §7).

### 2.4 Character arcs (the depth mass)
Staff, regulars, and factions get their own wants and trajectories. Investing in a person unlocks capability and story, not just a loyalty number. People become **means and ends**, not merely pressure emitters. This is the largest single mass of new content and the primary home of "character depth."

### Mapping questions — complements & rendering substrate
- Is there a single **card composition / compose runtime** that both halves can share? Where is it, and what is its input contract? (This is the shared rendering substrate — confirm it can render a card regardless of source.)
- Does the card runtime currently assume choices *reduce* a meter? If choice-preview or legibility logic bakes in any damping assumption, it must be generalized so a choice can also *advance* (ratchet). List every such assumption. **This is the single most important defect to find** — opportunity cards with incoherent choices would poison the new half on arrival.
- What is the persistence regime (e.g. schema validation + serialization)? Confirm new persistent collections can be added under the same regime.
- Where does relationship / loyalty state for characters currently live, and what shape is it?
- Where does "identity state" (what the tavern *is*) currently live, if anywhere?

---

## 3. Shared kernel vs separate systems — the resolved decision

**Decision: ventures and character arcs share one lifecycle kernel, but only the kernel.** The depth concern is real, and the rule that defuses it is strict: **share the lifecycle plumbing, never the content or meaning.**

### What the kernel owns (universal, invisible machinery)
- Stages and milestones
- Requirements, deadlines, failure states
- Serialization under the existing persistence regime
- A causality entry on **every** advancement
- A **pluggable advancement trigger** (see §4)
- **Branching** milestones, not linear-only chains

The player never touches the kernel directly. They touch a venture or an arc. Genericness *at the kernel level is harmless*, because depth does not live there. Staleness comes from shared **content patterns and advancement verbs**, not shared plumbing.

### The line that must not be crossed
The kernel never contains domain meaning. The moment there is an urge to write `if (type === 'arc')` *inside* the kernel, that logic belongs in a module instead. Stated cleanly:
- **Kernel** = structure and lifecycle.
- **Venture module** and **Arc module** = meaning, content registries, side-effects.
- The two modules are **siblings**: both depend on the kernel, neither depends on the other.

### Why sharing *increases* depth instead of flattening it
Because a venture and an arc are the same kind of object underneath, a milestone in one can natively reference and gate the other. A regular reaching "loyal" can unlock a venture stage; a licensing venture failing can wound a character's arc. This cross-pollination (see §6) is cheap when they share an interface and expensive/fake-feeling when they are two bolted-together systems. The shared substrate is what prevents the two halves from feeling like parallel quest logs.

### Mapping questions — kernel feasibility
- Is there an existing state-machine or staged-progress pattern anywhere in the code that the kernel could generalize from (rather than inventing fresh)?
- What module boundaries already exist? Where would a new `kernel` module sit so that two sibling modules can both import it without creating a cycle?
- Does the persistence regime support polymorphic/tagged collections cleanly (e.g. a stored object that carries a discriminant for venture vs arc)? Note how discriminated unions are currently handled, if at all.

---

## 4. Agency — the divergence that justifies one kernel with two faces

This is the design's answer to "won't a shared system feel stale?" The proof that ventures and arcs are *siblings, not twins* is **agency**, and the kernel must accommodate the difference from day one:

- A **venture is inert.** It moves only when the player invests. Its advancement trigger is investment-driven.
- A **character has wants.** They can move on their own, push back, or refuse. The arc module needs something the venture module does not: a character can **advance their own arc or spawn openings based on their trajectory, with no player investment at all.** Its advancement trigger is autonomous-or-hybrid.

Therefore the kernel's advancement **trigger must be pluggable** rather than hardcoded to "only advances when invested in." Build this on the kernel's first day. Likewise build **branching milestones** from the start, because arcs especially need to fork on character state. That autonomy is precisely where arc depth comes from, and it is a divergence that would have to be faked awkwardly if the two were one flat system.

### Mapping questions — agency mechanics
- Is there any existing autonomous simulation tick where entities change state without player input? If so, where, and could arc-autonomous advancement hook into it?
- How is player "investment" currently expressed and spent? Confirm the same mechanism can serve as a venture advancement trigger.
- Are there existing branching/conditional structures (dialogue trees, conditional seeds) whose pattern the branching-milestone design should match for consistency?

---

## 5. The entry model — world-offers-commit, with causal decay/return

**Decision: world-offers-commit.** Ventures are *not* picked from a menu (which would feel like a quest log and would let the player author truth). Instead, **shapes of opportunity appear**; the player can follow a thread and it grows into a venture, or let it pass. The system reveals and escalates simulation truth — it does not let the player author truth from a menu. This preserves the core design rule across the new half.

### Decay and return
An ignored opening does not simply vanish. It **eventually dies, or comes back in a different shape** — positively or negatively. This is the entropy engine acting on the teleology half, and it is the strongest part of the design: an ignored opening that returns transformed is *the world remembering.*

**The rule that keeps "comes back in a different shape" from feeling arbitrary:** the returned shape must be a **function of what actually changed in the world during the window the opening was ignored** — a relationship shifted, a pressure spiked, an identity transformation fired — and it must be logged through causality like everything else. Random mutation feels like a slot machine. **Causal** mutation feels like the world remembering. Pinning down the exact mapping from *(expired opening + intervening state) → return form* is a required pre-build decision (see §8).

### The cold-bootstrap problem (must be solved before openings ship)
Openings generate as a function of active ventures — but at a cold start there are **zero** active ventures, so nothing would generate the first opening. The fix:
1. The **first** openings key off identity and relationships **alone** (no dependency on active ventures).
2. Committing to one **spawns the first venture.**
3. **Only then** do active ventures begin biasing which openings the world offers.

This ordering is not optional polish — it shapes the build order, because the opening generator must be written to run correctly with an empty venture set.

### Mapping questions — entry & generation
- What is the existing generator for reactive seeds? Can openings reuse its scheduling/slotting, or do they need a parallel generator?
- What identity and relationship state is available **at a fresh save** to seed the first cold-start openings? Confirm it is non-empty at turn one.
- Where would an "expired/ignored opening" be parked while it waits to die or return? Is there an existing place for deferred/pending world state?
- Does causality logging currently capture *world deltas over a time window*, or only point events? The decay/return rule needs windowed deltas — confirm what is recordable.

---

## 6. Cross-pollination — the coupling that makes it architecture

The two halves, and the two sibling modules, are intentionally coupled at the level of **meaning**, not plumbing:
- A milestone in a venture can reference/gate an arc, and vice versa (enabled by the shared kernel object shape).
- A transformation (§2.3) retires entropy-half families and unlocks others, gating content in *both* halves.
- An ignored opening mutates based on intervening entropy-half events (§5).

This mutual coupling is the reason the two halves "give each other meaning." Keep the coupling in the **modules and their content registries**, never in the kernel.

### Mapping questions — coupling points
- What is a "card family," concretely, and where is the registry of families? Transformations need to *retire* and *unlock* families — confirm families can be enabled/disabled at runtime by world state.
- Are there existing gating/eligibility checks for whether content can appear? Transformations and cross-references will extend these — locate them.
- Is there a single source of truth for "current world/identity state" that all gating reads from? If gating is scattered, note every site.

---

## 7. Dependency chain & build sequencing logic

The four primitives are **not independent** — they form a dependency chain. Building each one fully before starting the next pushes integration (the scariest work in a large codebase) to the very end, which is the worst place for it. Instead, sequence so that **integration risk is retired early** while each phase still ships independently.

The dependency facts that fix the order:
- Openings key off active ventures → **ventures exist first.**
- Transformations fire off venture milestones → they need a venture lifecycle to attach to.
- Character arcs are venture-shaped and their payoffs behave like transformations/opening-biases → they ride on top once machinery is stable.
- Transformations are the only system that reaches **back into** the entropy engine → highest integration risk → built **last among the mechanics**, deliberately, on proven seams.

### Recommended sequence (to be turned into detailed phases *after* mapping)
0. **Seam audit + schema groundwork.** Find and fix any assumption that a card is reactive or that choices damp meters (continuous with the coherence work already underway, aimed at one question). Extend the root schema with empty ventures/arcs/transformations collections plus a save migration. Additive; ships invisibly.
1. **Kernel + ventures spine.** Lifecycle kernel (pluggable trigger, branching milestones, causality on advancement) and the venture module on top. Include a **dev-only spawn affordance** so ventures are testable before openings exist. Compose venture cards through the shared runtime and inject them into the daily hand beside triage. This phase proves the biggest seam — *two card sources feeding one hand* — with real content, and is shippable alone.
2. **Openings as the real entry path.** Cold-bootstrap off identity/relationships, the commit→spawn flow, then the feedback loop where active ventures bias generation. Retire the dev spawn. Add the decay/return behavior with causal mutation.
3. **Transformations.** The ratchet that retires/unlocks families across both halves. Built on now-proven seams, deliberately, not while everything else is in motion.
4. **Character arcs.** The big content mass, riding the stable kernel — autonomous advancement, cross-pollination with ventures and transformations.

The daily hand goal across all phases: roughly **one or two venture/arc cards carried by two or three triage cards.** The reactive half stays as flavor and risk surface; it is not replaced.

### Mapping questions — sequencing readiness
- How are save migrations currently performed? Confirm an additive, invisible migration is straightforward.
- How is the daily hand assembled today, in enough detail to inject a second card source without rewriting the loop? (Re-confirm §1 findings at implementation depth.)
- Is there a dev/debug affordance pattern already in the code that a dev-only venture spawn can follow?
- What is the smallest end-to-end slice that could ship in phase 1 without openings, transformations, or arcs existing?

---

## 8. Open decisions to settle before the phase plan is build-ready

1. **The decay/return mapping (highest priority).** Define the concrete rule that maps *(expired opening + intervening world delta) → return form*, including the positive vs negative branch and the death condition. Must be causal, not random, and must be logged through causality.
2. **Final naming** for all four primitives (ventures, openings, transformations, arcs) — align with existing naming conventions discovered during mapping.
3. **Kernel trigger interface shape** — how an investment-driven trigger and an autonomous/hybrid trigger are both expressed through one pluggable interface.
4. **Family enable/disable mechanism** — exactly how transformations retire and unlock families at runtime, given how the family registry actually works.
5. **Hand-composition budget** — the rule that keeps the daily hand at ~1–2 teleology cards + 2–3 triage cards, and where that ratio is enforced.

---

## 9. How to use this document next

1. Walk each "Mapping questions" block against the current codebase and record concrete answers (file paths, function names, data shapes, and any assumptions found).
2. Pay special attention to the §2 question about damping assumptions in the card runtime and the §6 question about runtime-toggleable families — these two findings most affect whether the sequence above holds as written.
3. Settle the §8 decisions, informed by what mapping revealed.
4. Only then, write the phase plan: self-contained, one independently-shippable phase at a time, each phase doc standing alone without reliance on prior context.
