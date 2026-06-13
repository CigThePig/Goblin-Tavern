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

---

# Part II — Codebase Mapping Answers

> Filled 2026-06-13 against branch `claude/teleology-audit-questions`. Every claim below is grounded in a file path (and line, where stable). This Part answers each "Mapping questions" block from Part I in order, then records questions that should have been asked but weren't (§A), and revisits the §8 open decisions with what mapping revealed (§B). Where an answer changes the build sequence in Part I §7, it is flagged **[SEQUENCE IMPACT]**.

## Executive summary — the five findings that most affect the plan

1. **The card runtime is already direction-agnostic; the "choices only damp" defect the guide fears most (§2/§9) is NOT present at the card/preview level.** Effects carry an explicit `direction: 'positive' | 'negative' | 'neutral'` (`src/sim/core/effect.ts:42`) *and* a four-way `EffectMeterDisplayCategory = 'good_when_higher' | 'bad_when_higher' | 'contextual' | 'resource'` (`effect.ts:50`); the rendered `CardView.stakes.direction` is already `'loss' | 'gain' | 'risk'` (`src/cards/types.ts:23`); and the magnitude lexicon already has a full *positive* register ("a clear lift", "a marked rise", "a surge" — `src/cards/compose/magnitudeLexicon.ts`). A choice that **advances** a meter upward already renders coherently today. **What the runtime *does* hardcode is the entropy *polarity* of two target kinds** — pressures are classified `bad_when_higher` and pressure-positive = risk/bad (`generatorHelpers.ts:330`+, `previewSelect.ts` `isRiskEffect`/`isDelayedBenefitEffect`). That coupling is correct for the entropy half and only becomes a problem if teleology effects are modelled *as pressures*. They should not be (see finding 2). **Net: the §0 "seam audit" is much smaller than Part I assumes — it is a targeted check of pressure-polarity sites, not a runtime generalization.**

2. **Pressures structurally cannot ratchet, by design — so ventures/arcs/transformations must be their own persistent collections, never pressures.** Every pressure is recomputed from scratch each day as `combineToValue(0, causes)` with a hard `baseline = 0` (`src/sim/modules/pressures/calculators/helpers.ts:45`). A pressure is a *pure state summary*; it returns to 0 the moment its causes vanish. This is the cleanest possible confirmation of the "two machines" frame: the ratchet half **must** persist its own state objects. Good news — adding persistent collections is a well-worn, fully additive path (finding 3).

3. **Adding persistent teleology collections is a solved, 5-step additive pattern, and an additive migration is invisible and routine.** Type (`TavernState.ts`) → Zod schema (`schemas.ts`) → defaults (`defaults.ts`) → idempotent migration helper (`migrations.ts`) → wire into the load chain (`web/src/lib/sim/persistence.ts`). Five prior slices shipped exactly this way (`world`, `recipes` ph65, `expeditions` ph70, cast attributes ph121, module slices). Discriminated unions already round-trip via `z.discriminatedUnion('kind', …)` (`localArcsModule.ts`), so a tagged `kind: 'venture' | 'arc'` collection is natively supported.

4. **The "two card sources into one hand" seam — billed in Part I §7 as the biggest risk of phase 1 — already exists and is trivial.** The sim does not render cards. It emits a *ranked* `seedsToday: IssueSeed[]` into `state.modules.issueSeeds` (`issueSeedModule.ts`); the web layer reads it via `gameStore.todaysSeeds`, filters by beat/timing, and maps each seed through the **single** pure renderer `renderCard(seed, state)` → `pickCard` (`web/src/lib/cards/realCardRegistry.ts:16`, `web/src/lib/screens/DayScreen.svelte:179`, `web/src/lib/components/CardDeck.svelte:44`). A venture/opening that emits a **seed-shaped object** is ranked and rendered by the same path with **zero loop changes**. **[SEQUENCE IMPACT]** the "prove two sources feed one hand" milestone is largely pre-proven; phase 1's real novelty is the *kernel + venture state*, not the hand wiring.

5. **`localArcs` is a working prototype of three things the kernel needs at once: staged lifecycle, autonomous (no-player-input) advancement, and runtime content-gating of issue families.** It has stages (`'seeded' | 'rising' | 'active' | 'climax' | 'resolved' | 'failed'`), declarative gated progression rules, conjunction-of-conditions start gates, a discriminated-union effect list, and — critically — it already emits `issue_seed_tag` effects that **bias which issue seeds the world offers** (`localArcsModule.ts:142`, consumed in `issueSeedRanking.ts:161`). That is the existing precedent for both arc-autonomy (§4) and transformation-driven family gating (§6). The kernel should generalize `localArcs`, not invent fresh.

