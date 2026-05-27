// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15: every banded
// snippet's text carries a token from `MAGNITUDE_LEXICON.positive.{tiny,
// small,large}` so traffic volume reads with calibrated weight
// ("Welcomed a hair" for a quiet night vs "Drew a wide leap" for a
// packed one). Traffic is always positive direction — it counts inflow.
//
// Verb for the daily service-log Traffic line. Composed as:
//   `${verb} ${trafficTotal} patrons across ${groupCount} groups.`
// The numbers stay structural; only the leading verb is voiced.
//
// Routing via seed.domain (volume band):
//   traffic_low (1-20), traffic_mid (21-60), traffic_high (>60).
// Mapped at gate-config time to (positive, tiny) / (positive, small) /
// (positive, large) for the lexicon check.
//
// Body cap 4 words (Phase 160 bump from 2 to fit lexicon tokens).

import type { SnippetPool } from '../../../../cards/compose/types'

export const trafficVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    { id: 'tv_fallback', text: 'Served', conditions: [] },

    // — Low traffic × tiny — lexicon: positive tiny tokens —
    {
      id: 'tv_low_hair',
      text: 'Welcomed a hair',
      conditions: [{ kind: 'hasTag', tag: 'traffic_low' }],
    },
    {
      id: 'tv_low_touch',
      text: 'Seated a touch',
      conditions: [{ kind: 'hasTag', tag: 'traffic_low' }],
    },

    // — Mid traffic × small — lexicon: positive small tokens —
    {
      id: 'tv_mid_step',
      text: 'Poured a step',
      conditions: [{ kind: 'hasTag', tag: 'traffic_mid' }],
    },
    {
      id: 'tv_mid_measure',
      text: 'Fed a measure',
      conditions: [{ kind: 'hasTag', tag: 'traffic_mid' }],
    },

    // — High traffic × large — lexicon: positive large tokens —
    {
      id: 'tv_high_surge',
      text: 'Drew a strong climb',
      conditions: [{ kind: 'hasTag', tag: 'traffic_high' }],
    },
    {
      id: 'tv_high_wide_leap',
      text: 'Packed a wide leap',
      conditions: [{ kind: 'hasTag', tag: 'traffic_high' }],
    },
  ],
}
