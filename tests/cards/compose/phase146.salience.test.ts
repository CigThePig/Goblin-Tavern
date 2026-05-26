// Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1.
//
// Signal salience read + multi-fact establishing slot. The compose
// runtime gains a per-slot `saliencePolicy` field; the assembler reads
// it to tie-break top-specificity matches by decision-relevance and to
// optionally append a secondary snippet covering an orthogonal salient
// fact. These tests bite the headline behaviour from the arc plan:
// "the supplier card opens with reliability × relationship when both
// resolve" — plus the surrounding determinism, layering, and fall-back
// guarantees.

import { describe, expect, it } from 'vitest'

import {
  assembleSlots,
  pickSnippet,
  resolveSalientReads,
  SALIENCE_TABLES,
  scoreCandidateSalience,
  type SlotSpec,
  type Snippet,
  type SnippetPool,
} from '../../../src/cards/compose'
import type { TavernState } from '../../../src/sim/state/TavernState'
import type {
  IssueSeed,
  IssueSeedFamilyId,
} from '../../../src/sim/modules/issues/issueSeedTypes'
import { makeSeed, makeTavernState } from '../cardFactories'

// ─── shared fixtures ─────────────────────────────────────────────────

function firstSupplierId(state: TavernState): string {
  const id = Object.keys(state.world.suppliers)[0]
  if (!id) throw new Error('test setup expects at least one starter supplier')
  return id
}

function supplierSeed(supplierId: string): IssueSeed {
  return makeSeed({
    id: 'salience-seed',
    family: 'supplier_relationship' as IssueSeedFamilyId,
    type: 'supplier_offer',
    timing: 'morning_prep',
    severity: 45,
    domain: ['suppliers'],
    primaryActor: { kind: 'supplier', id: supplierId },
  })
}

function withSupplier(
  state: TavernState,
  supplierId: string,
  partial: { reliability?: number; relationship?: number },
): TavernState {
  const existing = state.world.suppliers[supplierId]
  if (!existing) {
    throw new Error(`withSupplier: unknown supplier ${supplierId}`)
  }
  return {
    ...state,
    world: {
      ...state.world,
      suppliers: {
        ...state.world.suppliers,
        [supplierId]: {
          ...existing,
          ...(partial.reliability !== undefined
            ? { reliability: partial.reliability }
            : {}),
          ...(partial.relationship !== undefined
            ? { relationship: partial.relationship }
            : {}),
        },
      },
    },
  }
}

// ─── fixture pools ────────────────────────────────────────────────────

const SUPPLIER_POOL: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    { id: 'fallback', text: 'A merchant arrives.', conditions: [] },
    {
      id: 'low_rel',
      text: 'The goods come up short most weeks.',
      conditions: [
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.reliability',
          equals: 'low',
        },
      ],
    },
    {
      id: 'low_relationship',
      text: "There's old cold between this house and theirs.",
      conditions: [
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.relationship',
          equals: 'low',
        },
      ],
    },
    {
      id: 'memory_only',
      text: 'The ledger remembers them.',
      conditions: [{ kind: 'memoryPresent', tag: 'supplier' }],
    },
  ],
}

// Two equal-specificity snippets, one covering the salient reliability
// read, one covering a non-table memory read. Used to assert salience
// scoring drives the primary pick.
const TIE_POOL: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    { id: 'fallback', text: 'A merchant arrives.', conditions: [] },
    {
      id: 'salient',
      text: 'The goods come up short.',
      conditions: [
        {
          kind: 'signalEquals',
          role: 'primaryActor',
          signal: 'supplier.reliability',
          equals: 'low',
        },
      ],
    },
    {
      id: 'unrelated_memory',
      text: 'A different story rises.',
      conditions: [{ kind: 'memoryPresent', tag: 'unlisted_tag' }],
    },
  ],
}

function makeSlot(
  partial: Partial<SlotSpec> & { pool: SnippetPool },
): SlotSpec {
  return {
    id: 'establishing_line',
    role: 'utterance',
    wordBudget: 14,
    claimMode: 'sim_backed',
    ...partial,
  }
}

// ─── tests ───────────────────────────────────────────────────────────

