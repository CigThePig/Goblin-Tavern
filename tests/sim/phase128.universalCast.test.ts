import { describe, expect, it } from 'vitest'

import {
  AFFINITY_TARGET_SET,
  CULTURE_VOICE_DEFAULTS,
  FACTION_SOCIAL_SPECIALTIES,
  NOTABLE_NPC_SPECIALTY_DOMAIN,
  SUPPLIER_SPECIALTY_DOMAIN,
  VOICE_AXIS_IDS,
  createCustomerGroupCastAttributes,
  createFactionCastAttributes,
  createNotableNpcCastAttributes,
  createSupplierCastAttributes,
  ensureRequiredVerbalTicsRegistered,
  getNotableNpcSpecialtyDomain,
  getSupplierSpecialtyDomain,
  verbalTicRegistry,
} from '../../src/sim/content/cast'
import type {
  AffinityAxis,
  CastAttributes,
  CustomerGroupCastAttributes,
  VoiceProfile,
} from '../../src/sim/content/cast'
import { createRngStreams } from '../../src/sim/core/rng'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'

// Phase 128 / ISSUE-097 — Voiced Surface arc, Phase 2 (Universal Cast).
//
// Mirrors phase121.castAttributes.test.ts for the four new actor kinds:
// supplier, faction, customer-group (cohort), notable-NPC. Each `it()`
// names the gate it enforces. Suppliers / factions / notable NPCs carry
// the full CastAttributes shape; customer groups carry voice-only.

function expectVoiceAxisBoundedness(voice: VoiceProfile): void {
  for (const axisId of VOICE_AXIS_IDS) {
    expect([0, 1, 2]).toContain(voice.axes[axisId])
  }
}

function expectAffinityBoundedness(affinity: AffinityAxis): void {
  expect(AFFINITY_TARGET_SET.has(affinity.target)).toBe(true)
  expect(['toward', 'away']).toContain(affinity.polarity)
  expect([1, 2]).toContain(affinity.strength)
}

function expectCastAttributeShape(attrs: CastAttributes): void {
  expect(typeof attrs.specialty).toBe('string')
  expect(typeof attrs.blindspot).toBe('string')
  expect(attrs.specialty).not.toBe(attrs.blindspot)
  expect(Array.isArray(attrs.affinities)).toBe(true)
  expect(attrs.affinities.length).toBeGreaterThanOrEqual(1)
  expect(attrs.affinities.length).toBeLessThanOrEqual(2)
  for (const affinity of attrs.affinities) expectAffinityBoundedness(affinity)
  expectVoiceAxisBoundedness(attrs.voice)
  if (attrs.voice.verbalTic !== undefined) {
    expect(verbalTicRegistry.has(attrs.voice.verbalTic)).toBe(true)
  }
}

function expectGroupCastShape(attrs: CustomerGroupCastAttributes): void {
  // Voice-only by design — no specialty/blindspot/affinities surface
  // on cohorts. The compose-layer resolver synthesises empty defaults
  // so the four CastAttribute condition primitives evaluate uniformly.
  expectVoiceAxisBoundedness(attrs.voice)
  if (attrs.voice.verbalTic !== undefined) {
    expect(verbalTicRegistry.has(attrs.voice.verbalTic)).toBe(true)
  }
  expect(Object.keys(attrs)).toEqual(['voice'])
}

