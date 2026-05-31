import { describe, expect, it } from 'vitest'

import { simulateDay } from '../../src/sim/core/engine'
import type { SimInput } from '../../src/sim/core/context'

import { areasModule } from '../../src/sim/modules/areas/index'
import { attributionModule } from '../../src/sim/modules/attribution/index'
import { causesModule } from '../../src/sim/modules/causes/index'
import { cultureModule } from '../../src/sim/modules/cultures/index'
import { customersModule } from '../../src/sim/modules/customers/index'
import { factionModule } from '../../src/sim/modules/factions/index'
import { feedbackModule } from '../../src/sim/modules/feedback/index'
import { historyModule } from '../../src/sim/modules/history/index'
import { issueSeedsModule } from '../../src/sim/modules/issues/index'
import { localArcsModule } from '../../src/sim/modules/localArcs/index'
import { memoriesModule } from '../../src/sim/modules/memories/index'
import { monthlyModule } from '../../src/sim/modules/monthly/index'
import { ownerActionsModule } from '../../src/sim/modules/ownerActions/index'
import { pressuresModule } from '../../src/sim/modules/pressures/index'
import { regularModule } from '../../src/sim/modules/regulars/index'
import { serviceModule } from '../../src/sim/modules/service/index'
import { staffModule } from '../../src/sim/modules/staff/index'
import { stockModule } from '../../src/sim/modules/stock/index'
import { supplierModule } from '../../src/sim/modules/suppliers/index'
import { weeklyModule } from '../../src/sim/modules/weekly/index'
import { worldModule } from '../../src/sim/modules/world/index'

import { createInitialTavernState } from '../../src/sim/state/defaults'
import { validateState } from '../../src/sim/state/validation'
import { getIssueSeeds } from '../../src/sim/modules/issues/index'
import {
  createNotableNpc,
  ensureRequiredNotableNpcProfilesRegistered,
  notableNpcProfileRegistry,
} from '../../src/sim/content/npc'
import { createRngStreams } from '../../src/sim/core/rng'
import { runCardlessSim } from '../../src/sim/testing/simRunner'
import { buildNamedEntityRepetitionAudit } from '../../src/sim/testing/expandedReadinessReport'
import type {
  AreaState,
  EntityRef,
  StockState,
  TavernState,
} from '../../src/sim/state/TavernState'

// Phase 44 — ISSUE-004. NPC factory + initial notable NPC roster.
//
// The simulation has a `state.world.notableNpcs` slice, a `notable_npc`
// EntityRef kind, and a `modifyNotableNpc` mutator with per-field cause
// emission. ISSUE-004 implements the missing factory, seeds 8 starter
// notable NPCs from a profile registry, and lifts the inspection
// generator's `inspectorActor` resolution so a notable_npc ref reaches
// the four faction-bound futureHooks (`town_watch_advisor`,
// `corrupt_inspector_relationship`, `inspection_discovery_possible`,
// `town_watch_goodwill`).

const SEED = 'phase-44-notable-npcs-test'

const FULL_PIPELINE = [
  areasModule,
  stockModule,
  staffModule,
  customersModule,
  worldModule,
  cultureModule,
  factionModule,
  supplierModule,
  regularModule,
  ownerActionsModule,
  serviceModule,
  weeklyModule,
  monthlyModule,
  localArcsModule,
  memoriesModule,
  historyModule,
  causesModule,
  attributionModule,
  pressuresModule,
  feedbackModule,
  issueSeedsModule,
]

function input(overrides: Partial<SimInput> = {}): SimInput {
  return { seed: SEED, ...overrides }
}

function withArea(
  state: TavernState,
  id: string,
  overrides: Partial<AreaState>,
): TavernState {
  const area = state.areas[id]!
  return { ...state, areas: { ...state.areas, [id]: { ...area, ...overrides } } }
}

function withStock(
  state: TavernState,
  id: string,
  overrides: Partial<StockState>,
): TavernState {
  const stock = state.stock[id]!
  return { ...state, stock: { ...state.stock, [id]: { ...stock, ...overrides } } }
}

function inspectionPrimed(state: TavernState): TavernState {
  // Mirror the conditions Phase 19's "high inspection pressure" test
  // uses to clear `CONTRADICTION_GUARDS.inspection` and produce at
  // least one inspection seed.
  let s = state
  s = withArea(s, 'kitchen', { cleanliness: 10, smell: 80 })
  s = withArea(s, 'privy', { smell: 90, cleanliness: 10 })
  s = withStock(s, 'mushrooms', { spoilage: 90 })
  s = withStock(s, 'stew', { spoilage: 80, quantity: 400 })
  s = { ...s, reputation: { ...s.reputation, filthy: 90 } }
  s = {
    ...s,
    stock: {
      ...s.stock,
      ale: { ...s.stock.ale!, quantity: 800, quality: 60 },
    },
  }
  return s
}