---

## §1 — The existing entropy half

**Pressure/meter system — name, location, shape.** Canonical name is **"pressure."** Registry: `src/sim/registries/pressureRegistry.ts`; module: `src/sim/modules/pressures/pressureModule.ts`; types: `src/sim/modules/pressures/pressureTypes.ts`. There are 10 core ids (`PRESSURE_IDS`, `pressureTypes.ts:18` — `food_safety`, `inspection`, `staff_burnout`, `pests`, `debt`, `maintenance`, `violence`, `reputation_drift`, `stock_shortage`, `landlord`) plus 11 expanded ids (`EXPANDED_PRESSURE_IDS`, `pressureTypes.ts:40`). On-state shape is `PressureState { id, label, value: 0–100, trend, tags, topCauses }` at `state.pressures[id]`; a richer `PressureSnapshot { value, previousValue, delta, trend, severity, urgency, volatility, causes[], relatedActors[], relatedLocations[], consequences[], … }` (`pressureTypes.ts:144`) lives at `state.modules.pressures.snapshots[id]`.

**How a pressure rises / what damps it.** Neither — it is **recomputed daily**, not incremented. The `calculatePressuresHook` runs at the `closing` phase (`pressureModule.ts`), calling each pressure's `calculate(ctx)`, which reads current state, builds a `causes[]` list of signed contributions, and returns `combineToValue(0, causes)` clamped to 0–100 (`calculators/helpers.ts:45`; e.g. `calculators/foodSafety.ts`). A dirty kitchen pushes `+22`; a clean one contributes `−10`; a recent repair memory contributes `−10` (`maintenance.ts:99`). **"Damping" is therefore implicit and emergent**: the player improves the underlying state (via owner actions) and tomorrow's recompute yields a lower number. There is no API that subtracts from a pressure's stored value. **Implication for teleology: a permanent advance can never be expressed as a pressure** — pressures have amnesia by construction.

**The daily loop, concretely.** Entry point `simulateDay(state, input, modules)` (`src/sim/core/engine.ts:1700`). It topologically sorts modules, then runs three **day segments** (A morning / B afternoon / C evening — `src/sim/core/segments.ts`), reseeding a per-segment RNG before each, and walks a fixed 26-phase pipeline (`src/sim/core/phases.ts:31` `SIMULATION_PHASES`): `startDay → identityGeneration → applyDayTypeModifiers → cultureUpdate → supplierUpdate → factionUpdate → regularCustomerUpdate → localEventUpdate → rumourUpdate → forecastTraffic → beforeOwnerActions → applyOwnerActions → afterOwnerActions → assignStaffPriorities → beforeService → service → afterService → closing → applyResponses → endDay → endWeek → endMonth → generateReports → validate → advanceCalendar`. Each module contributes hooks per phase; all mutation flows through `ctx.modify*`/`ctx.add*` helpers that emit causes.

**Where the daily "hand" is assembled and what feeds it.** Two layers:
- *Sim side:* the `issueSeeds` module generates seeds in timing-keyed passes (`startDay`, `afterService`, `closing`, `endWeek`, `endMonth`), accumulates them into `state.modules.issueSeeds.seedsToday`, and **ranks the union** by `cardWorthiness` (`issueSeedModule.ts`, `issueSeedRanking.ts`).
- *UI side:* `gameStore.todaysSeeds` reads valid seeds (`web/src/lib/sim/gameStore.svelte.ts:565`), `seedsForTiming(timing)` / `BEAT_SEED_TIMINGS` slice them per beat, and `DayScreen.svelte`/`CardDeck.svelte` map each seed → `renderCard(seed, state)`. **The hand = the ranked, beat-filtered `seedsToday` list, one card per seed.** This is the injection seam for teleology cards (see §7 answer).

**Where reactive problems originate / seed contract.** Generators implement `IssueSeedGenerator { id, family, domain, timing[], generateWith?, generate(ctx): IssueSeed[] }` (`issueSeedRegistry.ts:15`) and are pure readers of state. The seed contract is `IssueSeed` (`issueSeedTypes.ts:369`): `{ id, family, type, domain[], timing, severity, urgency, novelty, cardWorthiness, location?, primaryActor?, affectedActors[], causes[], pressures[], stakes[], responseSlots[], consequenceProfiles[], memoriesCreated[], futureHooks[], toneHints[], textIngredients, validation, generatedAt }`. Each `ResponseSlot` (`issueSeedTypes.ts:223`) carries `allowedVerbs`, `shape`, `targetOptions[]`, `expectedEffects[]`; each `ConsequenceProfile` carries `immediateEffects[]`, `delayedEffects[]`, `memories[]`, `futureHooks[]`, `impactScore`. **This seed/slot/profile shape is exactly what an Opening should reuse — same contract, opposite valence (§2.2).**