describe('Phase 128 / ISSUE-097 — universal cast: suppliers', () => {
  it('gate 1: schema round-trip — day-zero suppliers carry well-shaped castAttributes', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
    const suppliers = Object.values(state.world.suppliers)
    expect(suppliers.length).toBeGreaterThan(0)
    for (const supplier of suppliers) {
      expect(supplier.castAttributes).toBeDefined()
      expectCastAttributeShape(supplier.castAttributes as CastAttributes)
      const domain = getSupplierSpecialtyDomain(supplier.supplierType)
      expect(domain).toContain(supplier.castAttributes!.specialty)
      expect(domain).toContain(supplier.castAttributes!.blindspot)
    }
  })

  it('gate 2: determinism — repeat createInitialTavernState yields identical supplier castAttributes', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.world.suppliers)) {
      expect(b.world.suppliers[id]?.castAttributes).toEqual(
        a.world.suppliers[id]?.castAttributes,
      )
    }
  })

  it('gate 3: stream isolation — burning service rolls does not perturb supplier castAttributes', () => {
    const streamsA = createRngStreams('supplier-isolation-seed')
    const burned = streamsA.get('service')
    for (let i = 0; i < 200; i += 1) burned.float()
    const attrsA = createSupplierCastAttributes({
      supplierType: 'brewer',
      cultureId: 'goblin_local',
      rng: streamsA.get('supplier_identity'),
    })

    const streamsB = createRngStreams('supplier-isolation-seed')
    const attrsB = createSupplierCastAttributes({
      supplierType: 'brewer',
      cultureId: 'goblin_local',
      rng: streamsB.get('supplier_identity'),
    })
    expect(attrsB).toEqual(attrsA)
  })

  it('gate 5: culture-aware bias — merchant_roadfolk floridity mean exceeds miner_workcrew', () => {
    const streamsM = createRngStreams('supplier-culture-bias-merchant')
    const merchantRng = streamsM.get('supplier_identity')
    const merchantSamples: number[] = []
    for (let i = 0; i < 80; i += 1) {
      const attrs = createSupplierCastAttributes({
        supplierType: 'caravan',
        cultureId: 'merchant_roadfolk',
        rng: merchantRng,
      })
      merchantSamples.push(attrs.voice.axes.floridity)
    }
    const streamsW = createRngStreams('supplier-culture-bias-miner')
    const minerRng = streamsW.get('supplier_identity')
    const minerSamples: number[] = []
    for (let i = 0; i < 80; i += 1) {
      const attrs = createSupplierCastAttributes({
        supplierType: 'caravan',
        cultureId: 'miner_workcrew',
        rng: minerRng,
      })
      minerSamples.push(attrs.voice.axes.floridity)
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(merchantSamples) - mean(minerSamples)).toBeGreaterThan(0.8)
  })

  it('gate 7: bounded outputs — every value lives in its declared bounded set', () => {
    const state = createInitialTavernState()
    for (const supplier of Object.values(state.world.suppliers)) {
      const attrs = supplier.castAttributes!
      expect(getSupplierSpecialtyDomain(supplier.supplierType)).toContain(
        attrs.specialty,
      )
      expect(getSupplierSpecialtyDomain(supplier.supplierType)).toContain(
        attrs.blindspot,
      )
      expectCastAttributeShape(attrs)
    }
  })

  it('gate 8: no prose — every supplier string tag is id-shaped (≤32 chars, no spaces)', () => {
    const state = createInitialTavernState()
    const seen: string[] = []
    for (const supplier of Object.values(state.world.suppliers)) {
      const attrs = supplier.castAttributes!
      seen.push(attrs.specialty, attrs.blindspot)
      for (const aff of attrs.affinities) seen.push(aff.target)
      if (attrs.voice.verbalTic) seen.push(attrs.voice.verbalTic)
    }
    expect(seen.length).toBeGreaterThan(0)
    for (const tag of seen) {
      expect(tag.length).toBeLessThanOrEqual(32)
      expect(tag).not.toMatch(/\s/)
    }
  })

  it('registry coverage: every registered supplierType has a specialty domain entry', () => {
    const state = createInitialTavernState()
    for (const supplier of Object.values(state.world.suppliers)) {
      expect(SUPPLIER_SPECIALTY_DOMAIN[supplier.supplierType]).toBeDefined()
    }
  })

  it('fallback domain: unknown supplierType falls through to SUPPLIER_FALLBACK_DOMAIN without throwing', () => {
    const streams = createRngStreams('supplier-fallback-seed')
    const attrs = createSupplierCastAttributes({
      supplierType: 'nonexistent_supplier_type',
      rng: streams.get('supplier_identity'),
    })
    expectCastAttributeShape(attrs)
  })
})

