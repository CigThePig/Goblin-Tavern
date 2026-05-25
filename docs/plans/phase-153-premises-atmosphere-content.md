# Phase 153 — Premises & Atmosphere Content Matrices

**ISSUE-121.** Fifth phase of Movement VI of the Legible Surface arc
(`docs/plans/legible-surface-arc.md`). Mirrors Phase 149 / ISSUE-117
(Suppliers, Stock & Debt), Phase 150 / ISSUE-118 (Staff & Personnel),
Phase 151 / ISSUE-119 (Regulars & Complaints), and Phase 152 / ISSUE-120
(Factions & Culture) — no Movement-V loopback, same nine gates, same
authoring loop. **Differs from prior cluster phases:** *both* templates
author 3-meter cube corners (per up-front AskUserQuestion scope
decision), so this is the first cluster where every template in the
cluster authors at spec-3. Phase 152's cultureConflict was the first
3-meter template in the codebase; Phase 153 makes the pattern routine.

## Context

Voiced Surface made every line *speak*; the Legible Surface arc makes
every line *inform*. Movement V shipped the machinery (Phases 146-148:
salience read + multi-fact establishing slot, preview-legibility
contract, choice-distinctness gate). Movement VI Phases 4-7 then proved
the cluster shape: extend `SALIENCE_TABLES`, opt the templates into
`saliencePolicy: 'multi'`, deepen establishing pools with matrix-corner
combos covering the band axis the situation turns on, and add
state-keyed snippets to reaction/sensory pools so they stop standing
fixed on `voiceProfile` alone.

**Phase 8 is the Premises & Atmosphere cluster.** Two compositional
templates share this cluster, both shipped in Voiced Surface Phase 137 /
ISSUE-106 as **narrator-voiced** (areas have no `castAttributes` — they
are rooms, not characters) but neither extended into the matrix the
Legible Surface arc calls for:

- **`maintenanceCard`** (`maintenance.maintenance_problem /
  morning_prep`) — picks an area by `damage + (60 − condition)` and
  applies a recency penalty (`issueSeedGenerators.ts:651-855`). The
  selection axis is `damage × condition` — high damage drives the score
  up; low condition does the same. **10 establishing snippets today**:
  1 fallback + 7 single-condition rungs (`signalEquals area.damage` /
  `area.condition` (one band each), `pressureRising maintenance`, three
  memories: `warning` / `ignored` / `patch`, `repeatCount maintenance`)
  + 2 two-condition combos (`est_damage_high_rising`: damage+pressure;
  `est_high_severity_repeat`: severity+repeat). **Zero damage × condition
  corner combos** — the very meter pair the picker turns on. Reaction
  pool (13 snippets) and sensory pool (9 snippets) carry some
  state-keyed snippets via memory / hasTag / pressure / severity, but
  no `signalEquals` branching on cleanliness, and the matrix face the
  card opens on is entirely uncovered.

- **`areaAtmosphereCard`** (`area_atmosphere.warning / morning_prep`) —
  picks an area by `(100 − cleanliness) + damage` (must score ≥ 60)
  with the same recency penalty (`expandedSeedGenerators.ts:2480-2761`).
  The selection axis is `cleanliness × damage` — low cleanliness drives
  the score up; high damage adds to it; rarely picks cleanliness=high
  + damage=low. **10 establishing snippets today**: 1 fallback + 7
  single-condition rungs (`signalEquals area.cleanliness` /
  `area.damage` (one band each), `pressureRising maintenance`, three
  memories: `atmosphere` / `neglected` / `cleaning` (plus `repair` as
  fourth memory), `repeatCount atmosphere`) + 2 two-condition combos
  (`est_cleanliness_pressure`: cleanliness+pressure;
  `est_high_severity_repeat`: severity+repeat). **Zero cleanliness ×
  damage corner combos.** Reaction pool (13 snippets) and sensory pool
  (10 snippets) follow the same shape as maintenance: some state keying
  via memory / hasTag / pressure / reputation / severity, no
  `signalEquals` branching on the third meter (`area.condition` for
  area_atmosphere), and the picker axis face is uncovered.

