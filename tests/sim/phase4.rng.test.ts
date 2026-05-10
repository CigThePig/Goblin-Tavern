import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRng, type SimRng } from '../../src/sim/core/rng'

const here = dirname(fileURLToPath(import.meta.url))

const collectFloats = (rng: SimRng, count: number): number[] => {
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    out.push(rng.float())
  }
  return out
}

describe('Phase 4 — Deterministic RNG', () => {
  it('same seed produces same float sequence', () => {
    const a = createRng('crooked-keg')
    const b = createRng('crooked-keg')
    expect(collectFloats(a, 10)).toEqual(collectFloats(b, 10))
  })

  it('different seeds produce different float sequences', () => {
    const a = createRng('crooked-keg')
    const b = createRng('mossy-stump')
    const seqA = collectFloats(a, 10)
    const seqB = collectFloats(b, 10)
    expect(seqA).not.toEqual(seqB)
  })

  it('call count increments correctly across helpers', () => {
    const rng = createRng('crooked-keg')
    expect(rng.state.calls).toBe(0)

    rng.float()
    expect(rng.state.calls).toBe(1)

    rng.int(0, 10)
    expect(rng.state.calls).toBe(2)

    // chance(0) and chance(1) are deterministic and must not consume calls
    rng.chance(0)
    rng.chance(1)
    expect(rng.state.calls).toBe(2)

    // chance with a non-edge probability does consume one call
    rng.chance(0.5)
    expect(rng.state.calls).toBe(3)

    // pick with a single item is deterministic and must not consume calls
    rng.pick(['only'])
    expect(rng.state.calls).toBe(3)

    // pick with multiple items consumes one call
    rng.pick(['a', 'b', 'c'])
    expect(rng.state.calls).toBe(4)

    // weightedPick with a single entry is deterministic and must not consume calls
    rng.weightedPick([{ item: 'solo', weight: 1 }])
    expect(rng.state.calls).toBe(4)

    // weightedPick with multiple entries consumes one call
    rng.weightedPick([
      { item: 'a', weight: 1 },
      { item: 'b', weight: 1 },
    ])
    expect(rng.state.calls).toBe(5)
  })

  it('replay from seed and call count produces the same value', () => {
    const rngA = createRng('crooked-keg', 0)
    rngA.float()
    const second = rngA.float()

    const rngB = createRng('crooked-keg', 1)
    const replaySecond = rngB.float()

    expect(replaySecond).toBe(second)
    expect(rngB.state.calls).toBe(2)
  })

  it('int(min, max) stays within inclusive bounds', () => {
    const rng = createRng('crooked-keg')
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(-3, 7)
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(-3)
      expect(v).toBeLessThanOrEqual(7)
    }
  })

  it('int with equal min and max always returns that value', () => {
    const rng = createRng('crooked-keg')
    for (let i = 0; i < 20; i++) {
      expect(rng.int(4, 4)).toBe(4)
    }
  })

  it('int throws when max < min', () => {
    const rng = createRng('crooked-keg')
    expect(() => rng.int(5, 2)).toThrow(/max.*min/)
  })

  it('chance(0) is always false and chance(1) is always true', () => {
    const rng = createRng('crooked-keg')
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false)
      expect(rng.chance(1)).toBe(true)
    }
  })

  it('chance throws on values outside [0, 1] or NaN', () => {
    const rng = createRng('crooked-keg')
    expect(() => rng.chance(-0.01)).toThrow()
    expect(() => rng.chance(1.01)).toThrow()
    expect(() => rng.chance(Number.NaN)).toThrow()
  })

  it('pick is deterministic for same seed/call position', () => {
    const items = ['ale', 'stew', 'mushrooms', 'firewood']
    const a = createRng('crooked-keg')
    const b = createRng('crooked-keg')
    const picksA = Array.from({ length: 25 }, () => a.pick(items))
    const picksB = Array.from({ length: 25 }, () => b.pick(items))
    expect(picksA).toEqual(picksB)
    for (const pick of picksA) {
      expect(items).toContain(pick)
    }
  })

  it('pick([]) throws', () => {
    const rng = createRng('crooked-keg')
    expect(() => rng.pick([])).toThrow(/empty/)
  })

  it('weightedPick respects deterministic replay', () => {
    const entries = [
      { item: 'ale', weight: 1 },
      { item: 'stew', weight: 2 },
      { item: 'mushrooms', weight: 3 },
    ]
    const a = createRng('crooked-keg')
    const b = createRng('crooked-keg')
    const picksA = Array.from({ length: 25 }, () => a.weightedPick(entries))
    const picksB = Array.from({ length: 25 }, () => b.weightedPick(entries))
    expect(picksA).toEqual(picksB)

    // Replay from a saved call count yields the same next value
    const rngFresh = createRng('crooked-keg')
    rngFresh.weightedPick(entries)
    rngFresh.weightedPick(entries)
    const expectedThird = rngFresh.weightedPick(entries)

    const rngReplay = createRng('crooked-keg', 2)
    const replayedThird = rngReplay.weightedPick(entries)
    expect(replayedThird).toBe(expectedThird)
  })

  it('weightedPick throws on empty input or non-positive weights', () => {
    const rng = createRng('crooked-keg')
    expect(() => rng.weightedPick([])).toThrow(/empty/)
    expect(() =>
      rng.weightedPick([
        { item: 'a', weight: 1 },
        { item: 'b', weight: 0 },
      ]),
    ).toThrow(/positive/)
    expect(() =>
      rng.weightedPick([
        { item: 'a', weight: 1 },
        { item: 'b', weight: -2 },
      ]),
    ).toThrow(/positive/)
    expect(() =>
      rng.weightedPick([{ item: 'a', weight: Number.NaN }]),
    ).toThrow(/positive/)
  })

  it('no simulation module imports or calls Math.random()', () => {
    const simRoot = resolve(here, '..', '..', 'src', 'sim')
    const offenders: string[] = []

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        const stats = statSync(full)
        if (stats.isDirectory()) {
          walk(full)
          continue
        }
        if (!full.endsWith('.ts')) continue
        const contents = readFileSync(full, 'utf8')
        if (contents.includes('Math.random')) {
          offenders.push(full)
        }
      }
    }

    walk(simRoot)
    expect(offenders).toEqual([])
  })
})
