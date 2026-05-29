# Phase 164 — Meter Valence (Faithful Surface arc, Phase 2 / ISSUE-132)

Implements Phase 2 of [`faithful-surface-arc.md`](faithful-surface-arc.md). See
`docs/ISSUE_TRACKER.md` ISSUE-132 for the canonical status entry.

## Context

The arc's defect class #1: effect-preview `direction` was the *arithmetic sign* of the
amount, with no concept of *valence*. `classifyDirection(amount)` returned
`amount > 0 ? 'positive' : 'negative'`. "Comfort Mira" lowers `staff.stress` by 8; the sim
tagged that `direction: negative`; the preview pool faithfully rendered the negative-staff
line ("the rota would slip a real step thinner"). The player was told a kindness makes
things worse. The audit found **339 such mismatches across staff / area / culture cards**.

Phase 1 (ISSUE-131) switched the gate samplers to production-shape seeds, which is what
made these renders visible to the gates in the first place.

## What changed

All sim-side changes are in `src/sim/modules/issues/generatorHelpers.ts`:

1. **`METER_VALENCE`** — data record (beside `MAGNITUDE_BAND_CUTOFFS`) naming the
   lower-is-better meters by **meter sub-name** (the last dot-segment of the target string,
   because state-change targets carry the entity id in the middle: `staff.mira.stress` →
   `stress`, `areas.kitchen.damage` → `damage`):
   `stress`, `fatigue` (staff); `damage`, `smell`, `mess`, `risk` (area); `tension`
   (culture); `irritation` (regular), `rowdiness` (cohort) — the last two defensive.
   `cleanliness` / `condition` are **higher**-is-better and intentionally absent.

2. **`resolveMeterValence(target)`** — reads the last dot-segment against the map;
   colon-prefixed cause targets (`staff:cook_1`) fall through to higher-is-better (cause
   effects carry amount 0 ⇒ neutral anyway).

3. **`classifyDirection(amount?, target?)`** — inverts the sign before classifying when the
   target resolves lower-is-better; the no-target form keeps arithmetic behavior so other
   callers don't regress. `effect()` (the single ~240-call-site choke point; `makeEffect`
   does not exist) now passes `target` through.

**Pool reword (one snippet):** `shared_preview_staff_neg_medium_b`
"the rota would slip a real step thinner" → "the rota would wear thin by a real slip". A
pre-existing magnitude-vocab bug (gated `negative` but "a real step" is a *positive*.medium
lexicon token) that valence routed real renders into; a scan confirmed it was the only such
mismatch across all preview pools. No other pool changes — the preview pools were correctly
gated on `direction` and were simply fed the wrong signal.

## Pressure is excluded by design

`pressure.*` is **not** in the valence map. Pressure is stored rising = positive, and its
Phase-159 preview block already encodes threat-vs-relief in the *verbs* ("build / mount /
climb" rising = bad; "settle / ease / fall back" relief = good) keyed on arithmetic sign,
with directional medium/large magnitude words ("a clear lift" vs "a clear drop"). It was
never among the 339 mismatches; inverting it would flip those snippets onto the wrong
outcomes and force a full re-author of ~36 pressure snippets + the inaction block + the
phase159 tests — colliding with the arc's "don't re-author pools / don't touch the lexicon"
constraints. A code comment on `METER_VALENCE` records this so a future phase doesn't "fix"
the omission. On mixed-effect cards the player still reads a consistent good/bad tone:
inverted meters via the valence flip, pressure via its verbs.

## Tests

- `tests/sim/phase145.effectClassification.test.ts` — new `classifyDirection —
  valence-aware (target form)` block (inverted staff/area/culture + higher-is-better guards
  incl. explicit `cleanliness +25 → positive`, pressure-exclusion guards, no-target
  arithmetic) + two new `effect()` cases.
- `tests/cards/compose/phase164.meterValence.test.ts` (new, 6 tests) — end-to-end render
  proof: an inverted-meter consequence composes a correct-tone preview line carrying a
  matching `MAGNITUDE_LEXICON[direction][band]` token; higher-is-better + pressure guards.

## Scope boundary

The Phase-1-deferred legibility `it.todo('every migrated situation passes Q1 + Q2')` stays
todo. Phase 2 collapses the **valence-class** `preview_magnitude_missing` (verified by the
previewVariety.live cluster tests' `magnitudeRatio === 1` on staff/area/culture mixes). A
separate non-valence residue remains — Phase-144 `effectKind: future_hook` / `pressure` /
cohort-cause base-rung snippets that carry no magnitude token by design yet fire for banded
effects — alongside `choice_label_collision` (Phase 3) and `establishing_off_salient`
(Phase 4). The full Q1+Q2 restoration is Phase 4's.

No new gates, no new condition primitives, no `EffectDirection` redefinition (stays
two-valued + neutral), no magnitude-lexicon change.

## Result

`npm run typecheck` clean; full suite green at **3102/3102 + 1 todo across 225 files**.