Neither `maintenance` nor `area_atmosphere` currently appears in
`SALIENCE_TABLES` (`src/cards/compose/salience.ts`). So today, when
maintenance resolves both `area.damage` and `area.condition` to bands,
the assembler picks whichever single-condition snippet out-specifies
the other — the two-meter pair the picker turns on never lands as one
line. Same gap on the area_atmosphere side for `cleanliness × damage`.
That is the legibility gap Phase 8 closes.

**Per-user scope decision (recorded up-front via AskUserQuestion):**
**Both templates author 3-meter cube corners.** Each picker is a 2-meter
function, but the Movement VI table names the *cluster* as
`area.condition × area.cleanliness × area.damage` ("state *which* is
failing and *how badly*") — a 3-meter design space. Per the user's
choice, each template fixes one extreme on its picker's primary axis
and spans the orthogonal 2×2 face of the other two meters at spec 3,
supplemented by spec-2 supports for the off-extreme picker cells.

For **maintenance**: 4 spec-3 cube corners fix `damage=high` and span
`condition × cleanliness` 2×2; 4 spec-2 supports cover `damage=mid ×
condition=low` (the alternate picker-driving cell) and the
`damage=high × condition=high` reachable via low cleanliness.

For **area_atmosphere**: 4 spec-3 cube corners fix `cleanliness=low`
and span `damage × condition` 2×2; 4 spec-2 supports cover
`cleanliness=mid × damage=high` (the alternate picker-driving cell).

Each template's third meter (cleanliness for maintenance, condition
for area_atmosphere) shows up at spec 3 as the cube-face variation and
at spec 2 as the supporting band-band combinations. Total ~24 new
combo cells across both templates — heavier authoring than the
2-meter-only Phase 151, comparable to Phase 152's culture cube
(11 new cells + 7 faction new cells).

**No Movement-V loopback this phase** — every read needed by both
families expresses with the six `SalienceRead` kinds Phase 4 already
shipped (`signal`, `pressure`, `memory`, `repeat`, `hasTag`,
`severity`). All three area meters (`area.condition`, `area.cleanliness`,
`area.damage`) are banded `[40, 70]` in `src/sim/signals/bands.ts`
(Phase 137 added `area.damage`). The `'location'` role string was
added to `resolveActorRef` in Phase 137 / ISSUE-106 — both templates
read area meters through it today.

## What ships

Two narrator-voiced templates with full 3-meter establishing-matrix
treatment behind nine gates, no Movement-V loopback. Mirrors Phase 152
cultureConflict's spec-3 cube authoring; applies it twice in one
cluster.

### A. `SALIENCE_TABLES` extension (`src/cards/compose/salience.ts`)

Two new entries — `maintenance` and `area_atmosphere`. Narrator-voiced
(no actor castAttributes; reads are signal/pressure/memory/hasTag/
repeat only — no voice-axis or verbal-tic conditions in the pools).
Both families resolve `role: 'location'` to the area through the
Phase-137 resolver extension. No new `SalienceRead` kinds.

```ts
maintenance: { reads: [
  { kind: 'signal', role: 'location', signal: 'area.damage' },
  { kind: 'signal', role: 'location', signal: 'area.condition' },
  { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
  { kind: 'pressure', pressureId: 'maintenance' },
  { kind: 'memory', tag: 'warning' },
  { kind: 'memory', tag: 'ignored' },
  { kind: 'memory', tag: 'patch' },
  { kind: 'memory', tag: 'maintenance' },
  { kind: 'hasTag', tag: 'inspection_relevant' },
  { kind: 'hasTag', tag: 'fire_risk' },
  { kind: 'repeat', subjectTag: 'maintenance', atLeast: 3 },
]}

area_atmosphere: { reads: [
  { kind: 'signal', role: 'location', signal: 'area.cleanliness' },
  { kind: 'signal', role: 'location', signal: 'area.damage' },
  { kind: 'signal', role: 'location', signal: 'area.condition' },
  { kind: 'pressure', pressureId: 'maintenance' },
  { kind: 'memory', tag: 'atmosphere' },
  { kind: 'memory', tag: 'neglected' },
  { kind: 'memory', tag: 'cleaning' },
  { kind: 'memory', tag: 'repair' },
  { kind: 'hasTag', tag: 'reputation' },
  { kind: 'hasTag', tag: 'inspection_negative' },
  { kind: 'hasTag', tag: 'merchant_sensitive' },
  { kind: 'repeat', subjectTag: 'atmosphere', atLeast: 3 },
]}
```

