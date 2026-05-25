# Phase 151 — Regulars & Complaints Content Matrices

**ISSUE-119.** Third phase of Movement VI of the Legible Surface arc
(`docs/plans/legible-surface-arc.md`). Mirrors the Phase 149 / ISSUE-117
(Suppliers, Stock & Debt) and Phase 150 / ISSUE-118 (Staff & Personnel)
shape — no Movement-V loopback, same nine gates, same authoring loop.

## Context

Voiced Surface made every line *speak*; the Legible Surface arc makes
every line *inform*. Movement V shipped the machinery — Phase 146 added
the salience read + multi-fact establishing slot, Phase 147 the
preview-legibility contract, Phase 148 the choice-distinctness gate.
Movement VI Phases 4 and 5 then proved a reusable cluster shape: extend
`SALIENCE_TABLES`, opt the templates into `saliencePolicy: 'multi'`,
deepen establishing pools with matrix-corner combos covering the band
pair the situation actually turns on, and add state-keyed snippets to
reaction/sensory pools so they stop standing fixed on `voiceProfile`
alone.

**Phase 6 is the Regulars & Complaints cluster.** Three compositional
templates share this cluster — all shipped earlier (drinkOrder in Voiced
Surface Phase C, regularComplaint + customerComplaint in Phase 8 /
ISSUE-103) but none extended into the matrix the Legible Surface arc
calls for:

- **`regularComplaintCard`** (`regular_customer / complaint /
  during_service`) — the loud branch of `regular_customer`, fires when
  the seed picks a regular with `irritation > 60`. Twelve establishing
  snippets today: 1 fallback + 8 single-condition rungs (irritation 2,
  loyalty 2, regular_customer_loss pressure, 3 memory tags, repeat) + 2
  two-condition combos (`est_irritation_repeat`,
  `est_loyalty_grudge`). **Zero irritation × loyalty corner combos** —
  the very meter pair the card is *about*. Reaction (`reaction_line`)
  and sensory (`manner_note`) pools are entirely voice/tic keyed.

- **`customerComplaintCard`** (`customer_complaint / complaint /
  during_service`) — the cohort version. Fourteen establishing snippets
  today: 1 fallback + 9 single-condition rungs (satisfaction 2,
  loyalty 2, 5 pressures: reputation_drift / staff_loyalty_risk /
  regular_customer_loss / rumour_pressure / cultural_tension, 2 memory
  tags, repeat) + 2 two-condition combos (`est_satisfaction_repeat`,
  `est_loyalty_complaint`). **Zero satisfaction × loyalty corner
  combos.** Reaction/manner pools voice/tic keyed only.

- **`drinkOrderCard`** (`regular_customer / relationship_test /
  during_service`) — the mild branch of `regular_customer`, fires when
  `irritation ≤ 60`. Template body shape is `[title, order_line,
  manner_note]` — there is no `establishing_line` slot. The
  `order_line` is the regular's *voice* (e.g. "Two pints, mate"), not a
  fact-stating slot, and `manner_note` is a sensory beat. Today both
  pools are voice/tic keyed only; the regular's irritation and loyalty
  bands are invisible at the surface.

Neither `regular_customer` nor `customer_complaint` currently appears
in `SALIENCE_TABLES`. So today, when a regularComplaint resolves both
`regular.irritation` and `regular.loyalty` to bands, the assembler
picks whichever single-condition snippet out-specifies the other — the
two-meter pair the choice turns on never lands as one line. Same gap
on the cohort side for `customer_group.satisfaction` × `customer_group.loyalty`.
That is the legibility gap Phase 6 closes.

**Per-user scope decision (recorded up-front):** the Movement VI table
names both regular and cohort meter pairs for this cluster, and both
are already banded in `src/sim/signals/{types,bands}.ts` (Phase 134 /
ISSUE-103). **No Movement-V loopback this phase** — every read needed
by both families expresses with the six `SalienceRead` kinds Phase 4
already shipped (`signal`, `pressure`, `memory`, `repeat`, `hasTag`,
`severity`).