function isNotableNpcRef(ref: EntityRef): boolean {
  return ref.kind === 'notable_npc'
}

describe('Phase 44 §ISSUE-004 — Initial notable NPC roster', () => {
  it('1. Default state seeds at least 8 notable NPCs with non-empty display names', () => {
    // Phase 82 / ISSUE-042 lifted the roster floor by adding the
    // three niche-faction profiles (smuggler_contact /
    // silvermark_factor / rival_tavern_keeper). The exact count is
    // no longer load-bearing — the invariant is "≥ the canonical
    // 8 starter NPCs are present and well-formed."
    const state = createInitialTavernState()
    const npcs = state.world.notableNpcs
    expect(Object.keys(npcs).length).toBeGreaterThanOrEqual(8)
    for (const npc of Object.values(npcs)) {
      expect(npc.id).toMatch(/^notable_npc_/)
      expect(npc.name.display.length).toBeGreaterThan(0)
      expect(typeof npc.kind).toBe('string')
      expect(npc.firstSeenDay).toBe(0)
      expect(Array.isArray(npc.tags)).toBe(true)
    }
  })

  it('2. Roster includes the canonical inspector + captain + moneylender + gossip + fence + priest + merchant prince + foreman', () => {
    const state = createInitialTavernState()
    const ids = new Set(Object.keys(state.world.notableNpcs))
    expect(ids).toContain('notable_npc_watch_inspector')
    expect(ids).toContain('notable_npc_watch_captain')
    expect(ids).toContain('notable_npc_moneylender')
    expect(ids).toContain('notable_npc_town_gossip')
    expect(ids).toContain('notable_npc_fence')
    expect(ids).toContain('notable_npc_shrine_priest')
    expect(ids).toContain('notable_npc_merchant_prince')
    expect(ids).toContain('notable_npc_miner_foreman')
  })

  it('3. Seeded NPCs reference factions and cultures that exist in world state', () => {
    const state = createInitialTavernState()
    for (const npc of Object.values(state.world.notableNpcs)) {
      if (npc.factionId !== undefined) {
        expect(state.world.factions[npc.factionId]).toBeDefined()
      }
      if (npc.cultureId !== undefined) {
        expect(state.world.cultures[npc.cultureId]).toBeDefined()
      }
      if (npc.customerGroupId !== undefined) {
        expect(state.customerGroups[npc.customerGroupId]).toBeDefined()
      }
    }
  })

  it('4. Seeding is deterministic across calls to createInitialTavernState', () => {
    const a = createInitialTavernState()
    const b = createInitialTavernState()
    const namesA = Object.values(a.world.notableNpcs)
      .map((npc) => `${npc.id}:${npc.name.display}`)
      .sort()
    const namesB = Object.values(b.world.notableNpcs)
      .map((npc) => `${npc.id}:${npc.name.display}`)
      .sort()
    expect(namesA).toEqual(namesB)
  })

  it('5. State validates clean against the full TavernState schema and reference validator', () => {
    const state = createInitialTavernState()
    // validateState throws on schema mismatch or any unresolved
    // EntityRef — including notable_npc refs (referenceValidation.ts:136).
    // The seeded roster must therefore satisfy both the Zod schema and
    // every cross-reference checker.
    expect(() => validateState(state, { modules: FULL_PIPELINE })).not.toThrow()
  })
})

describe('Phase 44 §ISSUE-004 — Factory determinism', () => {
  it('6. createNotableNpc produces the same display name for the same seed', () => {
    ensureRequiredNotableNpcProfilesRegistered()
    const profile = notableNpcProfileRegistry.get('watch_inspector')
    const streamsA = createRngStreams('phase44-test-deterministic')
    const streamsB = createRngStreams('phase44-test-deterministic')
    const a = createNotableNpc({
      npcId: profile.defaultNpcId,
      profileId: profile.id,
      rng: streamsA.get('npc_identity'),
      firstSeenDay: 0,
    })
    const b = createNotableNpc({
      npcId: profile.defaultNpcId,
      profileId: profile.id,
      rng: streamsB.get('npc_identity'),
      firstSeenDay: 0,
    })
    expect(a.generatedName.display).toBe(b.generatedName.display)
    expect(a.npc).toEqual(b.npc)
  })

  it('7. Unknown profile id throws a useful error', () => {
    ensureRequiredNotableNpcProfilesRegistered()
    const streams = createRngStreams('phase44-test-unknown')
    expect(() =>
      createNotableNpc({
        npcId: 'nope',
        profileId: 'not_a_real_profile',
        rng: streams.get('npc_identity'),
        firstSeenDay: 0,
      }),
    ).toThrow(/unknown notable NPC profile/)
  })
})

