// @vitest-environment jsdom
//
// Phase 195 / ISSUE-162 — Reports → Action conversion.
//
// Covers the acceptance criteria:
//   - planActionCtaForPath maps a pressure path to a tab + focus hint, and
//     omits coin / reputation (nothing maps → silence, not a dead button).
//   - The CauseDrilldown "Plan an action against this" CTA renders for a
//     pressure path, is absent for coin, and routes to Day + opens the
//     picker with context on tap.
//   - gameStore.requestActionPicker forces the plan beat only when the day
//     is open and pre-service (segment 'A').
//   - The Yesterday digest renders ABOVE the at-a-glance row on morning.
//   - projectYesterdayDigest's "Today's watch" cue branches correctly.
//   - Monthly / Weekly overview line items (reputation axes, signals,
//     maintenance areas, supplier invoices, top revenue) are tap targets.
//   - MissedOpportunities links the missed entity when a ref maps.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

import { planActionCtaForPath } from '../../web/src/lib/sim/planActionCta'
import { projectYesterdayDigest } from '../../src/reports/yesterdayDigest'
import type { DailyReportData } from '../../src/reports/types'
import type { TavernState } from '../../src/sim/state/TavernState'
import type {
  WeeklyOverviewData,
} from '../../src/reports/weeklyOverviewProjection'
import type {
  MonthlyOverviewData,
} from '../../src/reports/monthlyOverviewProjection'
import type { MissedOpportunityLine } from '../../src/reports/types'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { drilldownStore } = await import(
  '../../web/src/lib/sim/drilldownStore.svelte'
)
const { default: CauseDrilldown } = await import(
  '../../web/src/lib/components/CauseDrilldown.svelte'
)
const { default: DayScreen } = await import(
  '../../web/src/lib/screens/DayScreen.svelte'
)
const { default: WeeklyOverview } = await import(
  '../../web/src/lib/components/WeeklyOverview.svelte'
)
const { default: MonthlyOverview } = await import(
  '../../web/src/lib/components/MonthlyOverview.svelte'
)
const { default: MissedOpportunities } = await import(
  '../../web/src/lib/components/MissedOpportunities.svelte'
)

beforeEach(() => {
  gameStore.reset('phase195-seed')
  drilldownStore.close()
  drilldownStore.path = undefined
})

afterEach(() => {
  cleanup()
})

// ───────────────────────── planActionCtaForPath ─────────────────────────

describe('planActionCtaForPath (Phase 195)', () => {
  it('maps a pressure with affine actions to a tab + danger-band focus', () => {
    const state = {
      modules: {
        pressures: {
          snapshots: {
            food_safety: { id: 'food_safety', consequences: ['gets worse'] },
          },
        },
      },
    } as unknown as TavernState
    const cta = planActionCtaForPath('pressures.food_safety', state)
    expect(cta).toBeDefined()
    expect(cta!.tab).toBe('immediate')
    // In its danger band (non-empty consequences) → scroll Suggested in.
    expect(cta!.focusSuggested).toBe(true)
  })

  it('does not focus Suggested when the pressure is out of its danger band', () => {
    const state = {
      modules: { pressures: { snapshots: {} } },
    } as unknown as TavernState
    const cta = planActionCtaForPath('pressures.food_safety', state)
    expect(cta).toBeDefined()
    expect(cta!.focusSuggested).toBe(false)
  })

  it('omits the CTA for coin and reputation (nothing maps)', () => {
    const state = {
      modules: { pressures: { snapshots: {} } },
    } as unknown as TavernState
    expect(planActionCtaForPath('coin', state)).toBeUndefined()
    expect(planActionCtaForPath('reputation.tasty', state)).toBeUndefined()
    expect(planActionCtaForPath(undefined, state)).toBeUndefined()
  })

  it('omits the CTA for a pressure with no affine action', () => {
    const state = {
      modules: { pressures: { snapshots: {} } },
    } as unknown as TavernState
    expect(planActionCtaForPath('pressures.no_such_pressure', state)).toBeUndefined()
  })
})

// ─────────────────────── requestActionPicker beat gate ──────────────────

describe('gameStore.requestActionPicker plan-beat gate (Phase 195)', () => {
  it('forces the plan beat when the day is open pre-service (segment A)', () => {
    gameStore.segment = 'A'
    gameStore.setBeat('morning')
    gameStore.requestActionPicker({ planBeat: true, tab: 'immediate' })
    expect(gameStore.beat).toBe('plan')
    expect(gameStore.route).toBe('day')
    expect(gameStore.actionPickerRequest).toEqual({
      tab: 'immediate',
      focusSuggested: false,
    })
  })

  it('does NOT force the plan beat at a closed/ready day (segment C)', () => {
    gameStore.segment = 'C'
    gameStore.setBeat('report')
    gameStore.requestActionPicker({ planBeat: true, tab: 'immediate' })
    expect(gameStore.beat).toBe('report')
    // still routes + opens the picker.
    expect(gameStore.route).toBe('day')
    expect(gameStore.actionPickerRequest).toBeTruthy()
  })

  it('consume-once: the request clears after a read', () => {
    gameStore.requestActionPicker({ tab: 'social' })
    expect(gameStore.consumeActionPickerRequest()).toBeTruthy()
    expect(gameStore.consumeActionPickerRequest()).toBeUndefined()
  })
})

