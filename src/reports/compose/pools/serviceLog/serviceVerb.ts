// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Verb for the daily service-log Service line. Composed as:
//   `${verb} ${netCoin} coin (${unpaidTabs} unpaid tabs).`
// The figures stay structural; only the leading verb is voiced.
//
// Routing via seed.domain (direction × magnitude):
//   service_gain_small | service_gain_mid | service_gain_large
//   service_loss
// (The line only emits when netCoinEarned !== 0, so "flat" is
// unreachable.)
//
// Body cap 2 words.

import type { SnippetPool } from '../../../../cards/compose/types'

export const serviceVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    { id: 'sv_fallback', text: 'Took', conditions: [] },
    {
      id: 'sv_gain_small_pocketed',
      text: 'Pocketed',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_small' }],
    },
    {
      id: 'sv_gain_mid_earned',
      text: 'Earned',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_mid' }],
    },
    {
      id: 'sv_gain_mid_banked',
      text: 'Banked',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_mid' }],
    },
    {
      id: 'sv_gain_large_brought_in',
      text: 'Brought in',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_large' }],
    },
    {
      id: 'sv_gain_large_pulled',
      text: 'Pulled in',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_large' }],
    },
    {
      id: 'sv_loss_lost',
      text: 'Lost',
      conditions: [{ kind: 'hasTag', tag: 'service_loss' }],
    },
    {
      id: 'sv_loss_dropped',
      text: 'Dropped',
      conditions: [{ kind: 'hasTag', tag: 'service_loss' }],
    },
  ],
}
