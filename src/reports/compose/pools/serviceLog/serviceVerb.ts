// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15: every banded
// snippet's text carries a token from `MAGNITUDE_LEXICON[direction][band]`
// so a `+15` coin day reads distinct from a `+150` one. The
// `checkReportLegibility` gate confirms the calibration.
//
// Verb for the daily service-log Service line. Composed as:
//   `${verb} ${netCoin} coin (${unpaidTabs} unpaid tabs).`
// The figures stay structural; only the leading verb is voiced.
//
// Routing via seed.domain (direction × magnitude):
//   service_gain_small | service_gain_mid | service_gain_large
//   service_loss_small | service_loss_mid | service_loss_large
// The Service line only emits when netCoinEarned !== 0, so "flat" is
// unreachable.
//
// Body cap 4 words (Phase 160 bump from 2 to fit lexicon tokens).

import type { SnippetPool } from '../../../../cards/compose/types'

export const serviceVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    // — Unconditional fallback —
    { id: 'sv_fallback', text: 'Took', conditions: [] },

    // — Service gain × magnitude (lexicon: positive small/medium/large) —
    {
      id: 'sv_gain_small_notch',
      text: 'Pocketed a notch',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_small' }],
    },
    {
      id: 'sv_gain_small_measure',
      text: 'Took a measure',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_small' }],
    },
    {
      id: 'sv_gain_mid_real_step',
      text: 'Banked a real step',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_mid' }],
    },
    {
      id: 'sv_gain_mid_clear_lift',
      text: 'Earned a clear lift',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_mid' }],
    },
    {
      id: 'sv_gain_large_surge',
      text: 'Pulled in a surge',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_large' }],
    },
    {
      id: 'sv_gain_large_wide_leap',
      text: 'Brought a wide leap',
      conditions: [{ kind: 'hasTag', tag: 'service_gain_large' }],
    },

    // — Service loss × magnitude (lexicon: negative small/medium/large) —
    {
      id: 'sv_loss_small_notch',
      text: 'Spent a notch',
      conditions: [{ kind: 'hasTag', tag: 'service_loss_small' }],
    },
    {
      id: 'sv_loss_small_measure',
      text: 'Lost a measure',
      conditions: [{ kind: 'hasTag', tag: 'service_loss_small' }],
    },
    {
      id: 'sv_loss_mid_real_slip',
      text: 'Dropped a real slip',
      conditions: [{ kind: 'hasTag', tag: 'service_loss_mid' }],
    },
    {
      id: 'sv_loss_mid_clear_drop',
      text: 'Lost a clear drop',
      conditions: [{ kind: 'hasTag', tag: 'service_loss_mid' }],
    },
    {
      id: 'sv_loss_large_heavy_fall',
      text: 'Took a heavy fall',
      conditions: [{ kind: 'hasTag', tag: 'service_loss_large' }],
    },
    {
      id: 'sv_loss_large_wide_slide',
      text: 'Lost a wide slide',
      conditions: [{ kind: 'hasTag', tag: 'service_loss_large' }],
    },
  ],
}
