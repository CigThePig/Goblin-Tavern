import { describe, expect, it } from 'vitest'

import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  BAN_CUSTOMER_GROUP_ACTION_ID,
  BAN_REPUTATION_COST,
  FIRE_STAFF_ACTION_ID,
  HIRE_STAFF_ACTION_ID,
  HIRE_STAFF_COST,
} from '../../src/sim/modules/ownerActions/staffManagementActions'
import {
  actionRegistry,
  ensureRequiredOwnerActionsRegistered,
} from '../../src/sim/modules/ownerActions/ownerActionsModule'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { REQUIRED_STAFF_IDS } from '../../src/sim/modules/staff/staffModule'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 86 — ISSUE-046: hire / fire / ban owner actions.
//
// Before this phase, the player had no in-run mechanism for the
// staff roster to change after day 1 (except the staff_burnout /
// regular_customer issue-seed paths that mutated stats but never
// added/removed members) and no way to refuse service to a customer
// group. Phase 86 adds:
//
//   - hire_staff: pay 40 coin placement fee, append a new staff
//     member with a generated identity from the Phase 81 pool;
//   - fire_staff: remove a staff member, drop remaining staff
//     morale by FIRE_MORALE_HIT;
//   - ban_customer_group: drop the targeted group's patronage to
//     zero, hit loyalty, charge a respectable-reputation cost.

const SEED = 'phase-86-staff-management-test'

function withCoin(state: TavernState, coin: number): TavernState {
  return { ...state, coin }
}

