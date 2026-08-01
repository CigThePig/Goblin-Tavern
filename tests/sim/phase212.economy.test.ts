// Expansion Phase 5 (repo phase 212) / ISSUE-175 — coherent economy,
// financial failure and enforceable policies.
//
// These are contract tests for the phase's player-visible rules. Behavioral
// cases drive the full pipeline and use registered owner actions for recovery;
// one pure modifier case pins the recovery clock itself. No test writes a
// finished financial status or policy-compliance result into state.

import { describe, expect, it } from 'vitest'

import { FULL_PIPELINE } from '../../src/sim/canonicalPipeline'
import { simulateDay } from '../../src/sim/core/engine'
import type { SimContext } from '../../src/sim/core/context'
import type { SimulationModule } from '../../src/sim/core/module'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { ensureModuleSlices } from '../../src/sim/state/migrations'
import type { TavernState } from '../../src/sim/state/TavernState'
import { safeValidateState } from '../../src/sim/state/validation'
import {
  advanceEconomyModifiers,
  accountingFromEntries,
  getCompetitorChoiceFactorForGroup,
  getDemandFactorForGroup,
  getEconomyModuleState,
  getPolicyEffectStrength,
  getServicePriceMultiplier,
} from '../../src/sim/modules/economy/index'
import { getStockModuleState } from '../../src/sim/modules/stock/state'
import { stockModule } from '../../src/sim/modules/stock/index'
import { getServiceModuleState } from '../../src/sim/modules/service/index'
import { sellRecipe } from '../../src/sim/modules/service/recipes'
import { getOwnerActionsModuleState } from '../../src/sim/modules/ownerActions/index'
import { getWeeklyModuleState } from '../../src/sim/modules/weekly/state'
import { getMonthlyModuleState } from '../../src/sim/modules/monthly/monthlyModule'
import { DIFFICULTY_PRESETS } from '../../src/sim/state/difficulty'
import {
  withCoin,
  withCustomerGroup,
  withStaff,
  withStock,
} from '../../src/sim/testing/stateFactories'

const SEED = 'phase212/economy'

function stocked(state: TavernState): TavernState {
  let next = state
  for (const id of ['ale', 'stew', 'ingredients', 'mushrooms', 'firewood', 'mugs']) {
    next = withStock(next, id, { quantity: 5000, spoilage: 0 })
  }
  return next
}

function withSatisfaction(state: TavernState, satisfaction: number): TavernState {
  let next = state
  for (const id of Object.keys(state.customerGroups)) {
    if ((state.customerGroups[id]?.patronage ?? 0) <= 0) continue
    next = withCustomerGroup(next, id, { satisfaction })
  }
  return next
}

function runDays(state: TavernState, days: number, seed = SEED): TavernState {
  let current = state
  for (let day = 0; day < days; day += 1) {
    current = simulateDay(
      current,
      { seed: `${seed}-${day}` },
      FULL_PIPELINE,
    ).state
  }
  return current
}

function emptyCellar(state: TavernState): TavernState {
  let next = state
  for (const id of Object.keys(state.stock)) {
    next = withStock(next, id, { quantity: 0 })
  }
  return next
}

function withCalendarTag(state: TavernState, tag: string): TavernState {
  if ((state.calendar.tags as readonly string[]).includes(tag)) return state
  return {
    ...state,
    calendar: {
      ...state.calendar,
      tags: [...state.calendar.tags, tag] as typeof state.calendar.tags,
    },
  }
}

function withRivalAppeal(state: TavernState, appeal: number): TavernState {
  const monthly = getMonthlyModuleState(state)
  return {
    ...state,
    modules: {
      ...state.modules,
      monthly: {
        ...monthly,
        rivalTavern: { ...monthly.rivalTavern, appeal },
      },
    },
  }
}

