// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility): every banded snippet's text now carries a token from
// `MAGNITUDE_LEXICON.positive.{small,medium,large}` so a `+5` and a
// `+12` pressure delta render with distinct weight ("ticked a notch"
// vs "spiked a strong climb"). The `checkReportLegibility` gate
// confirms the calibration via the section's tagToBand mapping.
//
// Verb phrase for the Missed Opportunities `secondary` line. The
// projection composes the final line as
// `${pressureLabel} ${verb} ${signed(delta)} to ${value}.` — the verb
// is voiced here, the labels and figures stay structural.
//
// Delta magnitude routes via `seed.domain` carrying one of:
//   trend_small (|delta| ≤ 3), trend_mid (3 < |delta| ≤ 8),
//   trend_large (|delta| > 8). All routed by the section composer.
//
// Pressure direction in this surface is always positive = rising = bad
// (the secondary line is only emitted when a pressure rose); lexicon
// tokens are `MAGNITUDE_LEXICON.positive.*` and the verb carries the
// rising/threat semantics ("ticked", "rose", "spiked").

import type { SnippetPool } from '../../../../cards/compose/types'

export const secondaryVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    // — Unconditional fallback (no magnitude movement available) —
    {
      id: 'verb_fallback',
      text: 'rose',
      conditions: [],
    },

    // — Small band (|delta| ≤ 3) — lexicon: tiny/small tokens —
    {
      id: 'verb_small_notch',
      text: 'ticked a notch',
      conditions: [{ kind: 'hasTag', tag: 'trend_small' }],
    },
    {
      id: 'verb_small_step',
      text: 'crept a step',
      conditions: [{ kind: 'hasTag', tag: 'trend_small' }],
    },

    // — Mid band (3 < |delta| ≤ 8) — lexicon: medium tokens —
    {
      id: 'verb_mid_real_step',
      text: 'rose a real step',
      conditions: [{ kind: 'hasTag', tag: 'trend_mid' }],
    },
    {
      id: 'verb_mid_marked_rise',
      text: 'climbed a marked rise',
      conditions: [{ kind: 'hasTag', tag: 'trend_mid' }],
    },

    // — Large band (|delta| > 8) — lexicon: large tokens —
    {
      id: 'verb_large_strong_climb',
      text: 'surged a strong climb',
      conditions: [{ kind: 'hasTag', tag: 'trend_large' }],
    },
    {
      id: 'verb_large_wide_leap',
      text: 'spiked a wide leap',
      conditions: [{ kind: 'hasTag', tag: 'trend_large' }],
    },
  ],
}
