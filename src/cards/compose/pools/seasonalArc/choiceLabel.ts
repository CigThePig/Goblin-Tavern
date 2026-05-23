// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Voiced labels for the seasonal_arc template's response choices.
// Narrator-voiced — gated on `responseVerb` × theme `hasTag` /
// `severityAtLeast`, never on actor voice. The synthetic slot is
// optional so an unmatched seed falls back to the sim's verbatim
// `slot.labelHint`.
//
// The cross-theme verb surface from `buildSeasonalArcContent`
// (expandedSeedGenerators.ts:2849-4245) is wide — buy / negotiate /
// raise_price / pay / upgrade / clean / invite / bribe / rebrand /
// delay / discard / ignore — so these labels lean on
// shared moods (prep, hold the line, take the chance, hide it, ignore
// it) rather than per-theme verb-by-verb wording.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_buy_festival',
      text: 'Stock up before the crowd arrives',
      conditions: [
        { kind: 'responseVerb', anyOf: ['buy'] },
        { kind: 'hasTag', tag: 'festival_approaching' },
      ],
    },
    {
      id: 'label_buy_default',
      text: 'Lay in supplies for the run',
      conditions: [
        { kind: 'responseVerb', anyOf: ['buy'] },
      ],
    },
    {
      id: 'label_upgrade_default',
      text: 'Invest ahead of the day',
      conditions: [
        { kind: 'responseVerb', anyOf: ['upgrade'] },
      ],
    },
    {
      id: 'label_invite_default',
      text: 'Open the doors to the moment',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite'] },
      ],
    },
    {
      id: 'label_clean_default',
      text: 'Scrub everything before they look',
      conditions: [
        { kind: 'responseVerb', anyOf: ['clean'] },
      ],
    },
    {
      id: 'label_bribe_default',
      text: 'Slide coin under the table',
      conditions: [
        { kind: 'responseVerb', anyOf: ['bribe'] },
      ],
    },
    {
      id: 'label_rebrand_default',
      text: 'Lean into the moment publicly',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
      ],
    },
    {
      id: 'label_negotiate_default',
      text: 'Cut a quiet deal',
      conditions: [
        { kind: 'responseVerb', anyOf: ['negotiate'] },
      ],
    },
    {
      id: 'label_raise_price_severity',
      text: 'Set prices to match the rush',
      conditions: [
        { kind: 'responseVerb', anyOf: ['raise_price'] },
        { kind: 'severityAtLeast', value: 55 },
      ],
    },
    {
      id: 'label_raise_price_default',
      text: 'Lift the prices for the day',
      conditions: [
        { kind: 'responseVerb', anyOf: ['raise_price'] },
      ],
    },
    {
      id: 'label_pay_default',
      text: 'Pay to keep the trouble quiet',
      conditions: [
        { kind: 'responseVerb', anyOf: ['pay'] },
      ],
    },
    {
      id: 'label_delay_default',
      text: 'Wait it out for now',
      conditions: [
        { kind: 'responseVerb', anyOf: ['delay'] },
      ],
    },
    {
      id: 'label_discard_default',
      text: 'Throw the bad stock out',
      conditions: [
        { kind: 'responseVerb', anyOf: ['discard'] },
      ],
    },
    {
      id: 'label_ignore_default',
      text: 'Let the moment pass quietly',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
  ],
}
