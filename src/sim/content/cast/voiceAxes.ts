// Phase 121 / ISSUE-090 — Living Cast Phase A.
//
// The voice axes are kept here as a tiny ordered data table so Phase B's
// expected feedback loop (rename one axis, drop one, add one) lands as a
// one-line edit rather than a refactor. The factory iterates this list
// in order; the resulting `VoiceProfile.axes` record always carries one
// entry per axis id.

import type { VoiceAxisId } from './castTypes'

export const VOICE_AXIS_IDS: readonly VoiceAxisId[] = [
  'terseness',
  'warmth',
  'formality',
  'floridity',
] as const

export type VoiceAxisDefinition = {
  id: VoiceAxisId
  /** Short authoring guideline. Not prose, not snippet text — meta. */
  hint: string
}

export const VOICE_AXIS_DEFINITIONS: Readonly<Record<VoiceAxisId, VoiceAxisDefinition>> =
  Object.freeze({
    terseness: {
      id: 'terseness',
      hint: 'Higher = clipped sentences, fewer connectives. Lower = full clauses.',
    },
    warmth: {
      id: 'warmth',
      hint: 'Higher = familiar, generous. Lower = distant, prickly.',
    },
    formality: {
      id: 'formality',
      hint: 'Higher = titles, hedging, ceremony. Lower = nicknames, direct address.',
    },
    floridity: {
      id: 'floridity',
      hint: 'Higher = embellishment, metaphor. Lower = plain naming of things.',
    },
  })