**drinkOrder scope:** the template stays single-fact at the body level
(no establishing_line transplant; that would warp the template shape
and defeat the relationship_test branch's design — the regular's
*voice* IS the body). Phase 6 deepens `drinkOrder`'s `mannerNote` pool
with state-keyed sensory beats so a frustrated-but-not-yet-complaining
regular's manner reflects their meter standing ("they tap the counter
twice"), without changing what the card *says*. The
`saliencePolicy: 'multi'` setting is per-slot and only matters when an
establishing_line exists, so `drinkOrder.ts` itself stays untouched
except for the test count.

## What ships

Two templates with full establishing-matrix treatment + one template
with state-keyed sensory deepening, behind nine gates, no Movement-V
loopback. Mirrors the Phase 149 / 150 shape; broadens it to a
three-template cluster.

### A. `SALIENCE_TABLES` extension (`src/cards/compose/salience.ts`)

Two new entries — `regular_customer` (serves both drinkOrder and
regularComplaint; salience is per-family, not per-template) and
`customer_complaint`. Both templates in the regular family resolve
`role: 'primaryActor'` to the regular's id; the cohort family
resolves it to the customer_group id. No new `SalienceRead` kinds.

```ts
regular_customer: { reads: [
  { kind: 'signal', role: 'primaryActor', signal: 'regular.irritation' },
  { kind: 'signal', role: 'primaryActor', signal: 'regular.loyalty' },
  { kind: 'pressure', pressureId: 'regular_customer_loss' },
  { kind: 'memory', tag: 'grudge' },
  { kind: 'memory', tag: 'ignored_complaint' },
  { kind: 'memory', tag: 'warning' },
  { kind: 'memory', tag: 'customer' },
  { kind: 'repeat', subjectTag: 'regular', atLeast: 3 },
]}

customer_complaint: { reads: [
  { kind: 'signal', role: 'primaryActor', signal: 'customer_group.satisfaction' },
  { kind: 'signal', role: 'primaryActor', signal: 'customer_group.loyalty' },
  { kind: 'pressure', pressureId: 'reputation_drift' },
  { kind: 'pressure', pressureId: 'regular_customer_loss' },
  { kind: 'pressure', pressureId: 'staff_loyalty_risk' },
  { kind: 'memory', tag: 'complaint' },
  { kind: 'memory', tag: 'customer' },
  { kind: 'repeat', subjectTag: 'customer', atLeast: 3 },
]}
```

Ordering: the two band signals lead (extremity 2 at low/high — they
carry the most decision weight), then the family's primary pressure,
then secondary pressures, then choice-affecting memories, then the
multi-period repeat as the deepest rung. For `customer_complaint` the
generator references five pressures across response profiles; the table
lists the top three (reputation_drift first because cohort complaints
directly damage the reputation axis; regular_customer_loss second
because cohort drift is regular drift writ large; staff_loyalty_risk
third because complaints often surface staff handling). The other two
(`rumour_pressure`, `cultural_tension`) stay reachable as snippet
conditions but aren't listed as salient — they apply to narrower
sub-cases. Memory ordering follows the seed generators' tag emissions.

### B. Multi-fact slot enablement

Two template files gain the same wiring (`drinkOrder.ts` unchanged —
no establishing slot to opt in):

```ts
// regularComplaint.ts + customerComplaint.ts, on the establishing_line slot:
saliencePolicy: 'multi',
multiFactJoin: ' — ',
```

Same join and budget (default `wordBudget * 2 = 28`) as the Phase-4
and Phase-5 templates for cross-Movement-VI consistency. Multi-fact
join fires only when no spec-2 combo cell matches an unanticipated
state pair — authored combos always win specificity.

Carry the same Phase-1 / ISSUE-114 explanatory comment block from
`supplierReliability.ts:73-83` so future readers understand the
saliencePolicy intent without re-reading the salience module.

### C. Exhaustive establishing matrix authoring

**Important asymmetry:** `regularComplaint` only fires for
`irritation > 60` (mid or high band), so the *low irritation* row of
the 9-cell matrix never resolves at runtime. The decision-distinct
corners are 4 cells from the *mid+high* × *low+mid+high* subspace,
selected for design distinctness, not all 6 cells. Same shape on the
cohort side: `customer_complaint` picks groups by `100 - satisfaction`,
so satisfaction is *low or mid* (rarely high). Author the 4 corners
the design actually distinguishes; let the unconditional fallback
handle the remaining cells. This is the same rule Phase 149/150 used
when authoring "the readable diagonal + extremes."

