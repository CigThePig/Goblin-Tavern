// Phase 90 / ISSUE-050 — Cross-surface owner-action queue validity.
//
// The store-level `tryAddPick` cannot be unit-tested directly (it lives
// in a `.svelte.ts` file that requires Svelte preprocessing). Instead
// we test the pure gate that `tryAddPick` composes:
//   - `actionDisabledReasonForTarget` enforces budget + canApply +
//     target validity.
//   - The combination matches the central picker's contract.

import { describe, expect, it } from 'vitest'

import {
  actionDisabledReason,
  actionDisabledReasonForTarget,
} from '../../src/sim/modules/ownerActions/readonlyHelpers'
import { actionRegistry } from '../../src/sim/registries/actionRegistry'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { DAY_MINUTES } from '../../web/src/lib/sim/actionBuilder'

describe('Phase 90 — owner-action queue gate', () => {
  it('rejects the action when budget is already full', () => {
    const state = createInitialTavernState()
    const def = actionRegistry.get('restock_item')
    const reason = actionDisabledReasonForTarget(
      def,
      state,
      Object.keys(state.stock)[0],
      0, // no points left
    )
    expect(reason).toBe('budget full')
  })

  it('rejects targeted action with a dangling target id', () => {
    const state = createInitialTavernState()
    const def = actionRegistry.get('restock_item')
    const reason = actionDisabledReasonForTarget(
      def,
      state,
      'ghost_stock_item',
      DAY_MINUTES,
    )
    expect(reason).toBe('invalid target')
  })

  it('rejects targeted action with no target id', () => {
    const state = createInitialTavernState()
    const def = actionRegistry.get('restock_item')
    const reason = actionDisabledReasonForTarget(
      def,
      state,
      undefined,
      DAY_MINUTES,
    )
    expect(reason).toBe('no target')
  })

  it('accepts a valid (action, target) pair with budget remaining', () => {
    const state = createInitialTavernState()
    const def = actionRegistry.get('restock_item')
    const stockId = Object.keys(state.stock)[0]!
    const reason = actionDisabledReasonForTarget(
      def,
      state,
      stockId,
      DAY_MINUTES,
    )
    expect(reason).toBeUndefined()
  })

  it('global action disabled-reason matches the picker contract', () => {
    const state = createInitialTavernState()
    const def = actionRegistry
      .all()
      .find((d) => !d.targetType || d.targetType === 'global')
    expect(def).toBeDefined()
    if (!def) return
    // budget full
    expect(actionDisabledReason(def, state, 0)).toBe('budget full')
  })

  it('DAY_MINUTES is the canonical daily cap', () => {
    expect(DAY_MINUTES).toBeGreaterThan(0)
    expect(Number.isInteger(DAY_MINUTES)).toBe(true)
  })
})