**Resource the player spends.** **Owner time, in minutes** (Phase 186 replaced abstract action points). State: `state.modules.ownerActions { timeSpent, timeBudget }` (`ownerActions/types.ts:144`); daily budget `DAY_MINUTES = 360` (`ownerActions/stateHelpers.ts:43`), reset at `startDay`. Cost tiers `TIME_COST_TRIVIAL/QUICK/SHORT/STANDARD/HEAVY = 0/30/60/120/240` (`stateHelpers.ts:49`). Each `OwnerActionDefinition` declares `timeCost` and an `apply(ctx,input)` that mutates state (`actionDefinitions.ts`, e.g. `clean_area` = 120 min). Coin (`state.coin`) is a separate spent resource. **A venture "invest" verb can spend the exact same owner-time budget — no new resource needed (confirms §4 feasibility).**

**Assumptions in the day loop that every card is reactive/damping.** Audited; the honest answer is **the *loop* makes almost none — the assumption lives in the pressure model and a few preview-polarity sites, not in card handling**:
- *(real)* Pressures cannot ratchet: `baseline = 0` recompute (`helpers.ts:45`). Not a card assumption — a state-model one.
- *(real, narrow)* Pressure polarity is hardcoded "rising = bad": `classifyMeterDisplayCategory` maps every `pressure` target to `bad_when_higher` (`generatorHelpers.ts:338`); `isRiskEffect`/`isDelayedRiskEffect`/`isDelayedBenefitEffect` treat pressure-positive as risk and pressure-negative as relief (`src/cards/compose/previewSelect.ts`). These are correct for entropy and only bite if teleology is modelled as pressure.
- *(not an assumption)* Seed generation is reactive-by-threshold (e.g. `food_safety` fires at pressure ≥ 45, `issueSeedGenerators.ts`), but the generator interface itself is neutral — an opening generator keys off ventures/identity instead of a pressure threshold with no interface change.
- *(not an assumption)* The hand/`renderCard` path is source-agnostic and already renders gains.

## §2 — Complements & rendering substrate

**Shared compose runtime exists and is source-agnostic.** Yes: `src/cards/compose/`. A `CompositionalCardTemplate { id, appliesTo, priority?, voiceRegister, slots[], toCardView(filled, seed, state) }` (`compose/types.ts:284`) is wrapped by `defineCompositionalCard(template): CardDefinition` (`compose/defineCompositionalCard.ts:18`) into the same `CardDefinition` the registry/selection use. Its **input contract is `(seed: IssueSeed, state: TavernState)`** — nothing else. `assembleSlots(slots, seed, state)` (`compose/assemble.ts:395`) fills each slot by filtering snippets on data-`conditions`, keeping the top-specificity tier, breaking ties by salience then a deterministic FNV hash of `${seed.id}::${slot.id}`. **It will render a teleology card the instant that card produces a seed-shaped input — confirmed source-agnostic.**

**Does the runtime bake in damping? — the §9-critical question. Answer: NO at the meter level; a narrow, correctable polarity coupling at the pressure level.** Evidence the runtime already handles advancement:
- `EffectDirection = 'positive' | 'negative' | 'neutral'` (`effect.ts:42`) and `EffectMeterDisplayCategory = 'good_when_higher' | 'bad_when_higher' | 'contextual' | 'resource'` (`effect.ts:50`) — a *four-way* polarity model, not a binary "down = good."
- `MAGNITUDE_LEXICON.positive` has a full upward register ("a step/notch", "a clear lift/a real step/a marked rise", "a surge/a strong climb/a wide leap") (`compose/magnitudeLexicon.ts`).
- `CardView.stakes.direction` is `'loss' | 'gain' | 'risk'` (`src/cards/types.ts:23`) — **`gain` already exists.**
- `classifyMeterDisplayCategory` already returns `good_when_higher` for higher-is-better meters (`generatorHelpers.ts:330`).

