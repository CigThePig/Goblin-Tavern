# Teleology Phase 4b — Autonomous arc advancement + fork-on-state

> Standalone implementation record for `teleology-half-phase-plan.md` §"Phase 4b".
> Built on the 4a foundation (the `state.arcs` slice, `arcModule`, the hardcoded
> `arc_staff_mastery` arc attached to the `server` cast member, diff/cause wiring).

## Goal

Make arcs *move* on their own and surface that movement through exactly one arc
card family — proving the autonomous trigger, fork-on-state branching milestones,
causality-on-advancement, and the named `'arc'` RNG stream end to end.

## Sim scope

- **Autonomous trigger (`arcModule`).** A `startDay` tick advances every active
  arc with **no player investment**, mirroring the regulars/expeditions
  autonomous-tick pattern (contrast Phase 1's venture trigger, which reads
  owner-time). The tick:
  1. **Syncs the `proven` fork tag** from the subject cast member's *loyalty*
     driving meter (the producer for the fork condition, guardrail §10): tag
     present iff `loyalty >= PROVEN_LOYALTY`. Only writes when the tag actually
     flips, so a stable loyalty never churns causes.
  2. **Accrues progress** when loyalty clears a growth floor, drawing one roll
     from `ctx.getRngStream('arc')` to make some days strong (+2) and others
     ordinary (+1). Minimum gain 1/day keeps advancement reliable; the stream is
     load-bearing and replay-deterministic.
  3. **Advances via the kernel** with the autonomous trigger, which resolves the
     branching milestone (`resolveBranchingMilestone`) for the current stage.
     Causality on advancement is emitted by the kernel/`modifyArc` (verified).
- **Fork-on-state (`staffMasteryArc`).** The `apprentice` milestone forks on the
  `proven` tag down **two reachable branches**: proven → `journeyman` (thriving),
  not-proven → `steady`. Both rejoin at `journeyman → mastered` (terminal, writes
  the `mastered` ratchet tag). Loyalty is a real meter that moves (weekly trends),
  so both branches are reachable in shipping content — not a unit-only injection.
- **Issue-seed generator (`arcIssueSeeds`).** Emits one `staff_arc` /
  `arc_milestone` seed while the arc is active, resolving the entity from
  `state.arcs` and tagging the seed with the live `stage:` (+ `proven`) so the
  card reads the entry, never a hardcoded id/threshold. `staff_arc` is added to
  the central `IssueSeedFamilyId` union (the `arc_milestone` *type* already
  exists for `seasonal_arc`).

## Card scope (one family — `staff_arc.arc_milestone`)

A **narrator-voiced compositional template** (`staffArcTemplate`) with snippet
pools + spec, registered in `REQUIRED_CARDS` and the gate/legibility harnesses,
passing all nine compose gates. The arc entity is resolved from the seed's
`arc:<id>` primary-actor target; title and body read the entry's current stage —
no hardcoded id or literal threshold (guardrail §10). Both response choices are
acknowledgement-only (`cause`-kind effects): the arc advances autonomously, so the
card *reveals* movement rather than driving it (core design rule). `cause` effects
sidestep the magnitude/meter/cost/risk legibility rules cleanly; no `saliencePolicy`
slots, so the legibility Q1 salience check is N/A.

## Constraints honoured

- §1 layering: arc state/advancement in `src/sim/`; card a pure function in
  `src/cards/`. §2 named RNG: `'arc'` stream only. §3/§4 effect routing &
  polarity: arc effects target the arc/identity collections, never a pressure id.
- §2a §8 kernel purity: terminality is milestone data (`terminal` flag), write
  target is the injected `modifyArc` mutator — no `if (kind === 'arc')` in kernel.
  §10: fork producer (loyalty→`proven`) ships; card resolves from the seed.
- 4a loyalty-coexistence invariant preserved: the arc tick never writes the
  loyalty meter; it only *reads* it and writes `arcs.<id>` (progress/stage/tags).

## Tests

- Fast: autonomous advancement with no intent; fork resolves to both branches on
  real loyalty; causality emitted on advancement; the card passes its gates and
  renders legibly; loyalty unchanged by the arc tick.
- Heavy (`HEAVY_TEST_GLOBS`): arc autonomy over many days reaching `mastered`,
  with a replay/determinism check.