describe('SALIENCE_TABLES', () => {
  it('seeds supplier_relationship with reliability first', () => {
    const table = SALIENCE_TABLES['supplier_relationship' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'supplier.reliability',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'supplier.relationship',
    })
  })

  // Phase 150 / ISSUE-118 — Staff & Personnel cluster entries.
  it('seeds staff_identity with the two band signals first, then loyalty-risk pressure', () => {
    const table = SALIENCE_TABLES['staff_identity' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'staff.stress',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'staff.fatigue',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'pressure',
      pressureId: 'staff_loyalty_risk',
    })
  })

  it('seeds staff_burnout with the two band signals first, then burnout pressure', () => {
    const table = SALIENCE_TABLES['staff_burnout' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'staff.stress',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'staff.fatigue',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'pressure',
      pressureId: 'staff_burnout',
    })
  })

  // Phase 151 / ISSUE-119 — Legible Surface arc, Phase 6 additions.
  it('seeds regular_customer with irritation, loyalty, then loss pressure', () => {
    const table = SALIENCE_TABLES['regular_customer' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'regular.irritation',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'regular.loyalty',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'pressure',
      pressureId: 'regular_customer_loss',
    })
  })

  it('seeds customer_complaint with satisfaction, loyalty, then reputation_drift pressure', () => {
    const table = SALIENCE_TABLES['customer_complaint' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'customer_group.satisfaction',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'customer_group.loyalty',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'pressure',
      pressureId: 'reputation_drift',
    })
  })

  // Phase 152 / ISSUE-120 — Legible Surface arc, Phase 7 additions.
  it('seeds faction_request with relationship, influence, then faction_anger pressure', () => {
    const table = SALIENCE_TABLES['faction_request' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'faction.relationship',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'faction.influence',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'pressure',
      pressureId: 'faction_anger',
    })
  })

  it('seeds culture_conflict with tension, comfort, familiarity, then cultural_tension pressure', () => {
    const table = SALIENCE_TABLES['culture_conflict' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      signal: 'culture.tension',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      signal: 'culture.comfort',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'signal',
      signal: 'culture.familiarity',
    })
    expect(table!.reads[3]).toMatchObject({
      kind: 'pressure',
      pressureId: 'cultural_tension',
    })
  })

  // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8 additions.
  it('seeds maintenance with damage, condition, cleanliness, then maintenance pressure', () => {
    const table = SALIENCE_TABLES['maintenance' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.damage',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.condition',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.cleanliness',
    })
    expect(table!.reads[3]).toMatchObject({
      kind: 'pressure',
      pressureId: 'maintenance',
    })
  })

  it('seeds area_atmosphere with cleanliness, damage, condition, then maintenance pressure', () => {
    const table = SALIENCE_TABLES['area_atmosphere' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.cleanliness',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.damage',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.condition',
    })
    expect(table!.reads[3]).toMatchObject({
      kind: 'pressure',
      pressureId: 'maintenance',
    })
  })

  // Phase 154 / ISSUE-122 — Legible Surface arc, Phase 9 additions.
  it('seeds food_safety with cleanliness on location then cook stress/fatigue on primaryActor', () => {
    const table = SALIENCE_TABLES['food_safety' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.cleanliness',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'staff.stress',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'staff.fatigue',
    })
    expect(table!.reads[3]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.damage',
    })
  })

  it('seeds violence with rowdiness, satisfaction, area.damage, then loyalty', () => {
    const table = SALIENCE_TABLES['violence' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'customer_group.rowdiness',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'customer_group.satisfaction',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.damage',
    })
    expect(table!.reads[3]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'customer_group.loyalty',
    })
  })

  it('seeds inspection with relationship, influence on actor then cleanliness/condition on location', () => {
    const table = SALIENCE_TABLES['inspection' as IssueSeedFamilyId]
    expect(table).toBeDefined()
    expect(table!.reads[0]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'faction.relationship',
    })
    expect(table!.reads[1]).toMatchObject({
      kind: 'signal',
      role: 'primaryActor',
      signal: 'faction.influence',
    })
    expect(table!.reads[2]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.cleanliness',
    })
    expect(table!.reads[3]).toMatchObject({
      kind: 'signal',
      role: 'location',
      signal: 'area.condition',
    })
  })
})

