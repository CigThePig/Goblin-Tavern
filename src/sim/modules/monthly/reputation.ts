import { clampPercent } from '../../state/normalize'
import type { TavernState } from '../../state/TavernState'
import type { WeeklySignalTotals } from '../weekly/types'

import type {
  MonthlyAccumulator,
  ReputationAxisId,
  ReputationAxisShift,
  ReputationTier,
} from './types'

// Phase 15 §15.5 / §15.6 — Reputation shifts and tier bands.
//
// Monthly reputation shifts compose two ingredients:
//   1. Aggregated weekly signals — `signals.cheap`, `.filthy`, `.tasty`,
//      `.dangerous`, `.reliable` — accumulated across all weeks of the
//      month. The signal axes map onto a subset of the reputation axes.
//   2. End-of-month state checks for the axes that are not driven by
//      weekly signals (cozy, goblinAuthentic, respectable, strange).
//
// The deltas are intentionally modest (clamped per axis to ±12 per
// month) so chronic patterns compound across months rather than
// detonating in one tick. Phase 15 §"Do Not Do" — reputation must remain
// multi-axis, not a single good/bad score.

const PER_AXIS_MONTHLY_LIMIT = 12

// §15.6 — Tier band thresholds (inclusive lower bounds).
//
//   0–19   absent
//   20–39  faint
//   40–59  known
//   60–79  strong
//   80–100 defining
export function getReputationTier(value: number): ReputationTier {
  if (value < 20) return 'absent'
  if (value < 40) return 'faint'
  if (value < 60) return 'known'
  if (value < 80) return 'strong'
  return 'defining'
}

function clampDelta(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(-PER_AXIS_MONTHLY_LIMIT, Math.min(PER_AXIS_MONTHLY_LIMIT, value))
}

function signalContribution(
  signals: WeeklySignalTotals,
): Partial<Record<ReputationAxisId, number>> {
  // Signal totals are weekly *integer* deltas summed across the month.
  // Convert them into a reputation-axis nudge. The factor < 1 keeps the
  // shift modest; a quiet 4-week month with steady filthy signals lands
  // around the +6 / +8 mark, never enough to flip a band in one month.
  return {
    cheap: signals.cheap * 0.5,
    filthy: signals.filthy * 0.5,
    dangerous: signals.dangerous * 0.5,
    tasty: signals.tasty * 0.6,
    reliable: signals.reliable * 0.6,
  }
}

type ShiftWorkbook = Partial<
  Record<ReputationAxisId, { delta: number; reasons: string[] }>
>

function bump(
  workbook: ShiftWorkbook,
  axis: ReputationAxisId,
  delta: number,
  reason: string,
): void {
  if (delta === 0) return
  const entry = workbook[axis] ?? { delta: 0, reasons: [] }
  entry.delta += delta
  entry.reasons.push(reason)
  workbook[axis] = entry
}

function ingestSignalContribution(
  workbook: ShiftWorkbook,
  signals: WeeklySignalTotals,
): void {
  const partial = signalContribution(signals)
  if ((partial.cheap ?? 0) !== 0) {
    bump(workbook, 'cheap', partial.cheap!, `weekly cheap signal ${signals.cheap}`)
  }
  if ((partial.filthy ?? 0) !== 0) {
    bump(workbook, 'filthy', partial.filthy!, `weekly filthy signal ${signals.filthy}`)
  }
  if ((partial.dangerous ?? 0) !== 0) {
    bump(
      workbook,
      'dangerous',
      partial.dangerous!,
      `weekly dangerous signal ${signals.dangerous}`,
    )
  }
  if ((partial.tasty ?? 0) !== 0) {
    bump(workbook, 'tasty', partial.tasty!, `weekly tasty signal ${signals.tasty}`)
  }
  if ((partial.reliable ?? 0) !== 0) {
    bump(
      workbook,
      'reliable',
      partial.reliable!,
      `weekly reliable signal ${signals.reliable}`,
    )
  }
}

