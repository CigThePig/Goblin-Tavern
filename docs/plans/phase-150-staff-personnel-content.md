# Phase 150 — Staff & Personnel Content Matrices

**ISSUE-118.** Second phase of Movement VI of the Legible Surface arc
(`docs/plans/legible-surface-arc.md`). Follows Phase 149 / ISSUE-117
(Suppliers, Stock & Debt — the structural template this phase mirrors).

## Context

Voiced Surface made every line *speak*; the Legible Surface arc makes
every line *inform*. Movement V shipped the machinery (salience read +
multi-fact slot, preview-legibility contract, choice-distinctness gate).
Phase 4 was the first phase to author content against it — the Suppliers,
Stock & Debt cluster — and proved out a reusable cluster shape: extend
`SALIENCE_TABLES`, opt the templates into `saliencePolicy: 'multi'`,
deepen establishing pools with combo cells covering matrix corners + top
pressure×signal rungs, and add state-keyed snippets to reaction/sensory
pools so they stop standing fixed on voiceProfile alone.

**Phase 5 is the Staff & Personnel cluster.** Two compositional templates
sit in this cluster — both shipped in Voiced Surface Phase 7 (ISSUE-102,
phase 133) but never extended into the matrix the Legible Surface arc
calls for:

- **`staffAsideCard`** (`staff_identity / relationship_test / morning_prep`)
  — the loyalty-risk / blamed-staff surfacing-themselves card. Eleven
  establishing-line snippets today, mostly single-condition rungs, with
  only two two-condition combos (`est_stress_loyalty`, `est_fatigue_warning`).
  The reaction (`aside_line`) and sensory (`manner_note`) pools are
  entirely voice/tic keyed — no state-keyed variation.

- **`staffBurnoutCard`** (`staff_burnout / staff_request / morning_prep`)
  — the burnout/workload card that replaced the legacy hand-built
  "morale 30, stress 80" meter line. Twelve establishing snippets, same
  shape — mostly single-condition + two combos. Reaction and manner pools
  voice/tic keyed only.

Neither template currently appears in `SALIENCE_TABLES`. Neither has
`saliencePolicy: 'multi'` on its establishing_line slot. So today, when
both `staff.stress` and `staff.fatigue` resolve to bands, the assembler
picks whichever single-condition snippet out-specifies the other — the
two-meter pair the choice actually turns on never lands as one line.
That is the legibility gap Phase 5 closes for staff cards.

**Per-user scope decision (recorded up-front):** the Movement VI table
also names "morale" and "tenure/role" as matrix dimensions for this
cluster, but neither has a banded representation in the sim today
(`staff.morale` would require a new band signal; tenure/role are
categorical strings). Both are deferred to **Phase 17 (Deepening &
Recalibration)** where playtest tells us if they're missed. The
`staff_burnout` and `staff_loyalty_risk` pressures already provide
proxies for morale/loyalty movement, so the 9-cell stress×fatigue matrix
is the core deliverable here. **No Movement-V loopback this phase** —
every read needed by both staff families can be expressed with the six
`SalienceRead` kinds Phase 4 already shipped (`signal`, `pressure`,
`memory`, `repeat`, `hasTag`, `severity`).

## What ships

Two templates, behind nine gates, no Movement-V loopback. Mirrors the
Phase 149 shape exactly.

### A. `SALIENCE_TABLES` extension (`src/cards/compose/salience.ts`)

Two new entries — both actor-voiced (primaryActor is staff with
castAttributes per the template predicate), so reads lead with the two
staff band signals before falling to pressures, memories, and the staff
repeat-count. No new `SalienceRead` kinds.

```ts
staff_identity: { reads: [
  { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
  { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
  { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
  { kind: 'pressure', pressureId: 'staff_burnout' },
  { kind: 'memory', tag: 'identity' },
  { kind: 'memory', tag: 'warning' },
  { kind: 'repeat', subjectTag: 'staff', atLeast: 3 },
]}

staff_burnout: { reads: [
  { kind: 'signal', role: 'primaryActor', signal: 'staff.stress' },
  { kind: 'signal', role: 'primaryActor', signal: 'staff.fatigue' },
  { kind: 'pressure', pressureId: 'staff_burnout' },
  { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
  { kind: 'memory', tag: 'bonus' },
  { kind: 'memory', tag: 'workload' },
  { kind: 'memory', tag: 'risk' },
  { kind: 'repeat', subjectTag: 'staff', atLeast: 3 },
]}
```

