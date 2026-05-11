import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  canStaffWork,
  derivePriorityModifiers,
  getAllowedPrioritiesForRole,
  getDefaultPriorityForRole,
  getStaffEffectiveness,
  getStaffFatiguePenalty,
  getStaffModuleState,
  getStaffMoraleBonus,
  getStaffStressPenalty,
  isPriorityAllowedForRole,
  staffModule,
  staffPriorityRegistry,
  staffRegistry,
  summarizeStaff,
} from '../../src/sim/modules/staff'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { withStaff } from '../../src/sim/testing/stateFactories'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 11 — Staff system.
//
// These tests cover the ten cases in `phases-11-15.md` §11 "Tests"
// plus a few structural assertions that mirror the Phase 8/9/10
// precedents.

const SEED = 'phase-11-staff-test'

function input(staffPriorities?: Record<string, string>) {
  if (staffPriorities) {
    return { seed: SEED, staffPriorities }
  }
  return { seed: SEED }
}

function runDay(state: TavernState, staffPriorities?: Record<string, string>) {
  return simulateDay(state, input(staffPriorities), [staffModule])
}

describe('Phase 11 — Staff registry & priority registry', () => {
  it('default staff exist after createInitialTavernState', () => {
    const state = createInitialTavernState()
    expect(Object.keys(state.staff).sort()).toEqual(
      ['cleaner_bouncer', 'cook', 'server'].sort(),
    )
    for (const id of ['cook', 'server', 'cleaner_bouncer']) {
      const member = state.staff[id]
      expect(member).toBeDefined()
      expect(typeof member!.name).toBe('string')
      expect(member!.paidThisWeek).toBe(true)
      expect(Array.isArray(member!.activeFlags)).toBe(true)
      expect(Array.isArray(member!.tags)).toBe(true)
    }
    expect(() => validateState(state)).not.toThrow()
  })

  it('staff roles have allowed priorities', () => {
    for (const role of ['cook', 'server', 'cleaner_bouncer']) {
      const allowed = getAllowedPrioritiesForRole(role)
      expect(allowed.length).toBeGreaterThan(0)
      for (const id of allowed) {
        expect(staffPriorityRegistry.has(id)).toBe(true)
        expect(staffPriorityRegistry.get(id).roleId).toBe(role)
      }
    }
  })

  it('priority not allowed for role fails the cross-validation helper', () => {
    expect(isPriorityAllowedForRole('cook', 'speed')).toBe(true)
    expect(isPriorityAllowedForRole('cook', 'watch_tabs')).toBe(false)
    expect(isPriorityAllowedForRole('server', 'watch_tabs')).toBe(true)
    expect(isPriorityAllowedForRole('server', 'clean')).toBe(false)
    expect(isPriorityAllowedForRole('cleaner_bouncer', 'clean')).toBe(true)
    expect(isPriorityAllowedForRole('cleaner_bouncer', 'quality')).toBe(false)
  })

  it('staffRegistry exposes role default priority', () => {
    expect(getDefaultPriorityForRole('cook')).toBe('speed')
    expect(getDefaultPriorityForRole('server')).toBe('keep_customers_happy')
    expect(getDefaultPriorityForRole('cleaner_bouncer')).toBe('clean')
  })
})