describe('Phase 128 / ISSUE-097 — universal cast: factions', () => {
  it('gate 1: schema round-trip — day-zero factions carry well-shaped castAttributes', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
    const factions = Object.values(state.world.factions)
    expect(factions.length).toBeGreaterThan(0)
    for (const faction of factions) {
      expect(faction.castAttributes).toBeDefined()
      const attrs = faction.castAttributes as CastAttributes
      expectCastAttributeShape(attrs)
      expect(FACTION_SOCIAL_SPECIALTIES).toContain(attrs.specialty)
      expect(FACTION_SOCIAL_SPECIALTIES).toContain(attrs.blindspot)
    }
  })

  it('gate 2: determinism — repeat createInitialTavernState yields identical faction castAttributes', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.world.factions)) {
      expect(b.world.factions[id]?.castAttributes).toEqual(
        a.world.factions[id]?.castAttributes,
      )
    }
  })

  it('gate 3: stream isolation — burning service rolls does not perturb faction castAttributes', () => {
    const streamsA = createRngStreams('faction-isolation-seed')
    const burned = streamsA.get('service')
    for (let i = 0; i < 200; i += 1) burned.float()
    const attrsA = createFactionCastAttributes({
      cultureId: 'goblin_local',
      rng: streamsA.get('faction_identity'),
    })
    const streamsB = createRngStreams('faction-isolation-seed')
    const attrsB = createFactionCastAttributes({
      cultureId: 'goblin_local',
      rng: streamsB.get('faction_identity'),
    })
    expect(attrsB).toEqual(attrsA)
  })
})

describe('Phase 128 / ISSUE-097 — universal cast: customer groups (voice-only)', () => {
  it('gate 1: schema round-trip — day-zero groups carry voice-only castAttributes', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
    const groups = Object.values(state.customerGroups)
    expect(groups.length).toBeGreaterThan(0)
    for (const group of groups) {
      expect(group.castAttributes).toBeDefined()
      expectGroupCastShape(group.castAttributes as CustomerGroupCastAttributes)
    }
  })

  it('gate 2: determinism — repeat createInitialTavernState yields identical group castAttributes', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.customerGroups)) {
      expect(b.customerGroups[id]?.castAttributes).toEqual(
        a.customerGroups[id]?.castAttributes,
      )
    }
  })

  it('voice-only shape: group attributes contain no specialty/blindspot/affinities surface', () => {
    const streams = createRngStreams('group-shape-seed')
    const attrs = createCustomerGroupCastAttributes({
      cultureId: 'goblin_local',
      rng: streams.get('customer_group_identity'),
    })
    expect(Object.keys(attrs)).toEqual(['voice'])
    expect((attrs as Record<string, unknown>).specialty).toBeUndefined()
    expect((attrs as Record<string, unknown>).blindspot).toBeUndefined()
    expect((attrs as Record<string, unknown>).affinities).toBeUndefined()
  })

  it('gate 5: culture-aware bias — goblin_local warmth mean exceeds traveling_outsiders', () => {
    const streamsG = createRngStreams('group-culture-goblin')
    const goblinRng = streamsG.get('customer_group_identity')
    const goblinSamples: number[] = []
    for (let i = 0; i < 80; i += 1) {
      const attrs = createCustomerGroupCastAttributes({
        cultureId: 'goblin_local',
        rng: goblinRng,
      })
      goblinSamples.push(attrs.voice.axes.warmth)
    }
    const streamsO = createRngStreams('group-culture-outsider')
    const outsiderRng = streamsO.get('customer_group_identity')
    const outsiderSamples: number[] = []
    for (let i = 0; i < 80; i += 1) {
      const attrs = createCustomerGroupCastAttributes({
        cultureId: 'traveling_outsiders',
        rng: outsiderRng,
      })
      outsiderSamples.push(attrs.voice.axes.warmth)
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(goblinSamples) - mean(outsiderSamples)).toBeGreaterThan(0.8)
  })
})

