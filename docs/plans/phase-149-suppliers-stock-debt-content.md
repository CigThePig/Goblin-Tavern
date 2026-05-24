# Phase 149 — Suppliers, Stock & Debt Content Matrices

**ISSUE-117.** First phase of Movement VI of the Legible Surface arc
(`docs/plans/legible-surface-arc.md`).

## Context

Voiced Surface made every line *speak*; the Legible Surface arc makes
every line *inform*. Phase 1 (signal salience + multi-fact slot,
ISSUE-114 / phase 146), Phase 2 (preview legibility contract + magnitude
lexicon + inaction wiring, ISSUE-115 / phase 147), and Phase 3 (choice
distinctness gate + legible choice cap, ISSUE-116 / phase 148) built the
machinery. **Phase 4 is the first phase to actually use that machinery
to author content** — establishing-line matrices keyed to the seventeen
banded signals, plus reaction/sensory pools that vary with state instead
of standing fixed on `voiceProfile` alone.

The Suppliers/Stock/Debt cluster went first for three reasons.
(1) `supplier_relationship` was the only family Phase 1 seeded into
`SALIENCE_TABLES`, so its multi-fact slot was already wired but its pool
only carried 9 mostly-single-condition snippets — a tested foundation
but not yet matrix-deep. (2) The cluster's three templates exercise both
actor-voiced (supplier, with `castAttributes`) and narrator-voiced
(stock, debt — `systemRef` landlord, stock-item subject) compositional
shapes, so the matrix patterns this phase establishes can be reused
across Movement VI's seven remaining cluster phases. (3) The arc
explicitly warned the first content matrix would name a salience tie the
ranking doesn't break or a meter pair the multi-fact slot can't express
— debt_rent's `hasTag(rent_due_soon)` and stock_shortage's
`severityAtLeast(70)` were exactly that gap (the legacy `SalienceRead`
kinds were only `signal`/`pressure`/`memory`/`repeat`), so Phase 4
absorbed the Movement-V loopback up-front as authorised scope rather
than deferring it.

## What shipped

Three templates, behind nine gates, plus one Movement-V loopback:

### A. `SalienceRead` extension (`src/cards/compose/salience.ts`)

Two new variants on the discriminated union:

```ts
| { kind: 'hasTag'; tag: string }
| { kind: 'severity'; atLeast: number }
```

`resolveSalientReads(seed, state)` gains matching branches:
- `hasTag`: resolves when `collectSeedTags(seed)` (already-exported
  helper from `compose/conditions.ts`) includes the tag. Extremity = 1.
- `severity`: resolves when `seed.severity >= atLeast`. Extremity = 1
  below 70, 2 at-or-above 70 (matches the high-band extremity convention
  used by signal reads).

`scoreCandidateSalience(snippet, resolved)` gains matching arms:
- Snippet `hasTag { tag }` matches a `hasTag` resolved read with the
  same tag string.
- Snippet `severityAtLeast { value }` matches a `severity` resolved
  read whose `atLeast` is `<=` the snippet's `value`. (Snippet must be
  at least as tight as the read's threshold — otherwise it would fire
  for cases the read considers below salient.)

`effectMatchesSalienceRead` in `cardHelpers.ts` extended exhaustively
for the new kinds. Both return `false`: calendar tags and seed-level
severity have no per-effect analogue, so slots tied to those facts fall
through to seed-order tie-break in the choice cap, which is the intended
presentation order anyway.

No new condition primitives. The snippet-side `hasTag` and
`severityAtLeast` already existed and are widely used.

### B. `SALIENCE_TABLES` extension

Added entries for `stock_shortage` and `debt_rent`:

```ts
stock_shortage: { reads: [
  { kind: 'severity', atLeast: 70 },
  { kind: 'pressure', pressureId: 'stock_shortage' },
  { kind: 'hasTag', tag: 'high_demand' },
  { kind: 'pressure', pressureId: 'reputation_drift' },
  { kind: 'memory', tag: 'deception' },
  { kind: 'memory', tag: 'price' },
  { kind: 'memory', tag: 'ignored' },
  { kind: 'memory', tag: 'stock' },
  { kind: 'repeat', subjectTag: 'stock', atLeast: 3 },
]}

debt_rent: { reads: [
  { kind: 'severity', atLeast: 70 },
  { kind: 'hasTag', tag: 'rent_due_soon' },
  { kind: 'pressure', pressureId: 'debt' },
  { kind: 'pressure', pressureId: 'landlord' },
  { kind: 'memory', tag: 'risk' },
  { kind: 'memory', tag: 'rent' },
  { kind: 'memory', tag: 'landlord' },
  { kind: 'memory', tag: 'debt' },
  { kind: 'repeat', subjectTag: 'debt', atLeast: 3 },
]}
```