// ───────────────────────── CauseDrilldown CTA ───────────────────────────

describe('CauseDrilldown "Plan an action" CTA (Phase 195)', () => {
  it('renders the CTA for a pressure path', async () => {
    render(CauseDrilldown, {
      open: true,
      path: 'pressures.food_safety',
      onclose: () => {},
    })
    await tick()
    expect(screen.queryByTestId('plan-action-cta')).toBeTruthy()
  })

  it('omits the CTA for the coin path', async () => {
    render(CauseDrilldown, { open: true, path: 'coin', onclose: () => {} })
    await tick()
    expect(screen.queryByTestId('plan-action-cta')).toBeNull()
  })

  it('tapping the CTA closes the sheet, routes to Day, and opens the picker', async () => {
    let closed = false
    render(CauseDrilldown, {
      open: true,
      path: 'pressures.food_safety',
      onclose: () => {
        closed = true
      },
    })
    await tick()
    await fireEvent.click(screen.getByTestId('plan-action-cta'))
    expect(closed).toBe(true)
    expect(gameStore.route).toBe('day')
    expect(gameStore.actionPickerRequest?.tab).toBe('immediate')
  })
})

// ───────────────────── Yesterday digest morning order ───────────────────

describe('Yesterday digest sits above the at-a-glance row (Phase 195)', () => {
  it('source order: the Yesterday section precedes At a glance on morning', () => {
    const src = readFileSync(
      join(process.cwd(), 'web/src/lib/screens/DayScreen.svelte'),
      'utf8',
    )
    const yesterday = src.indexOf('aria-label="Yesterday"')
    const glance = src.indexOf('aria-label="At a glance"')
    expect(yesterday).toBeGreaterThan(-1)
    expect(glance).toBeGreaterThan(-1)
    expect(yesterday).toBeLessThan(glance)
  })

  it('rendered DOM: Yesterday section precedes At a glance after a closed day', async () => {
    gameStore.runDay()
    gameStore.setBeat('morning')
    const { container } = render(DayScreen)
    await tick()
    const html = container.innerHTML
    const yesterday = html.indexOf('aria-label="Yesterday"')
    const glance = html.indexOf('aria-label="At a glance"')
    expect(glance).toBeGreaterThan(-1)
    // The digest only shows for a non-quiet closed day; when present it
    // must lead.
    if (yesterday !== -1) expect(yesterday).toBeLessThan(glance)
  })
})

// ───────────────────────── Today's watch branching ──────────────────────

function reportWith(
  overrides: Partial<DailyReportData> & {
    risingPressures?: DailyReportData['risingPressures']
    reputationDeltas?: DailyReportData['reputationDeltas']
  },
): DailyReportData {
  return {
    header: { closedDayOrdinal: 7, dayLabel: 'Day 7 · Market Day' },
    coinBefore: 100,
    coinAfter: 110,
    coinDelta: 10,
    isQuiet: false,
    reputationDeltas: [],
    risingPressures: [],
    ...overrides,
  } as unknown as DailyReportData
}

describe("Today's watch branching (Phase 195)", () => {
  it('surfaces a notable riser the secondary did not already name', () => {
    const report = reportWith({
      // Big reputation move wins the digest secondary…
      reputationDeltas: [{ axis: 'tasty', label: 'Tasty', delta: 20 }] as never,
      // …leaving a notable pressure for the watch line.
      risingPressures: [
        { id: 'pests', label: 'Pests', value: 40, delta: 8 },
      ] as never,
    })
    const digest = projectYesterdayDigest(report)
    expect(digest?.secondary?.kind).toBe('reputation')
    expect(digest?.watch).toBeDefined()
    expect(digest!.watch!.pressureId).toBe('pests')
    expect(digest!.watch!.readable).toContain('Pests')
    expect(digest!.watch!.readable).toContain('keep an eye on it')
  })

  it('omits the watch when the pressure is already the digest secondary', () => {
    const report = reportWith({
      reputationDeltas: [],
      risingPressures: [
        { id: 'pests', label: 'Pests', value: 40, delta: 8 },
      ] as never,
    })
    const digest = projectYesterdayDigest(report)
    expect(digest?.secondary?.kind).toBe('pressure')
    expect(digest?.watch).toBeUndefined()
  })

  it('omits the watch when no riser clears the notability threshold', () => {
    const report = reportWith({
      reputationDeltas: [{ axis: 'tasty', label: 'Tasty', delta: 20 }] as never,
      risingPressures: [
        { id: 'pests', label: 'Pests', value: 22, delta: 2 },
      ] as never,
    })
    const digest = projectYesterdayDigest(report)
    expect(digest?.watch).toBeUndefined()
  })

  it('omits the watch when nothing rose', () => {
    const digest = projectYesterdayDigest(reportWith({}))
    expect(digest?.watch).toBeUndefined()
  })
})

