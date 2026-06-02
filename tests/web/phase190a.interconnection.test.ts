// @vitest-environment jsdom
//
// Phase 190a / ISSUE-157a — Interconnection primitives.
//
// Covers the primitives + routing + drilldown-path layer the consumer
// wiring (phase 190b / ISSUE-157b) is built on:
//   - routing target propagation through `gameStore.setRoute(opts)`
//   - consume-once semantics of the transient sub-view targets
//   - graceful plain-text fallback for an EntityLink whose id is missing
//   - drilldown-path resolution for `coin`, `reputation.<axis>`,
//     `inventory.<itemId>`
//   - MetricLink opening the global drilldown store

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import {
  metricDrilldownPath,
  entityExists,
  ENTITY_ROUTING,
} from '../../web/src/lib/components/links/types'
import {
  pathToCauseTarget,
  causesForCoin,
  causesForReputationAxis,
  causesForInventory,
} from '../../src/reports/index'
import type { CauseEntry } from '../../src/sim/state/TavernState'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { drilldownStore } = await import(
  '../../web/src/lib/sim/drilldownStore.svelte'
)
const { default: EntityLink } = await import(
  '../../web/src/lib/components/links/EntityLink.svelte'
)
const { default: MetricLink } = await import(
  '../../web/src/lib/components/links/MetricLink.svelte'
)

function firstStaffId(): string {
  const id = Object.keys(gameStore.state.staff)[0]
  expect(id, 'expected at least one starter staff member').toBeTruthy()
  return id!
}

beforeEach(() => {
  gameStore.reset('phase190a-seed')
  drilldownStore.close()
  drilldownStore.path = undefined
})

afterEach(() => {
  cleanup()
})

describe('metricDrilldownPath (Phase 190a)', () => {
  it('maps each metric kind to its drilldown path', () => {
    expect(metricDrilldownPath('coin')).toBe('coin')
    expect(metricDrilldownPath('pressure', 'food_safety')).toBe(
      'pressures.food_safety',
    )
    expect(metricDrilldownPath('reputation', 'tasty')).toBe('reputation.tasty')
    expect(metricDrilldownPath('inventory', 'ale')).toBe('inventory.ale')
  })

  it('returns undefined for id-bearing kinds given no id', () => {
    expect(metricDrilldownPath('pressure')).toBeUndefined()
    expect(metricDrilldownPath('reputation')).toBeUndefined()
    expect(metricDrilldownPath('inventory')).toBeUndefined()
  })
})

describe('drilldown path resolution (Phase 190a)', () => {
  it('resolves coin / reputation / inventory paths to cause targets', () => {
    expect(pathToCauseTarget('coin')).toBe('coin')
    expect(pathToCauseTarget('reputation.tasty')).toBe('reputation:tasty')
    // inventory.<itemId> aliases to the same stock target a StockDetailSheet reads.
    expect(pathToCauseTarget('inventory.ale')).toBe('stock:ale')
  })

  it('thin metric-cause helpers read the planted causes for the day', () => {
    const day = 5
    const plant = (target: string): CauseEntry =>
      ({
        target,
        weight: 10,
        timestamp: { absoluteDay: day },
      }) as unknown as CauseEntry
    gameStore.state.causes.push(
      plant('coin'),
      plant('reputation:tasty'),
      plant('stock:ale'),
    )

    expect(causesForCoin(gameStore.state, { absoluteDay: day })).toHaveLength(1)
    expect(
      causesForReputationAxis(gameStore.state, 'tasty', { absoluteDay: day }),
    ).toHaveLength(1)
    expect(
      causesForInventory(gameStore.state, 'ale', { absoluteDay: day }),
    ).toHaveLength(1)
  })
})

