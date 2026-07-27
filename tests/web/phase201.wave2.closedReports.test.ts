// Phase 201 / gameplay audit Wave 2 — closed reports are immutable.
//
//   P4-SEAM-002  yesterday's missed opportunities are rebuilt from today
//   P6-COMP-006  historical reports lose their resolved choices
//
// The audit's route: complete a day, read its report, press Next day, and
// reopen the same report — it now describes the NEW day's cards, and the
// choices the player made have vanished. Both come from the two report
// entry points handing `buildDailyReport` the live store state instead of
// the state of the day the report describes.
//
// The gate is field stability: identical immediately, after the next
// morning opens, several days later, and across a reload.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { gameStore } from '../../web/src/lib/sim/gameStore.svelte'
import {
  setStorageForTesting,
  validatePersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import { buildDailyReport } from '../../src/reports/dailyReportProjection'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import type { ResponseIntent } from '../../src/sim/modules/issues/issueSeedTypes'

const SEED = 'phase201-closed-reports'

function memoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

/** The daily report exactly as the two screens build it. */
function currentReport(): unknown {
  const result = gameStore.latestResult
  if (!result) throw new Error('no closed day')
  return JSON.parse(
    JSON.stringify(
      buildDailyReport(result, gameStore.closedDayState ?? gameStore.state, {
        ...(gameStore.previousCalendar
          ? { previousCalendar: gameStore.previousCalendar }
          : {}),
        dismissedMissedOpportunityIds: gameStore.dismissedMissedOpportunityIds,
      }),
    ),
  )
}

/** Close one day, resolving the first slot of every seed on the way. */
function playOneDay(): void {
  gameStore.beginDay()
  const def = actionRegistry.get('clean_area')
  const areaId = Object.keys(gameStore.state.areas)[0]!
  gameStore.addPick({
    actionId: def.id,
    label: def.label,
    category: def.category,
    targetType: def.targetType,
    targetId: areaId,
    timeCost: def.timeCost,
  })
  gameStore.runService()

  const intents: ResponseIntent[] = []
  for (const seed of gameStore.todaysSeeds) {
    const slot = seed.responseSlots[0]
    if (!slot) continue
    intents.push({
      id: `r-${seed.id}`,
      seedId: seed.id,
      verb: slot.allowedVerbs[0]!,
      shape: slot.shape,
      tags: [],
      intensity: 50,
      metadata: { responseSlotId: slot.id },
    })
  }
  gameStore.endDay({ responseIntents: intents })
}

function reload(): void {
  const session = gameStore.serializeForSave()
  const outcome = validatePersistedSession(JSON.parse(JSON.stringify(session)))
  if (outcome.kind !== 'loaded') {
    throw new Error(`save did not load: ${JSON.stringify(outcome)}`)
  }
  gameStore.reset('a-different-seed')
  gameStore.hydrateFromSave(outcome.save)
}

beforeEach(() => {
  setStorageForTesting(memoryStorage())
  gameStore.reset(SEED)
})

afterEach(() => {
  setStorageForTesting(undefined)
})

describe('P4-SEAM-002 / P6-COMP-006 — a closed report never changes', () => {
  it('is field-stable after the next morning opens', () => {
    playOneDay()
    const atClose = currentReport()

    // The audit's exact step: press Next day. Segment A replaces
    // seedsToday, clears resolvedToday and recalculates pressures.
    gameStore.beginDay()

    expect(currentReport()).toEqual(atClose)
  })

  it('keeps its resolved-choice ledger after the next morning opens', () => {
    playOneDay()
    const atClose = currentReport() as { resolvedIntents: unknown[] }
    expect(
      atClose.resolvedIntents.length,
      'test setup: the day resolved no choices',
    ).toBeGreaterThan(0)

    gameStore.beginDay()

    const later = currentReport() as { resolvedIntents: unknown[] }
    expect(later.resolvedIntents).toEqual(atClose.resolvedIntents)
  })

  it('keeps its missed-opportunity rows after the next morning opens', () => {
    playOneDay()
    const atClose = currentReport() as { missedOpportunities: unknown[] }
    gameStore.beginDay()
    const later = currentReport() as { missedOpportunities: unknown[] }
    expect(later.missedOpportunities).toEqual(atClose.missedOpportunities)
  })

  it('is field-stable across a reload', () => {
    playOneDay()
    const atClose = currentReport()

    reload()
    expect(currentReport()).toEqual(atClose)

    // And still after the next morning opens on the restored session.
    gameStore.beginDay()
    expect(currentReport()).toEqual(atClose)
  })

  it('stays stable through every beat of the days that follow it', () => {
    // The daily report describes the LATEST closed day, so "days later"
    // means: each closed day's report holds still across the whole of the
    // next day — morning, service and closing — and only changes when a
    // new day actually closes.
    for (let day = 0; day < 4; day++) {
      playOneDay()
      const atClose = currentReport()

      gameStore.beginDay()
      expect(currentReport(), `day ${day + 1} after next morning`).toEqual(atClose)
      gameStore.runService()
      expect(currentReport(), `day ${day + 1} after next service`).toEqual(atClose)
      gameStore.setBeat('closing')
      expect(currentReport(), `day ${day + 1} at next closing`).toEqual(atClose)

      // Closing the next day legitimately advances the report.
      gameStore.endDay({ responseIntents: [] })
      expect(currentReport()).not.toEqual(atClose)
    }
  })
})
