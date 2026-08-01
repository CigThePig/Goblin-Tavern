// Expansion Phase 5 (repo phase 212) / ISSUE-175 — multi-seed strategy
// evidence at the required 28-, 90-, and 180-day horizons.

import { describe, expect, it } from 'vitest'

import { runBalanceMatrix } from '../../src/sim/testing/balanceMatrix'
import { runBalanceScenario } from '../../src/sim/testing/balanceHarness'
import { getEconomyModuleState } from '../../src/sim/modules/economy/index'
import { getMonthlyModuleState } from '../../src/sim/modules/monthly/monthlyModule'

const HORIZONS = [28, 90, 180] as const
const BOTS = [
  'auto_clean_focused',
  'auto_profit_focused',
  'auto_staff_friendly',
] as const
const SEEDS = ['phase212-economy-a', 'phase212-economy-b'] as const

describe('Phase 212 §5 required long-run strategy matrix', () => {
  it.each(HORIZONS)(
    'keeps several identities viable across two seeds at %i days',
    (days) => {
      const matrix = runBalanceMatrix({
        botIds: BOTS,
        difficulties: ['standard'],
        variants: ['full'],
        seeds: SEEDS,
        days,
      })
      expect(matrix.rows).toHaveLength(BOTS.length * SEEDS.length)
      const invalid = matrix.rows
        .filter(
          (row) => !row.validatedThroughout || row.invariantFailureCount > 0,
        )
        .map((row) => ({
          botId: row.botId,
          seed: row.seed,
          firstInvalidDay: row.firstInvalidDay,
          firstInvariantFailure: row.firstInvariantFailure,
        }))
      expect(invalid, JSON.stringify(invalid)).toEqual([])
      expect(
        new Set(matrix.rows.map((row) => row.identityKey)).size,
      ).toBeGreaterThanOrEqual(2)

      // At least two distinct strategies can finish each horizon solvent,
      // with no missed rent and meaningful trade. The extractive arm may
      // choose social collapse; it is not allowed to make every arm fail.
      const viableBots = new Set(
        matrix.rows
          .filter(
            (row) =>
              row.finalCoin > 0 &&
              row.endingRentArrears === 0 &&
              row.totalPatrons > days,
          )
          .map((row) => row.botId),
      )
      expect(viableBots.size).toBeGreaterThanOrEqual(2)
    },
    300_000,
  )

  it('turns a 180-day passive collapse into closure and real arrears', () => {
    const finalState = runBalanceScenario({
      botId: 'auto_profit_focused',
      difficulty: 'standard',
      seed: 'phase212-economy-passive-collapse',
      days: 180,
      ownerActions: 'none',
      responses: 'none',
    }).finalState
    const economy = getEconomyModuleState(finalState)
    const monthly = getMonthlyModuleState(finalState)

    expect(economy.financial.status).toBe('temporarily_closed')
    expect(economy.financial.operatingArrears).toBeGreaterThan(0)
    expect(monthly.rent.arrears).toBeGreaterThan(0)
    expect(finalState.coin).toBe(0)
  }, 300_000)
})