describe('Phase 11 — Staff performance helpers (§11.4)', () => {
  it('effectiveness drops sharply with high fatigue', () => {
    const base = createInitialTavernState()
    const rested = base.staff.cook!
    const exhausted = { ...rested, fatigue: 100 }
    expect(getStaffEffectiveness(exhausted)).toBeLessThan(
      getStaffEffectiveness(rested),
    )
  })

  it('effectiveness drops with high stress', () => {
    const base = createInitialTavernState()
    const calm = base.staff.cook!
    const stressed = { ...calm, stress: 100 }
    expect(getStaffEffectiveness(stressed)).toBeLessThan(
      getStaffEffectiveness(calm),
    )
  })

  it('morale improves effectiveness', () => {
    const base = createInitialTavernState()
    const sad = base.staff.cook!
    const happy = { ...sad, morale: 100 }
    expect(getStaffEffectiveness(happy)).toBeGreaterThan(
      getStaffEffectiveness(sad),
    )
  })

  it('penalty/bonus helpers track the underlying meters', () => {
    const base = createInitialTavernState()
    const cook = base.staff.cook!
    expect(getStaffStressPenalty(cook)).toBe(Math.round(cook.stress * 0.25))
    expect(getStaffFatiguePenalty(cook)).toBe(Math.round(cook.fatigue * 0.25))
    expect(getStaffMoraleBonus(cook)).toBe(Math.round(cook.morale * 0.2))
  })

  it('canStaffWork returns false when unavailable is set', () => {
    const base = createInitialTavernState()
    const cook = base.staff.cook!
    expect(canStaffWork(cook)).toBe(true)
    expect(canStaffWork({ ...cook, unavailable: true })).toBe(false)
  })

  it('unavailable staff have zero effectiveness', () => {
    const base = createInitialTavernState()
    const cook = base.staff.cook!
    expect(getStaffEffectiveness({ ...cook, unavailable: true })).toBe(0)
  })

  it('effectiveness is clamped to 0–100', () => {
    const base = createInitialTavernState()
    const extreme = { ...base.staff.cook!, skill: 100, morale: 100, stress: 0, fatigue: 0 }
    expect(getStaffEffectiveness(extreme)).toBeLessThanOrEqual(100)
    expect(getStaffEffectiveness(extreme)).toBeGreaterThanOrEqual(0)
    const broken = { ...base.staff.cook!, skill: 0, morale: 0, stress: 100, fatigue: 100 }
    expect(getStaffEffectiveness(broken)).toBeGreaterThanOrEqual(0)
  })
})

describe('Phase 11 — Priority assignment via SimInput (§11.3)', () => {
  it('default priority is filled in when no input is provided', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    const applied = getStaffModuleState(result.state).appliedPriorities
    expect(applied.cook).toBe('speed')
    expect(applied.server).toBe('keep_customers_happy')
    expect(applied.cleaner_bouncer).toBe('clean')
    expect(result.state.staff.cook!.currentPriority).toBe('speed')
    expect(result.state.staff.server!.currentPriority).toBe(
      'keep_customers_happy',
    )
    expect(result.state.staff.cleaner_bouncer!.currentPriority).toBe('clean')
  })

  it('a valid assignment is applied and recorded', () => {
    const state = createInitialTavernState()
    const result = runDay(state, {
      cook: 'quality',
      server: 'watch_tabs',
      cleaner_bouncer: 'prevent_fights',
    })
    const applied = getStaffModuleState(result.state).appliedPriorities
    expect(applied.cook).toBe('quality')
    expect(applied.server).toBe('watch_tabs')
    expect(applied.cleaner_bouncer).toBe('prevent_fights')
    expect(result.state.staff.cook!.currentPriority).toBe('quality')
  })

  it('invalid priority for role is rejected and falls back to default', () => {
    const state = createInitialTavernState()
    const result = runDay(state, { cook: 'watch_tabs' })
    const moduleState = getStaffModuleState(result.state)
    expect(moduleState.appliedPriorities.cook).toBe('speed')
    expect(moduleState.rejectedAssignments).toContainEqual({
      staffId: 'cook',
      priorityId: 'watch_tabs',
      reason: 'priority_not_allowed_for_role',
    })
  })

  it('unknown priority id is rejected', () => {
    const state = createInitialTavernState()
    const result = runDay(state, { cook: 'nonsense' })
    const moduleState = getStaffModuleState(result.state)
    expect(moduleState.rejectedAssignments).toContainEqual({
      staffId: 'cook',
      priorityId: 'nonsense',
      reason: 'unknown_priority',
    })
  })

  it('unknown staff id is rejected', () => {
    const state = createInitialTavernState()
    const result = runDay(state, { bookkeeper: 'speed' })
    const moduleState = getStaffModuleState(result.state)
    expect(moduleState.rejectedAssignments).toContainEqual({
      staffId: 'bookkeeper',
      priorityId: 'speed',
      reason: 'unknown_staff',
    })
  })

  it('staff module validate flags a currentPriority that is wrong for the role', () => {
    // The `assignStaffPriorities` hook auto-repairs bad assignments by
    // falling back to the role default, so this case is tested by calling
    // the staff module's validate hook directly with a hand-built context.
    const base = createInitialTavernState()
    const broken = withStaff(base, 'cook', { currentPriority: 'watch_tabs' })
    const issues = staffModule.validate!({ state: broken } as never)
    expect(
      issues.some((i) => i.code === 'staff_priority_role_mismatch'),
    ).toBe(true)
  })
})