**Ordering rationale:**
- **maintenance** leads with `area.damage` (the strictly dominant
  picker-driver: higher damage = higher score, no inversion) followed
  by `area.condition` (the second picker meter, inverted: `60 − condition`)
  and then `area.cleanliness` as the third meter (cube-face variation,
  decision-relevant for "which failing — structural or sanitary?").
  The single family pressure (`maintenance`) comes after the three
  signals. Memory order mirrors the generator's prior-choice tag
  emissions (`warning` first because it's the player's standing
  forewarning, then `ignored` for the explicit-choice path, then
  `patch` for the temporary-fix path, then the generic `maintenance`
  bucket). Two `hasTag` reads (`inspection_relevant`, `fire_risk`)
  surface from the seed's toneHints and gate top-rung escalation
  snippets in the existing pool — included as salience entries to make
  the salience read enumerable for the Phase-16 gate.
- **area_atmosphere** leads with `area.cleanliness` (the strictly
  dominant picker-driver: `100 − cleanliness` weight; low cleanliness
  is the primary cell), then `area.damage` (the second picker meter,
  direct contribution), then `area.condition` (the cube-face third).
  Same pressure, then memories matching the generator's tag emissions
  (`atmosphere` first as the family bucket, then `neglected` /
  `cleaning` / `repair` matching prior-choice tag paths). Three
  `hasTag` reads (`reputation`, `inspection_negative`,
  `merchant_sensitive`) gate top-rung snippets in the existing pool.

The `repeat` read is the deepest rung for each (the multi-period
pattern). For both families the `severity` read is **not** added — the
existing pool's `severityAtLeast` combos handle escalation and severity
isn't the *headline* salient fact for premises (the picker doesn't
threshold on severity; severity is a downstream signal of the meters).
This mirrors Phase 152's choice to not add severity to faction /
culture salience.

### B. Multi-fact slot enablement

Both template files gain the same wiring on their `establishing_line`
slot:

```ts
saliencePolicy: 'multi',
multiFactJoin: ' — ',
```

Same join and default budget (`wordBudget * 2 = 28`) as Phase 149-152.
Multi-fact join fires only when no authored spec-2 / spec-3 cell
matches an unanticipated state combination — authored combos always
win specificity.

Carry the explanatory comment block lifted from
`supplierReliability.ts:73-83` and adapted in `cultureConflict.ts:73-89`
(the 3-meter note). For each template the comment notes:
- maintenance: "the cube is authored at 4 spec-3 corners fixing
  `damage=high` and spanning `condition × cleanliness` 2×2;
  multi-fact join is the fallback for unanticipated band pairs the
  spec-2/spec-3 cells don't catch."
- area_atmosphere: "the cube is authored at 4 spec-3 corners fixing
  `cleanliness=low` and spanning `damage × condition` 2×2;
  multi-fact join is the fallback for unanticipated band pairs."

### C. Exhaustive establishing matrix authoring

**Important asymmetries:**

