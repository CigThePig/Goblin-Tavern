# Goblin Tavern — The Teleology Half: Master Phase Plan

> Written 2026-06-13 against branch `claude/teleology-audit-questions`, downstream of the design + codebase mapping pass. This document is **self-contained**: a stateless implementation session should be able to act on any single phase below using only this file plus the codebase. It does not assume access to any prior conversation. Each phase is independently shippable. File paths and line numbers reflect the mapping snapshot and should be re-confirmed at the top of each session, not trusted blindly.

---

## 0. What this plan is

The game is currently an **entropy engine**: pressures rise on their own and are damped by improving underlying state. This plan adds its mirror — a **teleology engine** where state advances only when pushed, and where movement **ratchets** (permanently advances) instead of resetting. The two halves share rendering and persistence infrastructure and are coupled at the level of *meaning*, not plumbing. The reactive half is not replaced; it becomes the risk surface that threatens momentum.

Four new primitives, in dependency order: **ventures** (player-pursued staged objects, the spine), **openings** (the world proposing opportunities; the entry path), **transformations** (milestone effects that permanently change what the tavern is), **arcs** (characters with their own wants and trajectories; the depth mass).

The mapping pass confirmed the design is buildable on existing seams and changed the original sequence in specific ways, recorded under "Deltas from the original sequence" below.

---

## 1. Locked decisions

These were open before mapping. They are now settled and binding for all phases.

**Naming.** `state.ventures` and `state.arcs` are sibling top-level slices that share a `LifecycleEntry` *type* from the kernel (not one mixed array). `openings` use the issue-seed family `opportunity`/`opening`. Transformations write facts into `state.transformations` and/or `tavernIdentity` tags. World-facing entities stay under `state.world.*`; player-pursued ventures are a top-level slice. Names follow existing plain-domain-noun convention (`pressures`, `regulars`, `localArcs`, `expeditions`, `ownerActions`); no invented coinages.

**Kernel: generalize, do not invent.** The kernel is the `localArcs` shape lifted out and made generic: `{ stage, progressRules/milestones, conditions, effects, cooldowns }` plus two additions — a **pluggable advancement trigger** and **branching milestones**. The kernel holds *structure and lifecycle only*. The moment `if (kind === 'arc')` would appear inside it, that logic belongs in a sibling module. Mechanically enforce this by keeping the kernel free of any domain-registry import.

- Trigger interface: `(entry, ctx) => { advanced: boolean; toStage?: StageId; effects?: Effect[] }`, supplied per module. Ventures pass an investment-reading trigger; arcs pass an autonomous/hybrid trigger.
- Branching milestone shape: `{ requirements: Condition[]; outcomes: { when: Condition[]; effects: Effect[]; nextStage: StageId }[]; fallback }`, reusing the existing `LocalArcCondition` / `SnippetCondition` vocabulary so milestones stay declarative data, not code.
- Pipeline placement: register `kernelModule` after the state-owners (areas/stock/staff) and before the analysis tail (`causes → pressures → feedback → issueSeeds`) in `FULL_PIPELINE` (`src/sim/canonicalPipeline.ts`). `ventureModule` and `arcModule` each declare `dependsOn: ['kernel']`; neither imports the other.

**Entry model: world-offers-commit.** Ventures are never picked from a menu. Openings appear; committing to one spawns a venture; ignoring one lets it die or return transformed. The system reveals and escalates simulation truth; it does not let the player author truth from a menu.

**Family gating: generator-level retirement.** A transformation writes a tag into identity/`state.transformations`; retirable generators early-return `[]` when the tag is present, locked generators early-return until it is present. Card `appliesTo.custom(seed, state)` is the secondary lever. No engine change — this mirrors the existing `activeIssueSeedTags` precedent but for suppression/unlock rather than amplification.

