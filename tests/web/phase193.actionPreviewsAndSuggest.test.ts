// @vitest-environment jsdom
//
// Phase 193 / ISSUE-160 — Action effect previews + suggestions (web).
//
// Covers the acceptance criteria:
//   - Picker rows surface the definition's `effectsPreview` as a dim
//     caption; rows with none show no caption (no placeholder).
//   - Suggested section appears at the top of the picker when suggestions
//     exist, with the action label + a one-line reason.
//   - suggestActions: rising-pressure trigger, yesterday-loss trigger,
//     cap at 3, dedup against picks, time-cost tiebreak, deterministic
//     ordering, and reactive collapse when everything is queued.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

import { PRESSURES_MODULE_ID } from '../../src/sim/modules/pressures/index'
import type {
  PressureModuleState,
  PressureSnapshot,
} from '../../src/sim/modules/pressures/index'
import type { TavernState } from '../../src/sim/state/TavernState'
import type { DailyReportData } from '../../src/reports/types'

const { suggestActions } = await import('../../web/src/lib/sim/suggestActions')
const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { default: ActionPicker } = await import(
  '../../web/src/lib/components/ActionPicker.svelte'
)

// ---------- fixtures ----------

function snapshot(
  id: string,
  consequences: string[],
  severity = 80,
): PressureSnapshot {
  return {
    id,
    label: id,
    value: 90,
    previousValue: 80,
    delta: 10,
    trend: 'rising',
    severity,
    urgency: severity,
    volatility: 10,
    causes: [],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    tags: [],
    consequences,
    lastUpdated: { year: 1, month: 1, week: 1, day: 1, absoluteDay: 1 },
  }
}

/** A bare state carrying just the pressure snapshots + stock the engine reads. */
function makeState(
  snapshots: PressureSnapshot[],
  stock: Record<string, { id: string; label: string }> = {},
): TavernState {
  const slice: PressureModuleState = {
    snapshots: Object.fromEntries(snapshots.map((s) => [s.id, s])),
    history: {},
    lastCalculatedDay: 1,
  }
  return {
    modules: { [PRESSURES_MODULE_ID]: slice },
    stock,
  } as unknown as TavernState
}

/** A report carrying just the stock loss lines the engine reads. */
function reportWithStockLosses(
  losses: Array<{ id: string; delta: number }>,
): DailyReportData {
  return {
    groupedDiffs: {
      coinAndReputation: [],
      stock: losses.map((l) => ({
        path: `stock.${l.id}.quantity`,
        readable: '',
        humanReadable: '',
        direction: 'loss' as const,
        delta: l.delta,
        before: 0,
        after: 0,
        tags: [],
      })),
      pressures: [],
      areas: [],
      other: [],
    },
  } as unknown as DailyReportData
}

function plantSnapshot(snap: PressureSnapshot): void {
  const existing = gameStore.state.modules[PRESSURES_MODULE_ID] as
    | PressureModuleState
    | undefined
  const slice: PressureModuleState =
    existing ?? { snapshots: {}, history: {}, lastCalculatedDay: 1 }
  slice.snapshots = { ...slice.snapshots, [snap.id]: snap }
  gameStore.state.modules[PRESSURES_MODULE_ID] = slice
}

beforeEach(() => {
  gameStore.reset('phase193-seed')
  gameStore.setPicks([])
})

afterEach(() => {
  cleanup()
})

// ---------- suggestActions (pure) ----------

describe('suggestActions (Phase 193)', () => {
  it('suggests an affinity action when its pressure is in band', () => {
    const state = makeState([snapshot('food_safety', ['rats in the stew'])])
    const out = suggestActions(state, [])
    const clean = out.find((s) => s.action.id === 'clean_area')
    expect(clean).toBeDefined()
    expect(clean?.reason).toBe('food_safety rising')
  })

  it('stays silent for a pressure below its danger band (no consequences)', () => {
    const state = makeState([snapshot('food_safety', [])])
    expect(suggestActions(state, [])).toHaveLength(0)
  })

  it('suggests restocking after a yesterday stock loss', () => {
    const state = makeState([], { ale: { id: 'ale', label: 'Ale' } })
    const report = reportWithStockLosses([{ id: 'ale', delta: -50 }])
    const out = suggestActions(state, [], report)
    const restock = out.find((s) => s.action.id === 'restock_item')
    expect(restock).toBeDefined()
    expect(restock?.reason).toBe('lost ale yesterday')
  })

  it('caps the list at three suggestions', () => {
    const state = makeState([
      snapshot('food_safety', ['x'], 90),
      snapshot('staff_burnout', ['x'], 80),
      snapshot('stock_shortage', ['x'], 70),
      snapshot('maintenance', ['x'], 60),
      snapshot('pests', ['x'], 50),
    ])
    expect(suggestActions(state, [])).toHaveLength(3)
  })

  it('filters out actions already queued in picks', () => {
    const state = makeState([snapshot('food_safety', ['x'])])
    const out = suggestActions(state, [{ actionId: 'clean_area' }])
    expect(out.some((s) => s.action.id === 'clean_area')).toBe(false)
  })

  it('breaks ties by lowest time cost, not action points', () => {
    // stock_shortage maps to both buy_mugs (quick) and restock_item (short);
    // same source severity, so the cheaper-by-time action sorts first.
    const state = makeState([snapshot('stock_shortage', ['x'], 60)])
    const out = suggestActions(state, [])
    const ids = out.map((s) => s.action.id)
    expect(ids.indexOf('buy_mugs')).toBeLessThan(ids.indexOf('restock_item'))
  })

  it('orders higher-severity pressures first', () => {
    const state = makeState([
      snapshot('staff_burnout', ['x'], 30),
      snapshot('pests', ['x'], 90),
    ])
    const out = suggestActions(state, [])
    // The top suggestion traces to the higher-severity pressure, whichever
    // of its affinity actions is cheapest by time.
    expect(out[0]?.reason).toBe('pests rising')
  })

  it('is deterministic for the same inputs', () => {
    const state = makeState([
      snapshot('food_safety', ['x'], 90),
      snapshot('stock_shortage', ['x'], 60),
    ])
    expect(suggestActions(state, [])).toEqual(suggestActions(state, []))
  })

  it('collapses to empty when every suggestion is already queued', () => {
    const state = makeState([snapshot('food_safety', ['x'])])
    const first = suggestActions(state, [])
    const picks = first.map((s) => ({ actionId: s.action.id }))
    expect(suggestActions(state, picks)).toHaveLength(0)
  })
})

// ---------- ActionPicker rendering ----------

describe('ActionPicker effect previews + suggested section (Phase 193)', () => {
  it('renders the effectsPreview caption for an action that has one', async () => {
    render(ActionPicker, { open: true, onclose: () => {} })
    await tick()
    // clean_area is on the default Immediate tab and carries a preview.
    expect(
      screen.getByText('Raises cleanliness; lowers smell and risk'),
    ).toBeTruthy()
  })

  it('shows the Suggested section when a pressure is in band', async () => {
    plantSnapshot(snapshot('food_safety', ['rats in the stew']))
    render(ActionPicker, { open: true, onclose: () => {} })
    await tick()

    const section = screen.getByLabelText('Suggested actions')
    expect(section).toBeTruthy()
    expect(section.textContent).toContain('Clean Area')
    expect(section.textContent).toContain('food_safety rising')
  })

  it('renders no Suggested section when nothing is in band', async () => {
    render(ActionPicker, { open: true, onclose: () => {} })
    await tick()
    expect(screen.queryByLabelText('Suggested actions')).toBeNull()
  })
})
