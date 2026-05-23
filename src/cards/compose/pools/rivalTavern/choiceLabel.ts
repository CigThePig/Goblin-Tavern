// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Voiced labels for the rival_tavern template's response choices.
// Narrator-voiced — gated on `responseVerb` / `responseShape` /
// `severityAtLeast` / `hasTag`, never on actor voice (no actor with
// castAttributes resolves for this template). The synthetic slot is
// optional so an unmatched seed falls back to the sim's verbatim
// `slot.labelHint`.
//
// The rival_tavern allowedVerbs surface at
// `expandedSeedGenerators.ts:5791-5839`:
//   - compete_on_price       / lower_price / risky_profitable
//   - host_counter_event     / invite      / long_term_investment
//   - improve_quality        / upgrade     / long_term_investment
//   - spread_counter_rumour  / rebrand     / deception
//   - negotiate_with_rival   / negotiate   / compromise
//   - ignore_rival           / ignore      / ignore
// `invite` and `upgrade` both ride long_term_investment — but the
// verbs alone disambiguate them. Same for the rest.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_price_default',
      text: 'Match the rival on price',
      conditions: [
        { kind: 'responseVerb', anyOf: ['lower_price'] },
      ],
    },
    {
      id: 'label_event_default',
      text: 'Throw a counter-event',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite'] },
      ],
    },
    {
      id: 'label_quality_default',
      text: 'Invest in the kitchen',
      conditions: [
        { kind: 'responseVerb', anyOf: ['upgrade'] },
      ],
    },
    {
      id: 'label_rumour_default',
      text: 'Plant a counter-rumour',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
      ],
    },
    {
      id: 'label_negotiate_default',
      text: 'Settle a truce with them',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
      ],
    },
    {
      id: 'label_ignore_default',
      text: 'Let them have the night',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
    {
      id: 'label_price_severity',
      text: 'Cut the price to the bone',
      conditions: [
        { kind: 'responseVerb', anyOf: ['lower_price'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'label_quality_arc',
      text: 'Outshine the named house',
      conditions: [
        { kind: 'responseVerb', anyOf: ['upgrade'] },
        { kind: 'hasTag', tag: 'rival.arc' },
      ],
    },
  ],
}
