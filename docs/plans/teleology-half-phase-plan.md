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
- Pipeline placement: register `kernelModule` in `FULL_PIPELINE` (`src/sim/canonicalPipeline.ts`) after the world/state owners that teleology reads (`areas`, `stock`, `staff`, `customers`, `world`, cultures/factions/suppliers/regulars/adventurers/expeditions, owner/service, weekly/monthly, `localArcs`, and `tavernIdentity`) and before the analysis tail (`memories → history → causes → attribution → pressures → feedback → issueSeeds → responses`). This mirrors the current location of `localArcs` rather than the older shorthand "after areas/stock/staff"; re-check the current pipeline ordering before editing because it is load-bearing. `ventureModule` and `arcModule` each declare `dependsOn: ['kernel']`; neither imports the other.

**Entry model: world-offers-commit.** Ventures are never picked from a menu. Openings appear; committing to one spawns a venture; ignoring one lets it die or return transformed. The system reveals and escalates simulation truth; it does not let the player author truth from a menu.

**Family gating: generator-level retirement.** A transformation writes a tag into identity/`state.transformations`; retirable generators early-return `[]` when the tag is present, locked generators early-return until it is present. Add any new issue-seed families/types to the central `IssueSeedFamilyId` / `IssueSeedType` unions before generators emit them. Card `appliesTo.custom(seed, state)` is the secondary lever. No engine change — this mirrors the existing `activeIssueSeedTags` precedent but for suppression/unlock rather than amplification.

**Hand-composition budget: new sim-side selection step.** There is no existing enforcement point; the hand count is currently emergent from generators + validation + fairness + ranking + beat timings, with segment-local generation passes in `issueSeedModule`. Add a post-ranking selection step in that module, immediately after `rankSeeds([...existingSeeds, ...accepted])` in each generation pass, that reserves ~1–2 slots for teleology seeds (by `type`/family) and ~2–3 for triage. Keep it sim-side so it stays replay-deterministic.

**Decay/return mapping: new windowed accumulator.** Causality is point-event only today, so the decay/return rule needs new state: when an opening expires, snapshot the keying meters and the expiry day into the openings store; on the return roll, compute the delta against current meters (and/or scan window-tagged causes/memories), branch positive/negative on the sign of the meaningful delta, and emit a fresh seed-shaped opening **with a causality entry citing the delta**. Death condition = no qualifying delta within N days. Causal mutation, never random.

---

## 2. Cross-cutting constraints (every phase obeys these)

These are correctness constraints surfaced by mapping. A phase that violates one is not done, even if its feature works.

1. **Layering / purity (src/sim vs src/cards).** State and advancement live in `src/sim/`. Cards live in `src/cards/` as pure functions and must not import `src/reports/` or anything in `web/`. Every phase splits its work across these two trees: kernel/venture/arc *state* in `src/sim/`, their *cards* in `src/cards/`.
2. **Determinism / named RNG streams.** The sim is replay-deterministic via seeded PRNG threaded through `ctx`. Every new roll must take a **named** stream via `ctx.getRngStream(streamId)` — use `'venture'`, `'arc'`, `'opening'` after adding those ids to the `RngStreamId` union and `ALL_STREAM_IDS` in `src/sim/core/rng.ts`. Never add an unnamed roll; it shifts existing service/identity generation and breaks replay.
3. **Effect routing.** Teleology advances route through the existing `ResponseIntent` → `responsesModule`/`applyResponses` → `consequenceProfiles` pipeline, but the current response applier only dispatches `state_change` targets for coin, areas, stock, staff, customers, and reputation, plus pressure/cause/memory kinds. A teleology phase must first extend that applier (or add a sibling applier hook) for venture/arc/identity/transformation targets and prove those writes emit causes. Teleology effects must target the venture/arc/identity/transformation collections — **never a pressure id**. This keeps the pressure-polarity classifiers from ever seeing a teleology effect.
4. **Polarity safety.** Teleology progress is its own `good_when_higher` meter or plain stage state. It is never modelled as a pressure (pressures are recomputed from `baseline = 0` daily and structurally cannot ratchet; they are also hardcoded `bad_when_higher`).
5. **Test tiers.** Fast-tier unit tests for kernel/trigger/branch logic run in `npm test`. Any behavior that only manifests over many days gets a heavy playtest registered **only** in `HEAVY_TEST_GLOBS` (`vitest.config.ts`), run under `test:full`.
6. **Voice authoring.** Every teleology card family registers its own snippet pools/specs under `specs/cards/` and `src/cards/compose/pools/`, and must pass the existing `compose/gates/` legibility/preview gates. This is an authoring obligation per phase that ships cards, not optional polish.

