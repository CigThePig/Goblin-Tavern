# Phase 152 — Factions & Culture Content Matrices

**ISSUE-120.** Fourth phase of Movement VI of the Legible Surface arc
(`docs/plans/legible-surface-arc.md`). Mirrors Phase 149 / ISSUE-117
(Suppliers, Stock & Debt), Phase 150 / ISSUE-118 (Staff & Personnel), and
Phase 151 / ISSUE-119 (Regulars & Complaints) — no Movement-V loopback,
same nine gates, same authoring loop. **Differs in one respect:**
`cultureConflict` is the first 3-meter situation the arc deepens, so its
establishing matrix authors the readable cube (4 spec-3 corners) on top of
the 2-meter corners.

## Context

Voiced Surface made every line *speak*; the Legible Surface arc makes
every line *inform*. Movement V shipped the machinery (Phases 146-148:
salience read + multi-fact establishing slot, preview-legibility
contract, choice-distinctness gate). Movement VI Phases 4-6 then proved a
reusable cluster shape: extend `SALIENCE_TABLES`, opt the templates into
`saliencePolicy: 'multi'`, deepen establishing pools with matrix-corner
combos covering the band pair the situation actually turns on, and add
state-keyed snippets to reaction/sensory pools so they stop standing fixed
on `voiceProfile` alone.

**Phase 7 is the Factions & Culture cluster.** Two compositional templates
share this cluster, both shipped in Voiced Surface Phase 10 / ISSUE-105
but neither extended into the matrix the Legible Surface arc calls for:

- **`factionRequestCard`** (`faction_request / social_conflict /
  during_service`) — fires when `faction_anger pressure ≥ 25` and picks
  by `|relationship − 50| + 0.5×influence` minus recency. Actor-voiced
  (faction has `castAttributes` per Phase 128). Thirteen establishing
  snippets today: 1 fallback + 8 single-condition rungs (`signalEquals`
  faction.relationship × 2 bands + faction.influence × 2 bands;
  `pressureRising` faction_anger + cultural_tension; `memoryPresent`
  grudge / gratitude / refusal / faction; `repeatCount` faction) + 2
  two-condition combos (`est_low_repeat`, `est_anger_repeat`). **Zero
  relationship × influence corner combos** — the very meter pair the
  card is *about*. Reaction (`reaction_line`, 16 snippets) and sensory
  (`manner_note`, 10 snippets) pools are entirely voice/tic-keyed.

- **`cultureConflictCard`** (`culture_conflict / social_conflict /
  during_service`) — fires when `cultural_tension pressure ≥ 25` and
  picks by highest tension minus recency. Narrator-voiced (cultures have
  no `castAttributes` — population concept, not individuals). Fifteen
  establishing snippets today: 1 fallback + 9 single-condition rungs
  (`signalEquals` culture.tension × 2 + comfort × 2 + familiarity × 2;
  `pressureRising` cultural_tension; `memoryPresent` ignored / neglected
  / honour / mediation; `hasTag` festival / ritual; `repeatCount`
  culture) + 4 two-condition combos (`est_festival_rising`,
  `est_ritual_rising`, `est_high_tension_repeat`, `est_tension_ignored`).
  **Zero corner combos on any two of the three orthogonal meter pairs.**
  Reaction (12 snippets) and sensory (9 snippets) pools have *some*
  state keying via `severity`/`memory`/`hasTag` but no `signalEquals`
  branching on comfort or familiarity.

Neither `faction_request` nor `culture_conflict` appears in
`SALIENCE_TABLES`. So today, when factionRequest resolves both
`faction.relationship` and `faction.influence` to bands, the assembler
picks whichever single-condition snippet out-specifies the other — the
two-meter pair the choice turns on never lands as one line. Same gap on
the culture side across the three-meter space — the headline never
states the salient pair (or triple) that defines the situation. That is
the legibility gap Phase 7 closes.