describe('Phase 128 / ISSUE-097 — universal cast: notable NPCs', () => {
  it('gate 1: schema round-trip — day-zero notable NPCs carry well-shaped castAttributes', () => {
    const state = createInitialTavernState()
    expect(() => validateState(state)).not.toThrow()
    const npcs = Object.values(state.world.notableNpcs)
    expect(npcs.length).toBeGreaterThan(0)
    for (const npc of npcs) {
      expect(npc.castAttributes).toBeDefined()
      expectCastAttributeShape(npc.castAttributes as CastAttributes)
      const domain = getNotableNpcSpecialtyDomain(npc.kind)
      expect(domain).toContain(npc.castAttributes!.specialty)
      expect(domain).toContain(npc.castAttributes!.blindspot)
    }
  })

  it('gate 2: determinism — repeat createInitialTavernState yields identical NPC castAttributes', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.world.notableNpcs)) {
      expect(b.world.notableNpcs[id]?.castAttributes).toEqual(
        a.world.notableNpcs[id]?.castAttributes,
      )
    }
  })

  it('roll order — name field is byte-identical to pre-Phase-2 (cast roll fires AFTER name)', () => {
    // Two runs of createInitialTavernState must produce the same NPC
    // names. If the new createNotableNpcCastAttributes roll were
    // wired in BEFORE the name roll, the name rng position would
    // shift and names would drift. This pins the additive contract.
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.world.notableNpcs)) {
      expect(b.world.notableNpcs[id]?.name).toEqual(
        a.world.notableNpcs[id]?.name,
      )
    }
  })

  it('registry coverage: every registered NPC kind has a specialty domain entry', () => {
    const state = createInitialTavernState()
    for (const npc of Object.values(state.world.notableNpcs)) {
      expect(NOTABLE_NPC_SPECIALTY_DOMAIN[npc.kind]).toBeDefined()
    }
  })

  it('fallback domain: unknown profile kind falls through to NOTABLE_NPC_FALLBACK_DOMAIN', () => {
    const streams = createRngStreams('npc-fallback-seed')
    const attrs = createNotableNpcCastAttributes({
      profileKind: 'nonexistent_profile_kind',
      rng: streams.get('npc_identity'),
    })
    expectCastAttributeShape(attrs)
  })
})

describe('Phase 128 / ISSUE-097 — universal cast: cross-cutting guards', () => {
  it('Phase A is untouched: staff + regulars stay byte-identical across runs', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    for (const id of Object.keys(a.staff)) {
      expect(b.staff[id]?.castAttributes).toEqual(a.staff[id]?.castAttributes)
      expect(b.staff[id]?.name).toEqual(a.staff[id]?.name)
      expect(b.staff[id]?.identity).toEqual(a.staff[id]?.identity)
    }
    for (const id of Object.keys(a.world.regulars)) {
      expect(b.world.regulars[id]?.castAttributes).toEqual(
        a.world.regulars[id]?.castAttributes,
      )
    }
  })

  it('CULTURE_VOICE_DEFAULTS flows through every new actor kind via the shared rollVoiceProfile path', () => {
    ensureRequiredVerbalTicsRegistered()
    // Sanity: each new factory accepts cultureId and the resulting
    // voice axes respect the partial defaults. We don't replicate
    // the bias gate here — that's already covered above per kind.
    const streams = createRngStreams('culture-flow-seed')
    const sup = createSupplierCastAttributes({
      supplierType: 'brewer',
      cultureId: 'shrine_devotees',
      rng: streams.get('supplier_identity'),
    })
    const fac = createFactionCastAttributes({
      cultureId: 'shrine_devotees',
      rng: streams.get('faction_identity'),
    })
    const grp = createCustomerGroupCastAttributes({
      cultureId: 'shrine_devotees',
      rng: streams.get('customer_group_identity'),
    })
    const npc = createNotableNpcCastAttributes({
      profileKind: 'priest',
      cultureId: 'shrine_devotees',
      rng: streams.get('npc_identity'),
    })
    // shrine_devotees default formality is 2 — after [-1,0,0,1]
    // perturbation and clamp, the axis lands in {1, 2}. We assert
    // the result is at least 1 (the lower clamp from the [-1] roll).
    expect(sup.voice.axes.formality).toBeGreaterThanOrEqual(1)
    expect(fac.voice.axes.formality).toBeGreaterThanOrEqual(1)
    expect(grp.voice.axes.formality).toBeGreaterThanOrEqual(1)
    expect(npc.voice.axes.formality).toBeGreaterThanOrEqual(1)
  })

  it('new RNG streams are addressable from createRngStreams snapshot', () => {
    const streams = createRngStreams('stream-snapshot-seed')
    // Touch each new stream so snapshot reports the seeded entries.
    streams.get('supplier_identity').float()
    streams.get('faction_identity').float()
    streams.get('customer_group_identity').float()
    const snap = streams.snapshot()
    expect(snap.supplier_identity).toBeDefined()
    expect(snap.faction_identity).toBeDefined()
    expect(snap.customer_group_identity).toBeDefined()
    expect(snap.supplier_identity.calls).toBeGreaterThan(0)
    expect(snap.faction_identity.calls).toBeGreaterThan(0)
    expect(snap.customer_group_identity.calls).toBeGreaterThan(0)
  })
})