### 2a. Guardrails (from the Phase 0/1 review)

These were real mistakes caught in review after Phase 0/1 merged. Each is now a binding check — a phase that touches the relevant seam is not done until it satisfies the matching rule. The §0/§1 cross-references explain *why*; these say *don't repeat it*.

7. **A new top-level state slice is invisible until it is walked.** Adding a slice (or a meaningful field on one) is not finished at the schema/defaults/migration step. It must be wired into **`createStateDiff`** (`src/sim/core/diff.ts`) — a `diff*` walk for the slice's meters (numeric), lifecycle flips (`stage`/`status`, scalar), and entry spawn/removal (keyset) — or daily reports, missed-opportunity projections, and the cause-coverage audit silently never observe it. Skip per-day-incrementing timestamps/counters (they flood the diff), same omission shape as `regulars.lastSeenDay`. The matching mutator (`ctx.modify*`) emits per-field causes only for **numeric** moves, so any mutator that can change a **non-numeric-only** field (`stage`, `status`, a tag/flag) must emit an **aggregate fallback cause** when zero per-field causes were emitted (the `if (emitted === 0 && meta)` pattern the world mutators use). The engine-path `recordSynthesizedCause` is a no-op — without the fallback, a lifecycle transition lands with no `CauseEntry`.

8. **Kernel purity is behavioral, not just the import fence.** "Free of any domain-registry import" (§1) is necessary but not sufficient. The kernel must also contain **no domain literal and no `if (kind === …)` branch**: a hardcoded terminal stage id (`if (toStage === 'licensed')`) or a venture-vs-arc write branch both belong in the calling module, not the kernel. Completion/terminality is **milestone data** (a `terminal` flag → `LifecycleTriggerResult.status`), and the slice a write lands in is supplied by the module as an injected mutator (`EntryMutator`). Reading `entry.kind` to build a tag string is fine; branching control flow on it is not.

9. **Guard/coverage tests must bind to real authored content, not a hand-written sample.** A test that asserts a property over an inline array it defines in its own body is tautological — it can never catch a regression in the thing it claims to guard. The pressure-target guard (and any "teleology effects never target a pressure" / coverage check) must scan the **actually authored** consequence-profile effects the generators emit and/or the causes a simulated day produces, and assert it found ≥1 real effect first so the guard cannot pass vacuously.

10. **Author every milestone branch onto a path the sim can reach; resolve entities from the seed, not a literal id.** A branching-milestone outcome gated on a condition nothing in the shipping content ever sets (e.g. an `expedited` tag with no producer) is dead on the real path — exercised only by a unit test that injects the condition directly. Either ship a producer for the condition or drop the outcome. Likewise, a card/template must resolve its entity from the seed's target (`venture:<id>` / `arc:<id>`) and read requirement counts from the entry's current milestone — **never** hardcode a specific venture/arc id or a literal threshold, which silently breaks the moment a second entry exists.

---

## 3. The phases

Sequencing principle: retire integration risk early while keeping each phase shippable. Phase 1 proves the kernel, the two-sources-one-hand seam, and ratchet persistence simultaneously on a single hardcoded venture. The back-reach (Phase 3) lands on an already-proven seam. Arcs (the content mass) come last on stable machinery.

### Phase 0 — Foundations (invisible)

**Goal.** Make the codebase safe to grow teleology state into, without shipping any player-visible feature.

**Scope.**
- Add empty `state.ventures`, `state.arcs`, `state.transformations` collections via the established 5-step additive pattern: type (`TavernState.ts`) → Zod schema (`schemas.ts`, composed by `buildTavernStateSchema`) → defaults (`defaults.ts`) → idempotent migration helper (`migrations.ts`) → wire into the load chain (`web/src/lib/sim/persistence.ts`).
- Confirm the `applyResponses` handler can target the new collections; if not, add the routing so a `ResponseIntent` can advance a venture/arc/identity/transformation entry (constraint 3). As of this plan's review, the current applier does **not** support those target prefixes, so this is required work rather than a verification-only item.
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
- A dev-only spawn affordance gated on `NODE_ENV` and `freezeInDev`/`devGuard` conventions. There is currently no `ctx.input.devOptions` field, so either add a typed `devOptions?: { spawnVenture?: ... }` to `SimInput` or use an existing debug/test harness input; do not reference an untyped ad-hoc property. The spawn must write a venture into `state.ventures` through a cause-emitting mutator or module-state helper, not by direct state mutation.
- Register a venture `IssueSeedGenerator` (the clean injection path — its seeds merge into the same ranked `seedsToday` list and render with no loop/UI change). Add the venture family/type to issue seed unions before emitting it. Any roll uses the `'venture'` RNG stream.

