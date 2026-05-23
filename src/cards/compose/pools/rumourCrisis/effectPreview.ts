// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Voiced effect-preview lines for the rumour_crisis template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates
// `profile.immediateEffects` per choice); the snippet replaces only
// the readable string, never the kind / target / amount / tags.
// Narrator-voiced — gated on `effectKind` / `effectTag`, never on
// actor voice.
//
// The rumour_crisis consequence surface at
// `expandedSeedGenerators.ts:5044-5502` — nine profiles each carrying
// state_change on reputation axes, pressure shifts on rumour_pressure
// + cultural_tension + faction_anger, coin costs, cause adjustments,
// and future hooks.

import type { SnippetPool } from '../../types'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    {
      id: 'pre_reputation_state',
      text: "The house's name would shift with this",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for it',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_rumour_pressure',
      text: 'The pressure of the story would ease a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
        { kind: 'effectTag', tag: 'pressure' },
      ],
    },
    {
      id: 'pre_attribution_shift',
      text: 'The story would point a different direction now',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A risk would remain on the slate for later',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_regular_cost',
      text: "A regular's goodwill would draw down for it",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'regular' },
      ],
    },
    {
      id: 'pre_attribution_tag',
      text: 'The naming would settle on the chosen target',
      conditions: [
        { kind: 'effectTag', tag: 'attribution' },
      ],
    },
  ],
}
