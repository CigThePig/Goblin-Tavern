// Phase 136 / ISSUE-105 — Voiced Surface arc, Phase 10 (Factions & Culture).
//
// Voiced labels for the culture_conflict template's response choices.
// Narrator-voiced — gated on `responseVerb` × `responseShape` /
// `severityAtLeast` / `hasTag`, never on actor voice (cultures have no
// castAttributes). Synthetic slot is optional so an unmatched seed
// falls back to the sim's verbatim `slot.labelHint`.
//
// The culture_conflict verb surface at `expandedSeedGenerators.ts:2238-2287`
// — appease / negotiate / invite / serve / ignore / rebrand / discount /
// delegate.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_mediate_severity',
      text: 'Step between the groups',
      conditions: [
        { kind: 'responseVerb', anyOf: ['appease', 'negotiate'] },
        { kind: 'severityAtLeast', value: 60 },
      ],
    },
    {
      id: 'label_honour_festival',
      text: 'Honour the festival custom',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite', 'serve'] },
        { kind: 'hasTag', tag: 'festival' },
      ],
    },
    {
      id: 'label_honour_ritual',
      text: 'Acknowledge their ritual',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite', 'serve'] },
        { kind: 'hasTag', tag: 'ritual' },
      ],
    },
    {
      id: 'label_ignore_default',
      text: 'Let it pass tonight',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
    {
      id: 'label_rebrand_default',
      text: 'Adjust the seating',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
      ],
    },
    {
      id: 'label_discount_default',
      text: 'Stand a round for them',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discount'] },
      ],
    },
    {
      id: 'label_delegate_default',
      text: 'Send the staff over',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delegate'] },
      ],
    },
  ],
}
