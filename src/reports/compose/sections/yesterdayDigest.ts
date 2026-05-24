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

const SECONDARY_BUDGET = 2
const COIN_VERB_BUDGET = 1

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

function reputationTag(delta: number): string {
  if (delta > 0) return 'reputation_gain'
  if (delta < 0) return 'reputation_loss'
  return 'reputation_hold'
}

function pressureRiseTag(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 3) return 'pressure_rise_small'
  if (abs > 8) return 'pressure_rise_large'
  return 'pressure_rise_mid'
}

function coinTag(delta: number): string {
  if (delta > 0) return 'coin_gain'
  if (delta < 0) return 'coin_loss'
  return 'coin_flat'
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
    domain: [reputationTag(input.delta)],
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
    domain: [pressureRiseTag(input.delta)],
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
    domain: [coinTag(input.delta)],
  })
  const filled = assembleSlots(yesterdayDigestCoinSlots, seed, input.state)
  return filled['verb'] ?? 'shifted'
}