function ingestStateChecks(
  workbook: ShiftWorkbook,
  state: TavernState,
  accumulator: MonthlyAccumulator,
): void {
  // ----- cozy -----
  // Cozy rises when the room is calm and reasonably warm: low danger
  // signal, low damage, low main-room mess.
  const mainRoom = state.areas['main_room']
  if (mainRoom) {
    if (accumulator.signals.dangerous <= 4 && mainRoom.damage <= 30) {
      bump(workbook, 'cozy', 3, 'Main room stayed calm and serviceable.')
    }
    if (mainRoom.mess >= 70) {
      bump(workbook, 'cozy', -2, 'Main room mess piled up.')
    }
  }

  // ----- respectable -----
  // Respectable depends on merchant satisfaction and overall cleanliness.
  const merchants = state.customerGroups['merchants']
  if (merchants) {
    if (merchants.satisfaction >= 60 && (mainRoom?.cleanliness ?? 0) >= 50) {
      bump(
        workbook,
        'respectable',
        3,
        `Merchants stayed pleased (${merchants.satisfaction}).`,
      )
    }
    if (merchants.satisfaction < 30) {
      bump(
        workbook,
        'respectable',
        -3,
        `Merchants were repeatedly unhappy (${merchants.satisfaction}).`,
      )
    }
  }
  if (accumulator.signals.filthy >= 8) {
    bump(workbook, 'respectable', -2, 'Filth signals worked against respectability.')
  }

  // ----- goblinAuthentic -----
  // Strong if local goblins are loyal and the place stays rough and cheap.
  const locals = state.customerGroups['local_goblins']
  if (locals) {
    if (locals.loyalty >= 60 && accumulator.signals.cheap >= 4) {
      bump(
        workbook,
        'goblinAuthentic',
        3,
        'Local goblins stayed loyal; cheap stayed cheap.',
      )
    }
    if (locals.loyalty < 30) {
      bump(workbook, 'goblinAuthentic', -2, 'Local goblins drifted away.')
    }
  }
  if (state.reputation.respectable >= 70) {
    bump(workbook, 'goblinAuthentic', -1, 'Too respectable for the rough crowd.')
  }

  // ----- strange -----
  // Weird stock or quirky inventory: a "watered_down" ale tag, an
  // unusual stew quality drift, or any stock carrying a `weird` tag.
  let strangeBumps = 0
  for (const item of Object.values(state.stock)) {
    if (item.tags.includes('watered_down')) strangeBumps += 1
    if (item.tags.includes('weird')) strangeBumps += 1
  }
  if (strangeBumps > 0) {
    bump(workbook, 'strange', strangeBumps, 'Stock acquired unusual flags.')
  }
}

const ALL_AXES: ReadonlyArray<ReputationAxisId> = [
  'cheap',
  'tasty',
  'filthy',
  'dangerous',
  'cozy',
  'reliable',
  'goblinAuthentic',
  'respectable',
  'strange',
]

export function computeReputationShifts(
  state: TavernState,
  accumulator: MonthlyAccumulator,
): ReputationAxisShift[] {
  const workbook: ShiftWorkbook = {}
  ingestSignalContribution(workbook, accumulator.signals)
  ingestStateChecks(workbook, state, accumulator)

  const shifts: ReputationAxisShift[] = []
  for (const axisId of ALL_AXES) {
    const entry = workbook[axisId] ?? { delta: 0, reasons: [] }
    const rawDelta = clampDelta(Math.round(entry.delta))
    const before = state.reputation[axisId]
    const after = clampPercent(before + rawDelta)
    if (rawDelta === 0 && before === after) {
      shifts.push({
        axisId,
        before,
        after,
        delta: 0,
        tierBefore: getReputationTier(before),
        tierAfter: getReputationTier(after),
        reasons: entry.reasons,
      })
      continue
    }
    shifts.push({
      axisId,
      before,
      after,
      delta: after - before,
      tierBefore: getReputationTier(before),
      tierAfter: getReputationTier(after),
      reasons: entry.reasons,
    })
  }
  return shifts
}