**Hand-composition budget: new sim-side selection step.** There is no existing enforcement point; the hand count is currently emergent from generators + ranking + beat timings. Add a post-ranking selection step inside `issueSeeds` that reserves ~1–2 slots for teleology seeds (by `type`/family) and ~2–3 for triage. Keep it sim-side so it stays replay-deterministic.

**Decay/return mapping: new windowed accumulator.** Causality is point-event only today, so the decay/return rule needs new state: when an opening expires, snapshot the keying meters and the expiry day into the openings store; on the return roll, compute the delta against current meters (and/or scan window-tagged causes/memories), branch positive/negative on the sign of the meaningful delta, and emit a fresh seed-shaped opening **with a causality entry citing the delta**. Death condition = no qualifying delta within N days. Causal mutation, never random.

---

## 2. Cross-cutting constraints (every phase obeys these)

These are correctness constraints surfaced by mapping. A phase that violates one is not done, even if its feature works.

1. **Layering / purity (src/sim vs src/cards).** State and advancement live in `src/sim/`. Cards live in `src/cards/` as pure functions and must not import `src/reports/` or anything in `web/`. Every phase splits its work across these two trees: kernel/venture/arc *state* in `src/sim/`, their *cards* in `src/cards/`.
2. **Determinism / named RNG streams.** The sim is replay-deterministic via seeded PRNG threaded through `ctx`. Every new roll must take a **named** stream via `ctx.getRngStream(streamId)` — use `'venture'`, `'arc'`, `'opening'`. Never add an unnamed roll; it shifts existing identity/name generation and breaks replay.
3. **Effect routing.** Teleology advances route through the `ResponseIntent` → `applyResponses` → `consequenceProfiles` pipeline, targeting the venture/arc/identity collections — **never a pressure id**. This guarantees causality + diff coverage and keeps the pressure-polarity classifiers from ever seeing a teleology effect.
4. **Polarity safety.** Teleology progress is its own `good_when_higher` meter or plain stage state. It is never modelled as a pressure (pressures are recomputed from `baseline = 0` daily and structurally cannot ratchet; they are also hardcoded `bad_when_higher`).
5. **Test tiers.** Fast-tier unit tests for kernel/trigger/branch logic run in `npm test`. Any behavior that only manifests over many days gets a heavy playtest registered **only** in `HEAVY_TEST_GLOBS` (`vitest.config.ts`), run under `test:full`.
6. **Voice authoring.** Every teleology card family registers its own snippet pools/specs under `specs/cards/` and `src/cards/compose/pools/`, and must pass the existing `compose/gates/` legibility/preview gates. This is an authoring obligation per phase that ships cards, not optional polish.

---

## 3. The phases

Sequencing principle: retire integration risk early while keeping each phase shippable. Phase 1 proves the kernel, the two-sources-one-hand seam, and ratchet persistence simultaneously on a single hardcoded venture. The back-reach (Phase 3) lands on an already-proven seam. Arcs (the content mass) come last on stable machinery.

### Phase 0 — Foundations (invisible)

**Goal.** Make the codebase safe to grow teleology state into, without shipping any player-visible feature.

**Scope.**
- Add empty `state.ventures`, `state.arcs`, `state.transformations` collections via the established 5-step additive pattern: type (`TavernState.ts`) → Zod schema (`schemas.ts`, composed by `buildTavernStateSchema`) → defaults (`defaults.ts`) → idempotent migration helper (`migrations.ts`) → wire into the load chain (`web/src/lib/sim/persistence.ts`).
- Confirm the `applyResponses` handler can target the new collections; if not, add the routing so a `ResponseIntent` can advance a venture/arc/identity entry (constraint 3). This is the one thing to verify rather than assume.
- Pressure-polarity fence: document the entropy-coupled sites (`generatorHelpers.ts` pressure ⇒ `bad_when_higher`; `previewSelect.ts` `isRiskEffect`/`isDelayedRiskEffect`/`isDelayedBenefitEffect`; `assemble.ts` `readValence`) and add a test asserting no teleology effect carries a pressure target id.

