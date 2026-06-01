// Phase 117 / ISSUE-078 — Tests for `listPolicyToggleRows`.
//
// The picker no longer surfaces 14 enable/disable action rows. It
// surfaces 7 toggle rows, each resolving to the correct action id
// based on current state. The helper also flags pending conflicts
// when the conflicting policy's enable is queued.

import { describe, expect, it } from 'vitest'

import {
  DAY_MINUTES,
  listPolicyToggleRows,
} from '../../web/src/lib/sim/actionBuilder'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { POLICY_STARTERS } from '../../src/sim/modules/ownerActions/policyActions'

describe('listPolicyToggleRows', () => {
  it('returns one row per starter policy (no enable/disable pairs)', () => {
    const state = createInitialTavernState()
    const rows = listPolicyToggleRows({ state, pointsLeft: DAY_MINUTES, picks: [] })
    expect(rows).toHaveLength(POLICY_STARTERS.length)
    // No row's actionId duplicates another's policy.
    const policyIds = new Set(rows.map((r) => r.policyId))
    expect(policyIds.size).toBe(rows.length)
  })

  it('each row uses the registry label, never the raw policyType id', () => {
    const state = createInitialTavernState()
    const rows = listPolicyToggleRows({ state, pointsLeft: DAY_MINUTES, picks: [] })
    for (const row of rows) {
      expect(row.label).not.toContain('_')
      const starter = POLICY_STARTERS.find((p) => p.id === row.policyId)
      expect(row.label).toBe(starter?.label)
    }
  })

  it('action id resolves to disable_X when the policy is enabled', () => {
    const state = createInitialTavernState()
    // Enable one policy directly in state for the test.
    const ownerActionsSlice = state.modules['ownerActions'] as
      | { policies: Record<string, unknown> }
      | undefined
    if (ownerActionsSlice) {
      ownerActionsSlice.policies['ban_weapons_inside'] = {
        id: 'ban_weapons_inside',
        policyType: 'ban_weapons_inside',
        label: 'Ban Weapons Inside',
        enabled: true,
        startedAtDay: 0,
        tags: [],
        effects: [],
      }
    }
    const rows = listPolicyToggleRows({ state, pointsLeft: DAY_MINUTES, picks: [] })
    const banRow = rows.find((r) => r.policyId === 'ban_weapons_inside')
    expect(banRow?.enabled).toBe(true)
    expect(banRow?.actionId).toBe('disable_ban_weapons_inside')
  })

  it('action id resolves to enable_X when the policy is disabled', () => {
    const state = createInitialTavernState()
    const rows = listPolicyToggleRows({ state, pointsLeft: DAY_MINUTES, picks: [] })
    const tabsRow = rows.find((r) => r.policyId === 'allow_tabs_for_regulars')
    expect(tabsRow?.enabled).toBe(false)
    expect(tabsRow?.actionId).toBe('enable_allow_tabs_for_regulars')
  })

  it('disables the row when budget is exhausted', () => {
    const state = createInitialTavernState()
    const rows = listPolicyToggleRows({ state, pointsLeft: 0, picks: [] })
    for (const row of rows) {
      expect(row.disabledReason).toBeDefined()
    }
  })

  it('does not disable a row that is already queued (so tap can cancel it)', () => {
    const state = createInitialTavernState()
    const queuedPick = {
      pickId: 'p1',
      actionId: 'enable_allow_tabs_for_regulars',
      label: 'Turn on Allow Tabs for Regulars',
      category: 'policy' as const,
      targetType: 'policy' as const,
      targetId: 'allow_tabs_for_regulars',
      timeCost: 1,
    }
    const rows = listPolicyToggleRows({
      state,
      pointsLeft: 0,
      picks: [queuedPick],
    })
    const tabsRow = rows.find((r) => r.policyId === 'allow_tabs_for_regulars')
    expect(tabsRow?.queued).toBe(true)
    expect(tabsRow?.disabledReason).toBeUndefined()
  })

  it('surfaces conflictNote when the conflicting policy enable is queued', () => {
    const state = createInitialTavernState()
    const queuedPick = {
      pickId: 'p1',
      actionId: 'enable_refuse_tabs',
      label: 'Turn on Refuse Tabs',
      category: 'policy' as const,
      targetType: 'policy' as const,
      targetId: 'refuse_tabs',
      timeCost: 1,
    }
    const rows = listPolicyToggleRows({
      state,
      pointsLeft: DAY_MINUTES,
      picks: [queuedPick],
    })
    const tabsRow = rows.find((r) => r.policyId === 'allow_tabs_for_regulars')
    expect(tabsRow?.conflictNote).toBeDefined()
    expect(tabsRow?.conflictNote).toContain('Refuse Tabs')
  })
})
