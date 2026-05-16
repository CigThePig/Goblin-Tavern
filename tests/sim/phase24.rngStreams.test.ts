import { describe, it, expect } from 'vitest'

import {
  createRng,
  createRngStreams,
  type RngStreamId,
  type SimRng,
} from '../../src/sim/core/rng'
import type { SimulationModule } from '../../src/sim/core/module'
import { simulateDay } from '../../src/sim/core/engine'
import { createInitialTavernState } from '../../src/sim/state/defaults'
import {
  STARTER_NAMING_PROFILES,
  ensureStarterNamingProfilesRegistered,
  namingProfileRegistry,
} from '../../src/sim/content/naming/namingProfiles'
import { generateName } from '../../src/sim/content/naming/nameGenerator'

// Phase 24 — RNG streams and deterministic identity generation.
//
// These tests verify that:
//   1. Named RNG streams isolate identity-style rolls from per-day
//      service rolls.
//   2. The same seed + stream id produces the same sequence.
//   3. Stream snapshots round-trip through `createRngStreams(seed, snap)`.
//   4. `ctx.rng` still maps to the `service` stream so legacy modules
//      keep working.
//   5. `generateName()` is deterministic against a seeded RNG stream.

const SEED = 'phase-24-streams-test'

function collectFloats(rng: SimRng, count: number): number[] {
  const out: number[] = []
  for (let i = 0; i < count; i += 1) {
    out.push(rng.float())
  }
  return out
}