Ordering: highest-extremity facts first (a crisis-severity flag or a
rent-due calendar fact dominates decision-relevance), then family
pressures, then choice-affecting memories, then the multi-period repeat
as the deepest rung.

### C. Multi-fact slot enablement

`stockShortage.ts` and `debtRent.ts` establishing_line slots gain:

```ts
saliencePolicy: 'multi',
multiFactJoin: ' — ',
```

Same join and budget (default `wordBudget * 2 = 28`) as supplier for
consistency across the cluster. The multi-fact join fires when no
spec-2 combo cell matches an unanticipated state.

### D. Exhaustive establishing matrix authoring

**`supplierReliability/establishingLine.ts`** — 7 new combo cells (total
16 snippets up from 9):

- 4 corner band combos: low×low ("burning bridge"), low×high ("loyal
  but failing"), high×low ("icy professional"), high×high ("ally")
- 3 pressure × signal / severity / memory top rungs: low reliability ×
  distrust↑, severity 70 × distrust↑, distrust↑ × supplier-memory

Each combo states BOTH salient facts in one hand-authored line; the
spec-2 combo cell always beats the multi-fact join (which only fires
when no combo covers the resolved pair). The mid×mid case falls through
to the unconditional fallback, as the spec anticipated.

**`stockShortage/establishingLine.ts`** — 8 new combo cells (total 18):

- 4 pressure × hasTag/memory combos: shortage↑ × high_demand, shortage↑
  × deception, shortage↑ × price, shortage↑ × ignored
- 4 severity / hasTag / memory tops: severity 70 × shortage↑ ×
  high_demand (3-cond), severity 70 × deception, high_demand × deception,
  reputation_drift↑ × ignored

**`debtRent/establishingLine.ts`** — 7 new combo cells (total 17):

- rent_due × debt↑, rent_due × risk-memory, debt↑ × landlord↑ (both
  pressures squeezing), landlord↑ × rent-paid memory (cooling despite
  payment), landlord↑ × risk memory, severity 70 × rent_due × landlord↑
  (3-cond worst case), severity 70 × landlord↑.

Every new combo on a sim_backed slot carries ≥1 state-lookup primitive
(`pressureRising` / `memoryPresent` / `repeatCount` / `signalEquals`) so
`simCoherence` passes — `hasTag` and `severityAtLeast` are not
state-lookup kinds on their own.

### E. State-keyed reaction & sensory pools

**`supplierReliability/reactionLine.ts`** — 8 new state-keyed snippets
appended to the existing 16 voice-keyed ones. The supplier's reaction
now reflects their actual standing, not just voice axes:

- `signalEquals reliability=low/high` (acknowledge own failure or
  confidence)
- `signalEquals relationship=low/high` (acknowledge the chill or warmth)
- `pressureRising supplier_distrust` (self-aware of the pattern)
- `pressureRising market_instability` (acknowledge climate)
- `repeatCount supplier ≥ 3` (acknowledge repeat)
- `signalEquals relationship=high + memoryPresent supplier` (warm with
  shared history)

**`supplierReliability/mannerNote.ts`** — 5 new state-keyed sensory beats
(boots in the yard, eyes on the ledger, road dust on the coat).

**`stockShortage/reactionLine.ts`** — 3 new combo cells matching the new
establishing matrix top rungs. **`stockShortage/mannerNote.ts`** — 2 new
sensory beats.

**`debtRent/reactionLine.ts`** — 3 new combo cells. **`debtRent/mannerNote.ts`**
— 3 new sensory beats.

Strategy is additive — existing voice-keyed snippets stay (voice persists
as a layer); state-keyed snippets at spec 1–2 fire orthogonally and win
when state matches but voice is neutral.

## Critical files

**Edited:**
- `src/cards/compose/salience.ts` — `SalienceRead` extension; new table
  entries.
- `src/cards/cardHelpers.ts` — `effectMatchesSalienceRead` exhaustive
  switch arms.
- `src/cards/templates/stockShortage.ts` / `debtRent.ts` — `saliencePolicy:
  'multi'` on establishing_line.
- `src/cards/compose/pools/supplierReliability/{establishingLine,reactionLine,mannerNote}.ts`
- `src/cards/compose/pools/stockShortage/{establishingLine,reactionLine,mannerNote}.ts`
- `src/cards/compose/pools/debtRent/{establishingLine,reactionLine,mannerNote}.ts`
- `tests/cards/compose/phase146.salience.test.ts` — +5 cases for hasTag /
  severity resolver + scoring.
- `tests/cards/templates.supplierReliability.test.ts` — updated existing
  multi-fact assertion (combo wins specificity over the join); added
  sibling test proving multi-fact mechanism still fires when no combo
  covers the pair.
- `tests/cards/templates.debtRent.test.ts` — updated existing
  eviction-memory test (multi-fact policy now composes risk + landlord
  memories together; assertion checks for the salient risk-memory
  evidence).
- `docs/ISSUE_TRACKER.md` — added ISSUE-117 entry.

**Created:**
- `tests/cards/compose/phase149.exhaustiveMatrix.test.ts` — 21 new tests
  covering matrix cell reachability (4 supplier corners + 1 pressure-
  pair, 5 stock cells, 5 debt cells), state-varying reaction (3
  templates), re-render stability (3 templates).
- `docs/plans/phase-149-suppliers-stock-debt-content.md` — this file.

## Verification

Sequential, fail-fast:

1. `npm run typecheck` ✓ — types compile after the `SalienceRead` union
   expansion.
2. `npm test -- --run tests/cards/compose/phase146.salience.test.ts` ✓
   — 21/21 (16 original + 5 new).
3. `npm test -- --run tests/cards/compose/gates/` ✓ — 125/125, all nine
   gates pass on the deepened pools across all 41 template configurations.
4. `npm test -- --run tests/cards/templates.supplierReliability.test.ts
   tests/cards/templates.stockShortage.test.ts
   tests/cards/templates.debtRent.test.ts` ✓ — 22 + 17 + 16 = 55/55.
5. `npm test -- --run tests/cards/compose/phase149.exhaustiveMatrix.test.ts` ✓
   — 21/21 (every authored matrix cell reachable, all state-varying
   reactions distinct, all three templates byte-stable across re-renders).
6. `npm test` — full regression green at 2680/2680 (+31 vs the
   post-Phase-148 baseline of 2649).

## Anticipated risks (observed during authoring)

1. **`SalienceRead` extension surfaced no second gap.** The two new
   kinds covered every matrix cell the cluster needed. Calendar tone
   tags like `payday`, `brawl_night`, `market_day` proved reachable
   through existing `hasTag` snippet conditions for reaction-line
   variation without needing salience-table entries (the higher-level
   `high_demand` tag covers the rush-day cases).
2. **Diversity gate stayed quiet on the 3×3 supplier mid-band cells.**
   The mid×mid combo wasn't authored (spec note: "mid is not authored"),
   and the unconditional fallback handles it cleanly — no warning.
3. **Severity-band extremity didn't double-count with pressure
   extremity.** A snippet gated on both `severityAtLeast 70` AND
   `pressureRising debt` scores once against the severity read and once
   against the pressure read (different indices), as intended.
4. **Updating two existing tests was unavoidable but in-scope.** The
   debt-rent eviction test asserted byte-equality against one of two
   specific snippets; multi-fact policy now composes risk + landlord
   memories into one line. The supplier multi-fact test asserted the
   join token; the new spec-2 low×low combo wins specificity. Both
   tests were updated to assert the salient-fact contract (combo or
   join, evidence of both salient facts is present) rather than the
   specific path.

## Out of scope (deferred to later phases)

- The other seven Movement VI cluster phases (5–11): Staff & Personnel,
  Regulars & Complaints, Factions & Culture, Premises & Atmosphere,
  Crises & Safety, Reputation & Rumour, Periodic & Narrative.
- Movement VII preview-pool authoring against `EffectDirection ×
  EffectMagnitudeBand` (Phases 12–14).
- The Phase-16 legibility gate (needs ≥3 migrated clusters first).
- Cohort routing for the miners cohort on stock_shortage / a player-
  owner voice profile (design-intent deferral noted in Phase 9 already).
- Any change to sim response slot counts, verbs, targets, or effect
  amounts — composition voices around mechanics, never alters them.
