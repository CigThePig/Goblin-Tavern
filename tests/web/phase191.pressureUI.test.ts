// @vitest-environment jsdom
//
// Phase 191 / ISSUE-158 — Pressure stakes and danger zones (web).
//
// Covers:
//   - PressureRibbon surfaces the sim's consequence line, and marks the
//     row as danger, only when the pressure is in/above its danger band;
//     stays a bare bar below the band.
//   - CauseDrilldown renders the "If ignored" stakes callout for a pressure
//     path with authored consequences, and stays silent otherwise.
//   - pressureColor crossover guard (verified, not invented).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/svelte'
import { tick } from 'svelte'

import { pressureColor, palette } from '../../web/src/lib/design/tokens'
import { PRESSURES_MODULE_ID } from '../../src/sim/modules/pressures/index'
import type {
  PressureModuleState,
  PressureSnapshot,
} from '../../src/sim/modules/pressures/index'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { drilldownStore } = await import(
  '../../web/src/lib/sim/drilldownStore.svelte'
)
const { default: PressureRibbon } = await import(
  '../../web/src/lib/components/PressureRibbon.svelte'
)
const { default: CauseDrilldown } = await import(
  '../../web/src/lib/components/CauseDrilldown.svelte'
)

function snapshot(id: string, consequences: string[]): PressureSnapshot {
  return {
    id,
    label: id,
    value: 90,
    previousValue: 80,
    delta: 10,
    trend: 'rising',
    severity: 90,
    urgency: 90,
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

/** Plant a rich snapshot in the module slice so the projection can read it. */
function plantSnapshot(snap: PressureSnapshot): void {
  const existing = gameStore.state.modules[PRESSURES_MODULE_ID] as
    | PressureModuleState
    | undefined
  const slice: PressureModuleState =
    existing ?? { snapshots: {}, history: {}, lastCalculatedDay: 1 }
  slice.snapshots = { ...slice.snapshots, [snap.id]: snap }
  gameStore.state.modules[PRESSURES_MODULE_ID] = slice
}

/** Make a pressure the top ribbon row and give it a compact PressureState. */
function makeTopPressure(id: string, label: string): void {
  gameStore.state.pressures[id] = {
    id,
    label,
    value: 90,
    trend: 1,
    tags: [],
    topCauses: [],
  }
}

beforeEach(() => {
  gameStore.reset('phase191-seed')
  drilldownStore.close()
  drilldownStore.path = undefined
})

afterEach(() => {
  cleanup()
})

describe('PressureRibbon consequence surfacing (Phase 191)', () => {
  it('shows the sim consequence line and marks danger when in band', async () => {
    makeTopPressure('food_safety', 'Food Safety')
    plantSnapshot(
      snapshot('food_safety', [
        'Customers may fall ill if pressure keeps climbing.',
      ]),
    )
    render(PressureRibbon)
    await tick()

    const line = screen.getByTestId('pressure-consequence')
    expect(line.textContent?.trim()).toBe(
      'Customers may fall ill if pressure keeps climbing.',
    )
    // The row carrying the line is flagged danger for the visual treatment.
    const entry = line.closest('[data-danger]')
    expect(entry?.getAttribute('data-danger')).toBe('true')
  })

  it('stays a bare bar when the pressure is below its danger band', async () => {
    makeTopPressure('debt', 'Debt')
    plantSnapshot(snapshot('debt', [])) // below band: no authored consequences
    render(PressureRibbon)
    await tick()

    expect(screen.queryByTestId('pressure-consequence')).toBeNull()
    // The label still renders — the row is present, just without stakes.
    expect(screen.getByText('Debt')).toBeTruthy()
  })

  it('does not invent a line for a pressure with no snapshot', async () => {
    makeTopPressure('violence', 'Violence')
    // No snapshot planted at all.
    render(PressureRibbon)
    await tick()
    expect(screen.queryByTestId('pressure-consequence')).toBeNull()
  })
})

describe('CauseDrilldown stakes callout (Phase 191)', () => {
  it('renders the If-ignored callout for a pressure path with consequences', async () => {
    plantSnapshot(
      snapshot('violence', ['Brawls become likely.', 'Main room damage will rise.']),
    )
    render(CauseDrilldown, {
      props: { open: true, path: 'pressures.violence', onclose: () => {} },
    })
    await tick()

    const callout = screen.getByTestId('pressure-stakes')
    expect(callout).toBeTruthy()
    expect(callout.textContent).toContain('Brawls become likely.')
    expect(callout.textContent).toContain('Main room damage will rise.')
  })

  it('stays silent for a pressure below its danger band', async () => {
    plantSnapshot(snapshot('debt', []))
    render(CauseDrilldown, {
      props: { open: true, path: 'pressures.debt', onclose: () => {} },
    })
    await tick()
    expect(screen.queryByTestId('pressure-stakes')).toBeNull()
  })

  it('stays silent for a non-pressure path', async () => {
    render(CauseDrilldown, {
      props: { open: true, path: 'reputation.tasty', onclose: () => {} },
    })
    await tick()
    expect(screen.queryByTestId('pressure-stakes')).toBeNull()
  })
})

describe('pressureColor crossover (Phase 191 — verified, not invented)', () => {
  it('crosses into the risk/loss palette at the danger band', () => {
    // Calm below 30, rising candle to 50, risk (rust) from 50, loss (blood)
    // from 70 — the crossover aligns with where calculators author
    // consequences (severity 50–60). Guards against drift.
    expect(pressureColor(20)).toBe(palette.candleSoft)
    expect(pressureColor(40)).toBe(palette.candle)
    expect(pressureColor(50)).toBe(palette.rust)
    expect(pressureColor(69)).toBe(palette.rust)
    expect(pressureColor(70)).toBe(palette.blood)
    expect(pressureColor(95)).toBe(palette.blood)
  })
})
