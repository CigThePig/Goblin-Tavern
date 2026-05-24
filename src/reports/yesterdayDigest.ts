// Phase 96 — Yesterday digest projection.
//
// A small, tap-to-expand summary the player sees on Beat 1 (morning),
// composed entirely from the existing `DailyReportData` view-model. No
// new sim primitives — this surface exists so a returning player can
// see what closed yesterday without first navigating to Reports →
// Today (per game-loop §2.3).
//
// Composition rules:
//   - Always include a coin line if there was any movement (delta != 0)
//     OR if the closed day produced any meaningful activity. A flat
//     zero-coin day still shows "coin 100 (·)" so the player isn't
//     left without a number.
//   - Pick exactly ONE secondary line: the larger-magnitude mover
//     between top reputation delta and top rising pressure. Reputation
//     wins ties because rep movement is more interpretable for a new
//     player than a numeric pressure value.
//   - Return undefined only when there is NOTHING to say: no coin
//     movement AND no reputation deltas AND no rising pressures AND
//     the report is marked quiet. The morning beat then falls back to
//     its existing `composeEmpty('morning', …)` line.

import type { DailyReportData } from './types'
import { createInitialTavernState } from '../sim/state/defaults'
import {
  pickYesterdayPressureVerb,
  pickYesterdayReputationVerb,
} from './compose/sections'

// Yesterday-digest snippet conditions read only seed.domain (hasTag)
// and never state, so the runtime state parameter is effectively
// unused for the FNV pick. Pre-build a frozen singleton so we don't
// re-construct on every projection.
const DIGEST_STATE = createInitialTavernState()

export type YesterdayDigestDirection = 'gain' | 'loss' | 'neutral'

export type YesterdayDigestCoin = {
  before: number
  after: number
  delta: number
  direction: YesterdayDigestDirection
  /** ≤ 12 words. */
  readable: string
}

export type YesterdayDigestSecondary =
  | {
      kind: 'reputation'
      axis: string
      label: string
      delta: number
      direction: YesterdayDigestDirection
      /** ≤ 12 words. */
      readable: string
    }
  | {
      kind: 'pressure'
      id: string
      label: string
      value: number
      delta: number
      direction: YesterdayDigestDirection
      /** ≤ 12 words. */
      readable: string
    }

export type YesterdayDigestData = {
  /** The just-closed day's ordinal. */
  closedDayOrdinal: number
  /** Compact day label, e.g. "Day 14 · Market Day". */
  dayLabel: string
  coin: YesterdayDigestCoin
  secondary?: YesterdayDigestSecondary
}

const MAX_WORDS = 12

function clampWords(s: string, max: number = MAX_WORDS): string {
  const words = s.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ') + '…'
}

function direction(delta: number): YesterdayDigestDirection {
  if (delta > 0) return 'gain'
  if (delta < 0) return 'loss'
  return 'neutral'
}

function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '·'
}

function shortDayLabel(longLabel: string): string {
  // The full label looks like "Day 14 · Week 2 · Month 1 · Market Day".
  // For the digest, we drop the Week/Month coordinates — calendar day
  // + day-type is the orienting pair the player needs at-a-glance.
  const parts = longLabel.split('·').map((s) => s.trim())
  if (parts.length === 0) return longLabel
  const dayPart = parts[0]
  const typePart = parts[parts.length - 1]
  if (parts.length >= 2 && dayPart !== typePart) {
    return `${dayPart} · ${typePart}`
  }
  return dayPart ?? longLabel
}

/**
 * Build the digest from a freshly-projected DailyReportData. Returns
 * `undefined` only when there is literally nothing to surface.
 */
export function projectYesterdayDigest(
  report: DailyReportData,
): YesterdayDigestData | undefined {
  const hasReputation = report.reputationDeltas.length > 0
  const hasPressure = report.risingPressures.length > 0
  const hasCoinMovement = report.coinDelta !== 0
  const reportEmpty =
    report.isQuiet && !hasReputation && !hasPressure && !hasCoinMovement
  if (reportEmpty) return undefined

  const coin: YesterdayDigestCoin = {
    before: report.coinBefore,
    after: report.coinAfter,
    delta: report.coinDelta,
    direction: direction(report.coinDelta),
    readable: clampWords(
      `Coin ${report.coinBefore} → ${report.coinAfter} (${signed(report.coinDelta)})`,
    ),
  }

  const secondary = pickSecondary(report)

  return {
    closedDayOrdinal: report.header.closedDayOrdinal,
    dayLabel: shortDayLabel(report.header.dayLabel),
    coin,
    ...(secondary ? { secondary } : {}),
  }
}

function pickSecondary(
  report: DailyReportData,
): YesterdayDigestSecondary | undefined {
  const closedDayOrdinal = report.header.closedDayOrdinal
  // Reputation deltas are already sorted by magnitude descending in
  // `projectReputationDeltas`. Take the first.
  const topRep = report.reputationDeltas[0]
  // Rising pressures are already filtered to delta > 0 and ordered by
  // severity*delta in `projectRisingPressures`.
  const topPressure = report.risingPressures[0]

  if (!topRep && !topPressure) return undefined

  if (topRep && !topPressure) return repSecondary(topRep, closedDayOrdinal)
  if (!topRep && topPressure) return pressureSecondary(topPressure, closedDayOrdinal)

  // Both present. Reputation magnitude vs. pressure value+delta. We
  // compare raw movement: rep delta absolute vs. pressure delta. On
  // tie or when rep is larger, reputation wins (more interpretable).
  const repMag = Math.abs(topRep!.delta)
  const presMag = topPressure!.delta
  if (repMag >= presMag) return repSecondary(topRep!, closedDayOrdinal)
  return pressureSecondary(topPressure!, closedDayOrdinal)
}

function repSecondary(
  delta: DailyReportData['reputationDeltas'][number],
  closedDayOrdinal: number,
): YesterdayDigestSecondary {
  const dir = direction(delta.delta)
  const verb = pickYesterdayReputationVerb({
    state: DIGEST_STATE,
    closedDayOrdinal,
    axis: delta.axis,
    delta: delta.delta,
  })
  return {
    kind: 'reputation',
    axis: delta.axis,
    label: delta.label,
    delta: delta.delta,
    direction: dir,
    readable: clampWords(
      `${delta.label} ${verb} ${signed(delta.delta)}`,
    ),
  }
}

function pressureSecondary(
  line: DailyReportData['risingPressures'][number],
  closedDayOrdinal: number,
): YesterdayDigestSecondary {
  // A rising pressure is tonally a loss — the meter moved against
  // the player. Reading direction as 'loss' lets the digest reuse
  // the same icon and color treatment as a falling reputation axis.
  const verb = pickYesterdayPressureVerb({
    state: DIGEST_STATE,
    closedDayOrdinal,
    pressureId: line.id,
    delta: line.delta,
  })
  return {
    kind: 'pressure',
    id: line.id,
    label: line.label,
    value: line.value,
    delta: line.delta,
    direction: 'loss',
    readable: clampWords(
      `${line.label} ${verb} ${signed(line.delta)} (now ${line.value})`,
    ),
  }
}