**Per-user scope decision (recorded up-front).** The Movement VI table
names `culture.tension × culture.comfort × culture.familiarity` as a
27-cell space and instructs us to "author the readable diagonal +
extremes." Per the AskUserQuestion answer up-front, the culture
authoring is **aggressive**: 4 spec-3 cube corners (tension=high ×
comfort × familiarity 2×2) plus spec-2 supports for the (mid+high
tension) × (low+high comfort) edges that the spec-3 cells don't catch
when familiarity is mid. This makes cultureConflict the first
3-meter-corner template in the codebase. faction stays 2-meter at the
volume of Phases 149-151.

**No Movement-V loopback this phase** — every read needed by both
families expresses with the six `SalienceRead` kinds Phase 4 already
shipped (`signal`, `pressure`, `memory`, `repeat`, `hasTag`, `severity`).
Both relationship/influence and tension/comfort/familiarity were banded
in Phase 136 / ISSUE-105 (default-thirds `[40, 70]`).

## What ships

Two templates with full establishing-matrix treatment behind nine gates,
no Movement-V loopback. Mirrors Phase 149-151 shape; broadens it to the
arc's first 3-meter cube.

### A. `SALIENCE_TABLES` extension (`src/cards/compose/salience.ts`)

Two new entries — `faction_request` (serves factionRequestCard) and
`culture_conflict` (serves cultureConflictCard). No new `SalienceRead`
kinds.

```ts
faction_request: { reads: [
  { kind: 'signal', role: 'primaryActor', signal: 'faction.relationship' },
  { kind: 'signal', role: 'primaryActor', signal: 'faction.influence' },
  { kind: 'pressure', pressureId: 'faction_anger' },
  { kind: 'pressure', pressureId: 'cultural_tension' },
  { kind: 'memory', tag: 'grudge' },
  { kind: 'memory', tag: 'refusal' },
  { kind: 'memory', tag: 'gratitude' },
  { kind: 'memory', tag: 'faction' },
  { kind: 'repeat', subjectTag: 'faction', atLeast: 3 },
]}

culture_conflict: { reads: [
  { kind: 'signal', role: 'primaryActor', signal: 'culture.tension' },
  { kind: 'signal', role: 'primaryActor', signal: 'culture.comfort' },
  { kind: 'signal', role: 'primaryActor', signal: 'culture.familiarity' },
  { kind: 'pressure', pressureId: 'cultural_tension' },
  { kind: 'memory', tag: 'ignored' },
  { kind: 'memory', tag: 'neglected' },
  { kind: 'memory', tag: 'honour' },
  { kind: 'memory', tag: 'mediation' },
  { kind: 'memory', tag: 'culture' },
  { kind: 'hasTag', tag: 'festival' },
  { kind: 'hasTag', tag: 'ritual' },
  { kind: 'repeat', subjectTag: 'culture', atLeast: 3 },
]}
```

Ordering: the banded signals lead (extremity 2 at low/high — most
decision weight), then the family's primary pressure, then secondary
pressures, then choice-affecting memories ordered by generator emission
priority, then tone-tags (culture only), then the multi-period repeat as
the deepest rung. For `faction_request` the generator references only
`faction_anger` and `cultural_tension` as embedded pressures (Phase 136
record) — both listed, primary first. For `culture_conflict` the
generator embeds only `cultural_tension`; the four memory tags listed
match the generator's emission ranking (mediate / honour / ignore /
neglected paths). The `hasTag` reads for festival / ritual stay
secondary to memories because the cultural calendar context modulates
flavor rather than driving the headline.

### B. Multi-fact slot enablement

Both template files gain the same wiring on their `establishing_line`
slot:

```ts
saliencePolicy: 'multi',
multiFactJoin: ' — ',
```

Same join and budget (default `wordBudget * 2 = 28`) as Phases 149-151
for cross-Movement-VI consistency. Multi-fact join fires only when no
authored combo cell matches an unanticipated state combination —
authored combos always win specificity.