The places that *do* assume the entropy framing, to fix or avoid in §0 (all narrow):
- `generatorHelpers.ts:338` — `targetKind === 'pressure'` ⇒ `bad_when_higher` (always).
- `previewSelect.ts` — `isRiskEffect` (pressure pos/neg = risk surface), `isDelayedBenefitEffect` (pressure-negative = benefit), `isDelayedRiskEffect` (pressure-positive = risk). Coin-negative = cost is also assumed (correct for an invest verb).
- `assemble.ts` `readValence()` — derives `'distress' | 'calm' | 'neutral'` from `resolveMeterValence`/pressure direction to refuse stapling opposite-valence snippets; a rising teleology meter that is *good* would be mis-valenced **only if it routes through a pressure id**.

**Conclusion (updates Part I §0 and §9):** the seam audit is not a runtime generalization — it is (a) a guarantee that teleology effects target their own meters/state, not pressure ids, so the existing polarity classifiers never see them mislabeled, and (b) optionally a new `good_when_higher` venture-progress meter that the *existing* positive lexicon already words correctly. The "incoherent opportunity card" risk is low. **[SEQUENCE IMPACT]** §0 shrinks from "find/fix damping assumptions across the card runtime" to "confirm teleology effects never masquerade as pressures, add the ventures/arcs/transformations empty collections + migration."

**Persistence regime.** Zod-schema validation + plain-JSON serialization. `buildTavernStateSchema(modules)` composes the root (`src/sim/state/schemas.ts:725`); `validateState` parses then runs cross-reference reachability checks (`validation.ts:88`). New persistent collections are fully supported — see §3/§7 answers for the 5-step recipe.

**Where relationship/loyalty state lives, and its shape.** Distributed across six entity kinds, all 0–100 meters in plain JSON:
- Staff: `state.staff[id].loyalty` (+ `morale/stress/fatigue/skill`), plus identity-level `identity.loyalties[] / dislikes[]` (`TavernState.ts:168`).
- Regulars: `state.world.regulars[id].loyalty` + `irritation` + `visits` + `knownIncidentIds[]` (`TavernState.ts:510`).
- Customer groups: `state.customerGroups[id].loyalty` + `activeGrudges[]` + `relationshipToOtherGroups: Record<id, number>` (`TavernState.ts:208`).
- Suppliers: `state.world.suppliers[id].relationship` + `reliability` + `debtTolerance` (`TavernState.ts:489`).
- Factions: `state.world.factions[id].relationship` + `influence` + `trust` + `fear` (`TavernState.ts:473`).
- Cultures: `state.world.cultures[id].familiarity` + `comfort` + `tension` (`TavernState.ts:460`).
**Implication for arcs (§2.4):** the loyalty *number* already exists everywhere; an arc adds a staged trajectory *alongside* it (e.g. an arc whose milestone reads `regular.loyalty ≥ X`), it does not replace it. Cast members already carry `castAttributes` (Phase 121/128) — the natural attach point for a per-character arc id.

**Where identity state lives.** `state.world.tavernIdentity { foundingDay, knownFor[], houseRules[], atmosphereTags[] }` (`TavernState.ts:691`; schema `schemas.ts:668`). **Non-empty at turn one** — defaults seed `knownFor: ['cheap goblin food']`, `atmosphereTags: ['grimy floors','goblin-flavored']` (`defaults.ts:686`), and `tavernIdentityModule` recomputes all three arrays each `endDay` from reputation, enabled policies, and area/culture state. **This satisfies the cold-bootstrap requirement (§5): identity is queryable and non-empty before any venture exists.**

## §3 — Kernel feasibility

**Existing staged-progress pattern to generalize from.** **`localArcs` is the canonical match** — do not invent fresh. Types at `src/sim/content/events/localArcTypes.ts`: `LocalArcStage = 'seeded'|'rising'|'active'|'climax'|'resolved'|'failed'`; `LocalArcProgressRule { fromStage, toStage, afterDays?, pressureAbove?, memoryTagPresent?, weight? }`; `LocalArcCondition` (conjunction-of-gates start conditions); `LocalArcEffect` (discriminated union of side-effects). Module state `LocalArcsModuleState { activeArcIds, activeArcTags, activeIssueSeedTags, cooldowns, recentlyAppliedEffects, … }` (`modules/localArcs/types.ts:34`). Secondary references: `expeditions` (active→resolved with `daysElapsed/daysTotal`), area upgrades (`available→in_progress→installed→damaged→disabled`, `TavernState.ts:31`). **The kernel = the generalized `{stage, progressRules, conditions, effects, cooldowns}` shape, lifted out of `localArcs` and given a pluggable trigger + branching (§4).**