Ordering: the two band signals lead (extremity 2 at low/high — they
carry the most decision weight), then the family's primary pressure
(burnout for the burnout family; loyalty_risk for identity), then the
secondary pressure, then choice-affecting memories, then the multi-period
repeat as the deepest rung. Memory ordering reflects each family's
generator: `staff_burnout` reads `bonus / workload / risk / priority`
memories in its seed (the existing pool already gates on the first three
— `priority` lives as `est_priority_memory` if reachable; the table
omits it since it isn't currently in the establishing pool); `staff_identity`
reads `identity / warning` memories.

### B. Multi-fact slot enablement

`staffAside.ts` and `staffBurnout.ts` establishing_line slots both gain:

```ts
saliencePolicy: 'multi',
multiFactJoin: ' — ',
```

Same join and budget (default `wordBudget * 2 = 28`) as the Phase-4
templates for consistency across Movement VI. The multi-fact join fires
only when no spec-2 combo cell matches an unanticipated state pair —
authored combos always win specificity.

Carry the same Phase-1 / ISSUE-114 explanatory comment block from
`supplierReliability.ts:73-83` so future readers understand the
saliencePolicy intent without re-reading the salience module.

### C. Exhaustive establishing matrix authoring

**`staffAside/establishingLine.ts`** — 7 new combo cells (total goes
from 11 → 18). The 9-cell stress×fatigue matrix is the core:

- **4 corner band combos** (`signalEquals stress + signalEquals fatigue`):
  - `low × low` — fresh, easy morning ("walks in clear-eyed, the week's not on them yet")
  - `low × high` — calm but worn ("steady steps, but the long week shows in the shoulders")
  - `high × low` — tense but rested ("rested, and still pulled tight before the day opens")
  - `high × high` — exhausted and tight ("tight shoulders, slow steps, the long week sitting heavy")

  The existing pool's `est_stress_loyalty` (high stress × loyalty-risk
  rising) and `est_fatigue_warning` (high fatigue × warning memory) stay
  — they cover different orthogonal pairs and outrank the band-only
  combos when their secondary read resolves.

- **3 pressure × signal/memory top rungs**:
  - `signalEquals fatigue=high + pressureRising staff_burnout`
  - `signalEquals stress=high + memoryPresent identity`
  - `pressureRising staff_loyalty_risk + memoryPresent warning`