describe('Phase 212 §5.1/§5.4 — persistent quality collapse reaches cash', () => {
  it('sustained zero satisfaction materially reduces later demand and sales', () => {
    const base = stocked(createInitialTavernState())
    const healthy = runDays(withSatisfaction(base, 85), 14, `${SEED}/healthy`)
    const collapsed = runDays(withSatisfaction(base, 0), 14, `${SEED}/collapsed`)

    const healthyEconomy = getEconomyModuleState(healthy)
    const collapsedEconomy = getEconomyModuleState(collapsed)
    expect(collapsedEconomy.serviceHealth).toBeLessThan(healthyEconomy.serviceHealth)
    expect(getDemandFactorForGroup(collapsed, 'merchants')).toBeLessThan(0.75)
    expect(getDemandFactorForGroup(collapsed, 'merchants')).toBeLessThan(
      getDemandFactorForGroup(healthy, 'merchants'),
    )
    expect(collapsedEconomy.modifiers.spendFactor).toBeLessThan(
      healthyEconomy.modifiers.spendFactor,
    )
    expect(collapsedEconomy.lastDailyRecord!.accounting.sales).toBeLessThan(
      healthyEconomy.lastDailyRecord!.accounting.sales,
    )
  })

  it('one bad day changes the trajectory without causing a death spiral', () => {
    const after = simulateDay(
      withSatisfaction(stocked(createInitialTavernState()), 0),
      { seed: `${SEED}/one-bad-day` },
      FULL_PIPELINE,
    ).state
    const economy = getEconomyModuleState(after)
    expect(economy.financial.status).toBe('stable')
    expect(economy.modifiers.demandFactor).toBeGreaterThanOrEqual(0.9)
    expect(economy.financial.operatingArrears).toBe(0)
  })

  it('holds demand recovery until the persisted recovery lag expires', () => {
    const base = getEconomyModuleState(createInitialTavernState()).modifiers
    const distressed = {
      ...base,
      demandFactor: 0.5,
      spendFactor: 0.7,
      recoveryLagDays: 2,
    }
    const waiting = advanceEconomyModifiers(distressed, 90, 0, 1)
    expect(waiting.recoveryLagDays).toBe(1)
    expect(waiting.demandFactor).toBe(distressed.demandFactor)
    expect(waiting.spendFactor).toBe(distressed.spendFactor)

    const released = advanceEconomyModifiers(waiting, 90, 0, 2)
    expect(released.recoveryLagDays).toBe(0)
    expect(released.demandFactor).toBeGreaterThan(waiting.demandFactor)
    expect(released.spendFactor).toBeGreaterThan(waiting.spendFactor)
  })
})

