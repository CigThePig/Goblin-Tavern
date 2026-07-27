// @vitest-environment jsdom
//
// Phase 190b / ISSUE-157b — Consumer wiring.
//
// Wires the first round of high-traffic consumers onto the 190a primitives.
// Covers:
//   - the pure target-type / ref-kind → EntityKind mappers
//   - DayScreen morning at-a-glance: coin MetricLink, "N staff" EntityLink,
//     per-item stock EntityLinks, and where each tap lands
//   - PressureRibbon rows opening the pressure drilldown
//   - gameStore.clearSeed (the pending-tag revision affordance)
//   - DailyReport linking a resolved-intent subject that resolves to an
//     entity, and leaving a generic-noun subject as plain text
//   - StockPanel consuming the routing target once (auto-open, then not on
//     re-entry) — the 190a consume-once observed end-to-end

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

import {
  entityKindFromTargetType,
  entityKindFromRefKind,
} from '../../web/src/lib/components/links/types'
import { buildTavernOverview } from '../../src/reports/index'
import type { DailyReportData } from '../../src/reports/types'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { drilldownStore } = await import(
  '../../web/src/lib/sim/drilldownStore.svelte'
)
const { default: DayScreen } = await import(
  '../../web/src/lib/screens/DayScreen.svelte'
)
const { default: PressureRibbon } = await import(
  '../../web/src/lib/components/PressureRibbon.svelte'
)
const { default: DailyReport } = await import(
  '../../web/src/lib/components/DailyReport.svelte'
)
const { default: StockPanel } = await import(
  '../../web/src/lib/components/tavern/StockPanel.svelte'
)

function firstStaffId(): string {
  const id = Object.keys(gameStore.state.staff)[0]
  expect(id, 'expected at least one starter staff member').toBeTruthy()
  return id!
}

function firstStockId(): string {
  const id = Object.keys(gameStore.state.stock)[0]
  expect(id, 'expected at least one starter stock item').toBeTruthy()
  return id!
}

beforeEach(() => {
  gameStore.reset('phase190b-seed')
  drilldownStore.close()
  drilldownStore.path = undefined
})

afterEach(() => {
  cleanup()
})

describe('entity-kind mappers (Phase 190b)', () => {
  it('maps owner-action target types onto detail-surface kinds', () => {
    expect(entityKindFromTargetType('staff')).toBe('staff')
    expect(entityKindFromTargetType('stock')).toBe('stock')
    expect(entityKindFromTargetType('area')).toBe('area')
    expect(entityKindFromTargetType('regular')).toBe('regular')
    expect(entityKindFromTargetType('supplier')).toBe('supplier')
    expect(entityKindFromTargetType('faction')).toBe('faction')
    expect(entityKindFromTargetType('project')).toBe('project')
    expect(entityKindFromTargetType('recipe')).toBe('recipe')
  })

  it('returns undefined for target types with no detail surface', () => {
    expect(entityKindFromTargetType('customer_group')).toBeUndefined()
    expect(entityKindFromTargetType('policy')).toBeUndefined()
    expect(entityKindFromTargetType('global')).toBeUndefined()
  })

  it('maps sim EntityRef kinds onto detail-surface kinds', () => {
    expect(entityKindFromRefKind('staff')).toBe('staff')
    expect(entityKindFromRefKind('notable_npc')).toBe('npc')
    expect(entityKindFromRefKind('culture')).toBe('culture')
    expect(entityKindFromRefKind('supplier')).toBe('supplier')
  })

  it('returns undefined for ref kinds with no detail surface', () => {
    expect(entityKindFromRefKind('customer_group')).toBeUndefined()
    expect(entityKindFromRefKind('role')).toBeUndefined()
    expect(entityKindFromRefKind('system')).toBeUndefined()
    expect(entityKindFromRefKind('tavern_identity')).toBeUndefined()
  })
})

describe('DayScreen morning at-a-glance (Phase 190b)', () => {
  const staffName = (n: string) => /^\d+ staff$/.test(n)
  const firstStockChipName = (): string => {
    const s = Object.values(gameStore.state.stock)[0]!
    return `${s.label.toLowerCase()} ${s.quantity}`
  }

  it('renders coin as a MetricLink, staff + stock as tap targets', async () => {
    render(DayScreen)
    await tick()
    // Coin, "N staff", and the first stock chip are all present as buttons.
    expect(screen.getByRole('button', { name: String(gameStore.state.coin) })).toBeTruthy()
    expect(screen.getByRole('button', { name: staffName })).toBeTruthy()
    expect(screen.getByRole('button', { name: firstStockChipName() })).toBeTruthy()
  })

  it('tapping coin opens the coin drilldown', async () => {
    render(DayScreen)
    await tick()
    await fireEvent.click(
      screen.getByRole('button', { name: String(gameStore.state.coin) }),
    )
    expect(drilldownStore.open).toBe(true)
    expect(drilldownStore.path).toBe('coin')
  })

  it('tapping "N staff" lands on Tavern → Staff with no auto-open target', async () => {
    render(DayScreen)
    await tick()
    await fireEvent.click(screen.getByRole('button', { name: staffName }))
    expect(gameStore.route).toBe('tavern')
    expect(gameStore.tavernSubview).toBe('staff')
    expect(gameStore.tavernSubviewTarget).toBeUndefined()
  })

  it('tapping a stock chip lands on Tavern → Stock with the item target stashed', async () => {
    render(DayScreen)
    await tick()
    const expectedId = Object.values(gameStore.state.stock)[0]!.id
    await fireEvent.click(screen.getByRole('button', { name: firstStockChipName() }))
    expect(gameStore.route).toBe('tavern')
    expect(gameStore.tavernSubview).toBe('stock')
    expect(gameStore.tavernSubviewTarget).toBe(expectedId)
  })
})

