// Phase 88 — Card layer types.
//
// Canonical card-layer types referenced by `docs/plans/cards-contract.md §6`.
// The card layer is a separate slice from the simulation: cards consume
// `(seed, state)` and emit `CardView`. The simulation never imports cards;
// cards may freely import from `src/sim/` but must remain pure.
//
// Web mirrors of these types (`web/src/lib/cards/types.ts`) re-export from
// this file so the contract has a single source of truth.

import type {
  IssueSeed,
  IssueSeedType,
  IssueSeedFamilyId,
  IssueSeedTiming,
  ResponseIntentVerb,
  ResponseIntentShape,
} from '../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../sim/state/TavernState'

export type StakeView = {
  readable: string
  direction: 'loss' | 'gain' | 'risk'
}

export type CardContextLine = {
  readable: string
  kind: 'why_now' | 'cause' | 'history' | 'future'
  source:
    | 'issue_seed'
    | 'seed_cause'
    | 'pressure_snapshot'
    | 'text_ingredient'
    | 'stake'
    | 'memory'
    | 'fallback'
  refId?: string
}

export type CardContextView = {
  whyNow: CardContextLine[]
  causes: CardContextLine[]
  history: CardContextLine[]
  future: CardContextLine[]
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
  /** Severity 0–100 — used by the renderer for the wax-seal accent (≥70). */
  severity?: number
  /** Seed family/type shown as a small tag in the corner. */
  tag?: string
  /** Structured sim-backed explanations of why this card exists now. */
  context?: CardContextView
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
  /**
   * Higher wins when multiple cards match the same seed. The selection
   * algorithm in `selection.ts` orders by priority desc, specificity desc,
   * then id asc for a stable tie-break.
   */
  priority?: number
  toneHints?: string[]
  render: (seed: IssueSeed, state: TavernState) => CardView
}

// Re-exports for convenience so consumers can import everything from
// one place.
export type {
  IssueSeed,
  IssueSeedType,
  IssueSeedFamilyId,
  IssueSeedTiming,
  ResponseIntentVerb,
  ResponseIntentShape,
  TavernState,
}