describe('entityExists (Phase 190a graceful fallback)', () => {
  it('resolves a live staff member and rejects an unknown id', () => {
    expect(entityExists(gameStore.state, 'staff', firstStaffId())).toBe(true)
    expect(entityExists(gameStore.state, 'staff', 'no-such-staff')).toBe(false)
  })

  it('treats an empty id as not-an-entity', () => {
    expect(entityExists(gameStore.state, 'staff', '')).toBe(false)
  })
})

describe('gameStore routing target propagation (Phase 190a)', () => {
  it('routes to the kind home sub-view and stashes the target', () => {
    gameStore.setRoute('tavern', { target: 'mira', kind: 'staff' })
    expect(gameStore.route).toBe('tavern')
    expect(gameStore.tavernSubview).toBe(ENTITY_ROUTING.staff.subview)
    expect(gameStore.tavernSubviewTarget).toBe('mira')

    gameStore.setRoute('world', { target: 'guild', kind: 'faction' })
    expect(gameStore.route).toBe('world')
    expect(gameStore.worldSubview).toBe('factions')
    expect(gameStore.worldSubviewTarget).toBe('guild')
  })

  it('consumes the target once and clears it', () => {
    gameStore.setRoute('tavern', { target: 'mira', kind: 'staff' })
    expect(gameStore.consumeTavernSubviewTarget()).toBe('mira')
    // Re-entry finds it already cleared — the sheet must not re-open.
    expect(gameStore.consumeTavernSubviewTarget()).toBeUndefined()
    expect(gameStore.tavernSubviewTarget).toBeUndefined()
  })

  it('an empty target clears any pending target (no auto-open)', () => {
    gameStore.setRoute('tavern', { target: '', kind: 'staff' })
    expect(gameStore.tavernSubview).toBe('staff')
    expect(gameStore.tavernSubviewTarget).toBeUndefined()
  })

  it('single-arg callers are unchanged and leave targets untouched', () => {
    gameStore.tavernSubviewTarget = 'sticky'
    gameStore.setRoute('day')
    expect(gameStore.route).toBe('day')
    expect(gameStore.tavernSubviewTarget).toBe('sticky')
  })
})

describe('EntityLink (Phase 190a)', () => {
  it('renders a tap target that routes for a resolvable id', async () => {
    const staffId = firstStaffId()
    render(EntityLink, {
      props: { kind: 'staff', id: staffId, label: 'Mira' },
    })
    const btn = screen.getByRole('button', { name: 'Mira' })
    await fireEvent.click(btn)
    expect(gameStore.route).toBe('tavern')
    expect(gameStore.tavernSubview).toBe('staff')
    expect(gameStore.tavernSubviewTarget).toBe(staffId)
  })

  it('renders plain text (no button) for an unresolvable id', () => {
    render(EntityLink, {
      props: { kind: 'staff', id: 'ghost-staff', label: 'Departed' },
    })
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Departed')).toBeTruthy()
  })

  it('an empty id is still a navigation link (home tab, no target)', async () => {
    render(EntityLink, {
      props: { kind: 'staff', id: '', label: '3 staff' },
    })
    const btn = screen.getByRole('button', { name: '3 staff' })
    await fireEvent.click(btn)
    expect(gameStore.route).toBe('tavern')
    expect(gameStore.tavernSubview).toBe('staff')
    expect(gameStore.tavernSubviewTarget).toBeUndefined()
  })
})

describe('MetricLink (Phase 190a)', () => {
  const coinSnippet = createRawSnippet(() => ({
    render: () => `<span>100</span>`,
  }))

  it('opens the global drilldown at the metric path on tap', async () => {
    render(MetricLink, { props: { kind: 'coin', children: coinSnippet } })
    const btn = screen.getByRole('button')
    await fireEvent.click(btn)
    expect(drilldownStore.open).toBe(true)
    expect(drilldownStore.path).toBe('coin')
  })

  it('renders plain content (no button) when an id is required but missing', () => {
    render(MetricLink, { props: { kind: 'pressure', children: coinSnippet } })
    expect(screen.queryByRole('button')).toBeNull()
  })
})
