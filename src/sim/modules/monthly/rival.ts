import { clampPercent } from '../../state/normalize'
import type { TavernState } from '../../state/TavernState'
import { competitionSummary, competitorStandings } from '../rival/appeal'
import { getPrimaryRival } from '../rival/rivalState'

import type { RivalTavernResolution, RivalTavernState } from './types'

// Phase 15 §15.8 — Rival tavern pressure placeholder.
//
// A minimal opponent. Pressure rises when groups the rival serves well
// are unhappy here; pressure falls when local identity is strong. No
// rival content, no events, no cards — Phase 15 keeps this report-only.
//
// Expansion Phase 9 §9.1 — this is now a PROJECTION, not the model.
//
// The three numbers stayed where they were, because plenty of code reads
// them (the monthly report, the monthly review card, the pre-Phase-9
// competitor fallback), but they no longer decide anything: once the world
// has a rival record, `appeal` is the mean of what the customer groups
// actually think of the other house, `strategy` is the position it actually
// chose, and `pressure` follows the head-to-head. The Phase 15 heuristic
// below is kept as the fallback for a state with no rival slice — a fixture
// built by hand, or an old save between load and the module's first pass.

const PRESSURE_MERCHANTS_UNHAPPY = 6
const PRESSURE_RESPECTABLE_LOW = 4
const PRESSURE_RELIABLE_LOW = 4
const PRESSURE_LOCAL_LOYAL = -5
const PRESSURE_PRICES_COMPETITIVE = -3
const PRESSURE_STRONG_IDENTITY = -3

const APPEAL_MERCHANTS_UNHAPPY = 4
const APPEAL_RESPECTABLE_LOW = 3
const APPEAL_LOCAL_LOYAL = -3
const APPEAL_CHEAP_HIGH = -2

export function resolveRivalTavern(
  state: TavernState,
  rival: RivalTavernState,
): { next: RivalTavernState; resolution: RivalTavernResolution } {
  const projected = projectFromRivalRecord(state, rival)
  if (projected) return projected

  let pressureDelta = 0
  let appealDelta = 0
  const notes: string[] = []

  const merchants = state.customerGroups['merchants']
  if (merchants && merchants.satisfaction < 40) {
    pressureDelta += PRESSURE_MERCHANTS_UNHAPPY
    appealDelta += APPEAL_MERCHANTS_UNHAPPY
    notes.push(`Merchants underserved (satisfaction ${merchants.satisfaction}).`)
  }

  if (state.reputation.respectable < 30) {
    pressureDelta += PRESSURE_RESPECTABLE_LOW
    appealDelta += APPEAL_RESPECTABLE_LOW
    notes.push('Low respectability gives the rival room to operate.')
  }
  if (state.reputation.reliable < 30) {
    pressureDelta += PRESSURE_RELIABLE_LOW
    notes.push('Reliability slipped; rivals look steadier.')
  }

  const locals = state.customerGroups['local_goblins']
  if (locals && locals.loyalty >= 60) {
    pressureDelta += PRESSURE_LOCAL_LOYAL
    appealDelta += APPEAL_LOCAL_LOYAL
    notes.push('Local goblins remained loyal.')
  }

  // Cheap reputation tends to win price-sensitive groups outright.
  if (state.reputation.cheap >= 60) {
    pressureDelta += PRESSURE_PRICES_COMPETITIVE
    appealDelta += APPEAL_CHEAP_HIGH
    notes.push('Competitive prices kept patrons at home.')
  }

  if (state.reputation.goblinAuthentic >= 60) {
    pressureDelta += PRESSURE_STRONG_IDENTITY
    notes.push('Strong goblin identity is hard for a rival to copy.')
  }

  const nextPressure = clampPercent(rival.pressure + pressureDelta)
  const nextAppeal = clampPercent(rival.appeal + appealDelta)

  return {
    next: {
      pressure: nextPressure,
      appeal: nextAppeal,
      strategy: rival.strategy,
    },
    resolution: {
      pressureBefore: rival.pressure,
      pressureAfter: nextPressure,
      appealBefore: rival.appeal,
      appealAfter: nextAppeal,
      notes,
    },
  }
}

/**
 * The monthly numbers, read off the live competition.
 *
 * `appeal` is the mean of `rivalAppealForGroup` across the groups, so it
 * means what it always claimed to: how appealing the other house is. The
 * pressure delta follows the head-to-head rather than six thresholds on the
 * house's own state, which is the §9.1 requirement that rival pressure
 * "remains a summary of this competition" honoured literally.
 */
function projectFromRivalRecord(
  state: TavernState,
  rival: RivalTavernState,
): { next: RivalTavernState; resolution: RivalTavernResolution } | undefined {
  const record = getPrimaryRival(state)
  const summary = competitionSummary(state)
  if (!record || !summary) return undefined
  const standings = competitorStandings(state)
  if (standings.length === 0) return undefined

  const appeal = clampPercent(
    Math.round(
      standings.reduce((sum, standing) => sum + standing.rivalAppeal, 0) /
        standings.length,
    ),
  )
  // A month of being ahead builds; a month of being behind gives ground.
  const pressureDelta = Math.round(summary.meanAdvantage * 100 * 0.5)
  const nextPressure = clampPercent(
    rival.pressure + (summary.underTruce ? Math.min(0, pressureDelta) - 4 : pressureDelta),
  )

  const notes: string[] = [
    record.position === 'unknown'
      ? `${record.name} has not settled on what kind of house to be.`
      : `${record.name} is running a ${record.position} house.`,
  ]
  for (const standing of standings.slice(0, 3)) notes.push(standing.readable)
  if (summary.courtedGroupIds.length > 0) {
    notes.push(`They are working ${summary.courtedGroupIds.length} crowd(s).`)
  }
  if (record.backingFactionIds.length > 0) {
    notes.push(`${record.backingFactionIds.length} faction(s) are backing them.`)
  }
  if (summary.liveSetbackCount > 0) {
    notes.push(`They have ${summary.liveSetbackCount} trouble(s) of their own.`)
  }
  if (summary.underTruce) notes.push('There is an arrangement with them.')

  return {
    next: {
      pressure: nextPressure,
      appeal,
      strategy: record.position,
    },
    resolution: {
      pressureBefore: rival.pressure,
      pressureAfter: nextPressure,
      appealBefore: rival.appeal,
      appealAfter: appeal,
      notes,
    },
  }
}
