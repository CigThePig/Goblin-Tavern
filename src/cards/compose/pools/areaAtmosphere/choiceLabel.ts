// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Voiced labels for the area_atmosphere template's response choices.
// Narrator-voiced — gated on `responseVerb` / `responseShape` /
// `severityAtLeast` / `hasTag`, never on actor voice. The synthetic
// slot is optional so an unmatched seed falls back to the sim's
// verbatim `slot.labelHint`.
//
// The area_atmosphere allowedVerbs surface at
// `expandedSeedGenerators.ts:2523-2572` — repair / clean / upgrade /
// delay / rebrand / ignore. Six verbs map to six response shapes; the
// snippets key on verb × shape × severity / hasTag.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_repair',
      text: 'Repair what is broken',
      conditions: [
        { kind: 'responseVerb', anyOf: ['repair'] },
      ],
    },
    {
      id: 'label_clean_severity',
      text: 'Scrub it back to shape',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_clean',
      text: 'Send the cleaning crew',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
      ],
    },
    {
      id: 'label_upgrade',
      text: 'Start a real project',
      conditions: [
        { kind: 'responseVerb', anyOf: ['upgrade'] },
      ],
    },
    {
      id: 'label_delay',
      text: 'Close the room for now',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
      ],
    },
    {
      id: 'label_rebrand',
      text: 'Rebrand the space',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
      ],
    },
    {
      id: 'label_ignore',
      text: 'Leave it for another day',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
  ],
}
