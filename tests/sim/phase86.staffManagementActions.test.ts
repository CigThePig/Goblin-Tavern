import { describe, expect, it } from 'vitest'

import { runOneDay } from '../../src/sim/testing/simRunner'
import {
  BAN_CUSTOMER_GROUP_ACTION_ID,
  BAN_REPUTATION_COST,
} from '../../src/sim/modules/ownerActions/staffManagementActions'
import {
  FIRE_STAFF_ACTION_ID,
  HIRE_STAFF_ACTION_ID,
  HIRE_STAFF_COST,
} from '../../src/sim/modules/ownerActions/workforceActions'
import { listApplicants } from '../../src/sim/modules/staff/laborMarket'
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
//
// Expansion Phase 3 (ISSUE-173) rebuilt the two staff actions and the tests
// below follow them. Both keep their ids and their costs; what moved is what
// they target and what they leave behind:
//
//   * `hire_staff` targets an APPLICANT from the labor-market board rather than
//     a role id, because §3.1 requires hiring to be a decision about a person at
//     a negotiated wage rather than a purchase at a fixed price.
//   * `fire_staff` pays severance in lieu of notice and has NO founding-role
//     exemption. The two tests that pinned that exemption are inverted below:
//     plan §3.1 requires founding staff to stop being structurally immune to
//     separation, and the run staying playable afterwards is the property that
//     replaces the guard.

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

  // The applicant board is generated on the first `startDay`, so the id to hire
  // is not knowable before that day has run. Every hire test therefore runs one
  // day to populate the board and reads a real applicant off it, which is also
  // how a player reaches the action.
  function firstApplicantId(state: TavernState, seed: string): {
    state: TavernState
    applicantId: string
  } {
    const opened = runOneDay(state, { seed }).state
    const applicants = listApplicants(opened)
    expect(applicants.length).toBeGreaterThan(0)
    return { state: opened, applicantId: applicants[0]!.id }
  }

  it('hire_staff adds a new staff member and charges the placement fee', () => {
    const opened = firstApplicantId(
      withCoin(createInitialTavernState(), 200),
      `${SEED}-hire-open`,
    )
    const initialCount = Object.keys(opened.state.staff).length
    const applicant = listApplicants(opened.state)[0]!
    const result = runOneDay(withCoin(opened.state, 200), {
      seed: `${SEED}-hire`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: opened.applicantId },
      ],
    })
    const state = result.state
    expect(Object.keys(state.staff).length).toBe(initialCount + 1)
    const newHire = Object.values(state.staff).find((s) =>
      s.id.startsWith('hire_'),
    )
    expect(newHire).toBeDefined()
    expect(newHire!.role).toBe(applicant.roleId)
    expect(newHire!.identity).toBeDefined()
    expect(newHire!.name.display).toBe(applicant.name.display)
    // The applicant is off the board — one person, hired once.
    expect(
      listApplicants(state).some((a) => a.id === opened.applicantId),
    ).toBe(false)
  })

  it('hire_staff rejects when coin is insufficient', () => {
    const opened = firstApplicantId(
      withCoin(createInitialTavernState(), 200),
      `${SEED}-hire-broke-open`,
    )
    const result = runOneDay(withCoin(opened.state, HIRE_STAFF_COST - 1), {
      seed: `${SEED}-hire-broke`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: opened.applicantId },
      ],
    })
    const newHires = Object.values(result.state.staff).filter((s) =>
      s.id.startsWith('hire_'),
    )
    expect(newHires).toEqual([])
  })

  it('fire_staff removes the target and drops remaining staff morale', () => {
    let state = withCoin(createInitialTavernState(), 400)
    const opened = firstApplicantId(state, `${SEED}-fire-setup-open`)
    state = withCoin(opened.state, 400)
    state = runOneDay(state, {
      seed: `${SEED}-fire-setup-1`,
      ownerActions: [
        { actionId: HIRE_STAFF_ACTION_ID, targetId: opened.applicantId },
      ],
    }).state

    const targetId = Object.values(state.staff).find((s) =>
      s.id.startsWith('hire_'),
    )!.id
    const witnessMoraleBefore = Object.entries(state.staff)
      .filter(([id]) => id !== targetId)
      .map(([id, s]) => [id, s.morale] as const)

    state = runOneDay(withCoin(state, 400), {
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

  // Expansion Phase 3 §3.1 — the inverse of the Phase 86 guard.
  //
  // Phase 86 exempted the three founding roles from `fire_staff` because the
  // staff module's startDay hook THREW when one was missing, so firing one
  // bricked the run on the following day. That immunity is exactly what plan
  // §3.1 requires removing: it made the game's central staff promise
  // structurally impossible for the only three people it could be about. The
  // throw is gone, a missing role is a coverage gap with a cost, and every
  // founding staff member is now a legitimate target.
  it('fire_staff offers and accepts a founding role', () => {
    const fireStaff = actionRegistry.get(FIRE_STAFF_ACTION_ID)
    const state = withCoin(createInitialTavernState(), 400)

    const targetIds = fireStaff
      .getValidTargets({ state } as never)
      .map((t) => t.id)
    for (const requiredId of REQUIRED_STAFF_IDS) {
      expect(state.staff[requiredId]).toBeDefined()
      expect(targetIds).toContain(requiredId)

      const verdict = fireStaff.canApply(
        { state } as never,
        { actionId: FIRE_STAFF_ACTION_ID, targetId: requiredId },
      )
      expect(verdict.ok).toBe(true)
    }
  })

  // ...and the run survives it. This is the property that replaces the guard:
  // the tavern keeps trading short-handed rather than the engine throwing.
  it('firing a founding role leaves the run playable the next day', () => {
    let state = withCoin(createInitialTavernState(), 400)
    state = runOneDay(state, {
      seed: `${SEED}-fire-required`,
      ownerActions: [{ actionId: FIRE_STAFF_ACTION_ID, targetId: 'cook' }],
    }).state

    expect(state.staff['cook']).toBeUndefined()

    const next = runOneDay(state, { seed: `${SEED}-fire-required-next` })
    expect(next.validation.errors).toEqual([])
    expect(next.state.staff['cook']).toBeUndefined()
    // The cook's absence is now a reported coverage gap rather than a crash.
    const coverage = (
      next.state.modules['staff'] as {
        coverage?: Array<{ roleId: string; gap: number }>
      }
    ).coverage
    expect(coverage?.find((row) => row.roleId === 'cook')?.gap).toBeGreaterThan(0)
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