describe('Phase 212 §5.2/§5.5 — attributable costs and exact accounting', () => {
  it('reconciles the complete daily ledger to the till', () => {
    const start = stocked(withCoin(createInitialTavernState(), 600))
    const after = simulateDay(
      start,
      {
        seed: `${SEED}/ledger`,
        ownerActions: [
          { actionId: 'repair_area', targetId: 'main_room' },
        ],
      },
      FULL_PIPELINE,
    ).state
    const record = getEconomyModuleState(after).lastDailyRecord!
    const ledgerNet = getStockModuleState(after).ledger.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    )
    expect(record.accounting.cashNet).toBeCloseTo(ledgerNet, 8)
    expect(record.closingCoin - record.openingCoin).toBeCloseTo(ledgerNet, 8)
    expect(record.reconciled).toBe(true)
    expect(record.costs.due).toBeGreaterThan(0)
    expect(record.costs.lines.some((line) => line.kind === 'overhead')).toBe(true)
  })

  it('accounts for inventory deterioration without pretending coin moved', () => {
    const base = withStock(stocked(createInitialTavernState()), 'mushrooms', {
      quantity: 100,
      spoilage: 75,
    })
    const after = simulateDay(
      base,
      { seed: `${SEED}/writeoff` },
      FULL_PIPELINE,
    ).state
    const accounting = getEconomyModuleState(after).lastDailyRecord!.accounting
    expect(accounting.inventoryWriteOffs).toBeGreaterThan(0)
    expect(accounting.cashNet).toBeCloseTo(
      getStockModuleState(after).ledger.reduce((sum, entry) => sum + entry.amount, 0),
      8,
    )
  })

  it('includes a perishable restocked from zero in same-day deterioration', () => {
    let base = withStock(
      stocked(withCoin(createInitialTavernState(), 5000)),
      'mushrooms',
      { quantity: 0, spoilage: 25 },
    )
    base = {
      ...base,
      world: {
        ...base.world,
        suppliers: Object.fromEntries(
          Object.entries(base.world.suppliers).map(([id, supplier]) => [
            id,
            { ...supplier, reliability: 100 },
          ]),
        ),
      },
    }
    const after = simulateDay(
      base,
      {
        seed: `${SEED}/same-day-restock-writeoff`,
        ownerActions: [
          { actionId: 'restock_item', targetId: 'mushrooms', amount: 200 },
        ],
      },
      FULL_PIPELINE,
    ).state
    const economy = getEconomyModuleState(after)

    expect(
      getOwnerActionsModuleState(after).applied.some(
        (action) => action.actionId === 'restock_item',
      ),
    ).toBe(true)
    expect(economy.openingSpoilageByStock['mushrooms']).toBe(25)
    expect(after.stock['mushrooms']!.quantity).toBeGreaterThan(0)
    expect(after.stock['mushrooms']!.spoilage).toBeGreaterThan(25)
    expect(economy.lastDailyRecord!.accounting.inventoryWriteOffs).toBeGreaterThan(0)
  })

  it('nets unpaid-tab reversals against cash sales instead of operating costs', () => {
    const accounting = accountingFromEntries([
      {
        source: 'service.flow.locals.ale',
        amount: 30,
        category: 'sales',
        tags: ['sale', 'ale'],
      },
      {
        source: 'service.tabs.locals',
        amount: -9,
        category: 'other',
        tags: ['unpaid_tab', 'local_goblins'],
      },
    ])

    expect(accounting.sales).toBe(21)
    expect(accounting.otherCosts).toBe(0)
    expect(accounting.cashNet).toBe(21)
  })

  it('values expedition returns without pretending the haul was cash', () => {
    let state = stocked(withCoin(createInitialTavernState(), 500))
    const expeditionId = 'phase212_returning_expedition'
    const runner = state.world.hireableAdventurers['hireable_adv_alpha']!
    state = {
      ...state,
      world: {
        ...state.world,
        hireableAdventurers: {
          ...state.world.hireableAdventurers,
          [runner.id]: {
            ...runner,
            experience: 100,
            reliability: 100,
            specialty: 'uncommon',
            currentExpeditionId: expeditionId,
          },
        },
      },
      expeditions: {
        ...state.expeditions,
        active: [
          {
            id: expeditionId,
            runnerId: runner.id,
            mode: 'open',
            targetTier: 'uncommon',
            targetIngredientId: null,
            daysTotal: 1,
            daysElapsed: 0,
            costPaid: 0,
            startedDay: 0,
            status: 'in_progress',
            seed: 'return-0',
          },
        ],
      },
    }

    const after = simulateDay(
      state,
      { seed: `${SEED}/expedition-return` },
      FULL_PIPELINE,
    ).state
    const returned = after.expeditions.completed[0]!.returnedIngredients
    const returnedValue = returned.reduce(
      (sum, item) =>
        sum + item.quantity * (after.stock[item.ingredientId]?.basePrice ?? 0),
      0,
    )
    const accounting = getEconomyModuleState(after).lastDailyRecord!.accounting

    expect(returned.length).toBeGreaterThan(0)
    expect(accounting.expeditionReturns).toBe(returnedValue)
    expect(accounting.cashNet).toBe(
      getStockModuleState(after).ledger.reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ),
    )
  })

  it('weekly and monthly cash totals reconcile to the same 28 daily ledgers', () => {
    const after = runDays(stocked(withCoin(createInitialTavernState(), 5000)), 28)
    const economy = getEconomyModuleState(after)
    const weekly = getWeeklyModuleState(after)
    const monthly = getMonthlyModuleState(after)
    const dailyCashNet = economy.dailyHistory.reduce(
      (sum, record) => sum + record.accounting.cashNet,
      0,
    )
    const weeklyCashNet = weekly.weeklyHistory.reduce(
      (sum, result) => sum + (result.accounting?.cashNet ?? 0),
      0,
    )
    expect(weekly.weeklyHistory).toHaveLength(4)
    expect(monthly.lastMonthlyResult?.accounting).toBeDefined()
    expect(weeklyCashNet).toBeCloseTo(dailyCashNet, 8)
    expect(monthly.lastMonthlyResult!.accounting!.cashNet).toBeCloseTo(
      dailyCashNet,
      8,
    )
    expect(monthly.lastMonthlyResult!.accounting!.rent).toBe(
      monthly.lastMonthlyResult!.rent.paidAmount,
    )
    expect(monthly.lastMonthlyResult!.accounting!.wages).toBeGreaterThan(0)
  })

  it('keeps unpaid day-28 balances aligned across daily, weekly and monthly reports', () => {
    const after = runDays(
      emptyCellar(withCoin(createInitialTavernState(), 0)),
      28,
      `${SEED}/unpaid-month`,
    )
    const economy = getEconomyModuleState(after)
    const weekly = getWeeklyModuleState(after)
    const monthly = getMonthlyModuleState(after)
    const dailyOutstanding = economy.lastDailyRecord!.accounting.payableOutstanding
    const weeklyOutstanding = weekly.lastWeeklyResult!.accounting!.payableOutstanding
    const monthlyOutstanding =
      monthly.lastMonthlyResult!.accounting!.payableOutstanding

    expect(monthly.rent.arrears).toBeGreaterThan(0)
    expect(dailyOutstanding).toBeGreaterThanOrEqual(
      monthly.rent.arrears + economy.financial.operatingArrears,
    )
    expect(weeklyOutstanding).toBe(dailyOutstanding)
    expect(monthlyOutstanding).toBe(dailyOutstanding)
  })
})