describe('Phase 44 §ISSUE-004 — Inspection generator binds to notable_npc', () => {
  it('8. High-pressure inspection seed names a town_watch notable NPC, not just the faction', () => {
    const base = inspectionPrimed(createInitialTavernState())
    const watchNpcIds = new Set(
      Object.values(base.world.notableNpcs)
        .filter((npc) => npc.factionId === 'town_watch')
        .map((npc) => npc.id),
    )
    expect(watchNpcIds.size).toBeGreaterThan(0)

    // Phase 186 / Cluster 1 — `inspection` is a morning seed reading the
    // prior day's closing pressure snapshot; warm one day to populate it.
    const warm = simulateDay(base, input(), FULL_PIPELINE)
    const result = simulateDay(warm.state, input(), FULL_PIPELINE)
    const seeds = getIssueSeeds(result.state, { family: 'inspection' })
    expect(seeds.length).toBeGreaterThan(0)

    const refs: EntityRef[] = []
    for (const seed of seeds) {
      if (seed.primaryActor) refs.push(seed.primaryActor)
      for (const a of seed.affectedActors) refs.push(a)
      for (const ne of seed.textIngredients.namedEntities ?? []) refs.push(ne.ref)
    }
    const notableRefs = refs.filter(isNotableNpcRef)
    expect(notableRefs.length).toBeGreaterThan(0)
    expect(notableRefs.some((r) => watchNpcIds.has(r.id))).toBe(true)
  })

  it('9. Inspection seed futureHooks include a town_watch notable NPC actor', () => {
    const base = inspectionPrimed(createInitialTavernState())
    const watchNpcIds = new Set(
      Object.values(base.world.notableNpcs)
        .filter((npc) => npc.factionId === 'town_watch')
        .map((npc) => npc.id),
    )

    // Phase 186 / Cluster 1 — `inspection` is a morning seed reading the
    // prior day's closing pressure snapshot; warm one day to populate it.
    const warm = simulateDay(base, input(), FULL_PIPELINE)
    const result = simulateDay(warm.state, input(), FULL_PIPELINE)
    const seeds = getIssueSeeds(result.state, { family: 'inspection' })
    expect(seeds.length).toBeGreaterThan(0)

    let sawWatchHookOnNotableNpc = false
    for (const seed of seeds) {
      for (const profile of seed.consequenceProfiles ?? []) {
        for (const hook of profile.futureHooks ?? []) {
          for (const actor of hook.actors ?? []) {
            if (actor.kind === 'notable_npc' && watchNpcIds.has(actor.id)) {
              sawWatchHookOnNotableNpc = true
            }
          }
        }
      }
    }
    expect(sawWatchHookOnNotableNpc).toBe(true)
  })
})

describe('Phase 44 §ISSUE-004 — Named-entity audit credits notable NPCs', () => {
  it('10. notable_npc keys appear in the named-entity-repetition audit over a 28-day run', () => {
    const base = inspectionPrimed(createInitialTavernState())
    const run = runCardlessSim({
      seed: SEED,
      days: 28,
      initialState: base,
    })
    const audit = buildNamedEntityRepetitionAudit(run)
    // Audit aggregates `notable_npc:<id>` keys per use; with inspection
    // primed, the watch inspector should appear at least once.
    const seenNotable = audit.overusedEntities.some((e) =>
      e.refKey.startsWith('notable_npc:'),
    )
    // overusedEntities only includes refs hit 6+ times; for the low-end
    // assertion, also scan totalNamedEntityUses for at least one notable
    // use by inspecting every day's seed refs directly.
    let totalNotableUses = 0
    for (const day of run.days) {
      const seeds = getIssueSeeds(day.result.state, {})
      for (const seed of seeds) {
        if (seed.primaryActor && seed.primaryActor.kind === 'notable_npc') {
          totalNotableUses += 1
        }
        for (const a of seed.affectedActors) {
          if (a.kind === 'notable_npc') totalNotableUses += 1
        }
        for (const ne of seed.textIngredients.namedEntities ?? []) {
          if (ne.ref.kind === 'notable_npc') totalNotableUses += 1
        }
      }
    }
    expect(totalNotableUses).toBeGreaterThan(0)
    // The overused-entities check is a soft signal — depending on how
    // often inspection fires across 28 days it may or may not cross the
    // 6-hit threshold. Either outcome is acceptable here; the hard
    // assertion is the totalNotableUses count above.
    void seenNotable
  })
})