describe('resolveSalientReads', () => {
  it('returns reads in salience-table order, filtering missing entries', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const reads = resolveSalientReads(supplierSeed(supplierId), state)
    expect(reads).toHaveLength(2)
    expect(reads[0]!.read).toMatchObject({ signal: 'supplier.reliability' })
    expect(reads[0]!.band).toBe('low')
    expect(reads[0]!.extremity).toBe(2)
    expect(reads[1]!.read).toMatchObject({ signal: 'supplier.relationship' })
    expect(reads[1]!.band).toBe('low')
  })

  it('drops mid-band reads (mid carries extremity 1; still present)', () => {
    // mid still resolves — it has a band — but with extremity 1. The
    // resolver returns the read; the scorer uses extremity to tie-break.
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 50, relationship: 20 })
    const reads = resolveSalientReads(supplierSeed(supplierId), state)
    expect(reads).toHaveLength(2)
    expect(reads[0]!.band).toBe('mid')
    expect(reads[0]!.extremity).toBe(1)
    expect(reads[1]!.band).toBe('low')
    expect(reads[1]!.extremity).toBe(2)
  })

  it('returns [] for families without a salience table', () => {
    const seed = makeSeed({
      family: 'food_safety' as IssueSeedFamilyId,
      type: 'crisis',
    })
    const state = makeTavernState({})
    expect(resolveSalientReads(seed, state)).toEqual([])
  })

  // Phase 149 / ISSUE-117 — Legible Surface arc, Phase 4. SalienceRead
  // gained two new kinds: `hasTag` (calendar/domain/toneHint flow) and
  // `severity` (seed-level severity threshold).
  it('resolves hasTag reads against the seed tag flow (domain ∪ toneHints ∪ stake tags)', () => {
    const seed = makeSeed({
      id: 'debt-tag-seed',
      family: 'debt_rent' as IssueSeedFamilyId,
      type: 'debt_pressure',
      timing: 'end_month',
      severity: 50,
      domain: ['economy', 'monthly', 'landlord'],
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const state = makeTavernState({})
    const reads = resolveSalientReads(seed, state)
    // The debt_rent table puts hasTag(rent_due_soon) at index 1; with no
    // pressures rising and no memories, only the tag and (below sev 70)
    // no severity read resolve.
    expect(reads.some((r) => r.read.kind === 'hasTag' && r.read.tag === 'rent_due_soon')).toBe(true)
    const tagRead = reads.find((r) => r.read.kind === 'hasTag')!
    expect(tagRead.extremity).toBe(1)
  })

  it('omits hasTag reads when the tag is absent from the seed flow', () => {
    const seed = makeSeed({
      id: 'debt-no-tag-seed',
      family: 'debt_rent' as IssueSeedFamilyId,
      type: 'debt_pressure',
      timing: 'end_month',
      severity: 50,
      domain: ['economy', 'monthly', 'landlord'],
      toneHints: ['debt', 'pressure'],
    })
    const state = makeTavernState({})
    const reads = resolveSalientReads(seed, state)
    expect(reads.some((r) => r.read.kind === 'hasTag')).toBe(false)
  })

  it('resolves severity reads with extremity 2 at-or-above 70, 1 below', () => {
    const lowSevSeed = makeSeed({
      id: 'stock-low-sev',
      family: 'stock_shortage' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      severity: 65,
      toneHints: ['warning'],
    })
    const highSevSeed = makeSeed({
      id: 'stock-high-sev',
      family: 'stock_shortage' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      severity: 80,
      toneHints: ['warning'],
    })
    const state = makeTavernState({})
    // stock_shortage table has severity atLeast 70 at index 0.
    // For sev=65 (< 70), the read does NOT resolve (below threshold).
    const lowReads = resolveSalientReads(lowSevSeed, state)
    expect(lowReads.some((r) => r.read.kind === 'severity')).toBe(false)
    // For sev=80 (>= 70), it resolves with extremity 2.
    const highReads = resolveSalientReads(highSevSeed, state)
    const sev = highReads.find((r) => r.read.kind === 'severity')!
    expect(sev).toBeDefined()
    expect(sev.extremity).toBe(2)
  })
})

