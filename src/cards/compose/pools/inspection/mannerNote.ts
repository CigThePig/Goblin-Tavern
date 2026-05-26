// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Optional third-person sensory beat for the inspection template — a
// clipboard tapped, a slow walk along the bar, a glance to the
// kitchen door, a notebook flipped. Voice-axis-gated only; no
// checkable claim.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_terse',
      text: 'A clipboard taps once against the counter.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'They smooth the ledger before opening to a marked page.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_florid',
      text: 'The badge-cloth catches the morning lamp as they straighten.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_formal',
      text: 'A glance to the back. A slow nod.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_severity',
      text: 'A pencil hovers over the page, ready to mark.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'They straighten the cuff twice, then once more.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: spec-0 fillers so neutral inspectors fire.
    {
      id: 'mnr_mild_warm',
      text: 'They nod to the bartender as they pass.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'They square their cuff before opening the ledger.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'They tap a fingernail on the bartop.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'They turn the lapel pin toward the lamp.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Spec-1 state-keyed sensory beats so the inspector's manner
    // reflects actual standing rather than voice axes alone.
    // Third-person framing ("they" / impersonal); no role-claim
    // words.
    {
      id: 'mnr_state_low_relationship',
      text: 'Their glance lingers a beat too long on you.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_high_influence',
      text: 'Their badge catches the lamp as they straighten.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.influence', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_low_clean',
      text: 'A careful step around a sticky board.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_low_rel_inspection_tag',
      text: 'Their notebook comes out at the door.',
      conditions: [
        { kind: 'signalEquals', signal: 'faction.relationship', role: 'primaryActor', equals: 'low' },
        { kind: 'hasTag', tag: 'inspection_relevant' },
      ],
    },
    {
      id: 'mnr_state_pressure_prep',
      text: 'A glance past where the prep was meant to hold.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'inspection' },
        { kind: 'memoryPresent', tag: 'inspection_prep_recently' },
      ],
    },
  ],
}