**Scope (src/cards).**
- One compose template that renders the venture's current stage / next requirement as a seed-shaped card, injected into the hand beside triage. Register its snippet pools/specs (constraint 6) so it passes the legibility/preview gates.

**Exit criteria.** With nothing else built: the hardcoded venture spawns (dev-only), appears as a card in the daily hand, advances a stage when invested in via owner-time, writes a causality entry on advancement, and its milestone tag persists across days and across a save/load cycle. Ships alone.

**Tests.** Fast tier: kernel lifecycle transitions, the investment trigger, branch-on-state milestone resolution, causality emitted on advancement. Heavy tier (`HEAVY_TEST_GLOBS`): a multi-day playtest proving the venture advances under investment and the ratchet tag survives many days.

---

### Phase 2 — Openings as the real entry path

**Goal.** Replace the dev-only spawn with the real world-offers-commit loop, including causal decay/return.

**Forward-compatibility note.** A progressive-onboarding/unlock layer will eventually gate when teleology first appears, but that work is deliberately deferred to the very end of the project and is not in scope here. Design for it cheaply now and do not build it: route the opening generator's "is teleology available yet?" check through a **single predicate that currently returns `true` unconditionally** (e.g. a `teleologyUnlocked(state)` helper hardcoded to `true`). Later, gating becomes a one-line change to that predicate rather than a rearchitecture. Build and ship Phase 2 as if openings are available from day 1; the cold-bootstrap logic stays intact regardless of when "day 1" later becomes.

**Scope (src/sim).**
- An opening `IssueSeedGenerator` emitting `type: 'opportunity'` seeds keyed off ventures/identity/relationships — not pressure thresholds. If new opening families are introduced, add them to the central issue-seed family union before generation. **Cold-bootstrap:** the first openings key off `tavernIdentity` (`knownFor`/`atmosphereTags`, non-empty at day 1) plus starter regular/faction/culture meters, with zero active ventures. Only after a venture exists do active ventures bias generation.
- Commit flow: the "pursue" response on an opening spawns a venture (kernel entry) through `applyResponses`. Retire the dev-only spawn.
- Decay/return windowed accumulator (§1): park expired openings with a meter snapshot + expiry day; on the return roll (`'opening'` RNG stream) compute the delta, branch positive/negative on its sign, emit a fresh seed-shaped opening with a causality entry citing the delta; die after N days without a qualifying delta.
- Hand-budget selection step (§1): post-ranking, reserve ~1–2 teleology slots + ~2–3 triage, sim-side for determinism.

**Scope (src/cards).** Snippet pools/specs for the `opportunity` family (constraint 6).

**Exit criteria.** A fresh save offers at least one opening on day 1 with zero ventures; committing spawns a venture; ignoring leads either to a causal death or a causally-mutated return; the daily hand holds within the budget across each segment-local generation pass; everything replays deterministically.

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

Phase 4 is the largest phase in the plan: it adds a whole new top-level slice *and* an autonomous advancement loop *and* cross-system gating *and* the biggest card-authoring mass in the project. That is too much to land as one shippable unit, and bundling them couples unrelated integration risks (a new persisted slice, a new autonomous tick, a cross-module gating seam, and a per-family voice-authoring obligation) into one reviewable change. So Phase 4 is split into four independently shippable subphases that follow the same risk-retirement order the master plan uses everywhere else: **state foundation first (invisible) → autonomous mechanics made visible through a single card family → cross-pollination on now-stable arc machinery → the full per-family card-authoring mass last.**

Each subphase below is self-contained against this file plus the codebase, carries its own Exit criteria, and obeys the §2 constraints (1–6) and §2a guardrails (7–10) that touch its seam. Build them in order; each ships alone.

Original Phase 4 framing (the umbrella goal): *give staff/regulars/factions their own wants and trajectories, advancing autonomously, cross-pollinating with ventures and transformations.*

---

#### Phase 4a — Arc slice + cast attachment (invisible foundation)

**Goal.** Make the arc state real and safe to grow into, without shipping any autonomous behaviour or player-visible card. This is the arc analogue of Phase 0/1's state work: prove persistence, diff/cause wiring, and the loyalty-coexistence invariant before any movement exists.

