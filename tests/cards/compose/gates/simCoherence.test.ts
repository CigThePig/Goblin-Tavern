// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Sim-coherence gate (framework §6 #4): flavor slots may not invent
// facts; sim_backed slots must back claims with state-lookup conditions.

import { describe, expect, it } from 'vitest'

import { checkSimCoherence } from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { createInitialTavernState } from '../../../../src/sim/state/defaults'
import {
  backedHistoryClaimSlot,
  bannedNameSlot,
  buildTemplate,
  simBackedMissingLookupSlot,
  simBackedWithLookupSlot,
  unbackedHistoryClaimSlot,
  unbackedRoleClaimSlot,
} from './fixtures'
import { representativeBannedNames } from './samplers'

describe('sim-coherence gate — happy path', () => {
  it('the real drinkOrder template passes against a representative state', () => {
    const state = createInitialTavernState()
    const report = checkSimCoherence(drinkOrderTemplate, {
      bannedDisplayNames: representativeBannedNames(state),
    })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })
})

describe('sim-coherence gate — flavor failures', () => {
  it('a flavor snippet containing a banned display name fails with banned_display_name', () => {
    const planted = 'Krenn'
    const bad = buildTemplate('bad_banned_name', [bannedNameSlot(planted)])
    const report = checkSimCoherence(bad, {
      bannedDisplayNames: [planted],
    })
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.snippetId).toBe('plants_name')
    expect(report.violations[0]!.reason).toBe('banned_display_name')
    expect(report.violations[0]!.detail).toContain(planted)
  })

  it('a flavor snippet with "twice now" but no memoryPresent / repeatCount fails with unbacked_history_claim', () => {
    const bad = buildTemplate('bad_unbacked_history', [unbackedHistoryClaimSlot()])
    const report = checkSimCoherence(bad, { bannedDisplayNames: [] })
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.snippetId).toBe('unbacked_history')
    expect(report.violations[0]!.reason).toBe('unbacked_history_claim')
  })

  it('the same history text WITH a memoryPresent condition passes', () => {
    const good = buildTemplate('good_backed_history', [backedHistoryClaimSlot()])
    const report = checkSimCoherence(good, { bannedDisplayNames: [] })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('a flavor snippet with "your cook" but no hasNamedEntity fails with unbacked_role_claim', () => {
    const bad = buildTemplate('bad_unbacked_role', [unbackedRoleClaimSlot()])
    const report = checkSimCoherence(bad, { bannedDisplayNames: [] })
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.snippetId).toBe('unbacked_role')
    expect(report.violations[0]!.reason).toBe('unbacked_role_claim')
  })
})

describe('sim-coherence gate — sim_backed mode', () => {
  it('a sim_backed slot with a voice-only non-fallback snippet fails with sim_backed_missing_lookup', () => {
    const bad = buildTemplate('bad_sim_backed', [simBackedMissingLookupSlot()])
    const report = checkSimCoherence(bad, { bannedDisplayNames: [] })
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.snippetId).toBe('voice_only_on_sim_backed')
    expect(report.violations[0]!.reason).toBe('sim_backed_missing_lookup')
  })

  it('the unconditional fallback on a sim_backed slot is exempt from the lookup rule', () => {
    // simBackedMissingLookupSlot ships with a `conditions: []` snippet
    // alongside the bad one — that snippet must NOT contribute a
    // violation. The single violation must be the conditioned snippet.
    const bad = buildTemplate('bad_sim_backed_exempt_fallback', [
      simBackedMissingLookupSlot(),
    ])
    const report = checkSimCoherence(bad, { bannedDisplayNames: [] })
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.snippetId).toBe('voice_only_on_sim_backed')
  })

  it('a sim_backed slot with a memoryPresent-backed non-fallback snippet passes', () => {
    const good = buildTemplate('good_sim_backed', [simBackedWithLookupSlot()])
    const report = checkSimCoherence(good, { bannedDisplayNames: [] })
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })
})
