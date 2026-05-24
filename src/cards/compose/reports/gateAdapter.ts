// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Adapter: wraps a report-section composer (id + slots + voiceRegister)
// as a `CompositionalCardTemplate`-shaped object so the existing
// `runAllGates` harness, the seven structural gates, and the diversity
// sampler infrastructure all apply unchanged. Stub `appliesTo` and
// `toCardView` exist only to satisfy the type; gates never call them.

import type { CardView } from '../../types'
import type {
  CompositionalCardTemplate,
  FilledSlots,
  SlotSpec,
  VoiceRegisterId,
} from '../types'

export type ReportSection = {
  id: string
  voiceRegister: VoiceRegisterId
  slots: readonly SlotSpec[]
}

const EMPTY_CARD_VIEW: CardView = {
  title: '',
  body: [],
  stakes: [],
  choices: [],
}

export function reportSectionAsTemplate(
  section: ReportSection,
): CompositionalCardTemplate {
  return {
    id: section.id,
    appliesTo: {},
    voiceRegister: section.voiceRegister,
    slots: [...section.slots],
    toCardView: (_filled: FilledSlots) => EMPTY_CARD_VIEW,
  }
}
