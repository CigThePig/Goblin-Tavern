// Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6 (initial).
// Phase 144 / ISSUE-113 — Voiced Surface arc, Phase 18 (repair).
//
// Voiced effect-preview lines for the staff_aside template. Voice
// register `staff_quarters`. Each composed line corresponds 1-to-1 to a
// real `EffectPreview` in the consequence profile — the snippet replaces
// only the readable string. 10-word budget per the voice-bounds gate.
//
// Phase 18 repair shape: the original 6-snippet pool collapsed every
// state_change effect on a card to a single snippet (the "kitchen
// keeps its quiet drumbeat" screenshot). The fix is a multi-snippet
// base rung *per effect kind*, so the FNV tie-break in `pickSnippet`
// — which varies the per-effect synthetic slot id
// `effect_preview::${slotId}::${idx}` — has multiple candidates to
// spread across the choices/effects within a single card render.
//
// Voice deliberately does NOT gate preview lines. Previews are brief
// consequence statements; voice lives in the body slots
// (establishing_line / aside_line / manner_note / title) where it
// reads loudest. Phase 18 may layer voice-axis variants later; the
// repair is variety-first.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
    // — state_change base rung (the dominant kind on staff_identity) —
    {
      id: 'pre_state_change_a',
      text: 'morale shifts a beat',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'the kitchen catches the change',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'the rota notes it quietly',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'the shift carries the moment forward',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_e',
      text: 'the count moves a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_f',
      text: 'the prep tilts under it',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },

    // — pressure base rung (state_change cousin for meters) —
    {
      id: 'pre_pressure_a',
      text: 'the burnout meter would ride',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'loyalty risk would inch a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_c',
      text: 'pressure would settle a thread',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },

    // — future_hook base rung (the "later" effect kind) —
    {
      id: 'pre_future_hook_a',
      text: 'a thread would surface later',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },
    {
      id: 'pre_future_hook_b',
      text: 'the rota would loop back to it',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },

    // — cause base rung (attribution effects) —
    {
      id: 'pre_cause_a',
      text: 'the room would mark the choice',
      conditions: [{ kind: 'effectKind', anyOf: ['cause'] }],
    },
    {
      id: 'pre_cause_b',
      text: 'the credit would land in plain view',
      conditions: [{ kind: 'effectKind', anyOf: ['cause'] }],
    },
  ],
}