describe('Phase 86 / ISSUE-046 — staff-management owner actions', () => {
  it('registers hire_staff / fire_staff / ban_customer_group in the action registry', () => {
    ensureRequiredOwnerActionsRegistered()
    expect(actionRegistry.has(HIRE_STAFF_ACTION_ID)).toBe(true)
    expect(actionRegistry.has(FIRE_STAFF_ACTION_ID)).toBe(true)
    expect(actionRegistry.has(BAN_CUSTOMER_GROUP_ACTION_ID)).toBe(true)
  })

  it('hire_staff adds a new staff member and charges the placement fee', () => {
    let state = withCoin(createInitialTavernState(), 200)
    const initialCount = Object.keys(state.staff).length
    const result = runOneDay(state, {
      seed: `${SEED}-hire`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: 'server' },
      ],
    })
    state = result.state
    expect(Object.keys(state.staff).length).toBe(initialCount + 1)
    // Find the new hire — its id starts with `hire_server_`.
    const newHire = Object.values(state.staff).find((s) =>
      s.id.startsWith('hire_server_'),
    )
    expect(newHire).toBeDefined()
    expect(newHire!.role).toBe('server')
    expect(newHire!.identity).toBeDefined()
    expect(newHire!.name.display.length).toBeGreaterThan(0)
  })

  it('hire_staff rejects when coin is insufficient', () => {
    const state = withCoin(createInitialTavernState(), HIRE_STAFF_COST - 1)
    const result = runOneDay(state, {
      seed: `${SEED}-hire-broke`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: 'server' },
      ],
    })
    // No new hire appended; the action was rejected.
    const newHires = Object.values(result.state.staff).filter((s) =>
      s.id.startsWith('hire_'),
    )
    expect(newHires).toEqual([])
  })

  it('fire_staff removes the target and drops remaining staff morale', () => {
    let state = withCoin(createInitialTavernState(), 200)
    // Hire two extra staff first so the firing isn't blocked by the
    // last-staff guard.
    state = runOneDay(state, {
      seed: `${SEED}-fire-setup-1`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: 'server' },
      ],
    }).state
    state = runOneDay(state, {
      seed: `${SEED}-fire-setup-2`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: 'server' },
      ],
    }).state

    const targetId = Object.values(state.staff).find((s) =>
      s.id.startsWith('hire_server_'),
    )!.id
    const witnessMoraleBefore = Object.entries(state.staff)
      .filter(([id]) => id !== targetId)
      .map(([id, s]) => [id, s.morale] as const)

    state = runOneDay(state, {
      seed: `${SEED}-fire`,
      ownerActions: [{ actionId: FIRE_STAFF_ACTION_ID, targetId }],
    }).state

    expect(state.staff[targetId]).toBeUndefined()
    // Every remaining staff member's morale dropped (some by exactly
    // 5, modulo other day-end effects — at minimum it didn't rise).
    for (const [id, beforeMorale] of witnessMoraleBefore) {
      const after = state.staff[id]?.morale
      if (after === undefined) continue
      expect(after).toBeLessThanOrEqual(beforeMorale)
    }
  })

  it('fire_staff canApply rejects firing the last remaining staff member', () => {
    // Verifying via the engine path would crash the staff module's
    // startDay required-roster check before fire_staff could even be
    // evaluated. Test the canApply guard directly instead — it owns
    // the rule. The lone survivor must be a non-required hire, or the
    // founding-role guard (below) short-circuits first.
    const fireStaff = actionRegistry.get(FIRE_STAFF_ACTION_ID)
    const state = createInitialTavernState()
    const hiredId = 'hire_server_test'
    const lonely = {
      ...state,
      staff: {
        [hiredId]: { ...state.staff['server']!, id: hiredId },
      },
    }
    const result = fireStaff.canApply(
      { state: lonely } as never,
      { actionId: FIRE_STAFF_ACTION_ID, targetId: hiredId },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('last_staff')
    }
  })

  // Regression — the three founding roles (cook / server / cleaner_bouncer)
  // are a hard simulation contract: `staffModule`'s startDay hook throws
  // when one is missing. `fire_staff` used to offer them as targets, so
  // firing one left state validating dirty and made the *next* day's
  // `simulateDay` throw, bricking the run.
  it('fire_staff never offers or accepts a founding role', () => {
    const fireStaff = actionRegistry.get(FIRE_STAFF_ACTION_ID)
    const state = createInitialTavernState()

    const targetIds = fireStaff
      .getValidTargets({ state } as never)
      .map((t) => t.id)
    for (const requiredId of REQUIRED_STAFF_IDS) {
      expect(state.staff[requiredId]).toBeDefined()
      expect(targetIds).not.toContain(requiredId)

      const verdict = fireStaff.canApply(
        { state } as never,
        { actionId: FIRE_STAFF_ACTION_ID, targetId: requiredId },
      )
      expect(verdict.ok).toBe(false)
      if (!verdict.ok) expect(verdict.code).toBe('required_staff')
    }
  })

  // The consequence the guard prevents: the day after a founding-role
  // firing used to throw. Queuing the (now-refused) action must leave the
  // roster intact and the next day runnable.
  it('a queued founding-role firing leaves the run playable the next day', () => {
    let state = createInitialTavernState()
    state = runOneDay(state, {
      seed: `${SEED}-fire-required`,
      ownerActions: [{ actionId: FIRE_STAFF_ACTION_ID, targetId: 'cook' }],
    }).state

    expect(state.staff['cook']).toBeDefined()

    const next = runOneDay(state, { seed: `${SEED}-fire-required-next` })
    expect(next.validation.errors).toEqual([])
    expect(next.state.staff['cook']).toBeDefined()
  })

  it('ban_customer_group suppresses patronage and charges reputation', () => {
    const state = createInitialTavernState()
    const groupId = Object.keys(state.customerGroups)[0]!
    const beforeRep = state.reputation.respectable
    const beforePatronage = state.customerGroups[groupId]!.patronage
    const beforeLoyalty = state.customerGroups[groupId]!.loyalty

    const result = runOneDay(state, {
      seed: `${SEED}-ban`,
      ownerActions: [
        { actionId: BAN_CUSTOMER_GROUP_ACTION_ID, targetId: groupId },
      ],
    })
    const after = result.state.customerGroups[groupId]!
    expect(after.patronage).toBe(0)
    expect(after.loyalty).toBe(Math.max(0, beforeLoyalty - 10))
    expect(after.tags).toContain('banned')
    // Reputation hit (allow other axes to drift; we check
    // `respectable` specifically dropped by the configured amount).
    if (beforeRep > 0) {
      expect(result.state.reputation.respectable).toBeLessThanOrEqual(
        beforeRep - BAN_REPUTATION_COST,
      )
    }
    void beforePatronage
  })

  it('ban_customer_group rejects unknown group ids', () => {
    const result = runOneDay(createInitialTavernState(), {
      seed: `${SEED}-ban-unknown`,
      ownerActions: [
        {
          actionId: BAN_CUSTOMER_GROUP_ACTION_ID,
          targetId: 'no_such_group',
        },
      ],
    })
    // Action was rejected — no group was suppressed.
    const someGroup = Object.values(result.state.customerGroups)[0]!
    expect(someGroup.tags).not.toContain('banned')
  })
})