**`staffBurnout/establishingLine.ts`** — 7 new combo cells (total 12 →
19). Same 4-corner matrix with burnout-flavored framing (this is the
card whose voice register *is* the cook's voice on burnout); 3 different
top rungs reflecting the bonus/workload/risk memory surface this family
reads instead of identity/warning:

- **4 corner band combos**:
  - `low × low`, `low × high`, `high × low`, `high × high`
- **3 pressure × memory top rungs** (the existing `est_stress_repeat`
  and `est_fatigue_burnout` cover stress×repeat and fatigue×burnout, so
  the new top rungs orthogonalise to memory):
  - `signalEquals fatigue=high + memoryPresent bonus` (bone-tired
    despite the recent reward)
  - `pressureRising staff_burnout + memoryPresent workload` (the lighter
    rota the player held — and the load creeping back anyway)
  - `pressureRising staff_burnout + repeatCount staff atLeast: 3`
    (a third request, pressure still rising)

**Invariants** (carried from Phase 149):
- Every new combo on a sim_backed slot carries ≥1 state-lookup primitive
  (`signalEquals`/`pressureRising`/`memoryPresent`/`repeatCount`) so
  `simCoherence` passes.
- The mid×mid stress×fatigue cell stays unauthored — the unconditional
  fallback handles it cleanly; the diversity gate already proved this
  shape is safe in Phase 149.
- Spec-2 combos always beat the multi-fact join when both facts resolve.

### D. State-keyed reaction & sensory pools

Additive — existing voice-keyed snippets stay (voice persists as a
layer). New spec-1 state-keyed snippets fire orthogonally and win when
state matches but voice is neutral. Pattern mirrors Phase 149's supplier
reaction-line additions.

**`staffAside/asideLine.ts`** — 8 new state-keyed snippets appended to
the existing 18 voice/tic-keyed ones:
- `signalEquals stress=high` (acknowledge own tension in first-person)
- `signalEquals stress=low` (acknowledge own steadiness)
- `signalEquals fatigue=high` (acknowledge own exhaustion)
- `pressureRising staff_loyalty_risk` (acknowledge the pulling-away)
- `pressureRising staff_burnout` (acknowledge the mounting load)
- `repeatCount staff atLeast: 3` (acknowledge the pattern)
- `memoryPresent identity` (acknowledge the past slight)
- `memoryPresent warning` (acknowledge the past warning)

**`staffAside/mannerNote.ts`** — 5 new state-keyed sensory beats added
beside the existing 10 voice/tic-keyed snippets:
- `signalEquals stress=high` (tight hands on the counter)
- `signalEquals fatigue=high` (lean against the bar, dark under the eyes)
- `pressureRising staff_burnout` (a pause too long before the answer)
- `memoryPresent warning` (a look at the door before they speak)
- `repeatCount staff atLeast: 3` (third morning posture, like they belong)

**`staffBurnout/reactionLine.ts`** — 8 new state-keyed snippets appended
to the existing 16 voice/tic-keyed ones:
- `signalEquals stress=high` (cook acknowledges own tension)
- `signalEquals fatigue=high` (cook acknowledges own exhaustion)
- `pressureRising staff_burnout` (acknowledge mounting workload)
- `pressureRising staff_loyalty_risk` (acknowledge the drift)
- `memoryPresent bonus` (warmth/acknowledgement of past bonus)
- `memoryPresent workload` (acknowledge the lighter rota)
- `repeatCount staff atLeast: 3` (third morning explanation)
- `signalEquals fatigue=high + memoryPresent bonus` (warmer but worn —
  spec 2)

**`staffBurnout/mannerNote.ts`** — 5 new state-keyed sensory beats added
beside the existing 10 voice/tic-keyed snippets:
- `signalEquals stress=high` (grip on the counter, jaw set)
- `signalEquals fatigue=high` (leaning, shadows under the eyes)
- `pressureRising staff_burnout` (the pause that says "still climbing")
- `memoryPresent risk` (a glance at the way out)
- `repeatCount staff atLeast: 3` (the rota's worn knot in the shoulders)

Word budgets carried from existing per-slot specs: aside_line ≤12,
manner_note ≤10, reaction_line ≤12. Authoring trims any overrun before
commit (Phase 149 caught two such trims; expect 0–3 here).

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — two new `SALIENCE_TABLES` entries
  (`staff_identity`, `staff_burnout`).
- `src/cards/templates/staffAside.ts` — `saliencePolicy: 'multi'` +
  `multiFactJoin: ' — '` on establishing_line slot + explanatory comment.
- `src/cards/templates/staffBurnout.ts` — same wiring.
- `src/cards/compose/pools/staffAside/{establishingLine,asideLine,mannerNote}.ts`
- `src/cards/compose/pools/staffBurnout/{establishingLine,reactionLine,mannerNote}.ts`
- `specs/cards/staff_aside.spec.yaml` + `specs/cards/staff_burnout.spec.yaml`
  — design-record additions for the new matrix cells (record only,
  authoring is in-repo per Phase-4 loop).
- `tests/cards/templates.staffAside.test.ts` + `tests/cards/templates.staffBurnout.test.ts`
  — only if a pre-existing assertion narrows to a single snippet's exact
  text that the new multi-fact policy now composes. Phase 149 had two
  such test updates; expect 0–2 here. Each update relaxes to assert the
  *salient-fact contract* (evidence of both facts present), not the
  specific path.
- `docs/ISSUE_TRACKER.md` — new ISSUE-118 entry following the Phase-149
  ISSUE-117 row's shape.

**Created:**
- `tests/cards/compose/phase150.exhaustiveMatrix.test.ts` — new file,
  ~14 tests covering matrix-cell reachability and state-varying
  reactions. Mirrors `phase149.exhaustiveMatrix.test.ts` shape:
  - 5 `staffAside` cells (4 stress×fatigue corners + 1 fatigue×burnout
    top rung), each asserting the combo's distinctive substring appears
    in `view.body[0]`
  - 5 `staffBurnout` cells (4 stress×fatigue corners + 1 fatigue×bonus
    top rung)
  - 2 state-varying reaction tests (1 per template — same seed, two
    distinct state mutations, two distinct `body[1]`s)
  - 2 re-render stability tests (1 per template — JSON.stringify equality
    across two `card.render()` calls with the same seed+state)

  Reuses the Phase 149 helpers (`withRisingPressure`, `withMemory`, and
  a new `withNeutralStaffVoice` parallel to `withNeutralSupplierVoice`
  — castAttributes axes all at 1 so voice-extreme snippets don't fire,
  isolating state-keyed snippets). New helper `staffSeed(family, staffId)`
  builds the `relationship_test` / `staff_request` seed per family with
  primaryActor wired to the test staff member.
- `docs/plans/phase-150-staff-personnel-content.md` — this file lifted
  in.

## Verification

Sequential, fail-fast — identical shape to Phase 149's verification:

1. `npm run typecheck` — types compile after the `SALIENCE_TABLES`
   additions (no shape changes; just new entries).
2. `npm test -- --run tests/cards/compose/phase146.salience.test.ts` —
   21/21 pre-existing salience tests still pass (no resolver changes
   this phase; the new tables resolve through unchanged branches).
3. `npm test -- --run tests/cards/compose/gates/` — all nine gates pass
   across the deepened pools. Watch especially `simCoherence` (every new
   combo carries ≥1 state-lookup primitive); `diversity` (the two staff
   templates' diversity samplers must still hit minDistinct thresholds
   on the deepened pools — Phase 149 saw no failures, Phase 150 expected
   the same); `dedupe` (within-slot Levenshtein ≥0.85 — the supplier
   phase rephrased two snippets to clear this; budget 2–3 such reworkings
   here).
4. `npm test -- --run tests/cards/templates.staffAside.test.ts
   tests/cards/templates.staffBurnout.test.ts` — existing template
   integration tests stay green (with any narrow-to-specific-text
   assertions relaxed per the §Critical-files note).
5. `npm test -- --run tests/cards/compose/phase150.exhaustiveMatrix.test.ts`
   — 14/14 new tests pass.
6. `npm test` — full regression green at 2680+14 = 2694 (or 2680+~17 if
   we add a couple of salience-table coverage tests for the new entries
   — see "open question" below).

## Anticipated risks

1. **Reaction-line word budget.** `asideLine` and `reactionLine` cap at
   12 words; em-dashes count as words. Phase 149 caught two such trims
   on supplier; expect a similar volume here. Trim in place pre-commit.
2. **Cook-voice consistency in staffBurnout reactions.** The new
   state-keyed reaction snippets must read as the same character speaking
   under different state — a tense cook (`stress=high`) and a tired cook
   (`fatigue=high`) shouldn't sound like two different people. Cross-
   situation voice consistency was Phase-143's job structurally; here we
   stay inside the same register and lean on the existing voice axes for
   character continuity. The state-keyed snippets are spec 1 (no axis
   gating) and play *under* whatever voiceProfile the cook has — same
   pattern Phase 149 used for supplier.
3. **Multi-fact join word overflow.** Default budget is `wordBudget * 2
   = 28`; if two existing single-condition snippets sum past 28 the
   secondary drops silently (silence beats stapling, per Phase 1
   contract). Two of the existing single-condition snippets are 11–12
   words; pairs that sum to >28 will drop the secondary. The 4-corner
   spec-2 combos handle every band×band case so the join only fires for
   unanticipated pairs (e.g. `signal × pressure` when no top-rung
   combo exists). Acceptable per design.
4. **Existing combo snippets `est_stress_loyalty` / `est_fatigue_warning`
   on staffAside.** These two pre-existing combo cells score against the
   new salience table. `est_stress_loyalty` covers indices 0 (stress
   signal) + 2 (loyalty_risk pressure) — outranks the new band×band
   `high × high` combo (which covers indices 0 + 1) on extremity tie
   because pressure_extremity (1) loses to signal-extremity-2 — wait,
   actually the band×band combo wins because both reads are extremity 2.
   This is intentional: when stress + fatigue both resolve to extreme
   bands, the band-pair line is the strongest opener; when one band
   resolves and a pressure rises, the existing combo wins.
5. **Test update count.** Phase 149 updated two existing tests; budget
   the same scale here. Each update preserves the assertion's intent
   (the headline fact is present) while loosening byte-equality to a
   salient-substring contract.

## Out of scope (deferred to later phases)

- **Morale band signal + tenure/role categorical reads** — per the
  user's up-front scope decision, deferred to Phase 17 (Deepening &
  Recalibration). The two pressures (`staff_burnout`, `staff_loyalty_risk`)
  already proxy morale/loyalty movement; the Phase-17 deepening pass can
  add `staff.morale` as a band signal if playtest names the gap.
- The six remaining Movement VI cluster phases (6–11): Regulars &
  Complaints, Factions & Culture, Premises & Atmosphere, Crises & Safety,
  Reputation & Rumour, Periodic & Narrative.
- Movement VII preview-pool authoring against `EffectDirection ×
  EffectMagnitudeBand` (Phases 12–14). The staff effectPreview pools
  stay as Phase-7 / Phase-147 authored; Movement VII recalibrates them
  per-meter.
- The Phase-16 legibility gate (needs ≥3 migrated clusters first — Phase
  5 brings the count to 2).
- Any change to sim response slot counts, verbs, targets, or effect
  amounts — composition voices around mechanics, never alters them.
- No new condition primitives; no new `resolveActorRef` roles; no
  changes to the choice-distinctness cap or preview-legibility contract
  (both Movement V; locked).

## Optional add (decide during implementation)

A 2–3-test extension to `tests/cards/compose/phase146.salience.test.ts`
asserting the two new `SALIENCE_TABLES` entries resolve as expected
against fixture states (parallel to the Phase-1 `supplier_relationship`
table coverage). Tiny cost, useful regression net if the salience surface
is touched in later cluster phases. Add unless gate run-time pressure
argues against.
