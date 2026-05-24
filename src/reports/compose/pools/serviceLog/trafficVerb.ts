// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Verb for the daily service-log Traffic line. Composed as:
//   `${verb} ${trafficTotal} patrons across ${groupCount} groups.`
// The numbers stay structural; only the leading verb is voiced.
//
// Routing via seed.domain (volume band):
//   traffic_low (1-20), traffic_mid (21-60), traffic_high (>60).
//
// Body cap 2 words ("Brought in").

import type { SnippetPool } from '../../../../cards/compose/types'

export const trafficVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    { id: 'tv_fallback', text: 'Served', conditions: [] },
    {
      id: 'tv_low_welcomed',
      text: 'Welcomed',
      conditions: [{ kind: 'hasTag', tag: 'traffic_low' }],
    },
    {
      id: 'tv_low_seated',
      text: 'Seated',
      conditions: [{ kind: 'hasTag', tag: 'traffic_low' }],
    },
    {
      id: 'tv_mid_served',
      text: 'Poured for',
      conditions: [{ kind: 'hasTag', tag: 'traffic_mid' }],
    },
    {
      id: 'tv_mid_fed',
      text: 'Fed',
      conditions: [{ kind: 'hasTag', tag: 'traffic_mid' }],
    },
    {
      id: 'tv_high_drew',
      text: 'Drew',
      conditions: [{ kind: 'hasTag', tag: 'traffic_high' }],
    },
    {
      id: 'tv_high_brought_in',
      text: 'Brought in',
      conditions: [{ kind: 'hasTag', tag: 'traffic_high' }],
    },
  ],
}
