// Expansion Phase 5 (repo phase 212) / ISSUE-175 — every financial state is
// serializable through the production save/load boundary.

import { describe, expect, it } from 'vitest'

import {
  SAVE_VERSION,
  loadSession,
  saveSession,
  setStorageForTesting,
  type PersistedSession,
  type StorageLike,
} from '../../web/src/lib/sim/persistence'
import type { Beat, DaySegment } from '../../web/src/lib/sim/daySession'
import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import {
  getEconomyModuleState,
  type FinancialStatus,
} from '../../src/sim/modules/economy/index'

class MemoryStorage implements StorageLike {
  private readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

const STATUSES: ReadonlyArray<FinancialStatus> = [
  'stable',
  'cash_stress',
  'insolvent',
  'restructuring',
  'temporarily_closed',
  'recovering',
]

function sessionAt(
  state: TavernState,
  beat: Beat = 'morning',
  segment: DaySegment = 'A',
): PersistedSession {
  return {
    saveVersion: SAVE_VERSION,
    savedAt: '2026-07-31T00:00:00.000Z',
    simSeed: 'phase212/economy-persistence',
    state,
    picks: [],
    staffPriorities: {},
    pendingBySeedId: {},
    daySession: {
      beat,
      segment,
      serviceComplete: segment !== 'A',
      closingComplete: segment === 'C',
    },
    route: 'day',
  }
}

function roundTrip(state: TavernState): TavernState {
  setStorageForTesting(new MemoryStorage())
  try {
    const saved = saveSession(sessionAt(state))
    expect(saved.ok, saved.ok ? '' : saved.reason).toBe(true)
    const loaded = loadSession()
    expect(loaded.kind).toBe('loaded')
    if (loaded.kind !== 'loaded') throw new Error('load failed')
    return loaded.save.state
  } finally {
    setStorageForTesting(undefined)
  }
}

describe('Phase 212 §5.3/§5.10 — financial state persistence', () => {
  it.each(STATUSES)('round-trips %s without changing its economy state', (status) => {
    const state = createInitialTavernState()
    const economy = getEconomyModuleState(state)
    state.modules['economy'] = {
      ...economy,
      openingCoin: 17,
      openingFinancialStatus: status,
      serviceHealth: 31,
      collapseStreak: 8,
      recoveryStreak: 2,
      reserveStreak: 3,
      financial: {
        ...economy.financial,
        status,
        statusSinceDay: 11,
        cashStressDays: 4,
        insolvencyDays: 2,
        healthyDays: 1,
        operatingArrears: 47,
        restructuringBalance: 65,
        lastTransitionReason: `test ${status}`,
      },
    }

    const loaded = roundTrip(state)
    expect(getEconomyModuleState(loaded)).toEqual(
      getEconomyModuleState(state),
    )
    expect(getEconomyModuleState(loaded).financial.status).toBe(status)
    expect(safeValidateState(loaded, { modules: FULL_PIPELINE }).success).toBe(
      true,
    )
  })
})