Carry the same Phase-1 / ISSUE-114 explanatory comment block from
`supplierReliability.ts:73-83` so future readers understand the
saliencePolicy intent without re-reading the salience module. For
`cultureConflict` the comment includes a one-line note that the slot's
3-meter cube is authored at spec-3 corners; multi-fact join is the
fallback for unanticipated tension+comfort or tension+familiarity pairs
that aren't both extreme.

### C. Exhaustive establishing matrix authoring

**Important asymmetries:**

- `factionRequest` has no per-faction band guard at the seed level
  (factions are selected by combined `|relationship − 50| +
  0.5×influence` score, not a single-axis threshold). All 9 cells of
  the relationship × influence space are reachable. Author the 4
  corners + 3 top rungs as Phases 149-151 did.

- `cultureConflict` selects by highest tension, so **tension is
  typically high (with mid possible at lower-pressure cultures)** — low
  tension is rare but not gated out. Comfort and familiarity are
  unconstrained by selection. The 4 spec-3 corners all fix tension=high
  and span comfort × familiarity 2×2 (the readable cube face); the 4
  spec-2 supports cover (mid+high tension) × (low+high comfort) for the
  familiarity=mid case.

**`factionRequest/establishingLine.ts`** — 7 new combo cells (total
goes 13 → 20):