**Scope (src/sim).**
- `arcModule` (`dependsOn: ['kernel']`, sibling to `ventureModule`, importing neither): the `state.arcs` slice built from the shared kernel `LifecycleEntry` type (stage, milestones, conditions, effects, cooldowns), via the established 5-step additive pattern (type → Zod schema → defaults → idempotent migration → load-chain wiring), mirroring how `state.ventures`/`state.arcs` were stubbed in Phase 0. (Phase 0 added the empty collection; this fills in the arc entry shape and the module that owns it.)
- Attach arcs to cast members via a `castAttributes` arc id, so an arc is *linked to* a character without touching the existing 0–100 loyalty meter. An arc adds a staged trajectory *alongside* loyalty, never replacing it.
- One hardcoded arc seeded onto a starter cast member (no autonomy yet — it just exists at its initial stage), the arc analogue of Phase 1's single hardcoded venture, so the slice has real content to round-trip and diff.
- **Guardrail §7 (slice visibility):** wire `state.arcs` into `createStateDiff` (`src/sim/core/diff.ts`) — a `diff*` walk for arc meters (numeric), the `stage`/`status` lifecycle flip (scalar), and entry spawn/removal (keyset); skip per-day timestamps. The arc spawn/attach mutator must emit an **aggregate fallback cause** when no per-field numeric cause was emitted (the `if (emitted === 0 && meta)` pattern), so a stage/attach transition never lands without a `CauseEntry`.
- **Guardrail §8 (kernel purity):** arcs reuse the kernel unchanged; any arc-specific terminality or write target stays in `arcModule` as milestone data / an injected `EntryMutator`, never an `if (kind === 'arc')` branch or a domain literal inside the kernel.

**Scope (src/cards).** None. This subphase ships no card; existing fallback rendering is acceptable for the dormant hardcoded arc if a seed surfaces at all (prefer no seed yet).