describe('PressureRibbon (Phase 190b)', () => {
  it('opens the pressure drilldown when a row is tapped', async () => {
    const pid = Object.keys(gameStore.state.pressures)[0]!
    const label = gameStore.state.pressures[pid]!.label
    // Force the pressure above the ribbon's visibility threshold so it is
    // the top row.
    gameStore.state.pressures[pid]!.value = 95
    render(PressureRibbon)
    await tick()
    await fireEvent.click(
      screen.getByRole('button', { name: (n) => n.includes(label) }),
    )
    expect(drilldownStore.open).toBe(true)
    expect(drilldownStore.path).toBe(`pressures.${pid}`)
  })
})

describe('gameStore.clearSeed (Phase 190b pending-tag revision)', () => {
  it('drops a pending decision so the choice can be revised', () => {
    gameStore.resolveSeed('seed-x', { kind: 'ignore' })
    expect(gameStore.pendingBySeedId['seed-x']).toBeTruthy()
    gameStore.clearSeed('seed-x')
    expect(gameStore.pendingBySeedId['seed-x']).toBeUndefined()
    // Clearing an absent seed is a harmless no-op.
    expect(() => gameStore.clearSeed('not-there')).not.toThrow()
  })
})

describe('DailyReport resolved-intent subject (Phase 190b)', () => {
  function reportWith(entries: DailyReportData['dayArc'][number]['entries']): DailyReportData {
    return {
      header: {
        closedDayOrdinal: 1,
        dayLabel: 'Day 1',
        isEndOfWeek: false,
        isEndOfMonth: false,
      },
      coinBefore: 100,
      coinAfter: 100,
      coinDelta: 0,
      reputationDeltas: [],
      topDiffs: [],
      groupedDiffs: {
        coinAndReputation: [],
        stock: [],
        pressures: [],
        areas: [],
        other: [],
      },
      ownerActionsApplied: [],
      resolvedIntents: [],
      serviceLines: [],
      dayArc: [{ id: 'reckoning', title: 'The reckoning', entries }],
      risingPressures: [],
      futureHooks: [],
    staffFocus: [],
    pendingConsequences: [],
    resolvedConsequences: [],
      isQuiet: false,
    }
  }

  it('links a subject that resolves to a concrete entity', async () => {
    const staffId = firstStaffId()
    render(DailyReport, {
      props: {
        report: reportWith([
          {
            kind: 'resolved_intent',
            intent: {
              intentId: 'i1',
              seedId: 's1',
              verb: 'tend',
              subject: 'Mira',
              subjectRef: { kind: 'staff', id: staffId },
              responseSlotId: 'slot',
            },
          },
        ]),
      },
    })
    await tick()
    const link = screen.getByRole('button', { name: 'Mira' })
    expect(link.classList.contains('entity-link')).toBe(true)
  })

  it('leaves a generic-noun subject as plain text', async () => {
    render(DailyReport, {
      props: {
        report: reportWith([
          {
            kind: 'resolved_intent',
            intent: {
              intentId: 'i2',
              seedId: 's2',
              verb: 'patch',
              subject: 'the cellar',
              responseSlotId: 'slot',
            },
          },
        ]),
      },
    })
    await tick()
    expect(screen.queryByRole('button', { name: 'the cellar' })).toBeNull()
    expect(screen.getByText(/the cellar/)).toBeTruthy()
  })
})

describe('StockPanel target consumption (Phase 190b, consume-once)', () => {
  it('auto-opens the targeted sheet on first mount and not on re-entry', async () => {
    const stockId = firstStockId()
    const expectedLabel = gameStore.state.stock[stockId]!.label
    const data = buildTavernOverview(gameStore.state).stock

    // Route here as an EntityLink would, stashing the stock target.
    gameStore.setRoute('tavern', { target: stockId, kind: 'stock' })
    expect(gameStore.tavernSubviewTarget).toBe(stockId)

    const sheetOpen = (): boolean =>
      screen
        .queryAllByRole('dialog')
        .some((d) => d.getAttribute('aria-label') === expectedLabel)

    // First mount: the panel consumes the target and opens the sheet.
    const { unmount } = render(StockPanel, { props: { data } })
    await tick()
    expect(sheetOpen(), 'StockDetailSheet auto-opened').toBe(true)
    // The target was consumed (cleared) on read.
    expect(gameStore.tavernSubviewTarget).toBeUndefined()

    unmount()

    // Re-entry via the tab nav: no pending target, so no sheet re-opens.
    render(StockPanel, { props: { data } })
    await tick()
    expect(sheetOpen()).toBe(false)
  })
})
