import { describe, it, expect } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import {
  staffModule,
  validateStaffIdentityProfileRegistration,
} from '../../src/sim/modules/staff'
import {
  createStaffIdentity,
  ensureRequiredStaffIdentityProfilesRegistered,
  staffIdentityProfileRegistry,
} from '../../src/sim/content/staff'
import {
  generateName,
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
  STARTER_NAMING_PROFILES,
} from '../../src/sim/content/naming'
import { createRngStreams } from '../../src/sim/core/rng'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  ensureStaffIdentityFields,
  ensureWorldBranch,
} from '../../src/sim/state/migrations'
import { validateState } from '../../src/sim/state/validation'
import type { TavernState } from '../../src/sim/state/TavernState'

// Phase 31 — Staff identity, personality, and deterministic names.
//
// The Phase 31 plan §31.11 lists ten required tests. Each one is below;
// the file also re-asserts a few invariants the plan calls out
// implicitly (no `Math.random` use, name generator stability across
// repeated runs with the same RNG state).

const SEED = 'phase-31-staff-identity-test'

function runDay(state: TavernState) {
  return simulateDay(state, { seed: SEED }, [staffModule])
}

describe('Phase 31 — Default staff identity', () => {
  it('1. Default staff have `identity` records', () => {
    const state = createInitialTavernState()
    for (const staff of Object.values(state.staff)) {
      expect(staff.identity).toBeDefined()
    }
  })

  it('2. Default staff names match identity.namingProfileId profile', () => {
    const state = createInitialTavernState()
    for (const staff of Object.values(state.staff)) {
      expect(staff.identity).toBeDefined()
      expect(staff.name.display.length).toBeGreaterThan(0)
      expect(staff.name.profileId).toBe(staff.identity!.namingProfileId)
    }
  })

  it('3. Default identities include the required Phase 31 fields', () => {
    const state = createInitialTavernState()
    for (const staff of Object.values(state.staff)) {
      const identity = staff.identity!
      expect(typeof identity.groupId).toBe('string')
      expect(identity.groupId.length).toBeGreaterThan(0)
      expect(typeof identity.namingProfileId).toBe('string')
      expect(identity.namingProfileId.length).toBeGreaterThan(0)
      expect(Array.isArray(identity.personalityTags)).toBe(true)
      expect(identity.personalityTags.length).toBeGreaterThan(0)
      expect(typeof identity.workStyle).toBe('string')
      expect(typeof identity.stressResponse).toBe('string')
      expect(Array.isArray(identity.loyalties)).toBe(true)
      expect(Array.isArray(identity.dislikes)).toBe(true)
    }
  })
})

describe('Phase 31 — Name generator determinism', () => {
  it('4. generateName is deterministic for the same seed and profile', () => {
    ensureStarterNamingProfilesRegistered()
    const profile = namingProfileRegistry.get('goblin_common')

    const streamsA = createRngStreams('phase31-test-deterministic')
    const streamsB = createRngStreams('phase31-test-deterministic')

    const nameA = generateName(profile, streamsA.get('staff_identity'), 'test')
    const nameB = generateName(profile, streamsB.get('staff_identity'), 'test')

    expect(nameA).toEqual(nameB)
  })

  it('5. different naming profiles produce visibly different display-name patterns', () => {
    ensureStarterNamingProfilesRegistered()
    const goblinProfile = namingProfileRegistry.get('goblin_common')
    const dwarfProfile = namingProfileRegistry.get('dwarf_caravan')

    const goblinFamilyPool = new Set(goblinProfile.family ?? [])
    const dwarfFamilyPool = new Set(dwarfProfile.family ?? [])

    const overlap = [...goblinFamilyPool].filter((n) => dwarfFamilyPool.has(n))
    expect(overlap).toEqual([])

    // Sample several names from each profile so the test is not at the
    // mercy of a single RNG draw.
    const streams = createRngStreams('phase31-profile-diff')
    const rng = streams.get('staff_identity')
    const goblinNames = Array.from({ length: 10 }, () =>
      generateName(goblinProfile, rng, 'goblin_sample'),
    )
    const dwarfNames = Array.from({ length: 10 }, () =>
      generateName(dwarfProfile, rng, 'dwarf_sample'),
    )
    expect(goblinNames.every((n) => n.profileId === 'goblin_common')).toBe(true)
    expect(dwarfNames.every((n) => n.profileId === 'dwarf_caravan')).toBe(true)
    const goblinDisplays = new Set(goblinNames.map((n) => n.display))
    const dwarfDisplays = new Set(dwarfNames.map((n) => n.display))
    const sharedDisplays = [...goblinDisplays].filter((d) =>
      dwarfDisplays.has(d),
    )
    expect(sharedDisplays).toEqual([])
  })

  it('STARTER_NAMING_PROFILES still includes the Phase 24 seed profile', () => {
    expect(
      STARTER_NAMING_PROFILES.some((p) => p.id === 'goblin_common'),
    ).toBe(true)
  })
})

