// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Optional third-person sensory beat for the food_safety template —
// the cook wiping a hand, setting down a tasting spoon, the apron
// knotted twice. Voice-axis-gated only; no checkable claim.

import type { SnippetPool } from '../../types'

export const mannerNotePool: SnippetPool = {
  slotId: 'manner_note',
  snippets: [
    {
      id: 'mnr_warm',
      text: 'She wipes her hands and meets your eye, waiting.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_cold',
      text: 'She sets the tasting spoon down without looking up.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_formal',
      text: 'She squares the apron and waits for your decision.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse',
      text: 'She holds up the spoon and says nothing else.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'mnr_terse_cold',
      text: 'She keeps one hand on the prep block, watching.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'mnr_tic_qualifies',
      text: 'She tugs her cuff straight, twice, then once more.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },

    // Phase 18 repair: spec-0 fillers so neutral-voiced cooks fire.
    {
      id: 'mnr_mild_warm',
      text: 'She rests one hand on the cutting board.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_formal',
      text: 'She smooths the apron flat before speaking.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_terse',
      text: 'She turns the spoon over in her palm.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 1 },
      ],
      specificity: 0,
    },
    {
      id: 'mnr_mild_florid',
      text: 'She tilts her head toward the larder door.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 1 },
      ],
      specificity: 0,
    },

    // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9.
    // Spec-1 state-keyed sensory beats so the cook's manner reflects
    // her actual standing rather than standing fixed on voice axes
    // alone. Third-person "she" framing (consistent with the existing
    // pool); no role-claim words.
    {
      id: 'mnr_state_low_clean',
      text: 'She glances at the grease line along the wall.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'mnr_state_high_stress',
      text: 'Her knuckles whiten on the cleaver grip.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.stress', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_high_fatigue',
      text: 'She leans on the prep counter, weight off her feet.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
      ],
    },
    {
      id: 'mnr_state_fatigue_inspection',
      text: 'A tired hand on the day it matters most.',
      conditions: [
        { kind: 'signalEquals', signal: 'staff.fatigue', role: 'primaryActor', equals: 'high' },
        { kind: 'hasTag', tag: 'inspection_relevant' },
      ],
    },
    {
      id: 'mnr_state_pressure_deception',
      text: 'A glance past the pot we sent out wrong.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'food_safety' },
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
  ],
}