describe('Phase 24 — RNG streams', () => {
  it('1. same seed and same stream id produce the same float sequence', () => {
    const a = createRngStreams(SEED)
    const b = createRngStreams(SEED)
    expect(collectFloats(a.get('staff_identity'), 10)).toEqual(
      collectFloats(b.get('staff_identity'), 10),
    )
  })

  it('2. same seed but different streams produce different sequences', () => {
    const streams = createRngStreams(SEED)
    const namesSeq = collectFloats(streams.get('staff_identity'), 10)
    const serviceSeq = collectFloats(streams.get('service'), 10)
    expect(namesSeq).not.toEqual(serviceSeq)
  })

  it('3. calls in the service stream do not affect the names stream', () => {
    const streamsA = createRngStreams(SEED)
    const namesA = collectFloats(streamsA.get('staff_identity'), 5)

    const streamsB = createRngStreams(SEED)
    // Burn a bunch of rolls on the service stream first.
    collectFloats(streamsB.get('service'), 50)
    const namesB = collectFloats(streamsB.get('staff_identity'), 5)

    expect(namesA).toEqual(namesB)
  })

  it('4. snapshot() returns serializable stream state with call counts', () => {
    const streams = createRngStreams(SEED)
    streams.get('staff_identity').float()
    streams.get('staff_identity').float()
    streams.get('service').float()

    const snap = streams.snapshot()
    expect(snap.staff_identity.calls).toBe(2)
    expect(snap.service.calls).toBe(1)

    const roundTrip = JSON.parse(JSON.stringify(snap)) as typeof snap
    expect(roundTrip.staff_identity.calls).toBe(2)
    expect(roundTrip.service.calls).toBe(1)
    // Every declared stream id should be present in the snapshot.
    // Phase 63 / ISSUE-023 — list pruned to streams with real callers.
    const streamIds: RngStreamId[] = [
      'service',
      'incidents',
      'npc_identity',
      'staff_identity',
      'regular_identity',
      'seasonal_events',
      'attribution_perceiver',
      'adventurer_roster',
    ]
    for (const id of streamIds) {
      expect(snap[id]).toBeDefined()
      expect(typeof snap[id].seed).toBe('string')
      expect(snap[id].calls).toBe(snap[id].calls | 0)
    }
  })

  it('5. recreating streams from a snapshot resumes call counts correctly', () => {
    const a = createRngStreams(SEED)
    const names = a.get('staff_identity')
    names.float()
    names.float()
    const expectedThird = names.float()

    const snap = a.snapshot()
    // After 3 floats, the snapshot should record calls=3 for `names`.
    expect(snap.staff_identity.calls).toBe(3)

    // Resume from a snapshot taken after 2 calls.
    const partialSnap = {
      ...snap,
      staff_identity: { ...snap.staff_identity, calls: 2 },
    }
    const b = createRngStreams(SEED, partialSnap)
    const replayedThird = b.get('staff_identity').float()
    expect(replayedThird).toBe(expectedThird)
  })

  it('6. ctx.rng still works in existing simulation modules', () => {
    const rolls: number[] = []
    const probe: SimulationModule = {
      id: 'rng_legacy_probe',
      version: '0.1.0',
      hooks: {
        startDay: [
          (ctx) => {
            rolls.push(ctx.rng.int(1, 100))
          },
        ],
      },
    }
    const result = simulateDay(createInitialTavernState(), { seed: SEED }, [probe])
    expect(result.state).toBeDefined()
    expect(rolls.length).toBe(1)
    expect(Number.isInteger(rolls[0] as number)).toBe(true)
  })

  it('7. ctx.getRngStream("names") works inside a minimal test module', () => {
    let nameRoll = -1
    let serviceRoll = -1
    const probe: SimulationModule = {
      id: 'rng_stream_probe',
      version: '0.1.0',
      hooks: {
        startDay: [
          (ctx) => {
            const names = ctx.getRngStream('staff_identity')
            const service = ctx.rng
            nameRoll = names.int(1, 100)
            serviceRoll = service.int(1, 100)
          },
        ],
      },
    }
    simulateDay(createInitialTavernState(), { seed: SEED }, [probe])
    expect(nameRoll).toBeGreaterThanOrEqual(1)
    expect(nameRoll).toBeLessThanOrEqual(100)
    expect(serviceRoll).toBeGreaterThanOrEqual(1)
    expect(serviceRoll).toBeLessThanOrEqual(100)
    // Same seed + stream id should reproduce the name roll.
    const independent = createRngStreams(SEED).get('staff_identity').int(1, 100)
    expect(independent).toBe(nameRoll)
  })

  it('8. generateName() produces the same name for same seed and stream', () => {
    ensureStarterNamingProfilesRegistered()
    expect(namingProfileRegistry.has('goblin_common')).toBe(true)
    const profile = namingProfileRegistry.get('goblin_common')

    const a = createRngStreams(SEED).get('staff_identity')
    const b = createRngStreams(SEED).get('staff_identity')
    const nameA = generateName(profile, a, 'test')
    const nameB = generateName(profile, b, 'test')
    expect(nameA.display).toBe(nameB.display)
    expect(nameA.profileId).toBe('goblin_common')
    expect(nameA.parts.given).toBeDefined()
    expect(nameA.generatedBy).toBe('test')
  })

  it('9. generateName() changes when using a different stream or seed', () => {
    ensureStarterNamingProfilesRegistered()
    const profile = namingProfileRegistry.get('goblin_common')

    const staff = createRngStreams(SEED).get('staff_identity')
    const regular = createRngStreams(SEED).get('regular_identity')
    const altSeed = createRngStreams(`${SEED}-alt`).get('staff_identity')

    // Generate several names from each stream and require the sequences differ.
    const seq = (rng: SimRng): string[] =>
      Array.from({ length: 5 }, () => generateName(profile, rng, 'test').display)
    const fromStaff = seq(staff)
    const fromRegular = seq(regular)
    const fromAltSeed = seq(altSeed)
    expect(fromStaff).not.toEqual(fromRegular)
    expect(fromStaff).not.toEqual(fromAltSeed)
  })

  it('10. existing Phase 4 createRng API still works (backwards compatible)', () => {
    const a = createRng('crooked-keg')
    const b = createRng('crooked-keg')
    expect(collectFloats(a, 5)).toEqual(collectFloats(b, 5))
    expect(STARTER_NAMING_PROFILES.length).toBeGreaterThan(0)
  })
})