**`regularComplaint/establishingLine.ts`** — 7 new combo cells (total
goes 12 → 19):

- **4 irritation × loyalty corner combos** (`signalEquals
  regular.irritation + signalEquals regular.loyalty`, both spec 2):
  - `est_high_irritation_high_loyalty` — the deep-stakes corner; years
    of loyalty crashing against the present moment ("the years between
    us, and the way they look at me right now")
  - `est_high_irritation_low_loyalty` — done; the relationship's last
    scene ("the door's already in their hand, the words just catching
    up")
  - `est_mid_irritation_high_loyalty` — recoverable; loyal regular,
    quietly frustrated ("they're still here, but the patience is
    thinning by the breath")
  - `est_mid_irritation_low_loyalty` — slow drift; annoyed and
    detaching ("the table's gone quiet between us, the visits shorter
    each week")

  The existing combos `est_irritation_repeat` (high irritation × repeat
  ≥3) and `est_loyalty_grudge` (low loyalty × grudge memory) stay —
  they cover different orthogonal pairs and outrank the band-only
  combos when their secondary read resolves.

- **3 pressure / memory top rungs**:
  - `signalEquals regular.loyalty=low + pressureRising regular_customer_loss`
    (the meter and the trend agreeing)
  - `signalEquals regular.irritation=high + memoryPresent ignored_complaint`
    (today's anger built on yesterday's silence)
  - `pressureRising regular_customer_loss + memoryPresent warning`
    (the loss the player was warned of, now arriving)

**`customerComplaint/establishingLine.ts`** — 7 new combo cells (total
14 → 21). Same corner shape, cohort framing throughout (first-person
plural where the existing pool uses it):

- **4 satisfaction × loyalty corner combos** (`signalEquals
  customer_group.satisfaction + signalEquals customer_group.loyalty`,
  both spec 2):
  - `est_low_sat_low_loy` — the cohort walking out, no surprise left
    ("the regulars table's bag's already on the chair, eyes on the
    door")
  - `est_low_sat_high_loy` — loyal cohort surprised by the stumble
    ("the regulars who stand for us are watching us fall, and they
    don't understand")
  - `est_mid_sat_low_loy` — neutral cohort drifting anyway ("nothing
    in particular keeps them — and nothing in particular is what we've
    given them")
  - `est_mid_sat_high_loy` — loyal cohort, a single bad night
    ("they've forgiven us a hundred times; tonight's the test of one
    more")

  The existing `est_satisfaction_repeat` (low sat × repeat ≥3) and
  `est_loyalty_complaint` (low loyalty × complaint memory) stay.

- **3 pressure / memory top rungs**:
  - `signalEquals customer_group.satisfaction=low + pressureRising reputation_drift`
    (the cohort meter and the tavern-wide pressure agreeing)
  - `signalEquals customer_group.loyalty=low + memoryPresent complaint`
    (today's drift built on yesterday's grievance)
  - `pressureRising regular_customer_loss + memoryPresent customer`
    (the loss building, the customer-memory marking who's at risk)

**Invariants** (carried from Phase 149 / 150):
- Every new combo on a sim_backed slot carries ≥1 state-lookup
  primitive so `simCoherence` passes.
- The mid×mid cells stay unauthored — the unconditional fallback
  handles them cleanly; diversity has proven safe across Phase 149 /
  150.
- Spec-2 combos always beat the multi-fact join when both facts
  resolve; the join fires only for unauthored pairs.

### D. State-keyed reaction & sensory pools

Additive — existing voice-keyed snippets stay (voice persists as a
layer). New spec-1 state-keyed snippets fire orthogonally and win when
state matches but voice is neutral. Pattern mirrors Phase 149 / 150's
reaction/manner additions.

**`regularComplaint/reactionLine.ts`** — 7 new state-keyed snippets
appended to the existing 16 voice/tic-keyed ones:
- `signalEquals regular.irritation=high` (acknowledge the boil over
  in first-person: "I've held this in for weeks")
- `signalEquals regular.loyalty=low` (acknowledge the drift: "I
  shouldn't even be here saying this")
- `pressureRising regular_customer_loss` (acknowledge the slide: "and
  I won't be the last to walk")
- `memoryPresent grudge` (acknowledge the long memory)
- `memoryPresent ignored_complaint` (acknowledge being unheard)
- `memoryPresent warning` (acknowledge having warned them)
- `repeatCount regular atLeast: 3` (acknowledge the pattern: "third
  time I've stood here with the same words")

**`regularComplaint/mannerNote.ts`** — 5 new state-keyed sensory beats
appended to the existing 9 voice/tic-keyed ones:
- `signalEquals regular.irritation=high` (a flat hand on the bar)
- `signalEquals regular.loyalty=low` (one foot already turned toward
  the door)
- `pressureRising regular_customer_loss` (a glance to where they used
  to sit)
- `memoryPresent grudge` (the same hard line at the mouth)
- `repeatCount regular atLeast: 3` (the words come without thinking)

**`customerComplaint/reactionLine.ts`** — 7 new state-keyed snippets
appended to the existing 16 voice/tic-keyed ones. First-person plural
throughout (cohort voice, mirroring the existing pool):
- `signalEquals customer_group.satisfaction=low` ("we've stopped
  looking forward to it")
- `signalEquals customer_group.loyalty=low` ("there's no reason left
  to keep us here")
- `pressureRising reputation_drift` ("and we tell the others, when
  they ask")
- `pressureRising regular_customer_loss` ("the table's been thinning
  for weeks")
- `memoryPresent complaint` ("we said it last time and nothing
  changed")
- `memoryPresent customer` ("we've been coming here long enough to
  remember better")
- `repeatCount customer atLeast: 3` ("three nights running, the same
  trouble")

**`customerComplaint/mannerNote.ts`** — 5 new state-keyed sensory
beats appended to the existing 10 voice/tic-keyed ones:
- `signalEquals customer_group.satisfaction=low` (cohort sets coins on
  the table without looking up)
- `signalEquals customer_group.loyalty=low` (chairs scrape back in
  unison)
- `pressureRising reputation_drift` (one of them is already at the
  window, beckoning)
- `memoryPresent complaint` (the same tired exchange of glances around
  the table)
- `repeatCount customer atLeast: 3` (no fuss, no surprise — practiced
  disappointment)

**`drinkOrder/mannerNote.ts`** — 4 new state-keyed sensory beats
appended to the existing 8 voice/tic-keyed ones. drinkOrder's
`relationship_test` branch fires for irritation ≤ 60 (low or mid), so
state reads here are intentionally subtle — the regular hasn't
escalated yet, but their standing still reads at the manner:
- `signalEquals regular.irritation=mid` (one extra glance at the bar
  before they speak)
- `signalEquals regular.loyalty=high` (they wait their turn as they
  always do)
- `signalEquals regular.loyalty=low` (the order comes shorter than
  usual)
- `memoryPresent grudge` (an absence where there used to be a nod)

Word budgets carried from existing per-slot specs: `reaction_line` ≤
12, `manner_note` ≤ 10. Authoring trims any overrun before commit
(Phase 149 caught two; Phase 150 budgeted 0–3; budget the same here).

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — two new `SALIENCE_TABLES` entries
  (`regular_customer`, `customer_complaint`).
- `src/cards/templates/regularComplaint.ts` — `saliencePolicy: 'multi'`
  + `multiFactJoin: ' — '` on `establishing_line` slot + explanatory
  comment.
- `src/cards/templates/customerComplaint.ts` — same wiring.
- `src/cards/compose/pools/regularComplaint/{establishingLine,reactionLine,mannerNote}.ts`
  — combo cells + state-keyed snippets.
- `src/cards/compose/pools/customerComplaint/{establishingLine,reactionLine,mannerNote}.ts`
  — combo cells + state-keyed snippets.
- `src/cards/compose/pools/drinkOrder/mannerNote.ts` — state-keyed
  snippets only (no establishing matrix; template body has no
  establishing slot).
- `specs/cards/regular_complaint.spec.yaml` + `specs/cards/customer_complaint.spec.yaml`
  + `specs/cards/drink_order.spec.yaml` — design-record additions for
  the new matrix cells and state-keyed snippets (record only; authoring
  is in-repo per the Phase-4 loop).
- `tests/cards/templates.regularComplaint.test.ts` +
  `tests/cards/templates.customerComplaint.test.ts` +
  `tests/cards/templates.drinkOrder.test.ts` — only where a
  pre-existing assertion narrows to a single snippet's exact text that
  the new multi-fact policy now composes. Phase 149 had two such
  updates, Phase 150 had two; budget 1–3 here. Each update relaxes to
  assert the *salient-fact contract* (evidence of both facts present),
  not the specific path.
- `docs/ISSUE_TRACKER.md` — new ISSUE-119 entry following the
  ISSUE-117 / ISSUE-118 row shape.
- `docs/plans/legible-surface-arc.md` — no edits; the arc doc names
  Phase 6 with provisional ids already.

**Created:**
- `tests/cards/compose/phase151.exhaustiveMatrix.test.ts` — new file,
  ~16 tests mirroring `phase150.exhaustiveMatrix.test.ts`:
  - 5 `regularComplaint` cells (4 irritation×loyalty corners + 1
    loyalty=low × regular_customer_loss top rung), each asserting the
    combo's distinctive substring appears in `view.body[0]`
  - 5 `customerComplaint` cells (4 satisfaction×loyalty corners + 1
    satisfaction=low × reputation_drift top rung)
  - 2 state-varying reaction tests (1 per complaint template — same
    seed, two distinct state mutations, two distinct `body[1]`s)
  - 2 state-varying drinkOrder manner tests (1 for loyalty=high, 1
    for loyalty=low — same seed, mutated state, distinct `manner_note`)
  - 2 re-render stability tests (1 per complaint template — JSON
    equality across two `card.render()` calls with the same seed+state)

  Reuses the Phase 149 / 150 helpers (`withRisingPressure`,
  `withMemory`); adds a new `withNeutralRegularVoice` /
  `withNeutralCohortVoice` parallel to `withNeutralStaffVoice`
  (castAttributes axes all at 1 so voice-extreme snippets don't
  outrank state-keyed; cohorts have no castAttributes so the cohort
  helper is a no-op marker). New `regularSeed(type, regularId)` /
  `cohortSeed(groupId)` builders per family.

  **Optional add (decide during implementation):** 2–3-test extension
  to `tests/cards/compose/phase146.salience.test.ts` asserting the two
  new `SALIENCE_TABLES` entries resolve as expected against fixture
  states (parallel to existing `supplier_relationship` / `staff_*`
  coverage). Tiny cost, useful regression net. Add unless gate
  run-time pressure argues against (Phase 150 elected to add this).

- `docs/plans/phase-151-regulars-complaints-content.md` — this file
  lifted in.

## Verification

Sequential, fail-fast — identical shape to Phase 149 / 150:

1. `npm run typecheck` — types compile after the `SALIENCE_TABLES`
   additions (no shape changes; just new entries).
2. `npm test -- --run tests/cards/compose/phase146.salience.test.ts` —
   pre-existing salience tests still pass (no resolver changes this
   phase; the new tables resolve through unchanged branches). Plus
   any optional new salience-table-coverage tests pass.
3. `npm test -- --run tests/cards/compose/gates/` — all nine gates
   pass across the deepened pools. Watch especially:
   - `simCoherence` (every new combo carries ≥1 state-lookup primitive)
   - `diversity` (samplers must still hit minDistinct on deepened
     pools — Phase 149 / 150 saw none, expect same)
   - `dedupe` (within-slot Levenshtein ≥0.85 — Phase 149 rephrased
     two snippets to clear; budget 2–3 here too, especially across
     the parallel regular/cohort body since both families voice the
     same kind of grievance)
   - `voiceBounds` (em-dashes count as words; `reaction_line ≤ 12`
     is tight)
4. `npm test -- --run tests/cards/templates.{drinkOrder,regularComplaint,customerComplaint}.test.ts`
   — existing template integration tests stay green (with any
   narrow-to-specific-text assertions relaxed per the §Critical-files
   note).
5. `npm test -- --run tests/cards/compose/phase151.exhaustiveMatrix.test.ts`
   — 16/16 new tests pass.
6. `npm test` — full regression green at prior baseline + ~16–19 new
   tests (depending on the optional salience-table-coverage add).

## Anticipated risks

1. **Cohort first-person plural drift.** customerComplaint's existing
   reaction pool speaks as "we" (the cohort). New state-keyed snippets
   must stay in plural — a slip to "I" reads as a single regular
   speaking and breaks the template's cohort framing. Cross-check
   every new customerComplaint snippet pre-commit.
2. **Parallel-pool dedupe across families.** regular and cohort
   complaints voice the *same kind* of grievance — "we won't be back"
   vs "I won't be back" almost canonicalises identical. The dedupe
   gate runs per-pool, not cross-pool, so this won't trip the gate;
   but watch for it in voice consistency reads. Vary the verbs and
   imagery between the two families where possible.
3. **Reaction-line word budget.** `reaction_line` caps at 12 words;
   em-dashes count as words. Phase 149 caught two such trims; budget
   the same. Trim in place pre-commit.
4. **Multi-fact join word overflow on `establishing_line ≤ 14`.**
   Default budget is `wordBudget * 2 = 28`; if two existing
   single-condition snippets sum past 28 the secondary drops silently
   (silence beats stapling, per Phase 1 contract). The 4-corner spec-2
   combos handle every band×band case, so the join only fires for
   unanticipated pairs (signal × pressure where no top-rung combo
   exists). Acceptable per design.
5. **Existing combos vs new corner combos on regularComplaint.**
   `est_irritation_repeat` covers high irritation × repeat ≥3
   (salience indices 0 + 7); the new high×low corner covers indices
   0 + 1. Tie-broken by extremity then table index. Both reads in the
   corner combo are extremity 2 (band corners), and `repeat` is a
   single-read primitive — the corner wins on extremity sum. Same
   shape for `est_loyalty_grudge` (loyalty + memory): the new
   mid_irritation × low_loyalty corner ties on band extremity but
   wins on index sum. The intent is for the band corners to win when
   both signals resolve to extreme bands; existing combos catch the
   off-corner cases. Verify with the exhaustive matrix tests.
6. **Test update count.** Phase 149 updated two existing tests, Phase
   150 updated two; budget 1–3 here. Each update preserves the
   assertion's intent (the headline fact is present) while loosening
   byte-equality to a salient-substring contract.

## Out of scope (deferred to later phases)

- **drinkOrder `establishing_line` slot transplant.** Adding a new
  fact-stating slot to the relationship_test branch would change the
  template body shape and defeat the design (the regular's *voice* is
  the body). drinkOrder gets a light state-keyed `mannerNote`
  deepening only.
- **customer_group.rowdiness band reads** for cohort complaints.
  Rowdiness lands at the violence template (Phase 138 / ISSUE-107);
  it isn't part of the customer_complaint family's salient surface.
- **`rumour_pressure` and `cultural_tension` salience entries for
  customer_complaint.** Both are referenced as rising pressures in
  individual response profiles but aren't broadly salient to a cohort
  complaint's headline. Pool snippets gated on them stay reachable;
  they just don't appear in the salience table.
- The five remaining Movement VI cluster phases (7–11): Factions &
  Culture, Premises & Atmosphere, Crises & Safety, Reputation &
  Rumour, Periodic & Narrative.
- Movement VII preview-pool authoring against `EffectDirection ×
  EffectMagnitudeBand` (Phases 12–14). The regular/cohort
  `effectPreview` pools stay as Phase-8 / Phase-147 authored;
  Movement VII recalibrates them per-meter.
- The Phase-16 legibility gate (needs ≥3 migrated clusters first —
  Phase 6 brings the count to 3, so Phase 16 unblocks *after* this
  phase but is its own phase).
- Any change to sim response slot counts, verbs, targets, or effect
  amounts — composition voices around mechanics, never alters them.
- No new condition primitives; no new `SalienceRead` kinds; no
  changes to the choice-distinctness cap or preview-legibility
  contract (all Movement V; locked).