**Exit criteria.** Schema validates with the new empty collections; a save round-trips through serialize→load; the migration is idempotent (re-running is a no-op); all existing tests green; a fast-tier test asserts teleology effects never target a pressure id.

**Tests.** Fast tier only. Migration idempotency, schema round-trip, the pressure-target guard.

---

### Phase 1 — Kernel + ventures spine

**Goal.** Prove the entire teleology machine on one hardcoded venture: persistence, the kernel, investment-driven advancement, causality-on-advancement, two card sources feeding one hand, and a ratchet that survives save/load.

**Scope (src/sim).**
- Lift the generalized lifecycle kernel out of `localArcs` into a `kernel` module: the `LifecycleEntry` type (stage, milestones/progressRules, conditions, effects, cooldowns), the pluggable trigger (§1), branching milestones (§1), and a causality entry on **every** advancement. Kernel imports no domain registry.
- `ventureModule` (`dependsOn: ['kernel']`): the venture slice and one investment-reading trigger — "was an owner-action or a card choice's `ResponseIntent` tagged to this entry, spending owner-time against it today?"
- One hardcoded venture: *Acquire a liquor licence* (stages → a milestone whose effect writes a single identity/transformation tag, proving the ratchet persists).
- A dev-only spawn affordance following the `devGuard` pattern: `ctx.input.devOptions?.spawnVenture`, gated on `NODE_ENV`, writes a venture into `state.ventures` via `ctx.modify*`.
- Register a venture `IssueSeedGenerator` (the clean injection path — its seeds merge into the same ranked `seedsToday` list and render with no loop/UI change). Any roll uses the `'venture'` RNG stream.

**Scope (src/cards).**
- One compose template that renders the venture's current stage / next requirement as a seed-shaped card, injected into the hand beside triage. Register its snippet pools/specs (constraint 6) so it passes the legibility/preview gates.

**Exit criteria.** With nothing else built: the hardcoded venture spawns (dev-only), appears as a card in the daily hand, advances a stage when invested in via owner-time, writes a causality entry on advancement, and its milestone tag persists across days and across a save/load cycle. Ships alone.

**Tests.** Fast tier: kernel lifecycle transitions, the investment trigger, branch-on-state milestone resolution, causality emitted on advancement. Heavy tier (`HEAVY_TEST_GLOBS`): a multi-day playtest proving the venture advances under investment and the ratchet tag survives many days.

---

### Phase 2 — Openings as the real entry path

**Goal.** Replace the dev-only spawn with the real world-offers-commit loop, including causal decay/return.

**Forward-compatibility note.** A progressive-onboarding/unlock layer will eventually gate when teleology first appears, but that work is deliberately deferred to the very end of the project and is not in scope here. Design for it cheaply now and do not build it: route the opening generator's "is teleology available yet?" check through a **single predicate that currently returns `true` unconditionally** (e.g. a `teleologyUnlocked(state)` helper hardcoded to `true`). Later, gating becomes a one-line change to that predicate rather than a rearchitecture. Build and ship Phase 2 as if openings are available from day 1; the cold-bootstrap logic stays intact regardless of when "day 1" later becomes.

**Scope (src/sim).**
- An opening `IssueSeedGenerator` emitting `type: 'opportunity'` seeds keyed off ventures/identity/relationships — not pressure thresholds. **Cold-bootstrap:** the first openings key off `tavernIdentity` (`knownFor`/`atmosphereTags`, non-empty at day 1) plus starter regular/faction/culture meters, with zero active ventures. Only after a venture exists do active ventures bias generation.
- Commit flow: the "pursue" response on an opening spawns a venture (kernel entry) through `applyResponses`. Retire the dev-only spawn.
- Decay/return windowed accumulator (§1): park expired openings with a meter snapshot + expiry day; on the return roll (`'opening'` RNG stream) compute the delta, branch positive/negative on its sign, emit a fresh seed-shaped opening with a causality entry citing the delta; die after N dayless of qualifying delta.
- Hand-budget selection step (§1): post-ranking, reserve ~1–2 teleology slots + ~2–3 triage, sim-side for determinism.

