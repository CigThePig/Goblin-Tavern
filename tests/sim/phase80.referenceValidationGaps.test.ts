import { describe, it, expect } from 'vitest'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateWorldReferences } from '../../src/sim/state/referenceValidation'
import type {
  Expedition,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 80 — ISSUE-040: two dangling-reference shapes that produced
// silent null lookups at runtime instead of validation failures.
//
//   - staff.identity.cultureId was not checked against world.cultures;
//     a staff member could carry a dangling culture pointer for life.
//   - hireableAdventurer.currentExpeditionId was not reverse-checked
//     against expeditions.active; a double-resolve or save-game with
//     mismatched data would strand the runner.

function withStaffCulture(
  state: TavernState,
  staffId: string,
  cultureId: string,
): TavernState {
  const staff = state.staff[staffId]
  if (!staff) throw new Error(`test fixture: staff ${staffId} missing`)
  const baseIdentity = staff.identity ?? {
    groupId: 'kitchen_goblin',
    namingProfileId: 'goblin_common',
    workStyle: 'steady' as const,
    stressResponse: 'overworks' as const,
    personalityTags: [] as string[],
    loyalties: [] as string[],
    dislikes: [] as string[],
  }
  return {
    ...state,
    staff: {
      ...state.staff,
      [staffId]: {
        ...staff,
        identity: { ...baseIdentity, cultureId },
      },
    },
  }
}

function withDanglingExpedition(
  state: TavernState,
  adventurerId: string,
  expeditionId: string,
): TavernState {
  return {
    ...state,
    world: {
      ...state.world,
      hireableAdventurers: {
        ...state.world.hireableAdventurers,
        [adventurerId]: {
          ...state.world.hireableAdventurers[adventurerId]!,
          currentExpeditionId: expeditionId,
        },
      },
    },
  }
}

describe('Phase 80 / ISSUE-040 — reference validation gaps', () => {
  it('staff identity culture pointer is validated against world.cultures', () => {
    const base = createInitialTavernState()
    // Pick the first registered staff member.
    const staffId = Object.keys(base.staff)[0]!
    const bad = withStaffCulture(base, staffId, 'not_a_real_culture')
    const issues = validateWorldReferences(bad)
    const cultureIssue = issues.find(
      (i) =>
        i.path === `staff.${staffId}.identity.cultureId` &&
        i.code === 'unknown_culture_ref',
    )
    expect(cultureIssue).toBeDefined()
    expect(cultureIssue!.message).toMatch(/not_a_real_culture/)
  })

  it('a valid staff identity culture passes validation', () => {
    const base = createInitialTavernState()
    const staffId = Object.keys(base.staff)[0]!
    // Use a culture the initial state actually carries.
    const realCultureId = Object.keys(base.world.cultures)[0]!
    const good = withStaffCulture(base, staffId, realCultureId)
    const issues = validateWorldReferences(good)
    const stillDangling = issues.find((i) =>
      i.path.startsWith(`staff.${staffId}.identity.cultureId`),
    )
    expect(stillDangling).toBeUndefined()
  })

  it('adventurer currentExpeditionId is reverse-checked against expeditions.active', () => {
    const base = createInitialTavernState()
    const advId = Object.keys(base.world.hireableAdventurers)[0]!
    // Adventurer claims to be on expedition 'exp_999' but
    // expeditions.active is empty — the reverse edge must flag.
    const bad = withDanglingExpedition(base, advId, 'exp_999')
    const issues = validateWorldReferences(bad)
    const danglingIssue = issues.find(
      (i) =>
        i.path === `world.hireableAdventurers.${advId}.currentExpeditionId` &&
        i.code === 'dangling_expedition_ref',
    )
    expect(danglingIssue).toBeDefined()
    expect(danglingIssue!.message).toMatch(/exp_999/)
  })

  it('a consistent runner ↔ active expedition pair passes validation', () => {
    const base = createInitialTavernState()
    const advId = Object.keys(base.world.hireableAdventurers)[0]!
    const expedition: Expedition = {
      id: 'exp_consistent',
      runnerId: advId,
      mode: 'open',
      targetTier: 'uncommon',
      targetIngredientId: null,
      daysTotal: 3,
      daysElapsed: 0,
      costPaid: 15,
      startedDay: 1,
      status: 'in_progress',
      seed: 'phase80-test',
    }
    const consistent: TavernState = {
      ...base,
      expeditions: {
        ...base.expeditions,
        active: [...base.expeditions.active, expedition],
      },
      world: {
        ...base.world,
        hireableAdventurers: {
          ...base.world.hireableAdventurers,
          [advId]: {
            ...base.world.hireableAdventurers[advId]!,
            currentExpeditionId: expedition.id,
          },
        },
      },
    }
    const issues = validateWorldReferences(consistent)
    const danglingIssue = issues.find((i) =>
      i.path.startsWith(`world.hireableAdventurers.${advId}.currentExpeditionId`),
    )
    expect(danglingIssue).toBeUndefined()
  })

  it('the default tavern state has no new dangling references', () => {
    // Regression guard: the new checks should not fire on the
    // canonical starter state — staff identity cultureIds and
    // adventurer currentExpeditionIds are consistent by construction.
    const base = createInitialTavernState()
    const issues = validateWorldReferences(base)
    const newIssues = issues.filter(
      (i) =>
        i.code === 'unknown_culture_ref' &&
        i.path.startsWith('staff.') &&
        i.path.endsWith('.identity.cultureId'),
    )
    expect(newIssues).toEqual([])
    const danglingIssues = issues.filter(
      (i) => i.code === 'dangling_expedition_ref',
    )
    expect(danglingIssues).toEqual([])
  })
})