**Where a `kernel` module sits without a cycle.** Modules declare `dependsOn?: string[]` for **same-phase ordering only**; the engine enforces acyclicity via `topologicallySortModules` (`engine.ts:158`). The authoritative ordering is `FULL_PIPELINE` in `src/sim/canonicalPipeline.ts:43` (not the legacy `moduleRegistry`). Place `kernelModule` early — after state-owners (areas/stock/staff) and before the analysis tail (causes→pressures→feedback→issueSeeds) — and have `ventureModule` and `arcModule` each `dependsOn: ['kernel']`. Cross-module access is only via `ctx` getters/mutators and shared registries; **no module imports another module's files**, so the two siblings importing only `kernel` types creates no cycle. The kernel must hold structure only — the moment `if (type === 'arc')` appears inside it, that logic belongs in a sibling module (Part I §3 rule, mechanically enforceable by keeping kernel free of any domain registry import).

**Polymorphic/tagged collections.** Cleanly supported via `z.discriminatedUnion('kind', […])` — already used for `LocalArcEffect`/`LocalArcCondition` (`modules/localArcs/localArcsModule.ts`) and `EffectPreview.kind`. A stored kernel object discriminated by `kind: 'venture' | 'arc'` (or a `lifecycleKind` tag) round-trips through Zod and JSON with no special handling. Recommended: store ventures and arcs in **separate top-level collections** (`state.ventures`, `state.arcs`) that share a `LifecycleEntry` *type* from the kernel, rather than one mixed array — sibling modules each own their own slice's defaults/migration/validation, matching the existing module-slice convention, while still sharing the kernel's TS interface.

## §4 — Agency mechanics

**Existing autonomous tick (no player input).** Yes — multiple, every day, in the pre-service phases. `regularModule` (`modules/regulars/regularModule.ts`) emerges new regulars and decays/advances existing ones on `startDay`/`regularCustomerUpdate` with no player action; `expeditionsModule` advances `daysElapsed` and auto-resolves on `startDay`; `cultureUpdate`/`supplierUpdate`/`factionUpdate`/`localEventUpdate`/`rumourUpdate` phases all drift world entities autonomously. **Arc-autonomous advancement hooks straight into this pattern**: an `arcModule` hook on `startDay` (or a dedicated `arcUpdate` phase) reads each character's arc + driving meters and advances/forks/ spawns-an-opening with no investment. This is the divergence from ventures and the existing engine already supports it.

**How investment is expressed/spent → venture trigger.** Owner-time minutes against `DAY_MINUTES` (see §1), spent through an `OwnerActionDefinition.apply`. A venture's investment trigger is "an owner action (or a card choice's `ResponseIntent`) tagged to this venture spends time/coin and advances its stage." **Same mechanism, no new economy** — confirms the §4 requirement that one pluggable trigger covers both the investment-driven (venture) and autonomous/hybrid (arc) cases: the kernel's trigger is a function `(entry, ctx) => advanced?`, and the two modules supply different functions (venture reads "was this entry invested in this day?", arc reads character trajectory).

**Branching/conditional structures to match.** Two patterns to mirror for branching milestones: (a) `LocalArcProgressRule[]` — multiple gated `fromStage→toStage` rules with `weight`, the closest analogue to "this milestone forks on state"; (b) the seed `ResponseSlot[] + ConsequenceProfile[]` fan-out (`issueSeedTypes.ts:223`) where one slot has many `targetOptions` and each profile a distinct effect set; and (c) the data-`SnippetCondition` union evaluated by `evalCondition` (`src/cards/compose/conditions.ts:91`) as the model for declarative, serializable milestone gates. A branching milestone should be `{ requirements: Condition[]; outcomes: { when: Condition[]; effects: Effect[]; nextStage }[]; fallback }`, reusing the `LocalArcCondition`/`SnippetCondition` condition vocabulary so it stays data, not code.

## §5 — Entry & generation

**Existing reactive-seed generator — reuse or parallel?** **Reuse the scheduling/slotting wholesale.** Openings are seeds with `type: 'opportunity'` (the `IssueSeedType` union already includes opportunity-style types) emitted by an `IssueSeedGenerator` registered like any other; they ride the same timing passes, ranking (`issueSeedRanking.ts`), cooldown/novelty threading, and `renderCard` path. The only new logic is the generator's *trigger* (keyed off ventures/identity/relationships, not a pressure threshold) and a compose template for the opportunity family. **No parallel generator infrastructure is required.** **[SEQUENCE IMPACT]** this further de-risks phase 2.

