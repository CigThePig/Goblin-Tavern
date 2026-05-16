// Card-layer types.
//
// These mirror the locked shapes in docs/plans/cards-contract.md §6.
// The card layer itself (registry, selection algorithm, real card
// definitions) lives behind phase 87+ work and will land under
// `src/cards/`. When it does, this file should become a thin
// re-export of `src/cards/types.ts` rather than the source of truth.

import type {
  IssueSeed,
  IssueSeedType,
  IssueSeedFamilyId,
  IssueSeedTiming,
  ResponseIntentVerb,
  ResponseIntentShape,
} from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../../../src/sim/state/TavernState'

export type StakeView = {
  readable: string
  direction: 'loss' | 'gain' | 'risk'
}

export type CardChoice = {
  slotId: string
  label: string
  verb: ResponseIntentVerb
  targetId?: string
  shape: ResponseIntentShape
  previewEffects: string[]
  disabledReason?: string
}

export type CardView = {
  title: string
  body: string[]
  stakes: StakeView[]
  choices: CardChoice[]
  /** Severity 0–100 — used for the wax-seal accent threshold (≥70). */
  severity?: number
  /** Seed family/type shown as a small tag in the corner. */
  tag?: string
  meta?: Record<string, unknown>
}

export type CardAppliesTo = {
  seedTypes?: IssueSeedType[]
  seedFamilies?: IssueSeedFamilyId[]
  timings?: IssueSeedTiming[]
  requiredTags?: string[]
  minSeverity?: number
  minCardWorthiness?: number
  custom?: (seed: IssueSeed, state: TavernState) => boolean
}

export type CardDefinition = {
  id: string
  appliesTo: CardAppliesTo
  priority?: number
  toneHints?: string[]
  render: (seed: IssueSeed, state: TavernState) => CardView
}