**Exit criteria.** Schema validates with a populated `state.arcs`; a save round-trips through serialize→load; the migration is idempotent; the hardcoded arc attaches to a cast member and persists across days and a save/load cycle; `state.arcs` is walked in `createStateDiff` and an attach/spawn emits a cause; existing loyalty behaviour is byte-identical to before (a regression test asserts loyalty is unchanged by the arc slice's presence). All existing tests green.

**Tests.** Fast tier only: arc schema round-trip, migration idempotency, the diff walk emits arc changes, the spawn/attach cause is emitted, loyalty-unchanged invariant.

---

#### Phase 4b — Autonomous advancement + fork-on-state (made visible)

**Goal.** Make arcs *move* on their own and surface that movement to the player through exactly one arc card family — proving the autonomous trigger, branching (fork-on-state) milestones, causality-on-advancement, and the named RNG stream end to end.

**Scope (src/sim).**
- Autonomous/hybrid trigger supplied by `arcModule` to the kernel: arcs advance on `startDay` (or a dedicated `arcUpdate` phase) by reading character trajectory/driving meters, with **no player investment** — hooking into the existing autonomous-tick pattern used by regulars/expeditions/culture/supplier/faction updates. (Contrast Phase 1's venture trigger, which reads owner-time investment.)
- **Constraint 2 (named RNG):** any roll uses the `'arc'` stream via `ctx.getRngStream('arc')` after adding `'arc'` to the `RngStreamId` union and `ALL_STREAM_IDS` in `src/sim/core/rng.ts`. Never add an unnamed roll.
- Branching (fork-on-state) milestones using the existing `LocalArcCondition`/`SnippetCondition` vocabulary, so an arc forks on character state (e.g. high vs low driving meter → different next stage). **Guardrail §10:** every authored fork outcome must be gated on a condition the shipping content can actually reach — ship the producer for the condition or drop the branch; no dead branch exercised only by a unit test that injects the condition directly.
- A causality entry on **every** advancement (the kernel already requires this; verify the arc trigger path emits it). **Guardrail §8** still applies: terminality is milestone data, not a hardcoded stage id in the kernel.
- Register an arc `IssueSeedGenerator` emitting the arc-milestone seed for **one** arc family so advancement surfaces in the same ranked `seedsToday` hand. Add the arc family/type to the central `IssueSeedFamilyId`/`IssueSeedType` unions before emitting.

**Scope (src/cards).** **One** compose template for that single arc family, resolving its entity from the seed's `arc:<id>` target and reading requirement/stage data from the entry's current milestone — **never** a hardcoded arc id or literal threshold (guardrail §10). Register its snippet pools/specs and pass the existing `compose/gates/` legibility/preview gates (constraint 6). This is the one card family 4b ships; the rest are deferred to 4d.

**Exit criteria.** A character advances their own arc with no player input; the arc forks on character state down at least two reachable branches; each advancement writes a causality entry; the milestone surfaces as a card in the daily hand that passes the legibility/preview gates; existing loyalty behaviour is unchanged; everything replays deterministically under a fixed seed.

**Tests.** Fast tier: autonomous advancement (no intent in input), fork-on-state branch resolution on real content, causality emitted on advancement, the arc card passes its gates. Heavy tier (`HEAVY_TEST_GLOBS`): arc autonomy over many days with a replay/determinism check.

---

#### Phase 4c — Cross-pollination (arc ↔ venture / transformation)

**Goal.** Couple arcs to the rest of the teleology machine: arc milestones gate ventures and vice versa, and arc payoffs can behave like transformations or opening-biases — built on the now-stable arc slice (4a) and autonomous loop (4b).

**Scope (src/sim).**
- Cross-gating via the shared kernel type: at least one arc milestone references/gates a venture stage, and at least one venture outcome reaches back into an arc (e.g. a venture failure wounds an arc). Both directions route through the existing effect/condition vocabulary — **arc/venture effects target the arc/venture/identity/transformation collections, never a pressure id** (constraint 3/4).
- Arc payoffs that behave like transformations (write a fact/tag, reusing the Phase 3 transformation seam) or like opening-biases (bias the Phase 2 opening generator). No new engine concept — reuse the proven seams (`activeIssueSeedTags`-style gating, the transformation tag write, the opening generator's keying meters).
- **Guardrail §9 (real-content guards):** the cross-pollination guard test must scan the **actually authored** arc/venture consequence-profile effects (and/or the causes a simulated day produces), assert it found ≥1 real cross-effect first so it cannot pass vacuously, then assert the cross-gate holds and that no cross-effect targets a pressure id.
- **Guardrail §10:** the venture-failure-wounds-arc path (and any cross-gate) must resolve its target arc/venture from the seed/entry, not a hardcoded id, so it survives a second arc/venture existing.

**Scope (src/cards).** Only what's needed to keep the cross-pollination legible on the already-shipped 4b card family (e.g. a snippet noting "blocked until <arc> reaches <stage>"); no new families. New families land in 4d.

**Exit criteria.** At least one cross-pollination case works in each direction (an arc milestone unlocks a venture stage; a venture failure wounds an arc), verified to hold across many days; the real-content guard finds ≥1 authored cross-effect and none target a pressure; existing loyalty behaviour is unchanged; replay is deterministic.

**Tests.** Fast tier: the cross-gate (arc→venture) on real content; the reach-back (venture→arc) on real content; the no-pressure-target guard scanning authored effects. Heavy tier: a multi-day cross-pollination scenario (ignore/advance an arc and observe a venture stage unlock, or fail a venture and observe an arc wound) with a replay/determinism check.

---

#### Phase 4d — Arc card-authoring mass (the depth content)

**Goal.** Ship the remaining arc card families — the largest authoring obligation in the project — now that the mechanics (4a–4c) are proven and stable. This subphase is content/voice, not new mechanics.

**Scope (src/sim).** Register the issue-seed generators for the remaining arc families (add each new family/type to the central unions first). No new kernel/trigger/cross-gate mechanics — those are owned by 4a–4c. If the family count is large, this subphase may itself be sequenced as 4d-i, 4d-ii, … by family group (e.g. staff arcs, regular arcs, faction arcs), each group shippable on its own.

**Scope (src/cards).** Snippet pools/specs per remaining arc family under `specs/cards/` and `src/cards/compose/pools/`, each passing the `compose/gates/` legibility/preview gates (constraint 6). Each family resolves its entity from the seed target and reads thresholds from the entry's milestone (guardrail §10) — no hardcoded ids/thresholds.

**Exit criteria.** Each shipped arc family renders a legible card that passes the preview/legibility gates; no family ships a dead milestone branch (guardrail §10); existing loyalty behaviour is unchanged; the full suite (`test:full`) is green.

**Tests.** Fast tier: per-family gate/legibility coverage bound to the real authored pools (guardrail §9 — no tautological inline samples). Heavy tier: a long playtest exercising the arc families together, with a replay/determinism check.

---

## 4. How to use this plan

1. Pick the lowest unbuilt phase. Re-confirm the file paths it cites at the top of the session (they are a snapshot).
2. Expand that single phase into a standalone implementation doc if needed — it should stand alone, carry its own context, and assume no chat history.
3. Hold the §2 cross-cutting constraints (1–6) **and the §2a guardrails (7–10)** as a checklist; a phase isn't done until every one that touches its seam is satisfied, not just the feature.