describe('Phase 212 §5.4 — group elasticity and substitution', () => {
  it('price-sensitive groups buy less ale and substitute when its price spikes', () => {
    let base = stocked(createInitialTavernState())
    for (const id of Object.keys(base.customerGroups)) {
      if ((base.customerGroups[id]?.patronage ?? 0) <= 0) continue
      base = withCustomerGroup(base, id, { patronage: 80, satisfaction: 80 })
    }
    const cheap = simulateDay(
      withStock(base, 'ale', { salePrice: 1 }),
      { seed: `${SEED}/elasticity` },
      FULL_PIPELINE,
    ).state
    const expensive = simulateDay(
      withStock(base, 'ale', { salePrice: 20 }),
      { seed: `${SEED}/elasticity` },
      FULL_PIPELINE,
    ).state

    const purchases = (state: TavernState, groupId: string) =>
      (state.modules['service'] as {
        result: {
          purchasesByGroup: Record<
            string,
            { itemsBought: Array<{ stockId: string; quantity: number }> }
          >
        }
      }).result.purchasesByGroup[groupId]!.itemsBought
    const quantity = (
      items: Array<{ stockId: string; quantity: number }>,
      stockId: string,
    ) => items.find((item) => item.stockId === stockId)?.quantity ?? 0

    const cheapMiners = purchases(cheap, 'miners')
    const expensiveMiners = purchases(expensive, 'miners')
    expect(quantity(expensiveMiners, 'ale')).toBeLessThan(
      quantity(cheapMiners, 'ale'),
    )
    expect(
      quantity(expensiveMiners, 'stew') + quantity(expensiveMiners, 'mushrooms'),
    ).toBeGreaterThan(
      quantity(cheapMiners, 'stew') + quantity(cheapMiners, 'mushrooms'),
    )
    expect(quantity(purchases(expensive, 'merchants'), 'ale')).toBe(0)
  })

  it('turns rival appeal into a distinct group-specific competitor choice', () => {
    const neutral = createInitialTavernState()
    const attractiveRival = withRivalAppeal(neutral, 90)
    expect(getCompetitorChoiceFactorForGroup(neutral, 'merchants')).toBe(1)
    expect(
      getCompetitorChoiceFactorForGroup(attractiveRival, 'merchants'),
    ).toBeLessThan(1)
    expect(
      getCompetitorChoiceFactorForGroup(attractiveRival, 'merchants'),
    ).toBeLessThan(
      getCompetitorChoiceFactorForGroup(attractiveRival, 'local_goblins'),
    )
  })
})

