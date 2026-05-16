import { describe, expect, it } from 'vitest'

import { derivePriorityModifiers } from '../../src/sim/modules/staff/priorityEffects'
import type { StaffState } from '../../src/sim/state/TavernState'

// Phase 78 — ISSUE-038: cook-tier skill modulates foodQualityModifier.
//
// Before this phase, derivePriorityModifiers only read each staff
// member's currentPriority + workStyle + stressResponse. A master_chef
// on `quality` priority and a kitchen_hand on `quality` priority
// produced the same daily foodQualityModifier, leaving the cook
// hierarchy half-wired: only the prep gate in `service/recipes.ts`
// differentiated tiers. Phase 78 layers a small skill bias on top of
// the priority contribution, routed through scaleByEffectiveness so
// morale/stress/fatigue still suppress it.

function cook(role: string, skill: number, overrides: Partial<StaffState> = {}): StaffState {
  return {
    id: `cook_${role}_${skill}`,
    name: {
      display: `Test ${role}`,
      profileId: 'goblin_common',
      parts: { given: 'Test', family: role },
      patternId: 'given_family',
      generatedBy: 'phase78_test',
    },
    role,
    currentPriority: 'quality',
    skill,
    morale: 50,
    stress: 25,
    fatigue: 20,
    loyalty: 50,
    wage: 10,
    paidThisWeek: true,
    tags: [],
    activeFlags: [],
    ...overrides,
  }
}

function server(skill: number, overrides: Partial<StaffState> = {}): StaffState {
  return {
    id: `server_${skill}`,
    name: {
      display: 'Test Server',
      profileId: 'goblin_common',
      parts: { given: 'Test', family: 'Server' },
      patternId: 'given_family',
      generatedBy: 'phase78_test',
    },
    role: 'server',
    currentPriority: 'maximize_sales',
    skill,
    morale: 50,
    stress: 25,
    fatigue: 20,
    loyalty: 50,
    wage: 10,
    paidThisWeek: true,
    tags: [],
    activeFlags: [],
    ...overrides,
  }
}

describe('Phase 78 / ISSUE-038 — cook tier modulates foodQualityModifier', () => {
  it('master_chef on quality yields a higher foodQualityModifier than kitchen_hand on quality', () => {
    const masterMods = derivePriorityModifiers([cook('master_chef', 85)])
    const handMods = derivePriorityModifiers([cook('kitchen_hand', 30)])
    expect(masterMods.foodQualityModifier).toBeGreaterThan(
      handMods.foodQualityModifier,
    )
  })

  it('cook-family roles produce a monotonic foodQualityModifier in skill', () => {
    const skills = [30, 45, 55, 62, 75, 85]
    const mods = skills.map(
      (s) => derivePriorityModifiers([cook('cook', s)]).foodQualityModifier,
    )
    for (let i = 1; i < mods.length; i += 1) {
      expect(mods[i]).toBeGreaterThanOrEqual(mods[i - 1]!)
    }
    // The full spread (30 → 85) is small but observable.
    expect(mods[mods.length - 1]! - mods[0]!).toBeGreaterThan(0.2)
  })

  it('non-cook roles are not affected by the cook skill bias', () => {
    // A non-cook role on `quality` priority shouldn't gain the cook
    // bias even if priority happens to overlap (it does not, since
    // priority allowedPriorities are role-gated).
    const cleaner: StaffState = {
      ...cook('cleaner_bouncer', 85),
      currentPriority: 'clean',
    }
    const dirty: StaffState = {
      ...cook('cleaner_bouncer', 30),
      currentPriority: 'clean',
    }
    const m1 = derivePriorityModifiers([cleaner])
    const m2 = derivePriorityModifiers([dirty])
    // Cleaner's messControl is the dominant signal; foodQualityModifier
    // stays untouched by the skill bias.
    expect(m1.foodQualityModifier).toBe(m2.foodQualityModifier)
  })

  it('server role gets a skill bias on serviceSpeed', () => {
    const fast = derivePriorityModifiers([server(85)])
    const slow = derivePriorityModifiers([server(30)])
    expect(fast.serviceSpeed).toBeGreaterThan(slow.serviceSpeed)
  })

  it('skill bias scales with effectiveness — a high-stress master is suppressed', () => {
    // High stress lowers effectiveness, so the master's skill bonus
    // gets dampened. The differential vs. a calm cook should narrow.
    const calmMaster = derivePriorityModifiers([cook('master_chef', 85)])
    const stressedMaster = derivePriorityModifiers([
      cook('master_chef', 85, { stress: 95, morale: 20, fatigue: 90 }),
    ])
    expect(calmMaster.foodQualityModifier).toBeGreaterThan(
      stressedMaster.foodQualityModifier,
    )
  })
})