// ───────────────── Monthly / Weekly entity-link coverage ─────────────────

function realIds() {
  const areaId = Object.keys(gameStore.state.areas)[0]!
  const stockId = Object.keys(gameStore.state.stock)[0]!
  const supplierId = Object.keys(gameStore.state.world.suppliers)[0]
  return { areaId, stockId, supplierId }
}

describe('WeeklyOverview line items are tap targets (Phase 195)', () => {
  it('links signals (reputation axes), maintenance area, top revenue, invoices', async () => {
    const { areaId, stockId, supplierId } = realIds()
    const data: WeeklyOverviewData = {
      hasResult: true,
      header: {
        weekKey: '1',
        weekNumber: 1,
        monthNumber: 1,
        yearNumber: 1,
        endDay: 7,
        daysSinceClose: 0,
      },
      economy: {
        sales: 50,
        purchases: 10,
        wages: 5,
        rent: 0,
        repairs: 0,
        waste: 0,
        other: 0,
        net: 35,
        topRevenueSource: { id: stockId, label: 'Ale' },
      },
      signals: {
        cheap: 1,
        filthy: -1,
        dangerous: 0,
        tasty: 2,
        reliable: 0,
        notes: [],
      },
      maintenance: {
        rows: [
          { areaId, areaLabel: 'Cellar', severity: 40, reasons: [] } as never,
        ],
      },
      supplierInvoices: {
        paidCount: 0,
        unpaidCount: 1,
        totalUnpaid: 12,
        rows: [
          {
            id: supplierId ?? '',
            supplierLabel: 'Grok',
            amount: 12,
            dueWeek: 2,
            paid: false,
            relatedStock: [],
          },
        ],
      },
    }
    const { container } = render(WeeklyOverview, { data })
    await tick()
    // Five reputation-axis signal MetricLinks always render.
    expect(container.querySelectorAll('.metric-link').length).toBeGreaterThanOrEqual(5)
    // Maintenance area + top revenue stock resolve to EntityLinks.
    expect(container.querySelector('.entity-link')).toBeTruthy()
  })
})

describe('MonthlyOverview reputation axes link to their drilldown (Phase 195)', () => {
  it('renders the reputation axis label as a MetricLink', async () => {
    const data: MonthlyOverviewData = {
      hasResult: true,
      header: {
        monthKey: '1',
        monthNumber: 1,
        yearNumber: 1,
        endDay: 28,
        daysSinceClose: 0,
        endingCoin: 200,
      },
      reputation: {
        hasMonthOverMonth: false,
        rows: [
          {
            axisId: 'tasty',
            label: 'Tasty',
            before: 10,
            after: 20,
            delta: 10,
            tierBefore: 'faint',
            tierAfter: 'known',
            tierChanged: true,
            reasons: [],
          },
        ],
      },
    } as unknown as MonthlyOverviewData
    const { container } = render(MonthlyOverview, { data })
    await tick()
    const link = container.querySelector('.metric-link')
    expect(link).toBeTruthy()
    expect(link!.textContent).toContain('Tasty')
  })
})

describe('MissedOpportunities links the missed entity (Phase 195)', () => {
  it('renders an EntityLink when the line carries a mappable ref + label', async () => {
    const areaId = Object.keys(gameStore.state.areas)[0]!
    const opportunities: MissedOpportunityLine[] = [
      {
        id: 'missed_opp:6:pressure_remedy:clean_area:' + areaId,
        kind: 'pressure_remedy',
        readable: 'You could have cleaned the cellar.',
        actionId: 'clean_area',
        actionLabel: 'Clean Area',
        targetRef: { kind: 'area', id: areaId } as never,
        targetLabel: 'Cellar',
        impact: 5,
      },
    ]
    const { container } = render(MissedOpportunities, {
      opportunities,
      ondismiss: () => {},
    })
    await tick()
    const link = container.querySelector('.missed-jump .entity-link')
    expect(link).toBeTruthy()
    expect(link!.textContent).toContain('Cellar')
  })

  it('renders no jump link when the ref has no detail surface', async () => {
    const opportunities: MissedOpportunityLine[] = [
      {
        id: 'missed_opp:6:diff_counterfactual:adjust:x',
        kind: 'diff_counterfactual',
        readable: 'A customer group drifted away.',
        actionId: 'adjust',
        actionLabel: 'Adjust',
        targetRef: { kind: 'customer_group', id: 'rowdies' } as never,
        targetLabel: 'Rowdies',
        impact: 3,
      },
    ]
    const { container } = render(MissedOpportunities, {
      opportunities,
      ondismiss: () => {},
    })
    await tick()
    expect(container.querySelector('.missed-jump')).toBeNull()
  })
})