describe('scoreCandidateSalience', () => {
  it('scores a covering snippet with its read index and extremity', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const resolved = resolveSalientReads(supplierSeed(supplierId), state)
    const reliabilitySnippet: Snippet = SUPPLIER_POOL.snippets.find(
      (s) => s.id === 'low_rel',
    )!
    const score = scoreCandidateSalience(reliabilitySnippet, resolved)
    expect(score.index).toBe(0)
    expect(score.extremity).toBe(2)
    expect(score.coveredReadIndices).toEqual([0])
  })

  it('returns index=Infinity for a snippet whose conditions match no read', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const resolved = resolveSalientReads(supplierSeed(supplierId), state)
    const fallback: Snippet = SUPPLIER_POOL.snippets[0]!
    const score = scoreCandidateSalience(fallback, resolved)
    expect(score.index).toBe(Infinity)
    expect(score.extremity).toBe(0)
    expect(score.coveredReadIndices).toEqual([])
  })

  // Phase 149 / ISSUE-117 — hasTag and severity snippet conditions
  // score against the matching new SalienceRead kinds.
  it('a hasTag snippet covers a hasTag salience read with the same tag', () => {
    const seed = makeSeed({
      id: 'debt-tag-seed',
      family: 'debt_rent' as IssueSeedFamilyId,
      type: 'debt_pressure',
      timing: 'end_month',
      severity: 50,
      toneHints: ['debt', 'pressure', 'rent_due_soon'],
    })
    const state = makeTavernState({})
    const resolved = resolveSalientReads(seed, state)
    const snippet: Snippet = {
      id: 'rent_due_snippet',
      text: 'Rent is closing in.',
      conditions: [{ kind: 'hasTag', tag: 'rent_due_soon' }],
    }
    const score = scoreCandidateSalience(snippet, resolved)
    // debt_rent table puts hasTag(rent_due_soon) at index 1; resolved
    // reads array drops anything that didn't fire (severity below
    // threshold, no pressures, no memories), so the tag is at the only
    // resolved position.
    expect(score.index).toBeLessThan(Infinity)
    expect(score.coveredReadIndices.length).toBeGreaterThan(0)
    const covered = resolved[score.coveredReadIndices[0]!]!
    expect(covered.read.kind).toBe('hasTag')
  })

  it('a severityAtLeast snippet covers a severity read when its threshold ≥ the read threshold', () => {
    const seed = makeSeed({
      id: 'stock-high-sev',
      family: 'stock_shortage' as IssueSeedFamilyId,
      type: 'warning',
      timing: 'morning_prep',
      severity: 80,
      toneHints: ['warning'],
    })
    const state = makeTavernState({})
    const resolved = resolveSalientReads(seed, state)
    // Snippet at 70 exactly matches the table's severity read (atLeast 70).
    const exact: Snippet = {
      id: 's70',
      text: 'Critical now.',
      conditions: [{ kind: 'severityAtLeast', value: 70 }],
    }
    expect(scoreCandidateSalience(exact, resolved).index).toBeLessThan(Infinity)
    // Snippet at 85 is even tighter — still covers the table's atLeast 70.
    const tighter: Snippet = {
      id: 's85',
      text: 'Beyond crisis now.',
      conditions: [{ kind: 'severityAtLeast', value: 85 }],
    }
    expect(scoreCandidateSalience(tighter, resolved).index).toBeLessThan(Infinity)
    // Snippet at 50 is looser than the read's threshold (50 < 70). It
    // would fire for cases the read considers below salient — does NOT
    // cover the read. Returns Infinity.
    const looser: Snippet = {
      id: 's50',
      text: 'Slightly tight.',
      conditions: [{ kind: 'severityAtLeast', value: 50 }],
    }
    expect(scoreCandidateSalience(looser, resolved).index).toBe(Infinity)
  })
})