describe('Phase 212 §5.3 — failure, closure, restructuring and recovery', () => {
  it('reaches closure through unpaid operation and recovers through registered actions', () => {
    let state = emptyCellar(withCoin(createInitialTavernState(), 0))
    state = runDays(state, 18, `${SEED}/failure`)
    expect(getEconomyModuleState(state).financial.status).toBe('temporarily_closed')
    expect(getEconomyModuleState(state).financial.operatingArrears).toBeGreaterThan(0)

    expect(actionRegistry.has('restructure_tavern')).toBe(true)
    state = simulateDay(
      state,
      {
        seed: `${SEED}/restructure`,
        ownerActions: [{ actionId: 'restructure_tavern' }],
      },
      FULL_PIPELINE,
    ).state
    const restructured = getEconomyModuleState(state)
    expect(restructured.financial.status).toBe('restructuring')
    expect(getServiceModuleState(state).result.flow.ran).toBe(false)
    expect(
      getOwnerActionsModuleState(state).applied.some(
        (action) => action.actionId === 'restructure_tavern',
      ),
    ).toBe(true)
    expect(restructured.lastDailyRecord!.accounting.loanProceeds).toBeGreaterThan(0)
    expect(restructured.lastDailyRecord!.accounting.loanPayments).toBeGreaterThan(0)
    expect(restructured.lastDailyRecord!.accounting.financingCharges).toBeGreaterThan(0)
    expect(restructured.lastDailyRecord!.accounting.writeOffs).toBeGreaterThan(0)
    expect(Number.isInteger(state.coin)).toBe(true)
    expect(state.coin).toBeGreaterThan(0)

    state = simulateDay(
      stocked(state),
      {
        seed: `${SEED}/reopen`,
        ownerActions: [
          { actionId: 'close_tavern_temporarily' },
          { actionId: 'reopen_tavern' },
        ],
      },
      FULL_PIPELINE,
    ).state
    expect(getOwnerActionsModuleState(state).rejected[0]).toMatchObject({
      actionId: 'close_tavern_temporarily',
      code: 'already_closed',
    })
    expect(getOwnerActionsModuleState(state).applied[0]?.actionId).toBe(
      'reopen_tavern',
    )
    expect(getEconomyModuleState(state).financial.status).toBe('recovering')
    expect(getServiceModuleState(state).result.flow.ran).toBe(true)
  })
})

describe('Phase 212 §5.6 — policies are enforced rules', () => {
  it('waters ingredient use without discounting the delivered servings', () => {
    const state = createInitialTavernState()
    const salePrice = state.stock['ale']!.salePrice
    let captured:
      | {
          consumed: number
          result: ReturnType<typeof sellRecipe>
        }
      | undefined
    const probe: SimulationModule = {
      id: 'phase212.test.watered-billing',
      version: '0.0.0',
      dependsOn: ['stock'],
      hooks: {
        service: [
          (ctx: SimContext) => {
            const before = ctx.state.stock['ale']!.quantity
            const result = sellRecipe(ctx, 'dish_ale', 10, {
              buyerGroupId: 'local_goblins',
              ingredientUseFactor: 0.8,
            })
            captured = {
              consumed: before - ctx.state.stock['ale']!.quantity,
              result,
            }
          },
        ],
      },
    }

    simulateDay(state, { seed: `${SEED}/watered-billing` }, [stockModule, probe])

    expect(captured).toBeDefined()
    expect(captured!.result.sold).toBe(10)
    expect(captured!.consumed).toBe(8)
    expect(captured!.result.itemsConsumed).toEqual([
      { stockId: 'ale', quantity: 8 },
    ])
    expect(captured!.result.earned).toBe(10 * salePrice)
  })

  it('a staffed miner discount changes the bill and records compliance', () => {
    const after = simulateDay(
      stocked(createInitialTavernState()),
      {
        seed: `${SEED}/policy-staffed`,
        ownerActions: [{ actionId: 'enable_serve_miners_discount' }],
      },
      FULL_PIPELINE,
    ).state

    expect(getPolicyEffectStrength(after, 'serve_miners_discount')).toBeGreaterThan(0)
    expect(getServicePriceMultiplier(after, 'miners')).toBeLessThan(1)
    const policy = getEconomyModuleState(after).policies['serve_miners_discount']
    expect(policy?.status).toBe('compliant')
    expect(policy?.evidence.length).toBeGreaterThan(0)
    expect(policy?.enforcerIds.length).toBeGreaterThan(0)
  })

  it('the same rule without an enforcer is violated and grants no full effect', () => {
    let state = stocked(createInitialTavernState())
    for (const id of Object.keys(state.staff)) {
      state = withStaff(state, id, {
        unavailable: true,
        absence: {
          kind: 'illness',
          startedOnDay: 0,
          untilDay: 4,
          reason: 'all hands ill',
        },
      })
    }
    const after = simulateDay(
      state,
      {
        seed: `${SEED}/policy-unstaffed`,
        ownerActions: [{ actionId: 'enable_serve_miners_discount' }],
      },
      FULL_PIPELINE,
    ).state
    const policy = getEconomyModuleState(after).policies['serve_miners_discount']
    expect(policy?.status).toBe('violated')
    expect(policy?.compliance).toBe(0)
    expect(getServicePriceMultiplier(after, 'miners')).toBe(1)
  })

  it('charges staffed policy enforcement in whole coin', () => {
    const after = simulateDay(
      stocked(withCoin(createInitialTavernState(), 500)),
      {
        seed: `${SEED}/policy-cost`,
        ownerActions: [{ actionId: 'enable_ban_weapons_inside' }],
      },
      FULL_PIPELINE,
    ).state
    const economy = getEconomyModuleState(after)
    const policyCost = economy.lastDailyRecord!.costs.lines.find(
      (line) => line.kind === 'policy_enforcement',
    )
    expect(economy.policies['ban_weapons_inside']?.operatingCost).toBe(1)
    expect(policyCost?.due).toBe(1)
    expect(Number.isInteger(after.coin)).toBe(true)
  })

  it('reconciles every cohort when an enforced festival rule closes early', () => {
    let state = withCalendarTag(
      stocked(withCoin(createInitialTavernState(), 500)),
      'festival_window',
    )
    for (const id of Object.keys(state.customerGroups)) {
      if ((state.customerGroups[id]?.patronage ?? 0) <= 0) continue
      state = withCustomerGroup(state, id, {
        patronage: 100,
        satisfaction: 80,
      })
    }
    const after = simulateDay(
      state,
      {
        seed: `${SEED}/policy-early-close`,
        ownerActions: [
          { actionId: 'enable_close_early_on_festival_eve' },
        ],
      },
      FULL_PIPELINE,
    ).state
    const flow = getServiceModuleState(after).result.flow
    const lateParties = flow.parties.filter(
      (party) => party.arrivalWave >= flow.waves.length,
    )
    expect(flow.waves.length).toBeLessThan(6)
    expect(lateParties.length).toBeGreaterThan(0)
    expect(
      lateParties.every(
        (party) =>
          party.outcome === 'unserved_at_close' &&
          party.notes.some((note) => note.includes('doors closed')),
      ),
    ).toBe(true)
    for (const [groupId, demand] of Object.entries(flow.demandByGroup)) {
      expect(
        (flow.servedByGroup[groupId] ?? 0) +
          (flow.abandonedByGroup[groupId] ?? 0),
      ).toBe(demand)
    }
  })
})