describe('Phase 11 — Priority effects via service-quality plumbing (§11.5)', () => {
  it('cook quality priority improves food-quality modifier', () => {
    const state = createInitialTavernState()
    const quality = runDay(state, { cook: 'quality' })
    const speed = runDay(state, { cook: 'speed' })
    const qualityMod = getStaffModuleState(quality.state).serviceQuality
      .foodQualityModifier
    const speedMod = getStaffModuleState(speed.state).serviceQuality
      .foodQualityModifier
    expect(qualityMod).toBeGreaterThan(speedMod)
  })

  it('server watch_tabs priority increases tab control', () => {
    const state = createInitialTavernState()
    const watching = runDay(state, { server: 'watch_tabs' })
    const selling = runDay(state, { server: 'maximize_sales' })
    const watchingTab = getStaffModuleState(watching.state).serviceQuality
      .tabControl
    const sellingTab = getStaffModuleState(selling.state).serviceQuality
      .tabControl
    expect(watchingTab).toBeGreaterThan(sellingTab)
  })

  it('cleaner_bouncer prevent_fights raises fight control', () => {
    const state = createInitialTavernState()
    const guarding = runDay(state, { cleaner_bouncer: 'prevent_fights' })
    const cleaning = runDay(state, { cleaner_bouncer: 'clean' })
    const guardingFight = getStaffModuleState(guarding.state).serviceQuality
      .fightControl
    const cleaningFight = getStaffModuleState(cleaning.state).serviceQuality
      .fightControl
    expect(guardingFight).toBeGreaterThan(cleaningFight)
  })

  it('derivePriorityModifiers handles staff with no current priority', () => {
    const state = createInitialTavernState()
    const result = derivePriorityModifiers(Object.values(state.staff))
    expect(result.foodQualityModifier).toBe(0)
    expect(result.serviceSpeed).toBe(0)
    expect(result.staffSummaries.length).toBe(3)
  })

  it('summarizeStaff exposes role, priority, and effectiveness', () => {
    const state = createInitialTavernState()
    const cook = { ...state.staff.cook!, currentPriority: 'quality' }
    const summary = summarizeStaff(cook)
    expect(summary.roleId).toBe('cook')
    expect(summary.priorityId).toBe('quality')
    expect(summary.effectiveness).toBe(getStaffEffectiveness(cook))
    expect(summary.canWork).toBe(true)
  })
})

describe('Phase 11 — Daily passive recovery & state validation', () => {
  it('startDay applies modest stress/fatigue recovery', () => {
    const base = createInitialTavernState()
    const tired = withStaff(base, 'cook', { stress: 80, fatigue: 80 })
    const result = runDay(tired)
    expect(result.state.staff.cook!.stress).toBeLessThan(80)
    expect(result.state.staff.cook!.fatigue).toBeLessThan(80)
  })

  it('staff stress and fatigue stay within 0–100 across many days', () => {
    let state = createInitialTavernState()
    state = withStaff(state, 'cook', { stress: 0, fatigue: 0 })
    for (let i = 0; i < 30; i += 1) {
      state = runDay(state).state
    }
    expect(state.staff.cook!.stress).toBeGreaterThanOrEqual(0)
    expect(state.staff.cook!.fatigue).toBeGreaterThanOrEqual(0)
  })

  it('state validates after simulateDay with staff module', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    expect(result.validation.errors).toEqual([])
  })

  it('validate surfaces an unknown role id', () => {
    const base = createInitialTavernState()
    const broken: TavernState = {
      ...base,
      staff: {
        ...base.staff,
        cook: { ...base.staff.cook!, role: 'flim_flam_artist' },
      },
    }
    const result = simulateDay(broken, input(), [staffModule])
    expect(
      result.validation.errors.some((i) => i.code === 'unknown_staff_role'),
    ).toBe(true)
  })
})

