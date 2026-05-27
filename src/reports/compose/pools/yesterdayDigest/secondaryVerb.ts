// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility): magnitude-banded variants added so a `+5` reputation
// gain reads distinct from a `+25` one. Each banded snippet's text
// contains a token from `MAGNITUDE_LEXICON[direction][band]` so the
// `checkReportLegibility` gate confirms the calibration.
//
// Verb phrase for the Yesterday Digest secondary line. The projection
// composes the final reputation/pressure secondary line as
// `${label} ${verb} ${signed(delta)}`. The verb is voiced here per
// (kind, direction, band); the label and figure stay structural.
//
// Routing via seed.domain (see `yesterdayDigest.ts:reputationTags` etc.):
//   - reputation_gain (direction-only fallback) + reputation_gain_small
//     / reputation_gain_mid / reputation_gain_large.
//   - reputation_loss (fallback) + reputation_loss_small / _mid / _large.
//   - reputation_hold (no magnitude).
//   - pressure_rise_small / pressure_rise_mid / pressure_rise_large.
//     For pressure, positive direction = rising = bad (the lexicon
//     stays banded; the verb carries threat: "creeping" / "mounting" /
//     "pressing") — same convention Phase 14 / phase-159 set for the
//     shared narrator base.
//
// Banded snippets carry an explicit `specificity: 2` so they out-rank
// the direction-only fallback snippets (specificity 1) on the per-pool
// pick. Both kinds of snippet have a single `hasTag` condition, but the
// section emits BOTH a direction tag AND a band tag in `seed.domain`
// whenever a magnitude band applies — so without the override the FNV
// tie-break would sometimes return the bare-direction fallback and the
// lexicon calibration would be invisible. The bare-direction fallback
// still fires for callers who pass only the direction tag (none ship
// with Phase 160, but the back-compat path is kept honest).
//
// Body cap 4 words (Phase 160 bump from 2 — the lexicon tokens add 2-3
// words to the leading verb).

import type { SnippetPool } from '../../../../cards/compose/types'

export const secondaryVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    // — Unconditional fallback —
    {
      id: 'yd_fallback',
      text: 'shifted',
      conditions: [],
    },

    // — Reputation gain (direction-only fallback) —
    {
      id: 'yd_rep_gain_fallback_rose',
      text: 'rose',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain' }],
    },
    {
      id: 'yd_rep_gain_fallback_climbed',
      text: 'climbed',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain' }],
    },

    // — Reputation gain × magnitude (lexicon-bound, specificity 2) —
    {
      id: 'yd_rep_gain_small_notch',
      text: 'rose a notch',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain_small' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_gain_small_measure',
      text: 'climbed a measure',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain_small' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_gain_mid_real_step',
      text: 'climbed a real step',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain_mid' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_gain_mid_marked_rise',
      text: 'rose a marked rise',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain_mid' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_gain_large_surge',
      text: 'surged a strong climb',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain_large' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_gain_large_wide_leap',
      text: 'leapt a wide leap',
      conditions: [{ kind: 'hasTag', tag: 'reputation_gain_large' }],
      specificity: 2,
    },

    // — Reputation loss (direction-only fallback) —
    {
      id: 'yd_rep_loss_fallback_fell',
      text: 'fell',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss' }],
    },
    {
      id: 'yd_rep_loss_fallback_slipped',
      text: 'slipped',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss' }],
    },

    // — Reputation loss × magnitude (lexicon-bound, specificity 2) —
    {
      id: 'yd_rep_loss_small_notch',
      text: 'slipped a notch',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss_small' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_loss_small_measure',
      text: 'fell a measure',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss_small' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_loss_mid_real_slip',
      text: 'dropped a real slip',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss_mid' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_loss_mid_marked_fall',
      text: 'fell a marked fall',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss_mid' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_loss_large_heavy_fall',
      text: 'fell a heavy fall',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss_large' }],
      specificity: 2,
    },
    {
      id: 'yd_rep_loss_large_wide_slide',
      text: 'slid a wide slide',
      conditions: [{ kind: 'hasTag', tag: 'reputation_loss_large' }],
      specificity: 2,
    },

    // — Reputation hold (no magnitude movement) —
    {
      id: 'yd_rep_held',
      text: 'held',
      conditions: [{ kind: 'hasTag', tag: 'reputation_hold' }],
    },

    // — Pressure rise × magnitude (lexicon-bound; pressure_rise_* tags
    //   are already band-specific, no direction-only fallback to compete
    //   with, so specificity 1 is enough) —
    //   Pressure is always positive-direction = rising = bad. Lexicon
    //   tokens come from `MAGNITUDE_LEXICON.positive.{small,medium,large}`;
    //   the verb carries threat ("creeping" / "mounting" / "pressing")
    //   distinct from the reputation-gain verbs ("rose" / "climbed" /
    //   "surged") so the dedupe gate stays below 0.85 within the pool.
    {
      id: 'yd_pres_small_notch',
      text: 'creeping a notch',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_small' }],
    },
    {
      id: 'yd_pres_small_step',
      text: 'pressing a step',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_small' }],
    },
    {
      id: 'yd_pres_mid_marked_rise',
      text: 'mounting a marked rise',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_mid' }],
    },
    {
      id: 'yd_pres_mid_clear_lift',
      text: 'building a clear lift',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_mid' }],
    },
    {
      id: 'yd_pres_large_wide_leap',
      text: 'spiking a wide leap',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_large' }],
    },
    {
      id: 'yd_pres_large_surge',
      text: 'pressing a surge',
      conditions: [{ kind: 'hasTag', tag: 'pressure_rise_large' }],
    },
  ],
}