**Identity/relationship state available at a fresh save.** Confirmed non-empty at turn one: `tavernIdentity.knownFor/atmosphereTags` are seeded (`defaults.ts:686`); starter regulars seed with `loyalty` 58–72 (`defaults.ts:505`); starter staff, suppliers, factions, cultures all instantiate from their registries with default relationship meters (`defaults.ts`). **The cold-bootstrap generator (Part I §5) has real, non-empty inputs at day 1** — it can key the first openings off `tavernIdentity` + regular/faction/culture meters with zero active ventures.

**Where an ignored/expired opening is parked.** No existing "deferred opportunity" store — this is **net-new state**, but the parking pattern exists: `localArcs` keeps `cooldowns: Record<string, number>` and `activeArcIds[]`, and `issueSeeds` keeps `recentPicks`/`cooldowns` for recency. Recommendation: a `state.openings` (or `ventures`-module sub-slice) holding `{ expired: ExpiredOpening[] }` where each carries the original seed shape + the day it expired + a snapshot of the keying state, added via the standard 5-step additive path.

**Does causality capture windowed deltas?** **Not today — causality is point-event only.** A `CauseEntry` (`modules/causes/causeTypes.ts`) records a single discrete change `{ source, target, amount, direction, weight, readable, ageDays, expiresAfterDays?, … }`. Day-boundary diffs exist (`ChangeTracker.snapshot/finalize`, `core/changeTracker.ts`; `StateDiff`/`StateChange` in `core/diff.ts`) but are computed per-day, not accumulated across an arbitrary window. **The decay/return rule (§8.1) therefore needs a new windowed accumulator**: the openings store should, when parking an expired opening, snapshot the keying meters, and on potential return compute the delta against the *current* meters (and/or scan `causes[]`/memories tagged in the window). This is the one genuinely new causality mechanism the teleology half requires; everything else reuses existing logging. **[SEQUENCE IMPACT]** budget design time for this in §8.1 before phase 2.

## §6 — Coupling points

**What a "card family" is, and where the registry is.** Two related registries:
- *Issue-seed families* (the gating unit): `CORE_ISSUE_SEED_FAMILIES` (10) + `EXPANDED_ISSUE_SEED_FAMILIES` (10) in `issueSeedTypes.ts:49`. A family is produced by one or more registered generators and consumed by `appliesTo.seedFamilies` on cards.
- *Cards*: `cardRegistry: Registry<CardDefinition>` (`src/cards/registry.ts:21`), each card declaring `appliesTo: CardAppliesTo { seedTypes?, seedFamilies?, timings?, requiredTags?, minSeverity?, minCardWorthiness?, custom? }`.

**Can families be enabled/disabled at runtime by world state?** **There is no built-in `enabled` flag, but the precedent for runtime family gating already ships.** `localArcs` emits `issue_seed_tag` effects into `activeIssueSeedTags` (`localArcsModule.ts:142`), which `issueSeedRanking.ts:161` reads to **amplify** matching seeds. That is *additive* gating (boost), not *retirement*. For transformations (§2.3) to **retire/unlock** families, the cleanest extension — given the architecture — is: (a) a transformation writes a fact into identity/world state (e.g. `tavernIdentity` tags or a new `state.transformations` set), and (b) each retirable generator early-returns `[]` when a disabling tag is present, and/or each card's `appliesTo.custom(seed, state)` predicate (the existing per-card state-aware escape hatch, `selection.ts`) checks it. **No engine change needed — gating is already a per-generator/per-card predicate over state; transformations just write the state those predicates read.** Confirm during §8.4: prefer generator-level retirement (the family stops *appearing*) over card-level (the seed appears but finds no card and hits fallback).

**Where gating/eligibility checks live; single source of truth.** Gating is **not scattered into ad-hoc globals** — it is uniformly "a pure predicate over the `ctx.state`/`state` snapshot." Sites: issue-seed generators' trigger guards (`issueSeedGenerators.ts` thresholds + `CONTRADICTION_GUARDS`); seed ranking (`issueSeedRanking.ts`, reads `activeIssueSeedTags`); card selection `appliesToMatches` (`selection.ts:22`); compose snippet `evalCondition` (`conditions.ts:91`) reading the banded **signals** surface (`src/sim/signals/`, a pure read over `TavernState`). **The single source of truth is `TavernState` itself**, read through the signals layer and `ctx`. Transformations and cross-references extend these predicates; they must not introduce a parallel truth store.

