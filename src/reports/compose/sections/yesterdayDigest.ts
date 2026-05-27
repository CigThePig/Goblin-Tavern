// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composer for the Yesterday Digest secondary line and the
// (optional) voiced coin verb. Replaces the inline parameter-built
// `readable` strings at `src/reports/yesterdayDigest.ts:162-191`.
//
// Connector-only voicing: the label and signed delta stay as
// structured sim figures; only the verb is composed. Composition:
// `${label} ${verb} ${signed(delta)}`.

import type { ReportSection } from '../../../cards/compose/reports'
import { buildReportSeed } from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import type { TavernState } from '../../../sim/state/TavernState'
import {
  yesterdayDigestCoinVerbPool,
  yesterdayDigestSecondaryVerbPool,
} from '../pools/yesterdayDigest'

// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15. Bumped from 2
// to 4 so verb snippets can carry MAGNITUDE_LEXICON tokens like
// "rose a notch" (small) or "surged a strong climb" (large).
const SECONDARY_BUDGET = 4
// Phase 160 — coin verb similarly grows to fit "earned a step" /
// "pulled in a surge" / "took a heavy fall". The legacy single-word
// fallback "shifted" still fits.
const COIN_VERB_BUDGET = 4

export const yesterdayDigestSecondarySlots: readonly SlotSpec[] = [
  {
    id: 'verb',
    role: 'aside',
    pool: yesterdayDigestSecondaryVerbPool,
    optional: false,
    wordBudget: SECONDARY_BUDGET,
    claimMode: 'flavor',
  },
]

export const yesterdayDigestCoinSlots: readonly SlotSpec[] = [
  {
    id: 'verb',
    role: 'aside',
    pool: yesterdayDigestCoinVerbPool,
    optional: false,
    wordBudget: COIN_VERB_BUDGET,
    claimMode: 'flavor',
  },
]

export const yesterdayDigestSecondarySection: ReportSection = {
  id: 'morning.yesterday_digest.secondary',
  voiceRegister: 'tavern_floor',
  slots: yesterdayDigestSecondarySlots,
}

export const yesterdayDigestCoinSection: ReportSection = {
  id: 'morning.yesterday_digest.coin',
  voiceRegister: 'tavern_floor',
  slots: yesterdayDigestCoinSlots,
}

export type YesterdayReputationInput = {
  state: TavernState
  closedDayOrdinal: number
  axis: string
  delta: number
}

export type YesterdayPressureInput = {
  state: TavernState
  closedDayOrdinal: number
  pressureId: string
  delta: number
}

export type YesterdayCoinInput = {
  state: TavernState
  closedDayOrdinal: number
  delta: number
}

// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15. The three tag
// helpers each return an array of routing tags. The first entry is the
// pre-Phase-160 direction-only tag (back-compat: existing snippets
// gated on `reputation_gain` / `coin_loss` / `pressure_rise_mid` keep
// firing as fallback). When a magnitude band applies, the second entry
// is the new band-bearing tag (`reputation_gain_small`,
// `coin_loss_large`, …) that lexicon-calibrated snippets gate on. The
// `checkReportLegibility` gate's tagToBand map keys on the new tags.
//
// Cutoffs are local to the report layer — they don't have to match the
// sim's `MAGNITUDE_BAND_CUTOFFS` (which classify EffectPreview amounts,
// a different domain). Tuned so a typical day's deltas spread across
// the three tiers instead of bunching at one extreme.

function reputationTags(delta: number): readonly string[] {
  if (delta === 0) return ['reputation_hold']
  const abs = Math.abs(delta)
  const direction = delta > 0 ? 'reputation_gain' : 'reputation_loss'
  const band = abs <= 3 ? 'small' : abs > 8 ? 'large' : 'mid'
  return [direction, `${direction}_${band}`]
}

function pressureRiseTags(delta: number): readonly string[] {
  const abs = Math.abs(delta)
  if (abs <= 3) return ['pressure_rise_small']
  if (abs > 8) return ['pressure_rise_large']
  return ['pressure_rise_mid']
}

function coinTags(delta: number): readonly string[] {
  if (delta === 0) return ['coin_flat']
  const abs = Math.abs(delta)
  const direction = delta > 0 ? 'coin_gain' : 'coin_loss'
  // Coin deltas can be much larger than reputation/pressure (sales can
  // be 30-200+); use cutoffs that align with the service-log binning at
  // 30 / 100 so coin verb vocabulary calibrates consistently.
  const band = abs <= 30 ? 'small' : abs > 100 ? 'large' : 'mid'
  return [direction, `${direction}_${band}`]
}

/** Picks the voiced verb for a reputation secondary line. The
 *  projection composes the full line as `${label} ${verb} ${signed}`. */
export function pickYesterdayReputationVerb(
  input: YesterdayReputationInput,
): string {
  const seed = buildReportSeed({
    sectionId: 'morning.yesterday_digest.secondary',
    periodKey: `d${input.closedDayOrdinal}.rep.${input.axis}`,
    timing: 'morning_prep',
    domain: reputationTags(input.delta),
  })
  const filled = assembleSlots(yesterdayDigestSecondarySlots, seed, input.state)
  return filled['verb'] ?? 'shifted'
}

/** Picks the voiced verb for a rising pressure secondary line. The
 *  projection composes the full line as `${label} ${verb} ${signed} (now ${value})`. */
export function pickYesterdayPressureVerb(
  input: YesterdayPressureInput,
): string {
  const seed = buildReportSeed({
    sectionId: 'morning.yesterday_digest.secondary',
    periodKey: `d${input.closedDayOrdinal}.pres.${input.pressureId}`,
    timing: 'morning_prep',
    domain: pressureRiseTags(input.delta),
  })
  const filled = assembleSlots(yesterdayDigestSecondarySlots, seed, input.state)
  return filled['verb'] ?? 'rising'
}

/** Picks the voiced verb describing coin movement direction. The
 *  projection composes the full line by prefixing the structured
 *  `Coin BEFORE → AFTER (DELTA)` figure with `(${verb}) ` when
 *  desired. */
export function pickYesterdayCoinVerb(input: YesterdayCoinInput): string {
  const seed = buildReportSeed({
    sectionId: 'morning.yesterday_digest.coin',
    periodKey: `d${input.closedDayOrdinal}.coin`,
    timing: 'morning_prep',
    domain: coinTags(input.delta),
  })
  const filled = assembleSlots(yesterdayDigestCoinSlots, seed, input.state)
  return filled['verb'] ?? 'shifted'
}