- **4 relationship × influence corner combos** (`signalEquals
  faction.relationship + signalEquals faction.influence`, both spec 2):
  - `est_high_rel_high_inf` — the powerful ally pleased to see us;
    rare gift, must not squander it ("a strong hand at the door, and
    it's resting on the latch — not the knocker")
  - `est_high_rel_low_inf` — friendly small faction, can give little
    but never withholds either ("they've nothing big to offer, but
    every small thing they have, they bring")
  - `est_low_rel_high_inf` — the dangerous opposition; weight without
    warmth ("they don't need our welcome — only our compliance, and
    they've come for it")
  - `est_low_rel_low_inf` — the small grievance; harmless today, the
    kind that calcifies into worse later ("a minor faction in a sour
    mood, and these are the ones that breed the next year's trouble")

  The existing combos `est_low_repeat` (relationship low × repeat ≥3)
  and `est_anger_repeat` (faction_anger rising × repeat ≥3) stay —
  different orthogonal pairs.

- **3 pressure / memory top rungs**:
  - `signalEquals faction.relationship=low + pressureRising faction_anger`
    (the meter and the trend agreeing)
  - `signalEquals faction.influence=high + memoryPresent refusal`
    (heavy faction we've refused before)
  - `pressureRising faction_anger + memoryPresent grudge`
    (the anger building on the older score)

**`cultureConflict/establishingLine.ts`** — 11 new combo cells (total
15 → 26). Three rungs:

- **4 spec-3 cube corners** (`signalEquals culture.tension=high +
  signalEquals culture.comfort + signalEquals culture.familiarity`,
  all spec 3) — narrator framing throughout:
  - `est_high_ten_low_comf_low_fam` — alien crowd in an uneasy room
    we've never tried to read ("strangers in a room that doesn't know
    them, and the trouble's been waiting to find a voice")
  - `est_high_ten_low_comf_high_fam` — we know them well enough to
    know what went wrong, and did it anyway ("the regulars we know
    best, kept in a room that's never quite been theirs")
  - `est_high_ten_high_comf_low_fam` — they're settled here yet still
    a polite mystery ("comfortable enough to stay, distant enough that
    the outburst arrives without warning")
  - `est_high_ten_high_comf_high_fam` — trusted friends snapping;
    the loudest signal in the cube ("the crowd that's always made
    this place feel certain, suddenly hard to recognise")

- **4 spec-2 tension × comfort supports** (`signalEquals
  culture.tension + signalEquals culture.comfort`, both spec 2 — for
  when familiarity is mid):
  - `est_mid_ten_low_comf` — quiet drift to the door; not angry, just
    not welcome
  - `est_mid_ten_high_comf` — slow rumble in a cheerful corner; out of
    place, sounding worse for it
  - `est_high_ten_low_comf` — the simple match: stirred up, and never
    settled here in the first place
  - `est_high_ten_high_comf` — at home and furious; the surprise
    eruption from a comfortable corner

- **3 pressure / memory / hasTag top rungs** (mixing salience reads
  the existing pool's two-condition combos don't already cover):
  - `signalEquals culture.tension=high + pressureRising cultural_tension`
    (meter and tavern-wide pressure agreeing — beats single-condition
    `est_cultural_tension_high` and `pressureRising` snippets)
  - `signalEquals culture.comfort=low + memoryPresent ignored`
    (today's discomfort built on yesterday's neglect)
  - `signalEquals culture.familiarity=low + memoryPresent neglected`
    (the gap we never closed, now showing)

  The existing combos `est_festival_rising` (festival × pressureRising),
  `est_ritual_rising` (ritual × pressureRising),
  `est_high_tension_repeat` (high tension × repeat), and
  `est_tension_ignored` (pressureRising × ignored memory) stay — all
  cover orthogonal pairs the new combos don't.

**Invariants** (carried from Phase 149-151):
- Every new combo on a sim_backed slot carries ≥1 state-lookup
  primitive so `simCoherence` passes.
- The mid×mid cells (and mid-third-meter slots on the culture cube
  faces) stay unauthored — the unconditional fallback handles them
  cleanly.
- Spec-3 combos beat spec-2 combos beat single-condition snippets;
  the multi-fact join is the fallback for unanticipated state pairs
  where no authored cell matches.
- The culture cube's spec-3 corners are budgeted at ≤14 words (the
  slot's `wordBudget`). 14 words is tight for three conditions plus
  prose — anticipated risk #1 below.

### D. State-keyed reaction & sensory pools

Additive — existing voice-keyed and severity-keyed snippets stay
(voice / severity persist as layers). New spec-1 state-keyed snippets
fire orthogonally and win when state matches but voice is neutral.
Pattern mirrors Phase 149-151's reaction/manner additions.

**`factionRequest/reactionLine.ts`** — 6 new state-keyed snippets
appended to the existing 16 voice/tic-keyed ones. Faction is
actor-voiced so the reaction is first-person from the faction's
representative:
- `signalEquals faction.relationship=low` ("we've come because we have
  to, not because we want to")
- `signalEquals faction.influence=high` ("you'll find we don't ask
  twice")
- `pressureRising faction_anger` ("and the patience downriver isn't
  what it was last month")
- `memoryPresent grudge` ("we haven't forgotten the last time we
  stood here")
- `memoryPresent refusal` ("you turned us away before — that won't be
  the gentle ask now")
- `repeatCount faction atLeast: 3` ("third visit, same question; we'd
  hoped for a different answer")

**`factionRequest/mannerNote.ts`** — 5 new state-keyed sensory beats
appended to the existing 9 voice/tic-keyed ones:
- `signalEquals faction.relationship=low` (a delegation that won't
  meet the eyes)
- `signalEquals faction.influence=high` (the room shifts to give them
  space they didn't ask for)
- `pressureRising faction_anger` (the second of the delegation hasn't
  unclenched a hand)
- `memoryPresent grudge` (a glance at the wall they remember from
  before)
- `repeatCount faction atLeast: 3` (the same boots in the same place
  on the same floorboard)

**`cultureConflict/reactionLine.ts`** — 6 new state-keyed snippets
appended to the existing 12 narrator-voiced ones. Narrator framing
throughout (cultureConflict is narrator-voiced — no first-person from
the culture, which is a population not an individual):
- `signalEquals culture.tension=high` (the noise from the table is no
  longer murmur)
- `signalEquals culture.comfort=low` (they sit with shoulders the
  room has never softened)
- `signalEquals culture.familiarity=low` (their gestures don't fit
  the staff's reading of them)
- `pressureRising cultural_tension` (the friction's been audible at
  the next table, too)
- `memoryPresent neglected` (the same complaint, now from a louder
  table)
- `repeatCount culture atLeast: 3` (the third week running this room
  has hosted the same trouble)

**`cultureConflict/mannerNote.ts`** — 5 new state-keyed sensory beats
appended to the existing 9 narrator-voiced ones:
- `signalEquals culture.tension=high` (a chair pushed back, no return
  to it)
- `signalEquals culture.comfort=low` (coats still over arms; coats
  were not over arms an hour ago)
- `signalEquals culture.familiarity=low` (a question asked twice in
  two languages, neither answered)
- `pressureRising cultural_tension` (the next table has stopped
  pretending not to listen)
- `repeatCount culture atLeast: 3` (no one in the room is surprised
  by the rise of voices)

Word budgets carried from existing per-slot specs: `reaction_line` ≤
12, `manner_note` ≤ 10. Pre-commit trim any overrun (Phase 149 caught
two; Phase 150 budgeted 0-3; budget 2-4 here given the larger volume).

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — two new `SALIENCE_TABLES` entries
  (`faction_request`, `culture_conflict`).
- `src/cards/templates/factionRequest.ts` — `saliencePolicy: 'multi'`
  + `multiFactJoin: ' — '` on `establishing_line` slot + explanatory
  comment block lifted from `supplierReliability.ts:73-83`.
- `src/cards/templates/cultureConflict.ts` — same wiring + comment,
  with one-line note that the slot's 3-meter cube is authored at
  spec-3 corners.
- `src/cards/compose/pools/factionRequest/{establishingLine,reactionLine,mannerNote}.ts`
  — combo cells + state-keyed snippets.
- `src/cards/compose/pools/cultureConflict/{establishingLine,reactionLine,mannerNote}.ts`
  — combo cells (incl. 4 spec-3) + state-keyed snippets.
- `specs/cards/faction_request.spec.yaml` +
  `specs/cards/culture_conflict.spec.yaml` — design-record additions
  for the new matrix cells and state-keyed snippets (record only;
  authoring is in-repo per the Phase-4 loop).
- `tests/cards/templates.factionRequest.test.ts` +
  `tests/cards/templates.cultureConflict.test.ts` — only where a
  pre-existing assertion narrows to a single snippet's exact text
  that the new multi-fact policy or new combo cell now composes.
  Phase 149 had two such updates, Phase 150 had two, Phase 151 had
  three; budget 2-4 here (larger pool delta).
- `docs/ISSUE_TRACKER.md` — new ISSUE-120 entry following the
  ISSUE-117 / ISSUE-118 / ISSUE-119 row shape.
- `docs/plans/legible-surface-arc.md` — no edits; the arc doc names
  Phase 7 with provisional ids already.

**Created:**
- `tests/cards/compose/phase152.exhaustiveMatrix.test.ts` — new file,
  ~18-20 tests mirroring `phase151.exhaustiveMatrix.test.ts`:
  - 5 `factionRequest` cells (4 relationship × influence corners + 1
    relationship=low × faction_anger top rung), each asserting the
    combo's distinctive substring appears in `view.body[0]`
  - 8 `cultureConflict` cells (4 spec-3 cube corners + 4 spec-2
    tension × comfort supports)
  - 1 `cultureConflict` top-rung test (tension=high ×
    cultural_tension pressureRising)
  - 2 state-varying reaction tests (1 per template — same seed, two
    distinct state mutations, two distinct `body[1]`s)
  - 2 re-render stability tests (1 per template — JSON equality
    across two `card.render()` calls with the same seed+state)

  Reuses Phase 149-151 helpers (`withRisingPressure`, `withMemory`);
  adds new builders `factionSeed(factionId, type)` and
  `cultureSeed(cultureId, type)` parallel to the existing
  `supplierSeed` / `regularSeed` / `cohortSeed`. Adds
  `withFactionMeters(state, factionId, rel, inf)` and
  `withCultureMeters(state, cultureId, tens, comf, fam)` helpers
  parallel to the existing `withStaffMeters`. Adds
  `withNeutralFactionVoice` (cast axes all at 1 so voice-extreme
  snippets don't outrank state-keyed); cultureConflict needs no
  cohort-voice helper (narrator-voiced).

  **Optional add (decide during implementation):** 2-3-test extension
  to `tests/cards/compose/phase146.salience.test.ts` asserting the two
  new `SALIENCE_TABLES` entries resolve as expected against fixture
  states (parallel to existing `supplier_relationship` / `staff_*` /
  `regular_*` coverage). Tiny cost, useful regression net. Add unless
  gate run-time pressure argues against (Phases 150-151 added this).

- `docs/plans/phase-152-factions-culture-content.md` — this file
  lifted in.

## Verification

Sequential, fail-fast — identical shape to Phase 149-151:

1. `npm run typecheck` — types compile after the `SALIENCE_TABLES`
   additions (no shape changes; just new entries).
2. `npm test -- --run tests/cards/compose/phase146.salience.test.ts` —
   pre-existing salience tests still pass (no resolver changes this
   phase; the new tables resolve through unchanged branches). Plus
   any optional new salience-table-coverage tests pass.
3. `npm test -- --run tests/cards/compose/gates/` — all nine gates
   pass across the deepened pools. Watch especially:
   - `simCoherence` (every new combo carries ≥1 state-lookup
     primitive; the 4 spec-3 cube corners have 3 state-lookups each,
     so they're well-covered)
   - `diversity` (samplers must still hit minDistinct on deepened
     pools — the cultureConflict samplers need state-perturbation
     coverage of comfort and familiarity bands the existing pool
     didn't exercise; cross-check `samplers.ts:buildCultureConflictDiversitySampler`)
   - `dedupe` (within-slot Levenshtein ≥0.85 — the 4 spec-3 culture
     corners + 4 spec-2 supports + existing 15 snippets share a lot
     of vocabulary; budget 3-5 rephrasings vs Phase 149's 2,
     Phase 151's 1-2)
   - `voiceBounds` (em-dashes count as words; spec-3 corners on a
     14-word budget are tight — anticipated risk #1)
4. `npm test -- --run tests/cards/templates.{factionRequest,cultureConflict}.test.ts`
   — existing template integration tests stay green (with any
   narrow-to-specific-text assertions relaxed per the §Critical-files
   note).
5. `npm test -- --run tests/cards/compose/phase152.exhaustiveMatrix.test.ts`
   — ~18-20 new tests pass.
6. `npm test` — full regression green at prior baseline + ~20-22 new
   tests (depending on the optional salience-table-coverage add).

## Anticipated risks

1. **Spec-3 cube corners on a 14-word budget.** The 4 culture-cube
   corner snippets each express three banded conditions plus
   distinguishing prose. 14 words is tight; the drafts above all sit
   at 12-14. Plan two rephrasings minimum. If a corner can't fit at
   14 words without losing the distinguishing read, raise the
   `wordBudget` on `cultureConflict`'s `establishing_line` slot from
   14 to 16 (a per-slot data change, no template structure change,
   matches the supplier/staff slot bumps from Phase 150). Prefer
   rephrasing first — voice-bounds gate failures are easier to fix
   than to argue for budget bumps.
2. **Cross-pool dedupe collisions on culture.** The 4 spec-3 corners
   share two of three meter words (tension=high in all four; comfort
   and familiarity vary). Snippets like "strangers in a room that
   doesn't know them" and "comfortable enough to stay, distant enough
   that the outburst arrives without warning" need to stay
   canonicalised-distant from each other (Levenshtein ≥0.85). Budget
   3-5 rephrasings — more than the 1-2 of earlier phases because the
   3-meter authoring naturally crowds vocabulary. Vary the imagery
   per corner: alien/room (corner 1), known/wrong-room (corner 2),
   polite/distant (corner 3), trusted/surprise (corner 4).
3. **Existing combos vs new corner combos on cultureConflict.** The
   existing `est_high_tension_repeat` (high tension × repeat ≥3, spec
   2) ties with the new `est_high_tension_high_comfort` (high tension
   × high comfort, spec 2) when both resolve. Tie-broken by extremity
   sum then table-index sum then FNV. Both have one extremity-2 read
   (the band signal), so extremity sums tie at 2+2=4 for the new
   corner and 2+0=2 for the existing combo (repeat is extremity 0).
   The new corner wins — desired. Note in the comment block beside
   the snippet ids if the resolution surprises a reader.
4. **factionRequest existing `est_anger_repeat` vs new top rung.**
   `est_anger_repeat` (anger rising × repeat ≥3, spec 2) overlaps
   with the new `pressureRising faction_anger + memoryPresent grudge`
   top rung. Different secondary reads (repeat vs memory); both fire
   when applicable, FNV breaks any further tie. No conflict.
5. **Test update count.** Phase 149 updated two existing tests,
   Phase 150 updated two, Phase 151 updated three. Budget 2-4 here.
   Each update preserves the assertion's intent (the headline fact is
   present) while loosening byte-equality to a salient-substring
   contract.
6. **Multi-fact join word overflow on `establishing_line ≤ 14`.**
   Default budget is `wordBudget * 2 = 28`; if two existing
   single-condition snippets sum past 28 the secondary drops silently
   (silence beats stapling, per Phase 1 contract). For factionRequest
   the 4-corner spec-2 combos handle every relationship×influence
   case, so the join only fires for unanticipated signal × pressure /
   memory pairs. For cultureConflict the 4 spec-3 corners + 4 spec-2
   supports cover the tension+comfort space; the join fires for
   tension+familiarity unanticipated pairs and for pressure/memory
   stacks the top rungs don't catch. Acceptable per design.
7. **Diversity sampler band coverage.** Current
   `buildCultureConflictDiversitySampler` (per the explore report)
   may not perturb comfort and familiarity bands beyond the seed's
   default — the existing pool only branched on tension. The
   spec-3 corners require samples that vary all three bands. Audit
   the sampler when implementing; extend its perturbation table if
   the diversity gate underperforms. Phase 150 saw the same need on
   staff samplers; budget similar work here.

## Out of scope (deferred to later phases)

- **The four remaining Movement VI cluster phases (8-11):** Premises
  & Atmosphere, Crises & Safety, Reputation & Rumour, Periodic &
  Narrative. Each is its own ISSUE-NNN at the phase's start.
- **Movement VII preview-pool authoring** against `EffectDirection ×
  EffectMagnitudeBand` (Phases 12-14). The faction/culture
  `effectPreview` pools stay as Phase-10 / Phase-147 authored;
  Movement VII recalibrates them per-meter.
- **The Phase-16 legibility gate** (the centerpiece). Movement VI's
  cluster count reaches 4 after this phase (suppliers/stock/debt,
  staff, regulars/complaints, factions/culture). The gate unblocks
  but is its own phase.
- **Phase-17 deepening & recalibration** — the standing playtest
  loop. Any band-cut-point recalibration or salience-table
  reordering that play reveals goes there, not here.
- **Any change to sim response slot counts, verbs, targets, or
  effect amounts** — composition voices around mechanics, never
  alters them. No changes to the cardinality of culture or faction
  response profiles.
- **No new condition primitives; no new `SalienceRead` kinds; no
  changes to the choice-distinctness cap or preview-legibility
  contract** (all Movement V; locked).
- **No new band signals.** The arc note in Phase 136 / ISSUE-105
  records that `culture.tension`, `culture.comfort`, and
  `culture.familiarity` were added then — exactly the meter set this
  phase needs. No new signal types or band thresholds required.
- **Faction blame-mode / influence-mode** subsignals (referenced as a
  "Phase 10 candidate" in Phase 7's ISSUE-102 record) — not needed
  for the matrix authoring; the existing band reads cover the
  decision-relevant surface. Revisit in Phase 17 if play reveals a
  gap.
