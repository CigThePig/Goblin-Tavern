// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Verb for the Missed Opportunities `ignored_seed` readable line.
// Composed as `${slotLabel} would have ${verb} the ${subject} incident.`
// The slot label and subject noun stay sim-derived; the verb is voiced.
//
// Routing via seed.domain (severity band):
//   ignored_low (severity ≤ 30) — soft verbs (settled, eased)
//   ignored_mid (30 < severity ≤ 70) — neutral (closed, resolved)
//   ignored_high (severity > 70) — strong (averted, headed off)
//
// Body cap 2 words ("headed off" is 2).

import type { SnippetPool } from '../../../../cards/compose/types'

export const ignoredVerbPool: SnippetPool = {
  slotId: 'ignored_verb',
  snippets: [
    { id: 'ign_fallback', text: 'closed', conditions: [] },
    {
      id: 'ign_low_settled',
      text: 'settled',
      conditions: [{ kind: 'hasTag', tag: 'ignored_low' }],
    },
    {
      id: 'ign_low_eased',
      text: 'eased',
      conditions: [{ kind: 'hasTag', tag: 'ignored_low' }],
    },
    {
      id: 'ign_mid_resolved',
      text: 'resolved',
      conditions: [{ kind: 'hasTag', tag: 'ignored_mid' }],
    },
    {
      id: 'ign_mid_ended',
      text: 'ended',
      conditions: [{ kind: 'hasTag', tag: 'ignored_mid' }],
    },
    {
      id: 'ign_high_averted',
      text: 'averted',
      conditions: [{ kind: 'hasTag', tag: 'ignored_high' }],
    },
    {
      id: 'ign_high_headed_off',
      text: 'headed off',
      conditions: [{ kind: 'hasTag', tag: 'ignored_high' }],
    },
  ],
}
