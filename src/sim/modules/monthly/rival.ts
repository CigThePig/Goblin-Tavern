import { clampPercent } from '../../state/normalize'
import type { TavernState } from '../../state/TavernState'

import type { RivalTavernResolution, RivalTavernState } from './types'

// Phase 15 §15.8 — Rival tavern pressure placeholder.
//
// A minimal opponent. Pressure rises when groups the rival serves well
// are unhappy here; pressure falls when local identity is strong. No
// rival content, no events, no cards — Phase 15 keeps this report-only.

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