## §7 — Sequencing readiness

**Save migrations.** Idempotent additive helpers chained at load (`src/sim/state/migrations.ts` + `web/src/lib/sim/persistence.ts`). Each helper (`ensureWorldBranch`, `ensureRecipesSlice`, `ensureExpeditionsSlice`, `ensureCastAttributes`, `ensureModuleSlices`, …) checks-then-defaults and is safe to re-run. **An additive, invisible migration adding empty `ventures`/`arcs`/`transformations` collections is straightforward and has five working precedents.**

**Daily hand assembly at implementation depth (re-confirming §1).** `simulateDay` → `issueSeeds` module accumulates+ranks `state.modules.issueSeeds.seedsToday` → `gameStore.todaysSeeds` (`gameStore.svelte.ts:565`) filters valid + by `BEAT_SEED_TIMINGS` → `DayScreen.svelte:179`/`CardDeck.svelte:44` call `renderCard(seed, state)`. **To inject a second source:** register a venture/opening `IssueSeedGenerator` (cleanest — seeds merge into the same ranked list and render with no UI change), *or* if teleology cards need a distinct lane, add a sibling collection the DayScreen concatenates after `todaysSeeds`. The former requires **zero loop or UI rewrite**; the hand-composition budget (§8.5) is then enforced at the ranking/selection step.

**Dev/debug affordance pattern.** `src/sim/core/devGuard.ts` (`freezeInDev`, gated on `NODE_ENV`), and `ctx.input` carries structured input the engine reads. A dev-only venture spawn follows this: a `startDay` kernel hook reads `ctx.input.devOptions?.spawnVenture` and, under a `NODE_ENV` guard, writes a venture into `state.ventures` via `ctx.modify*`. (Also note `src/sim/core/devGuard.ts` and existing test seams in `src/sim/testing/`.)

**Smallest end-to-end phase-1 slice (no openings/transformations/arcs).** A single hardcoded venture (e.g. "Acquire a liquor licence") with: the kernel lifecycle + one venture module slice (state + Zod + defaults-empty + migration); a dev-only spawn; one `OwnerAction` (or card choice) tagged to invest owner-time that advances a stage and writes a causality entry; one compose template that renders the venture's current stage/next-requirement as a seed-shaped card injected into the hand beside triage; and a milestone whose effect writes a single identity tag (proving the ratchet persists across days/saves). That slice proves: persistence, the kernel, investment-advancement, causality-on-advancement, the two-sources-one-hand seam, and a permanent ratchet — shippable with nothing else built.

---

## §A — Questions that should have been asked but weren't

These gaps materially affect the phase plan and are not covered by any Part I mapping block.

**A1. Is the card layer pure/headless, and where exactly is the sim↔card↔UI boundary?** It matters because Part I talks about "the card runtime" as if it sits in the sim. **Finding:** the sim is fully headless and emits only `IssueSeed` data; **all** rendering is pure functions in `src/cards/` (`pickCard`/`renderCard`) invoked from `web/`. Teleology cards must obey the same purity boundary — `src/cards/` must not import `src/reports/` or anything in `web/` (layering rule in `src/cards/types.ts` header). The kernel/venture/arc *state and advancement* live in `src/sim/`; their *cards* live in `src/cards/`. Plan phases must split work across these two trees.

**A2. How is determinism/replay preserved, and what RNG streams must teleology use?** The whole sim is replay-deterministic via seeded PRNG threaded through `ctx`, with **named RNG streams for identity** (`ctx.getRngStream(streamId)`, Architectural Rule 7). Autonomous arc advancement and opening generation introduce new rolls — **they must take named streams** (e.g. `'venture'`, `'arc'`, `'opening'`) so an added roll doesn't shift existing identity/name generation. This is a hard correctness constraint absent from Part I.

**A3. What is the `ResponseIntent` → effect-application pipeline, and how does a venture-advancing choice apply its ratchet?** Cards don't mutate; a chosen `CardChoice` yields a `ResponseIntent` collected by the UI and fed to the next `simulateDay`, applied in the `applyResponses` phase via `consequenceProfiles`. A venture-advancing choice must route its permanent effect through this same pipeline (so it gets causality + diff coverage), targeting the venture/identity collection — **not** a pressure. Confirm the `applyResponses` handler can target the new collections.

**A4. What is the test-tier obligation for a new system?** `npm test` is a fast tier; heavy multi-day playtests are gated in `vitest.config.ts` `HEAVY_TEST_GLOBS` and run under `test:full`. A teleology system that only manifests over many days will need a heavy playtest file — **registered in `HEAVY_TEST_GLOBS`, nowhere else** — plus fast-tier unit tests for the kernel. Budget this per phase.

