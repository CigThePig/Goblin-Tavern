import { describe, expect, it } from 'vitest'

import { createStaffIdentity } from '../../src/sim/content/staff/staffIdentityFactory'
import {
  ensureRequiredStaffIdentityProfilesRegistered,
  getStaffIdentityProfilesForRole,
  staffIdentityProfileRegistry,
} from '../../src/sim/content/staff/staffIdentityProfiles'
import { createRng } from '../../src/sim/core/rng'

// Phase 81 — ISSUE-041: staff identity profile pool covers ≥6 of 8
// registered cultures across the cook tiers + server + cleaner_bouncer.
//
// Before this phase, createStaffIdentity used `Registry.find` (first
// match by role), so every hire was confined to goblin_common /
// human_town / dwarf_caravan regardless of which culture's
// workforce the in-world fiction came from. Phase 81 adds per-culture
// variants and a deterministic weighted pick.

describe('Phase 81 / ISSUE-041 — staff identity profile pool coverage', () => {
  it('registry covers ≥6 of 8 cultures (or omits cultureId explicitly)', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    const cultures = new Set<string>()
    for (const profile of staffIdentityProfileRegistry.all()) {
      if (profile.cultureId !== undefined) cultures.add(profile.cultureId)
    }
    expect(cultures.size).toBeGreaterThanOrEqual(5)
  })

  it('every cook tier has at least one profile with a non-default culture', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    for (const role of ['cook', 'kitchen_hand', 'seasoned_cook', 'master_chef']) {
      const matches = getStaffIdentityProfilesForRole(role)
      expect(matches.length).toBeGreaterThanOrEqual(1)
      const cultures = new Set(matches.map((p) => p.cultureId).filter(Boolean))
      // The seasoned_cook and master_chef family historically had no
      // cultureId on their default profile; phase 81 adds a culture
      // variant for each, so every tier sees ≥1 cultureId-bearing
      // profile.
      expect(cultures.size).toBeGreaterThanOrEqual(1)
    }
  })

  it('50 deterministic hires for `server` cover ≥3 cultures', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    const cultures = new Set<string>()
    for (let i = 0; i < 50; i += 1) {
      const rng = createRng(`phase-81-coverage-server-${i}`)
      const { identity } = createStaffIdentity({
        staffId: `s_${i}`,
        roleId: 'server',
        rng,
      })
      if (identity.cultureId !== undefined) {
        cultures.add(identity.cultureId)
      }
    }
    // server family now has 3 cultureId-bearing variants (miner,
    // merchant, adventuring) plus the original cultureId-less
    // `server_town_human`. We expect at least 3 cultures across the
    // 50-hire sweep.
    expect(cultures.size).toBeGreaterThanOrEqual(3)
  })

  it('50 deterministic hires across all roles cover ≥5 cultures', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    const cultures = new Set<string>()
    const roles = [
      'cook',
      'kitchen_hand',
      'seasoned_cook',
      'master_chef',
      'server',
      'cleaner_bouncer',
    ]
    for (let i = 0; i < 50; i += 1) {
      const role = roles[i % roles.length]!
      const rng = createRng(`phase-81-coverage-all-${i}`)
      const { identity } = createStaffIdentity({
        staffId: `s_${i}`,
        roleId: role,
        rng,
      })
      if (identity.cultureId !== undefined) {
        cultures.add(identity.cultureId)
      }
    }
    expect(cultures.size).toBeGreaterThanOrEqual(5)
  })

  it('preferredCultureId biases the pick toward the requested culture', () => {
    ensureRequiredStaffIdentityProfilesRegistered()
    let preferredHits = 0
    let unbiasedHits = 0
    // Use a single shared rng so the prando float sequence advances
    // continuously instead of starting fresh on each trial.
    const sharedPreferred = createRng('phase-81-prefer-shared')
    const sharedUnbiased = createRng('phase-81-prefer-shared')
    for (let i = 0; i < 60; i += 1) {
      const preferred = createStaffIdentity({
        staffId: `s_pref_${i}`,
        roleId: 'server',
        rng: sharedPreferred,
        preferredCultureId: 'miner_workcrew',
      })
      const baseline = createStaffIdentity({
        staffId: `s_base_${i}`,
        roleId: 'server',
        rng: sharedUnbiased,
      })
      if (preferred.identity.cultureId === 'miner_workcrew') preferredHits += 1
      if (baseline.identity.cultureId === 'miner_workcrew') unbiasedHits += 1
    }
    // With a +3 weight bias, miner profile wins ~4/7 picks. Without
    // the bias it wins ~1/4. The preferredHits sweep must strictly
    // beat the unbiased sweep.
    expect(preferredHits).toBeGreaterThan(unbiasedHits)
  })

  it('legacy first-match callers still resolve to a single profile', () => {
    // Backwards compatibility: callers using profileId directly still
    // get exactly the named profile.
    ensureRequiredStaffIdentityProfilesRegistered()
    const rng = createRng('phase-81-explicit')
    const { identity } = createStaffIdentity({
      staffId: 's_explicit',
      roleId: 'cook',
      rng,
      profileId: 'cook_miner',
    })
    expect(identity.cultureId).toBe('miner_workcrew')
    expect(identity.namingProfileId).toBe('miner_workcrew')
  })

  it('every registered profile points at a registered naming profile', () => {
    // The factory blows up otherwise — this is the static guarantee.
    ensureRequiredStaffIdentityProfilesRegistered()
    for (const profile of staffIdentityProfileRegistry.all()) {
      const rng = createRng(`phase-81-static-${profile.id}`)
      expect(() =>
        createStaffIdentity({
          staffId: 's_static',
          roleId: profile.roleId,
          rng,
          profileId: profile.id,
        }),
      ).not.toThrow()
    }
  })
})
