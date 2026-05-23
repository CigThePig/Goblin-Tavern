// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Voiced labels for the rumour_crisis template's response choices.
// Voice-axis gating reads through the target's `castAttributes`. The
// synthetic slot is optional so an unmatched seed falls back to the
// sim's verbatim `slot.labelHint`.
//
// The rumour_crisis allowedVerbs surface at
// `expandedSeedGenerators.ts:4963-5040` — nine slots (largest verb
// roster in the codebase along with Phase 12's inspection):
//   - deny_rumour            / rebrand / reputation_play
//   - confess_partial_truth  / confess / relationship_sacrifice
//   - blame_someone_else     / blame / deception
//   - prove_truth            / rebrand / long_term_investment
//   - bribe_gossip           / bribe / risky_profitable
//   - ignore_rumour          / ignore / ignore
//   - counter_rumour         / rebrand / deception
//   - ask_regular_to_vouch   / invite, negotiate / safe_costly
//   - name_source_publicly   / blame, confess / escalation
// `rebrand` appears three times — `responseShape` disambiguates.

import type { SnippetPool } from '../../types'

export const choiceLabelPool: SnippetPool = {
  slotId: 'choice_label',
  snippets: [
    {
      id: 'label_deny_default',
      text: 'Deny the story',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['reputation_play'] },
      ],
    },
    {
      id: 'label_confess_default',
      text: 'Tell the honest part',
      conditions: [
        { kind: 'responseVerb', anyOf: ['confess'] },
        { kind: 'responseShape', anyOf: ['relationship_sacrifice'] },
      ],
    },
    {
      id: 'label_blame_default',
      text: 'Push it onto another',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame'] },
        { kind: 'responseShape', anyOf: ['deception'] },
      ],
    },
    {
      id: 'label_prove_default',
      text: 'Settle it with evidence',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    {
      id: 'label_bribe_default',
      text: 'Pay the talker quiet',
      conditions: [
        { kind: 'responseVerb', anyOf: ['bribe'] },
      ],
    },
    {
      id: 'label_ignore_default',
      text: 'Let it travel',
      conditions: [
        { kind: 'responseVerb', anyOf: ['ignore'] },
      ],
    },
    {
      id: 'label_counter_default',
      text: 'Plant a louder story',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['deception'] },
      ],
    },
    {
      id: 'label_vouch_default',
      text: 'Call in a vouching regular',
      conditions: [
        { kind: 'responseVerb', anyOf: ['invite', 'negotiate'] },
      ],
    },
    {
      id: 'label_name_default',
      text: 'Name the source aloud',
      conditions: [
        { kind: 'responseVerb', anyOf: ['blame', 'confess'] },
        { kind: 'responseShape', anyOf: ['escalation'] },
      ],
    },
    {
      id: 'label_deny_cold',
      text: 'Cut the story dead',
      conditions: [
        { kind: 'responseVerb', anyOf: ['rebrand'] },
        { kind: 'responseShape', anyOf: ['reputation_play'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'label_confess_warm',
      text: 'Own up plainly',
      conditions: [
        { kind: 'responseVerb', anyOf: ['confess'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'label_bribe_severity',
      text: 'Buy the silence outright',
      conditions: [
        { kind: 'responseVerb', anyOf: ['bribe'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