**A5. Is there an onboarding/unlock gate that should own the *first appearance* of teleology?** The **Tier 4 Progressive Onboarding arc** (`docs/plans/progressive-onboarding.md`, ISSUE-060…077, currently all `open`) reframes the first ~10 weeks and unlocks systems progressively. Openings/ventures appearing on day 1 may collide with onboarding pacing. **Decision needed:** does teleology gate behind an onboarding unlock, and does it sequence before/after that arc? Part I's §7 sequence is silent on this and the two arcs touch the same daily-hand budget.

**A6. How is the daily-hand budget *currently* enforced, so §8.5 has a real hook?** The hand is the ranked, beat-filtered `seedsToday` list; there is presently no hard cap module — count is emergent from generators + ranking + beat timings. So §8.5's "~1–2 teleology + 2–3 triage" ratio has **no existing enforcement point** and needs one (most naturally a post-ranking selection step in `issueSeeds` or a `gameStore` slice that interleaves a separate teleology lane). Flag: this is new mechanism, not a tweak.

**A7. What already reaches "back into" the entropy half, so transformations have a proven seam?** `localArcs` already biases issue-seed selection via `activeIssueSeedTags` (read in `issueSeedRanking.ts:161`) and applies `pressure_delta`/`market_condition`/`customer_group_modifier` effects through `ctx`. **Transformations are not the first system to reach back — they extend a proven seam.** This lowers the §2.3 integration-risk estimate in Part I §7 (it is still the highest-risk teleology system, but the seam is not virgin territory).

**A8. Where do labels/voice come from, to keep teleology cards consistent with the existing voice?** Compose templates carry a `voiceRegister`; magnitude words come from `MAGNITUDE_LEXICON`; entity/meter labels come from `src/reports/labels/` and registries (cards reuse colocated label maps, never importing `src/reports/`). Teleology card prose must register its own snippet pools/specs under `specs/cards/` and `src/cards/compose/pools/` to pass the existing legibility/preview gates (`compose/gates/`). Authoring obligation, not optional polish.

---

## §B — The §8 open decisions, informed by mapping

1. **Decay/return mapping (highest priority).** Mapping confirms the *required substrate is missing*: causality is point-event only (§5 answer), so the rule needs a **new windowed accumulator** in the openings store — snapshot the keying meters at expiry, compute deltas against current state (and/or scan window-tagged causes/memories) on the return roll, branch positive/negative on the sign of the meaningful delta, and emit a fresh seed-shaped opening *with a causality entry citing the delta*. Death condition = no qualifying delta within N days. This is genuinely new and must be designed before phase 2.
2. **Final naming.** Existing conventions favour plain domain nouns (`pressures`, `regulars`, `localArcs`, `expeditions`, `ownerActions`). Recommend: keep **`ventures`**, **`arcs`** (matches `localArcs`), **`openings`** (seed-family `opportunity`/`opening`), and for §2.3 a noun that reads as state — **`transformations`** or `milestones` set on `tavernIdentity`. Avoid invented coinages; align with `state.world.*` placement for world-facing entities and a top-level slice for player-pursued ventures.
3. **Kernel trigger interface.** Mapping supports a single function-shaped trigger `(entry, ctx) => { advanced: boolean; toStage?; effects? }` supplied per-module: venture passes an investment-reading trigger (did a tagged owner-action/ResponseIntent spend against this entry today), arc passes an autonomous/hybrid trigger reading character trajectory. Both run from a kernel hook on `startDay`/`applyResponses`; this matches how `localArcs`/`expeditions` advance on their own hooks.
4. **Family enable/disable.** Given §6, prefer **generator-level retirement**: a transformation writes a tag into identity/`state.transformations`; retirable generators early-return `[]` when the tag is present; unlocked generators early-return until it is. Cards' `appliesTo.custom` is the secondary lever. No engine change; mirrors the `activeIssueSeedTags` precedent but for suppression/unlock rather than amplification.
5. **Hand-composition budget.** No existing enforcement point (§A6). Add one: after `issueSeeds` ranking, a selection step that reserves ~1–2 slots for teleology seeds (by `type`/family) and ~2–3 for triage, or a `gameStore` interleave of a separate teleology lane. Decide *where* (sim ranking vs UI selection) early — it determines whether the budget is replay-deterministic (prefer sim-side).