- `maintenance` picker scores `damage + (60 − condition)`. The 4 spec-3
  cube corners fix `damage=high` (the picker's dominant lever) and
  span `condition × cleanliness` 2×2 (low/high × low/high). The 4
  spec-2 supports cover the alternate picker-driving cell
  (`damage=mid × condition=low`) and the `damage=high` spec-2 row
  where cleanliness is unauthored at spec-3.
- `area_atmosphere` picker scores `(100 − cleanliness) + damage` and
  requires score ≥ 60. So cleanliness is typically low or mid, damage
  is typically mid or high. The 4 spec-3 corners fix `cleanliness=low`
  and span `damage × condition` 2×2. The 4 spec-2 supports cover
  `cleanliness=mid × damage=high` cells where condition varies.

**`maintenance/establishingLine.ts`** — 11 new combo cells (total
goes 10 → 21):

- **4 spec-3 cube corners** (`signalEquals area.damage=high +
  signalEquals area.condition + signalEquals area.cleanliness`,
  all spec 3) — narrator framing, vary imagery per corner so dedupe
  has room:
  - `est_high_dmg_high_cond_high_clean` — visible damage on an
    otherwise pristine, well-built room ("the gouge across an
    otherwise-careful wall stands out at the door")
  - `est_high_dmg_high_cond_low_clean` — damage on a sound but
    grubby room; cleaning could mask but doesn't ("a fresh split in
    a stretch of timber that hasn't been scrubbed in weeks")
  - `est_high_dmg_low_cond_high_clean` — sanitary but structurally
    failing ("the floor's swept clean and the joist beneath it is
    listing badly")
  - `est_high_dmg_low_cond_low_clean` — the worst-case room;
    structural failure compounded ("a wreck of a corner, with no
    pretence of upkeep to soften it")

- **4 spec-2 damage × condition supports** (for `cleanliness=mid` or
  when one signal is unbanded):
  - `est_high_dmg_high_cond` — sudden harm to a well-kept room
  - `est_high_dmg_low_cond` — long-overdue room with fresh damage
  - `est_mid_dmg_low_cond` — quiet decline; deferred maintenance
    becoming structural
  - `est_high_dmg_mid_cond` — visible harm on an average room

- **3 pressure / memory / hasTag top rungs**:
  - `signalEquals area.damage=high + pressureRising maintenance`
    (the meter and the trend agreeing — beats existing
    `est_damage_high_rising` on extremity sum because both reads are
    extremity 2 here, vs the existing 2+1)
  - `signalEquals area.condition=low + memoryPresent warning`
    (today's failure built on a standing warning)
  - `hasTag fire_risk + memoryPresent ignored`
    (the risk we've already chosen to live with — escalation)

  The existing combos `est_damage_high_rising` (damage + pressure,
  spec 2) and `est_high_severity_repeat` (severity + repeat, spec 2)
  stay — both cover orthogonal pairs the new combos don't.

**`area_atmosphere/establishingLine.ts`** — 11 new combo cells (total
goes 10 → 21). Same shape — 4 spec-3 cube corners + 4 spec-2 supports
+ 3 top rungs:

- **4 spec-3 cube corners** (`signalEquals area.cleanliness=low +
  signalEquals area.damage + signalEquals area.condition`, all spec 3):
  - `est_low_clean_high_dmg_high_cond` — grime on a sound, sturdy
    room ("dust thick on rafters the carpentry of which would still
    pass any test")
  - `est_low_clean_high_dmg_low_cond` — neglect compounding;
    nothing's been tended ("the room reads as nobody's bothered with
    it for a long stretch")
  - `est_low_clean_low_dmg_high_cond` — small mess, intact bones;
    the easiest recovery, the most embarrassing surface ("a strong
    room let dirty enough that the kindness of its build can't hide
    it")
  - `est_low_clean_low_dmg_low_cond` — slow general decline; nothing
    catastrophic, nothing right ("the kind of slip nobody catches
    until the regulars stop sitting there")

- **4 spec-2 cleanliness × damage supports** (for `condition=mid`):
  - `est_low_clean_high_dmg` — grime layered over real damage
  - `est_low_clean_mid_dmg` — the standard atmosphere case
  - `est_mid_clean_high_dmg` — passable cleaning, real damage
    showing through
  - `est_high_clean_high_dmg` — the rare clean-but-damaged room
    (visible because nothing else is in the way)

- **3 pressure / memory / hasTag top rungs**:
  - `signalEquals area.cleanliness=low + pressureRising maintenance`
    (cleanliness and tavern-wide pressure agreeing)
  - `signalEquals area.damage=high + memoryPresent neglected`
    (today's harm built on standing neglect)
  - `hasTag reputation + memoryPresent atmosphere`
    (the reputation-relevant room with prior atmosphere choices)

  The existing combos `est_cleanliness_pressure` (cleanliness +
  pressure, spec 2) and `est_high_severity_repeat` (severity +
  repeat, spec 2) stay — orthogonal pairs.

**Invariants** (carried from Phase 149-152):
- Every new combo on a sim_backed slot carries ≥1 state-lookup
  primitive so `simCoherence` passes. `hasTag` is not a state-lookup
  on its own — the third top rung in each pool (`hasTag X +
  memoryPresent Y`) uses memory as the state-lookup; the
  `hasTag fire_risk + memoryPresent ignored` and `hasTag reputation +
  memoryPresent atmosphere` combos satisfy this. The 4 spec-3 cube
  corners each carry 3 signal-lookup primitives, well-covered.
- The mid×mid cells (and mid-third-meter slots on the cube faces)
  stay unauthored — the unconditional fallback handles them cleanly.
- Spec-3 combos beat spec-2 combos beat single-condition snippets;
  the multi-fact join is the fallback for unanticipated state pairs
  where no authored cell matches.
- The cube's spec-3 corners are budgeted at ≤14 words (the slot's
  `wordBudget`). 14 words is tight for three conditions plus prose
  — anticipated risk #1 below; the drafts above sit at 11-14.

### D. State-keyed reaction & sensory pools

Additive — existing voice-keyed and severity-keyed snippets stay.
New spec-1 state-keyed snippets fire orthogonally and win when state
matches but no higher-rung snippet does. Pattern mirrors Phase 149-152
reaction/manner additions. **Narrator framing throughout** — areas
have no individual voice; the owner's morning read is the narrator.

**`maintenance/reactionLine.ts`** — 6 new state-keyed snippets
appended to the existing 13 (the existing pool already covers tone
tags + memories + severity + pressure + repeat — the genuine coverage
gap is `signalEquals` reads on the three area meters):
- `signalEquals area.damage=high` (the gouge / split / sag the
  narrator's eye lands on)
- `signalEquals area.condition=low` (the room reads tired in the
  morning light)
- `signalEquals area.cleanliness=low` (a wash hasn't been near this
  corner in days)
- `signalEquals area.condition=high + signalEquals area.damage=high`
  (a strong room with one bad surface; the contrast is the read)
- `pressureRising maintenance + memoryPresent warning` (the warning
  cashing in)
- `repeatCount maintenance atLeast: 3 + memoryPresent ignored` (the
  pattern we've made ours)

**`maintenance/mannerNote.ts`** — 5 new state-keyed sensory beats
appended to the existing 9 (existing pool covers severity / 2
memories / pressure / inspection / repeat; gap is signal reads):
- `signalEquals area.damage=high` (the splinter underfoot at the
  door)
- `signalEquals area.condition=low` (the give of a floorboard that
  shouldn't give)
- `signalEquals area.cleanliness=low` (the smell at the threshold)
- `pressureRising maintenance + memoryPresent ignored` (a glance
  past where the fix was supposed to go)
- `signalEquals area.damage=high + hasTag fire_risk` (the char-mark
  on the timber, no longer plausibly old)

**`area_atmosphere/reactionLine.ts`** — 6 new state-keyed snippets
appended to the existing 13 (existing pool covers reputation /
inspection / merchant / urgent / severity / pressure / 3 memories /
repeat; gap is signal reads on the three area meters):
- `signalEquals area.cleanliness=low` (the smear on the table the
  owner doesn't wipe in front of customers)
- `signalEquals area.damage=high` (the broken slat behind the bench
  the regulars know to avoid)
- `signalEquals area.condition=low` (the slow read of a room
  showing its age)
- `signalEquals area.cleanliness=low + signalEquals area.damage=high`
  (grime layered on real wear — the read both speaks)
- `pressureRising maintenance + memoryPresent atmosphere` (the
  atmosphere choice we made, now the atmosphere we have)
- `repeatCount atmosphere atLeast: 3 + memoryPresent neglected`
  (third weekly reading, same room)

**`area_atmosphere/mannerNote.ts`** — 5 new state-keyed sensory
beats appended to the existing 10 (existing covers severity / 2
memories / pressure / reputation / repeat; gap is signal reads):
- `signalEquals area.cleanliness=low` (the patron's coat hem brushed
  back from the bench)
- `signalEquals area.damage=high` (the table that doesn't sit level
  any more)
- `signalEquals area.condition=low` (the door catching at the jamb
  again)
- `signalEquals area.cleanliness=low + hasTag merchant_sensitive`
  (the merchant's eyebrow lifting at the wall behind the bar)
- `pressureRising maintenance + memoryPresent repair` (the patched
  spot bowing again)

Word budgets carried from existing per-slot specs: `reaction_line ≤
12`, `manner_note ≤ 10`. Pre-commit trim any overrun (Phase 149
caught two; Phase 150 0-3; Phase 151 1-2; Phase 152 2 trims; budget
2-4 here given the spec-3 cube + larger overall volume).

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — two new `SALIENCE_TABLES` entries
  (`maintenance`, `area_atmosphere`); no `SalienceRead` shape changes.
- `src/cards/templates/maintenance.ts` — `saliencePolicy: 'multi'` +
  `multiFactJoin: ' — '` on `establishing_line` slot + explanatory
  comment block lifted from `supplierReliability.ts:73-83` and adapted
  with the maintenance cube note.
- `src/cards/templates/areaAtmosphere.ts` — same wiring + adapted
  comment for the cleanliness-fixed cube.
- `src/cards/compose/pools/maintenance/{establishingLine,reactionLine,mannerNote}.ts`
  — combo cells (incl. 4 spec-3) + state-keyed snippets.
- `src/cards/compose/pools/areaAtmosphere/{establishingLine,reactionLine,mannerNote}.ts`
  — combo cells (incl. 4 spec-3) + state-keyed snippets.
- `specs/cards/maintenance.spec.yaml` + `specs/cards/area_atmosphere.spec.yaml`
  — design-record additions for the new matrix cells and state-keyed
  snippets (record only; authoring is in-repo per the Phase-4 loop;
  create the files if they don't exist as YAML records yet — earlier
  cluster phases all added them as record-only artifacts).
- `tests/cards/templates.maintenance.test.ts` +
  `tests/cards/templates.areaAtmosphere.test.ts` — only where a
  pre-existing assertion narrows to a single snippet's exact text
  that the new multi-fact policy or new combo cell now composes.
  Phase 149 had two updates, Phase 150 had two, Phase 151 had three,
  Phase 152 had three. Budget 2-4 here (3-meter cube authoring on
  both templates raises the chance of pre-existing assertions
  shifting).
- `tests/cards/compose/gates/samplers.ts` — extend
  `buildAreaAtmosphereDiversitySampler` to add `damage` perturbation
  to its area-meter perturbation table (currently only varies
  cleanliness × condition — Phase 8 adds `area.damage` as a salient
  signal and authors cube corners requiring damage variation;
  diversity gate will underperform without it). Extend
  `buildMaintenanceDiversitySampler` to add `cleanliness`
  perturbation (currently only varies damage × condition; same
  cube-corner reason). Budget ~5-8 new perturbation entries per
  sampler.
- `docs/ISSUE_TRACKER.md` — new ISSUE-121 entry following the
  ISSUE-117 / ISSUE-118 / ISSUE-119 / ISSUE-120 row shape.
- `docs/plans/legible-surface-arc.md` — no edits; the arc doc names
  Phase 8 with provisional ids already (phase 153 / ISSUE-121).

**Created:**
- `tests/cards/compose/phase153.exhaustiveMatrix.test.ts` — new file,
  ~20-22 tests mirroring `phase152.exhaustiveMatrix.test.ts`:
  - 8 `maintenance` cells (4 spec-3 cube corners + 4 spec-2 supports),
    each asserting the combo's distinctive substring appears in
    `view.body[0]`
  - 8 `areaAtmosphere` cells (4 spec-3 cube corners + 4 spec-2
    supports)
  - 2 top-rung tests (1 per template: maintenance damage=high ×
    pressureRising; areaAtmosphere cleanliness=low × pressureRising)
  - 2 state-varying reaction tests (1 per template — same seed, two
    distinct state mutations, two distinct `body[1]`s)
  - 2 re-render stability tests (1 per template — JSON equality
    across two `card.render()` calls with the same seed+state)

  Reuses Phase 149-152 helpers (`withRisingPressure`, `withMemory`);
  adds new builders `maintenanceSeed(areaId)` and
  `atmosphereSeed(areaId)` parallel to the existing `supplierSeed` /
  `regularSeed` / `cohortSeed` / `factionSeed` / `cultureSeed`. Adds
  `withAreaMeters(state, areaId, damage, condition, cleanliness)`
  helper parallel to the existing `withStaffMeters` /
  `withCultureMeters`. **No `withNeutralVoice` helper needed** —
  both templates are narrator-voiced.

  **Optional add (decide during implementation):** 2-3-test extension
  to `tests/cards/compose/phase146.salience.test.ts` asserting the
  two new `SALIENCE_TABLES` entries resolve as expected against
  fixture states (parallel to existing supplier / staff / regular /
  cohort / faction / culture coverage). Tiny cost, useful regression
  net. Add unless gate run-time pressure argues against
  (Phases 150-152 all added this).

- `docs/plans/phase-153-premises-atmosphere-content.md` — this file
  lifted in.

## Verification

Sequential, fail-fast — identical shape to Phase 149-152:

1. `npm run typecheck` — types compile after the `SALIENCE_TABLES`
   additions (no shape changes; just new entries).
2. `npm test -- --run tests/cards/compose/phase146.salience.test.ts` —
   pre-existing salience tests still pass (no resolver changes this
   phase; new tables resolve through unchanged branches). Plus any
   optional new salience-table-coverage tests pass.
3. `npm test -- --run tests/cards/compose/gates/` — all nine gates
   pass across the deepened pools. Watch especially:
   - `simCoherence` (every new combo carries ≥1 state-lookup
     primitive; the 4 spec-3 cube corners on each template have 3
     state-lookups each, so they're well-covered; the
     `hasTag + memoryPresent` top rungs use memory as the
     state-lookup)
   - `diversity` (samplers must hit minDistinct on deepened pools —
     both samplers gain perturbation entries for the previously-
     unvaried third area meter; cross-check
     `buildMaintenanceDiversitySampler` for cleanliness coverage and
     `buildAreaAtmosphereDiversitySampler` for damage coverage)
   - `dedupe` (within-slot Levenshtein ≥0.85 — the 4 spec-3 cube
     corners + 4 spec-2 supports + existing 10 snippets per pool
     share area vocabulary; budget 3-5 rephrasings per pool, matching
     Phase 152's 3-5)
   - `voiceBounds` (em-dashes count as words; spec-3 corners on a
     14-word budget are tight — anticipated risk #1)
4. `npm test -- --run tests/cards/templates.{maintenance,areaAtmosphere}.test.ts`
   — existing template integration tests stay green (with any
   narrow-to-specific-text assertions relaxed per the §Critical-files
   note).
5. `npm test -- --run tests/cards/compose/phase153.exhaustiveMatrix.test.ts`
   — ~20-22 new tests pass.
6. `npm test` — full regression green at prior baseline + ~22-25 new
   tests (depending on optional salience-table-coverage add).

## Anticipated risks

1. **Spec-3 cube corners on a 14-word budget, doubled.** Each
   template authors 4 corner snippets at ≤14 words each — 8 corners
   total in this cluster. Drafts above sit at 11-14. Plan 2-3
   rephrasings per template minimum. If a corner can't fit at 14
   words without losing the distinguishing read, raise the
   `wordBudget` on that template's `establishing_line` slot from 14
   to 16 (per-slot data change, no template structure change; matches
   the supplier/staff slot bumps from Phase 150). Prefer rephrasing
   first — voice-bounds gate failures are easier to fix than to argue
   for budget bumps.

2. **Cross-pool dedupe collisions on shared area vocabulary.** The 4
   spec-3 corners per template share two of three meter words (the
   fixed extreme; the other two vary). Both pools draw on the same
   "room / wall / floor / corner / boards / smell" lexicon. Snippets
   like maintenance's "the gouge across an otherwise-careful wall"
   and area_atmosphere's "dust thick on rafters" need to stay
   canonicalised-distant. The dedupe gate runs per-pool, not
   cross-pool, so cross-template collisions won't trip the gate; but
   within-pool collisions on the 4 corners are real. Vary the imagery
   per corner: gouge/wall (maintenance corner 1), split/timber
   (corner 2), floor/joist (corner 3), wreck/corner (corner 4); and
   for area_atmosphere: rafters/dust (corner 1), neglect/long-stretch
   (corner 2), bones/build (corner 3), regulars-stop-sitting
   (corner 4). Budget 3-5 rephrasings — more than Phase 151's 1-2
   because the 3-meter authoring naturally crowds vocabulary.

3. **Existing combos vs new corner combos on both templates.**
   maintenance's existing `est_damage_high_rising` (damage +
   pressure, spec 2) overlaps with the new top rung
   `signalEquals area.damage=high + pressureRising maintenance` (also
   spec 2, but both reads extremity 2 vs the existing 2+1). The new
   top rung wins on extremity sum (2+2 vs 2+1). The same shape on
   area_atmosphere's `est_cleanliness_pressure` (cleanliness +
   pressure, spec 2) vs new `signalEquals area.cleanliness=low +
   pressureRising maintenance`. Document the resolution in a comment
   next to the new top-rung snippet ids so a future reader doesn't
   wonder why the existing combo is now usually-not-firing.

4. **Test update count.** Phase 149 / 150 / 151 / 152 all updated
   2-3 existing tests as multi-fact policy or new combo cells shifted
   what specific snippet resolved. Budget 2-4 here. Each update
   preserves the assertion's intent (the headline fact is present)
   while loosening byte-equality to a salient-substring contract.
   The two templates' tests are 19 + 23 = 42 tests; ~5-10% update
   rate.

5. **Multi-fact join word overflow on `establishing_line ≤ 14`.**
   Default budget is `wordBudget * 2 = 28`; if two existing
   single-condition snippets sum past 28 the secondary drops
   silently (silence beats stapling, per Phase 1 contract). For
   maintenance the 4 cube corners + 4 spec-2 supports cover the
   damage × condition × cleanliness space the picker selects; the
   join only fires for unanticipated signal × pressure / memory
   pairs. For area_atmosphere same shape on cleanliness × damage.
   Acceptable per design.

6. **Diversity sampler band coverage.** Current
   `buildAreaAtmosphereDiversitySampler` does not perturb
   `area.damage` (only cleanliness × condition); current
   `buildMaintenanceDiversitySampler` does not perturb
   `area.cleanliness` (only damage × condition). The spec-3 cube
   corners require samples that vary all three area bands per
   template. Extend each sampler's perturbation table to cover the
   third meter. Phase 150 saw the same need on staff samplers and
   Phase 152 on culture samplers; budget similar work here.
   ~5-8 new perturbation entries per sampler.

7. **`hasTag` reads in salience table without state-lookup
   pairing.** Two of the new salience table entries are `hasTag`
   reads (`fire_risk`, `inspection_relevant` for maintenance;
   `reputation`, `inspection_negative`, `merchant_sensitive` for
   area_atmosphere). These resolve through `collectSeedTags(seed)`
   in `evaluateRead`. The Phase-16 legibility gate (not this
   phase's deliverable) will assert that salience reads correspond
   to backed state — `hasTag` reads back to the seed's tagged
   context, not a meter, which is intentional. Document this in
   the salience-table entry comments so the gate's expectations
   stay clear.

## Out of scope (deferred to later phases)

- **The three remaining Movement VI cluster phases (9-11):** Crises
  & Safety, Reputation & Rumour, Periodic & Narrative. Each is its
  own ISSUE-NNN at the phase's start.
- **Movement VII preview-pool authoring** against `EffectDirection
  × EffectMagnitudeBand` (Phases 12-14). The maintenance /
  area_atmosphere `effectPreview` pools stay as Phase-137 /
  Phase-147 authored; Movement VII recalibrates them per-meter.
- **The Phase-16 legibility gate** (the centerpiece). Movement VI's
  cluster count reaches 5 after this phase (suppliers/stock/debt,
  staff, regulars/complaints, factions/culture, premises/atmosphere).
  The gate unblocks but is its own phase.
- **Phase-17 deepening & recalibration** — the standing playtest
  loop. Any band-cut-point recalibration or salience-table
  reordering that play reveals goes there, not here.
- **Any change to sim response slot counts, verbs, targets, or
  effect amounts** — composition voices around mechanics, never
  alters them. No changes to the cardinality of maintenance /
  area_atmosphere response profiles.
- **No new condition primitives; no new `SalienceRead` kinds; no
  changes to the choice-distinctness cap or preview-legibility
  contract** (all Movement V; locked).
- **No new band signals.** Phase 137 / ISSUE-106 added `area.damage`;
  `area.condition` and `area.cleanliness` predate it. The three
  needed signals are present.
- **`severity` as a salience read for these families.** The pickers
  don't threshold on severity; severity is downstream of the
  meters. The existing `est_high_severity_repeat` snippet stays
  reachable through specificity; salience just doesn't list
  severity as a primary fact (matching Phase 152's choice for
  faction / culture).
- **Cross-template salience consistency** — both templates use the
  same family pressure (`maintenance`) but list signals in
  different orders matching their pickers. This is intentional;
  salience is per-family.