**Scope (src/cards).** Snippet pools/specs for the `opportunity` family (constraint 6).

**Exit criteria.** A fresh save offers at least one opening on day 1 with zero ventures; committing spawns a venture; ignoring leads either to a causal death or a causally-mutated return; the daily hand holds within the budget; everything replays deterministically.

**Tests.** Fast tier: cold-bootstrap yields ≥1 opening with zero ventures; commit→spawn; decay/return branch selection given a synthetic delta; budget reservation. Heavy tier: the full ignore→mutate→return loop over many days, and a determinism/replay check.

---

### Phase 3 — Transformations (the ratchet across both halves)

**Goal.** Let a venture milestone permanently change what the tavern is, and have that gate content in both halves.

**Note.** Not virgin territory — `localArcs` already reaches back into the entropy half via `activeIssueSeedTags`. Transformations extend that proven seam. Still the highest-risk teleology system, so build it deliberately on now-stable seams, not while other systems are in motion.

**Scope (src/sim).**
- A transformation = a kernel effect kind that writes a fact into `state.transformations` / `tavernIdentity`, with a causality entry.
- Generator-level family gating (§1): retirable generators early-return `[]` when a disabling tag is present; locked generators early-return until an enabling tag is present. Prefer generator-level (the family stops *appearing*) over card-level (the seed appears but finds no card and hits fallback). Card `appliesTo.custom` is the secondary lever.

**Exit criteria.** Reaching a designated venture milestone fires a transformation that (a) persists, (b) retires at least one entropy-half family so it stops appearing, and (c) unlocks at least one previously-locked family — verified to hold across many days.

**Tests.** Fast tier: a transformation writes its tag and the gated generators flip. Heavy tier: a retired family never reappears post-transformation across a long playtest; an unlocked family appears only after.

---

### Phase 4 — Character arcs (the depth mass)

**Goal.** Give staff/regulars/factions their own wants and trajectories, advancing autonomously, cross-pollinating with ventures and transformations.

**Scope (src/sim).**
- `arcModule` (`dependsOn: ['kernel']`, sibling to `ventureModule`, importing neither): the arc slice, attached to cast members via a `castAttributes` arc id. An arc adds a staged trajectory *alongside* the existing 0–100 loyalty meter, never replacing it.
- Autonomous/hybrid trigger: arcs advance on `startDay` (or a dedicated `arcUpdate` phase) by reading character trajectory/driving meters, with no player investment — hooking into the existing autonomous-tick pattern used by regulars/expeditions/culture/supplier/faction updates. Rolls use the `'arc'` RNG stream.
- Cross-pollination: arc milestones reference/gate ventures and vice versa via the shared kernel type; arc payoffs may behave like transformations or opening-biases.

**Scope (src/cards).** Snippet pools/specs per arc family — the largest authoring mass (constraint 6).

**Exit criteria.** A character advances their own arc with no player input, can fork on character state, and at least one cross-pollination case works (an arc milestone unlocks a venture stage, or a venture failure wounds an arc). Existing loyalty behavior is unchanged.

**Tests.** Fast tier: autonomous advancement, fork-on-state, the cross-gate. Heavy tier: arc autonomy over many days plus a cross-pollination scenario, with a replay/determinism check.

---

## 4. How to use this plan

1. Pick the lowest unbuilt phase. Re-confirm the file paths it cites at the top of the session (they are a snapshot).
2. Expand that single phase into a standalone implementation doc if needed — it should stand alone, carry its own context, and assume no chat history.
3. Hold the §2 cross-cutting constraints as a checklist; a phase isn't done until all six are satisfied, not just the feature.
