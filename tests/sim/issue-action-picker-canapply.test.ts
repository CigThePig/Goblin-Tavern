import { describe, expect, it } from 'vitest'

import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { withArea, withCoin } from '../../src/sim/testing/stateFactories'
import { actionDisabledReason } from '../../web/src/lib/sim/actionBuilder'

// ISSUE-048 — the owner-action picker (`web/src/lib/components/ActionPicker.svelte`)
// previously enabled any action whose budget fit and whose target list
// was non-empty. Actions like `patch_roof` with insufficient coin would
// appear pickable, then get silently dropped by `applyOwnerActions` in
// the engine. The new `actionDisabledReason` helper runs the same
// `canApply` validation the engine runs, so the picker can surface a
// reason and disable the row.

const FULL_BUDGET = 3

describe('ISSUE-048 — actionDisabledReason mirrors engine canApply', () => {
  it('patch_roof on damaged roof with no coin surfaces a coin-related reason', () => {
    const patchRoof = actionRegistry.get('patch_roof')
    expect(patchRoof).toBeDefined()

    // Roof must be damaged so the "nothing_to_patch" early-out doesn't
    // fire — we want to hit the coin check.
    const state = withCoin(
      withArea(createInitialTavernState(), 'roof', { damage: 50, condition: 60 }),
      0,
    )

    const reason = actionDisabledReason(patchRoof!, state, FULL_BUDGET)
    expect(reason).toBeDefined()
    expect(reason!.toLowerCase()).toContain('coin')
  })

  it('patch_roof on damaged roof with ample coin is selectable', () => {
    const patchRoof = actionRegistry.get('patch_roof')!
    const state = withCoin(
      withArea(createInitialTavernState(), 'roof', { damage: 50, condition: 60 }),
      500,
    )
    expect(actionDisabledReason(patchRoof, state, FULL_BUDGET)).toBeUndefined()
  })

  it('budget exhaustion wins over any canApply reason', () => {
    const patchRoof = actionRegistry.get('patch_roof')!
    // Even with a perfectly applicable state, zero budget short-circuits.
    const state = withCoin(
      withArea(createInitialTavernState(), 'roof', { damage: 50, condition: 60 }),
      500,
    )
    expect(actionDisabledReason(patchRoof, state, 0)).toBe('budget full')
  })

  it('no valid targets surfaces "no valid targets"', () => {
    const patchRoof = actionRegistry.get('patch_roof')!
    // Delete the roof area so patchRoof.getValidTargets returns [].
    const base = createInitialTavernState()
    const { roof, ...areasWithoutRoof } = base.areas
    void roof
    const state: typeof base = { ...base, areas: areasWithoutRoof }
    expect(actionDisabledReason(patchRoof, state, FULL_BUDGET)).toBe('no valid targets')
  })
})
