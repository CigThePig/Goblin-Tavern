// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Voiced labels for the reputation_shift template's response choices.
// Narrator-voiced — gated on `responseVerb` / `responseShape` /
// `severityAtLeast` / `hasTag`, never on actor voice (no actor resolves
// for this template). The synthetic slot is optional so an unmatched
// seed falls back to the sim's verbatim `slot.labelHint`.
//
// The reputation_shift allowedVerbs surface at
// `issueSeedGenerators.ts:3341-3374`:
//   - embrace   / rebrand / reputation_play
//   - correct   / clean,repair,pay / long_term_investment
//   - advertise / invite / compromise
//   - diversify / rebrand / compromise
// `rebrand` appears on two slots — embrace vs diversify is split by
// `responseShape`.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_embrace_default',
      text: 'Lean into the identity',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['reputation_play'] },
      ],
    },
    {
      id: 'label_embrace_severity',
      text: 'Own the shift outright',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['reputation_play'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_correct_default',
      text: 'Pull the name back',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean', 'repair', 'pay'] },
      ],
    },
    {
      id: 'label_correct_severity',
      text: 'Spend coin to course-correct',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean', 'repair', 'pay'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_advertise_default',
      text: 'Call the matching crowd in',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite'] },
      ],
    },
    {
      id: 'label_diversify_default',
      text: 'Broaden the offer',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['compromise'] },
      ],
    },
  ],
}
