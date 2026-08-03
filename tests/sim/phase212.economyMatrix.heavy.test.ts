// Expansion Phase 5 (repo phase 212) / ISSUE-175 — multi-seed strategy
// evidence at the required 28-, 90-, and 180-day horizons.

import { describe, expect, it } from 'vitest'

import { runBalanceMatrix } from '../../src/sim/testing/balanceMatrix'
import { runBalanceScenario } from '../../src/sim/testing/balanceHarness'
import { getEconomyModuleState } from '../../src/sim/modules/economy/index'
import { getMonthlyModuleState } from '../../src/sim/modules/monthly/monthlyModule'
import { getTenancy } from '../../src/sim/modules/tenancy/index'
import {
  listObligations,
  outstandingAmount,
} from '../../src/sim/contracts/obligations/index'

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
    expect(monthly.rent.arrears).toBeGreaterThan(0)

    // Expansion Phase 7 re-pins two of these, and what moved is WHERE the
    // debt lives rather than whether the collapse happened.
    //
    // `operatingArrears` was the economy module's own accumulator, and while
    // it was the only place an unpaid obligation could live it was the right
    // thing to assert. Rent is now an `ObligationRecord` in the shared
    // ledger, so a tavern can owe a great deal with that counter at zero —
    // which is why the assertion moves to the ledger itself. Overdue
    // payables is the same claim made against the record that now holds it.
    const overdue = listObligations(finalState, { direction: 'payable' })
      .filter(
        (record) =>
          record.status === 'grace' ||
          record.status === 'defaulted' ||
          record.status === 'in_collections',
      )
      .reduce((sum, record) => sum + outstandingAmount(record), 0)
    expect(overdue).toBeGreaterThan(0)

    // And the tenancy itself ran its ladder to the end: a passive tavern
    // does not merely stop trading, it loses the building.
    expect(getTenancy(finalState)?.tenancyStatus).toBe('evicted')

    // The till is spent. Not exactly zero — a closed tavern still takes the
    // odd coin and the sweeps no longer drain it to the last penny — but far
    // less than a single day of operating cost.
    expect(finalState.coin).toBeLessThan(30)
  }, 300_000)
})
