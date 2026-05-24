// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
//
// Section composer for the Missed Opportunities `readable` + `secondary`
// lines on the `pressure_remedy` kind. Replaces the inline
// `composePressureReadable` + parameter-substituted secondary string at
// `src/reports/missedOpportunityProjection.ts:132-148`.
//
// Connector-only voicing: the action label and pressure label stay as
// structured sim labels (resolved by `resolveEntityLabel` and
// `pressure.label`). Only the connecting verb is composed — the
// snippet pool returns `"would have eased"`, `"would have softened"`,
// etc.; the projection composes the final string as
// `${actionPhrase} ${connector} ${pressureLabel}.`
//
// Action category is routed via `seed.domain` (one of
// `clean_action` / `repair_action` / `patch_action` / `fumigate_action`
// / `restock_action` / `bonus_action` / `price_action` /
// `generic_action`); trend magnitude is routed similarly
// (`trend_small` / `trend_mid` / `trend_large`).
//
// The other two missed-opportunity kinds (`diff_counterfactual` and
// `ignored_seed`) keep their legacy hand-rolled prose for this commit
// and migrate in a follow-up.

import type { ReportSection } from '../../../cards/compose/reports'
import { buildReportSeed } from '../../../cards/compose/reports'
import { assembleSlots } from '../../../cards/compose/assemble'
import type { SlotSpec } from '../../../cards/compose/types'
import type { TavernState } from '../../../sim/state/TavernState'
import {
  missedOpportunityConnectorPool,
  missedOpportunitySecondaryVerbPool,
} from '../pools/missedOpportunity'

const READABLE_BUDGET = 4
const SECONDARY_BUDGET = 2

/** Slot list for the pressure-remedy readable line. One slot — the
 *  connector verb phrase. Routed by action category. */
export const missedOpportunityReadableSlots: readonly SlotSpec[] = [
  {
    id: 'connector',
    role: 'aside',
    pool: missedOpportunityConnectorPool,
    optional: false,
    wordBudget: READABLE_BUDGET,
    claimMode: 'flavor',
  },
]

/** Slot list for the secondary line. One slot — the trend verb.
 *  Routed by delta magnitude. */
export const missedOpportunitySecondarySlots: readonly SlotSpec[] = [
  {
    id: 'verb',
    role: 'aside',
    pool: missedOpportunitySecondaryVerbPool,
    optional: false,
    wordBudget: SECONDARY_BUDGET,
    claimMode: 'flavor',
  },
]

export const missedOpportunityReadableSection: ReportSection = {
  id: 'daily.missed_opportunity.readable',
  voiceRegister: 'office_quarters',
  slots: missedOpportunityReadableSlots,
}

export const missedOpportunitySecondarySection: ReportSection = {
  id: 'daily.missed_opportunity.secondary',
  voiceRegister: 'office_quarters',
  slots: missedOpportunitySecondarySlots,
}

/** Maps an owner-action id to the snippet-routing tag used in
 *  `seed.domain` for the connector pool. */
export function actionCategoryTag(actionId: string): string {
  switch (actionId) {
    case 'clean_area':
      return 'clean_action'
    case 'repair_area':
      return 'repair_action'
    case 'patch_roof':
      return 'patch_action'
    case 'fumigate_cellar':
      return 'fumigate_action'
    case 'restock_item':
      return 'restock_action'
    case 'pay_staff_bonus':
      return 'bonus_action'
    case 'adjust_prices':
      return 'price_action'
    default:
      return 'generic_action'
  }
}

/** Maps absolute delta magnitude to a trend tag for the secondary verb
 *  pool. */
export function trendMagnitudeTag(delta: number): string {
  const abs = Math.abs(delta)
  if (abs <= 3) return 'trend_small'
  if (abs > 8) return 'trend_large'
  return 'trend_mid'
}

export type PressureRemedyReadableInput = {
  state: TavernState
  closedDay: number
  actionId: string
  actionLabel: string
  targetLabel: string | undefined
  pressureLabel: string
  pressureDelta: number
}

/** Composes the voiced `readable` line for a pressure_remedy missed
 *  opportunity. Structure: `${actionPhrase} ${connector} ${pressureLabel}.`
 *  The action phrase is built by `buildActionPhrase`; the connector is
 *  picked from `missedOpportunityConnectorPool` per action category. */
export function composePressureReadableVoiced(
  input: PressureRemedyReadableInput,
): string {
  const seed = buildReportSeed({
    sectionId: 'daily.missed_opportunity.pressure_remedy',
    periodKey: `d${input.closedDay}.${input.actionId}.${input.targetLabel ?? '_'}`,
    timing: 'closing',
    domain: [actionCategoryTag(input.actionId)],
  })
  const filled = assembleSlots(missedOpportunityReadableSlots, seed, input.state)
  const connector = filled['connector'] ?? 'would have eased'
  const actionPhrase = buildActionPhrase(input.actionId, input.actionLabel, input.targetLabel)
  return `${actionPhrase} ${connector} ${input.pressureLabel.toLowerCase()}.`
}

export type PressureRemedySecondaryInput = {
  state: TavernState
  closedDay: number
  actionId: string
  targetId: string | undefined
  pressureLabel: string
  pressureDelta: number
  pressureValue: number
}

/** Composes the voiced `secondary` line. Structure:
 *  `${pressureLabel} ${verb} ${signed(delta)} to ${value}.` */
export function composePressureSecondaryVoiced(
  input: PressureRemedySecondaryInput,
): string {
  const seed = buildReportSeed({
    sectionId: 'daily.missed_opportunity.secondary',
    periodKey: `d${input.closedDay}.${input.actionId}.${input.targetId ?? '_'}`,
    timing: 'closing',
    domain: [trendMagnitudeTag(input.pressureDelta)],
  })
  const filled = assembleSlots(missedOpportunitySecondarySlots, seed, input.state)
  const verb = filled['verb'] ?? 'rose'
  const signed = input.pressureDelta >= 0 ? `+${input.pressureDelta}` : `${input.pressureDelta}`
  return `${input.pressureLabel} ${verb} ${signed} to ${input.pressureValue}.`
}

/** Builds the action phrase for the readable line. Mirrors the legacy
 *  switch in `composePressureReadable` but emits only the
 *  action-and-target half (no pressure suffix, no connector). */
export function buildActionPhrase(
  actionId: string,
  actionLabel: string,
  targetLabel: string | undefined,
): string {
  switch (actionId) {
    case 'clean_area':
      return targetLabel ? `Cleaning ${targetLabel}` : 'Cleaning an area'
    case 'repair_area':
      return targetLabel ? `Repairing ${targetLabel}` : 'A repair'
    case 'patch_roof':
      return 'Patching the roof'
    case 'fumigate_cellar':
      return 'Fumigating the cellar'
    case 'pay_staff_bonus':
      return targetLabel ? `A bonus for ${targetLabel}` : 'A staff bonus'
    case 'restock_item':
      return targetLabel ? `Restocking ${targetLabel}` : 'A restock'
    case 'buy_mugs':
      return 'Buying mugs'
    case 'adjust_prices':
      return 'Adjusting prices'
    default:
      return actionLabel
  }
}
