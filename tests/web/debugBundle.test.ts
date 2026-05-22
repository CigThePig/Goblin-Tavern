// Debug bundle — shape sanity for the More → Diagnostics copy button.
//
// The bundle is the user-facing payload pasted into bug reports, so a
// stable shape matters. These tests don't lock copy or numeric values
// (those move as the sim evolves) — they assert structure, plain-JSON
// roundtripability, and that errors / latestResult appear when set.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { buildDebugBundle, debugBundleAsText } = await import(
  '../../web/src/lib/sim/debugBundle'
)

describe('debugBundle', () => {
  beforeEach(() => {
    gameStore.reset('debug-bundle-test')
  })

  afterEach(() => {
    gameStore.runError = undefined
    gameStore.hydrationError = undefined
  })

  it('builds a JSON-serializable bundle with the expected top-level shape', () => {
    const bundle = buildDebugBundle()

    // Top-level keys.
    expect(bundle.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(bundle.build.simVersion).toBeDefined()
    expect(bundle.ui.route).toBeDefined()
    expect(bundle.ui.beat).toBeDefined()
    expect(bundle.sim.seedString).toBe('debug-bundle-test')
    expect(bundle.sim.calendar.totalDaysElapsed).toBeTypeOf('number')
    expect(typeof bundle.sim.coin).toBe('number')
    expect(Array.isArray(bundle.sim.customerGroups)).toBe(true)
    expect(Array.isArray(bundle.sim.topPressures)).toBe(true)
    expect(typeof bundle.player.pendingBySeedId).toBe('object')
    expect(Array.isArray(bundle.player.picks)).toBe(true)
    expect(typeof bundle.player.staffPriorities).toBe('object')

    // No errors on a fresh reset.
    expect(bundle.errors.runError).toBeUndefined()
    expect(bundle.errors.hydrationError).toBeUndefined()

    // Round-trips through JSON without loss.
    const text = debugBundleAsText()
    const parsed = JSON.parse(text)
    expect(parsed.sim.seedString).toBe('debug-bundle-test')
  })

  it('captures runError when set on the store', () => {
    gameStore.runError = { message: 'boom', stack: 'at test' }
    const bundle = buildDebugBundle()
    expect(bundle.errors.runError).toEqual({ message: 'boom', stack: 'at test' })
  })

  it('captures hydrationError when set on the store', () => {
    gameStore.hydrationError = 'bad save shape'
    const bundle = buildDebugBundle()
    expect(bundle.errors.hydrationError).toBe('bad save shape')
  })

  it('summarizes customer groups with id/satisfaction/patronage/loyalty only', () => {
    const bundle = buildDebugBundle()
    for (const group of bundle.sim.customerGroups) {
      expect(Object.keys(group).sort()).toEqual(
        ['id', 'loyalty', 'patronage', 'satisfaction'].sort(),
      )
    }
  })

  it('caps topPressures at five entries', () => {
    const bundle = buildDebugBundle()
    expect(bundle.sim.topPressures.length).toBeLessThanOrEqual(5)
  })

  it('drops card-prose payloads from pendingBySeedId, keeping only kind/slotId/verb', () => {
    gameStore.pendingBySeedId = {
      'seed-x': {
        kind: 'choice',
        slotId: 'fix_root',
        verb: 'clean',
        choice: {
          // The choice object can carry card prose; the bundle should
          // strip it.
          slotId: 'fix_root',
          label: 'Clean the place up',
          verb: 'clean',
          shape: 'long_term_investment',
          previewEffects: ['+18 cleanliness'],
        },
      } as unknown as (typeof gameStore.pendingBySeedId)[string],
    }
    const bundle = buildDebugBundle()
    const entry = bundle.player.pendingBySeedId['seed-x']
    expect(entry).toBeDefined()
    if (entry && entry.kind === 'choice') {
      expect(Object.keys(entry).sort()).toEqual(
        ['kind', 'slotId', 'verb'].sort(),
      )
    } else {
      throw new Error('expected choice entry')
    }
  })
})