describe('Phase 212 §5.7 — difficulty changes recovery economics', () => {
  it('easy restructuring gives more help and writes down more arrears than hard', () => {
    const run = (difficulty: 'easy' | 'hard'): TavernState => {
      let state = emptyCellar(
        createInitialTavernState(undefined, DIFFICULTY_PRESETS[difficulty]),
      )
      state = withCoin(state, 0)
      for (let day = 0; day < 28; day += 1) {
        if (
          getEconomyModuleState(state).financial.status ===
          'temporarily_closed'
        ) {
          break
        }
        state = simulateDay(
          state,
          { seed: `${SEED}/difficulty/${difficulty}/failure-${day}` },
          FULL_PIPELINE,
        ).state
      }
      expect(getEconomyModuleState(state).financial.status).toBe(
        'temporarily_closed',
      )
      return simulateDay(
        state,
        {
          seed: `${SEED}/difficulty/${difficulty}/restructure`,
          ownerActions: [{ actionId: 'restructure_tavern' }],
        },
        FULL_PIPELINE,
      ).state
    }
    const easy = run('easy')
    const hard = run('hard')
    expect(getEconomyModuleState(easy).financial.status).toBe('restructuring')
    expect(getEconomyModuleState(hard).financial.status).toBe('restructuring')
    expect(Number.isInteger(easy.coin)).toBe(true)
    expect(Number.isInteger(hard.coin)).toBe(true)
    expect(easy.coin).toBeGreaterThan(hard.coin)
    expect(getEconomyModuleState(easy).financial.operatingArrears).toBeLessThan(
      getEconomyModuleState(hard).financial.operatingArrears,
    )
    expect(getEconomyModuleState(easy).financial.restructuringBalance).toBeGreaterThan(
      getEconomyModuleState(hard).financial.restructuringBalance,
    )
  })
})

describe('Phase 212 §5.10 — old saves gain the economy without invented debt', () => {
  it('migrates a pre-Phase-5 save to the neutral slice', () => {
    const legacy = createInitialTavernState()
    delete legacy.modules['economy']
    const migrated = ensureModuleSlices(legacy)
    const economy = getEconomyModuleState(migrated)
    expect(economy.financial.status).toBe('stable')
    expect(economy.financial.operatingArrears).toBe(0)
    expect(economy.dailyHistory).toEqual([])
    expect(safeValidateState(migrated, { modules: FULL_PIPELINE }).success).toBe(true)
  })
})