describe('Phase 11 — Staff report (§11.6)', () => {
  it('staff report includes name, role, priority, and effectiveness', () => {
    const state = createInitialTavernState()
    const result = runDay(state, { cook: 'quality' })
    const report = result.reports.find((r) => r.id === 'staff')
    expect(report).toBeDefined()
    const text = report!.lines.join('\n')
    expect(text).toMatch(/Gribna/)
    expect(text).toMatch(/Cook/)
    expect(text).toMatch(/Quality/)
    expect(text).toMatch(/Effectiveness:/)
    expect(text).toMatch(/Skill:/)
    expect(text).toMatch(/Morale:/)
    expect(text).toMatch(/Stress:/)
    expect(text).toMatch(/Fatigue:/)
  })

  it('staff report surfaces rejected assignments', () => {
    const state = createInitialTavernState()
    const result = runDay(state, { cook: 'watch_tabs' })
    const report = result.reports.find((r) => r.id === 'staff')
    const text = report!.lines.join('\n')
    expect(text).toMatch(/Rejected priority assignments/)
    expect(text).toMatch(/watch_tabs/)
  })

  it('staff report includes service-quality modifiers', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    const report = result.reports.find((r) => r.id === 'staff')
    const text = report!.lines.join('\n')
    expect(text).toMatch(/Service Quality Modifiers/)
    expect(text).toMatch(/Food quality/)
    expect(text).toMatch(/Service speed/)
    expect(text).toMatch(/Tab control/)
    expect(text).toMatch(/Mess control/)
    expect(text).toMatch(/Fight control/)
    expect(text).toMatch(/Repair support/)
  })
})

describe('Phase 11 — Module shape', () => {
  it('staffModule registers the canonical id, hooks, schema, report, and validator', () => {
    expect(staffModule.id).toBe('staff')
    expect(staffModule.version).toBeTypeOf('string')
    expect(staffModule.hooks?.startDay).toBeDefined()
    expect(staffModule.hooks?.assignStaffPriorities).toBeDefined()
    expect(staffModule.hooks?.beforeService).toBeDefined()
    expect(staffModule.buildReport).toBeTypeOf('function')
    expect(staffModule.validate).toBeTypeOf('function')
    expect(staffModule.stateSchema).toBeDefined()
  })

  it('staffRegistry has the three required role definitions with full default state', () => {
    const ids = staffRegistry.all().map((r) => r.id).sort()
    expect(ids).toEqual(['cleaner_bouncer', 'cook', 'server'].sort())
    for (const def of staffRegistry.all()) {
      expect(def.allowedPriorities.length).toBeGreaterThan(0)
      expect(def.defaultPriority).toBeTruthy()
      expect(def.allowedPriorities).toContain(def.defaultPriority)
      expect(def.defaultState.skill).toBeGreaterThanOrEqual(0)
      expect(def.defaultState.skill).toBeLessThanOrEqual(100)
    }
  })

  it('StaffState has the Phase 11 fields: currentPriority, paidThisWeek, activeFlags', () => {
    const state = createInitialTavernState()
    const cook = state.staff.cook!
    expect(cook.paidThisWeek).toBe(true)
    expect(cook.activeFlags).toEqual([])
    // currentPriority is initially undefined until the day runs.
    expect(cook.currentPriority).toBeUndefined()
  })
})