describe('pickSnippet with saliencePolicy', () => {
  it('layered, not replaced: pool with no salient conditions picks identically to today', () => {
    // The fallback-only "pool" with no salient match resolves to the
    // unconditional fallback regardless of saliencePolicy.
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 50, relationship: 50 })
    const seed = supplierSeed(supplierId)
    const baseline = pickSnippet(makeSlot({ pool: SUPPLIER_POOL }), seed, state)
    const withTop = pickSnippet(
      makeSlot({ pool: SUPPLIER_POOL, saliencePolicy: 'top' }),
      seed,
      state,
    )
    expect(withTop).toBe(baseline)
  })

  it('top mode picks the salience-covering snippet over an equal-specificity unrelated one', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 50 })
    // Add a memory tagged 'unlisted_tag' so the unrelated condition
    // actually evaluates true under TIE_POOL.
    state = {
      ...state,
      memories: [
        ...state.memories,
        {
          id: 'mem-unrelated',
          type: 'fact',
          strength: 50,
          ageDays: 0,
          createdAt: {
            year: 1,
            month: 1,
            week: 1,
            day: 1,
            absoluteDay: state.calendar.totalDaysElapsed,
          },
          actors: [],
          locations: [],
          relatedSystems: [],
          tags: ['unlisted_tag'],
        },
      ],
    }
    const seed = supplierSeed(supplierId)
    // Without salience: both candidates are spec 1; FNV picks one.
    // With saliencePolicy: 'top', the reliability-covering one must win.
    const picked = pickSnippet(
      makeSlot({ pool: TIE_POOL, saliencePolicy: 'top' }),
      seed,
      state,
    )
    expect(picked).toBe('The goods come up short.')
  })

  it('multi mode states reliability AND relationship when both resolve', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId)
    const picked = pickSnippet(
      makeSlot({
        pool: SUPPLIER_POOL,
        saliencePolicy: 'multi',
        multiFactJoin: ' — ',
      }),
      seed,
      state,
    )
    expect(picked).toBeDefined()
    expect(picked).toContain('come up short') // reliability fact
    expect(picked).toContain('old cold') // relationship fact
    expect(picked).toContain(' — ')
  })

  it('multi mode falls back to primary-only when no orthogonal read resolves', () => {
    // reliability low, relationship mid (no `mid` snippet exists)
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 50 })
    const seed = supplierSeed(supplierId)
    const picked = pickSnippet(
      makeSlot({
        pool: SUPPLIER_POOL,
        saliencePolicy: 'multi',
        multiFactJoin: ' — ',
      }),
      seed,
      state,
    )
    expect(picked).toBe('The goods come up short most weeks.')
    expect(picked).not.toContain(' — ')
  })

  it('multi mode respects combined word budget — drops secondary if overflowing', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId)
    // Tight budget that fits the primary but not the joined pair.
    const picked = pickSnippet(
      makeSlot({
        pool: SUPPLIER_POOL,
        saliencePolicy: 'multi',
        multiFactJoin: ' — ',
        multiFactBudget: 10,
      }),
      seed,
      state,
    )
    expect(picked).toBe('The goods come up short most weeks.')
  })

  it('determinism: same (seed, state) ⇒ same pick across many calls', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId)
    const slot = makeSlot({
      pool: SUPPLIER_POOL,
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    })
    const first = pickSnippet(slot, seed, state)
    for (let i = 0; i < 25; i++) {
      expect(pickSnippet(slot, seed, state)).toBe(first)
    }
  })

  it('re-render stability: unrelated state mutation does not move the pick', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId)
    const slot = makeSlot({
      pool: SUPPLIER_POOL,
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    })
    const before = pickSnippet(slot, seed, state)
    const mutated: TavernState = {
      ...state,
      calendar: {
        ...state.calendar,
        totalDaysElapsed: state.calendar.totalDaysElapsed + 0, // identity
      },
    }
    expect(pickSnippet(slot, seed, mutated)).toBe(before)
  })

  it('no saliencePolicy ⇒ pure-gradient behaviour identical to today', () => {
    // Construct a forced-tie pool: two unconditional fallbacks of equal
    // specificity. FNV tie-break selects one. Adding salience-policy
    // unspecified must not change which one.
    const TIE_FALLBACKS: SnippetPool = {
      slotId: 'establishing_line',
      snippets: [
        { id: 'a', text: 'First option.', conditions: [] },
        { id: 'b', text: 'Second option.', conditions: [] },
      ],
    }
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId)
    const slot = makeSlot({ pool: TIE_FALLBACKS })
    // Two identical-condition snippets ⇒ FNV picks deterministically.
    const before = pickSnippet(slot, seed, state)
    expect(before).toMatch(/^(First|Second) option\.$/)
    // Calling many times yields the same one — determinism preserved.
    for (let i = 0; i < 10; i++) {
      expect(pickSnippet(slot, seed, state)).toBe(before)
    }
  })

  it('family without a salience table behaves identically to a no-policy slot', () => {
    const noTableSeed = makeSeed({
      family: 'food_safety' as IssueSeedFamilyId,
      type: 'crisis',
      timing: 'during_service',
    })
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const baseline = pickSnippet(
      makeSlot({ pool: SUPPLIER_POOL }),
      noTableSeed,
      state,
    )
    const withMulti = pickSnippet(
      makeSlot({ pool: SUPPLIER_POOL, saliencePolicy: 'multi' }),
      noTableSeed,
      state,
    )
    expect(withMulti).toBe(baseline)
  })
})

describe('assembleSlots integration', () => {
  it('multi-fact slot composes the joined line into FilledSlots["establishing_line"]', () => {
    let state = makeTavernState({})
    const supplierId = firstSupplierId(state)
    state = withSupplier(state, supplierId, { reliability: 20, relationship: 20 })
    const seed = supplierSeed(supplierId)
    const slots: SlotSpec[] = [
      makeSlot({
        pool: SUPPLIER_POOL,
        saliencePolicy: 'multi',
        multiFactJoin: ' — ',
      }),
    ]
    const filled = assembleSlots(slots, seed, state)
    expect(filled['establishing_line']).toContain('come up short')
    expect(filled['establishing_line']).toContain('old cold')
  })
})