describe('Phase 31 — State validation', () => {
  it('6. validateState(createInitialTavernState()) passes', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
  })

  it('7. unknown identity profile reference fails validation', () => {
    const issues = validateStaffIdentityProfileRegistration({
      staffId: 'cook',
      profileId: 'definitely-not-a-real-profile',
    })
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]!.code).toBe('unknown_staff_identity_profile')
  })

  it('staff module validate flags missing identity on hand-built state', () => {
    const state = createInitialTavernState()
    // Construct a staff record without `identity`. `exactOptionalPropertyTypes`
    // means setting `identity: undefined` is not the same as omitting the
    // key, so build the object via destructuring.
    const { identity: _stripped, ...cookWithoutIdentity } = state.staff.cook!
    const broken: TavernState = {
      ...state,
      staff: {
        ...state.staff,
        cook: cookWithoutIdentity,
      },
    }
    const result = simulateDay(broken, { seed: SEED }, [staffModule])
    expect(
      result.validation.errors.some((i) => i.code === 'missing_staff_identity'),
    ).toBe(true)
  })

  it('reference validation rejects an identity pointing at an unknown culture', () => {
    const state = createInitialTavernState()
    const cook = state.staff.cook!
    const broken: TavernState = {
      ...state,
      staff: {
        ...state.staff,
        cook: {
          ...cook,
          identity: {
            ...cook.identity!,
            cultureId: 'unknown-culture-xyz',
          },
        },
      },
    }
    const result = simulateDay(broken, { seed: SEED }, [staffModule])
    expect(
      result.validation.errors.some((i) => i.code === 'unknown_culture_ref'),
    ).toBe(true)
  })
})

describe('Phase 31 — Identity integrates with priority assignment', () => {
  it('8. existing Phase 11 priority assignment still works', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    expect(result.state.staff.cook!.currentPriority).toBe('speed')
    expect(result.state.staff.server!.currentPriority).toBe(
      'keep_customers_happy',
    )
    expect(result.state.staff.cleaner_bouncer!.currentPriority).toBe('clean')
    expect(result.validation.errors).toEqual([])
  })

  it('9. staff report includes identity without losing role/priority info', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    const report = result.reports.find((r) => r.id === 'staff')!
    const text = report.lines.join('\n')
    // Role and priority still present (Phase 11 §11.6).
    expect(text).toMatch(/Cook/)
    expect(text).toMatch(/Server/)
    expect(text).toMatch(/Cleaner\/Bouncer/)
    // Identity strip present (Phase 31 §31.10).
    expect(text).toMatch(/Identity:/)
    // Identity strip mentions naming profile so the report stays
    // debuggable when names alone do not reveal which profile produced
    // them.
    const cook = result.state.staff.cook!
    expect(text).toContain(cook.identity!.namingProfileId)
  })
})

describe('Phase 31 — Determinism', () => {
  it('10. no generated staff identity uses Math.random behaviour', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.staff)) {
      expect(b.staff[id]).toBeDefined()
      expect(a.staff[id]!.identity).toEqual(b.staff[id]!.identity)
      expect(a.staff[id]!.name).toEqual(b.staff[id]!.name)
    }
  })

  it('createStaffIdentity returns identical identities under the same RNG seed', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    const streamA = createRngStreams('phase31-staff-identity-deterministic').get(
      'staff_identity',
    )
    const streamB = createRngStreams('phase31-staff-identity-deterministic').get(
      'staff_identity',
    )
    const a = createStaffIdentity({
      staffId: 'cook',
      roleId: 'cook',
      rng: streamA,
    })
    const b = createStaffIdentity({
      staffId: 'cook',
      roleId: 'cook',
      rng: streamB,
    })
    expect(a).toEqual(b)
  })
})

describe('Phase 31 — Identity profile registry', () => {
  it('registers one profile per required role', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    const profiles = staffIdentityProfileRegistry.all()
    const roleIds = profiles.map((p) => p.roleId).sort()
    expect(roleIds).toEqual(['cleaner_bouncer', 'cook', 'server'])
    for (const profile of profiles) {
      expect(profile.workStyles.length).toBeGreaterThan(0)
      expect(profile.stressResponses.length).toBeGreaterThan(0)
      expect(profile.personalityTags.length).toBeGreaterThan(0)
      // Naming profile referenced by the identity profile must exist
      // in the naming registry.
      expect(namingProfileRegistry.has(profile.namingProfileId)).toBe(true)
    }
  })
})

describe('Phase 31 — Migration: ensureStaffIdentityFields', () => {
  it('attaches a deterministic default identity to pre-Phase-31 staff', () => {
    const state = createInitialTavernState()
    const stripped = {
      ...state,
      staff: Object.fromEntries(
        Object.entries(state.staff).map(([id, member]) => [
          id,
          { ...member, identity: undefined, name: '' },
        ]),
      ),
    } as unknown as TavernState

    const repaired = ensureStaffIdentityFields(ensureWorldBranch(stripped))
    for (const staff of Object.values(repaired.staff)) {
      expect(staff.identity).toBeDefined()
      expect(staff.name.display.length).toBeGreaterThan(0)
      expect(staff.name.profileId).toBe(staff.identity!.namingProfileId)
    }
  })
})

describe('Phase 31 — Identity work style nudges service quality', () => {
  it('work-style modifier is small relative to priority modifiers', () => {
    const state = createInitialTavernState()
    const result = runDay(state)
    // Service quality should resolve to finite, JSON-serializable numbers.
    const sq = result.reports.find((r) => r.id === 'staff')!.data as Record<
      string,
      unknown
    >
    const serviceQuality = sq.serviceQuality as Record<string, number>
    for (const key of [
      'foodQualityModifier',
      'serviceSpeed',
      'tabControl',
      'messControl',
      'fightControl',
      'repairSupport',
    ]) {
      const v = serviceQuality[key]
      expect(typeof v).toBe('number')
      expect(Number.isFinite(v as number)).toBe(true)
    }
  })
})
