import Prando from 'prando'

export type RngState = {
  seed: string
  calls: number
}

export type SimRng = {
  state: RngState
  float: () => number
  int: (min: number, max: number) => number
  chance: (probability: number) => boolean
  pick: <T>(items: T[]) => T
  weightedPick: <T>(items: Array<{ item: T; weight: number }>) => T
}

export type SimulationRunConfig = {
  seed: string
}

export type RngDebugMetadata = {
  seed: string
  callsBefore: number
  callsAfter: number
}

export function createRng(seed: string, calls: number = 0): SimRng {
  if (!Number.isInteger(calls) || calls < 0) {
    throw new Error(
      `createRng(seed, calls): calls must be a non-negative integer, got ${calls}`,
    )
  }

  const prando = new Prando(seed)
  if (calls > 0) {
    prando.skip(calls)
  }

  const state: RngState = { seed, calls }

  const float = (): number => {
    const value = prando.next()
    state.calls += 1
    return value
  }

  const int = (min: number, max: number): number => {
    if (max < min) {
      throw new Error(`int(min, max): max (${max}) must be >= min (${min})`)
    }
    const roll = float()
    return min + Math.floor(roll * (max - min + 1))
  }

  const chance = (probability: number): boolean => {
    if (
      typeof probability !== 'number' ||
      Number.isNaN(probability) ||
      probability < 0 ||
      probability > 1
    ) {
      throw new Error(
        `chance(probability): probability must be within [0, 1], got ${probability}`,
      )
    }
    if (probability === 0) return false
    if (probability === 1) return true
    return float() < probability
  }

  const pick = <T>(items: T[]): T => {
    if (items.length === 0) {
      throw new Error('pick(items): items must not be empty')
    }
    if (items.length === 1) {
      return items[0] as T
    }
    const index = int(0, items.length - 1)
    return items[index] as T
  }

  const weightedPick = <T>(items: Array<{ item: T; weight: number }>): T => {
    if (items.length === 0) {
      throw new Error('weightedPick(items): items must not be empty')
    }
    let total = 0
    for (const entry of items) {
      if (typeof entry.weight !== 'number' || Number.isNaN(entry.weight) || entry.weight <= 0) {
        throw new Error(
          `weightedPick(items): every weight must be a positive number, got ${entry.weight}`,
        )
      }
      total += entry.weight
    }
    if (!(total > 0)) {
      throw new Error('weightedPick(items): total weight must be > 0')
    }
    if (items.length === 1) {
      return (items[0] as { item: T; weight: number }).item
    }
    const roll = float() * total
    let cursor = 0
    for (const entry of items) {
      cursor += entry.weight
      if (roll < cursor) {
        return entry.item
      }
    }
    return (items[items.length - 1] as { item: T; weight: number }).item
  }

  return { state, float, int, chance, pick, weightedPick }
}

// Phase 24 §"Required RNG Stream Types" — named RNG streams.
//
// Different identity-style systems (names, suppliers, regulars) must use
// isolated streams so a per-day service roll cannot accidentally shift a
// generated name. Each stream derives its seed from the run's base seed
// (`${seed}:${streamId}`), keeps its own call counter, and can be
// snapshotted to a plain JSON-safe record.

export type RngStreamId =
  | 'service'
  | 'economy'
  | 'incidents'
  | 'names'
  | 'npc_identity'
  | 'staff_identity'
  | 'supplier_identity'
  | 'regular_identity'
  | 'faction_behaviour'
  | 'seasonal_events'
  | 'issue_seed_selection'
  | 'attribution_perceiver'
  // Phase 69 / ISSUE-029 §5.4 — weekly drift roll for the hireable
  // adventurer roster: who arrives, who leaves. Names continue to use
  // `npc_identity`.
  | 'adventurer_roster'

export type RngStreamState = Record<RngStreamId, RngState>

export type SimRngStreams = {
  baseSeed: string
  get: (streamId: RngStreamId) => SimRng
  /**
   * Phase 70 / ISSUE-030 §6.3 — dynamic named stream. Used for
   * per-instance ids (e.g. `expedition_<expeditionId>`,
   * `ingredient_quality_<expeditionId>`) that can't enumerate at
   * compile time. The seed is derived as `${baseSeed}:${name}`, so
   * the same baseSeed + name always returns an RNG with the same
   * initial state — saves can resume mid-run and produce the same
   * resolution. The dynamic stream is not tracked in `snapshot()`;
   * callers must read it once at resolution.
   */
  getByName: (name: string) => SimRng
  snapshot: () => RngStreamState
}

const ALL_STREAM_IDS: ReadonlyArray<RngStreamId> = [
  'service',
  'economy',
  'incidents',
  'names',
  'npc_identity',
  'staff_identity',
  'supplier_identity',
  'regular_identity',
  'faction_behaviour',
  'seasonal_events',
  'issue_seed_selection',
  'attribution_perceiver',
  // Phase 69 / ISSUE-029.
  'adventurer_roster',
]

export function createRngStreams(
  seed: string,
  initialState?: Partial<RngStreamState>,
): SimRngStreams {
  const cache = new Map<RngStreamId, SimRng>()

  const get = (streamId: RngStreamId): SimRng => {
    const existing = cache.get(streamId)
    if (existing) return existing

    const prior = initialState?.[streamId]
    const streamSeed = prior?.seed ?? `${seed}:${streamId}`
    const rng = createRng(streamSeed, prior?.calls ?? 0)
    cache.set(streamId, rng)
    return rng
  }

  // Phase 70 / ISSUE-030 §6.3 — dynamic stream factory. The returned
  // RNG is freshly seeded from `${seed}:${name}`; the same name
  // always produces an RNG with the same starting state across
  // reloads. Callers consume it once per resolution.
  const getByName = (name: string): SimRng => {
    return createRng(`${seed}:${name}`, 0)
  }

  const snapshot = (): RngStreamState => {
    const out = {} as RngStreamState
    for (const id of ALL_STREAM_IDS) {
      const rng = cache.get(id)
      if (rng) {
        out[id] = { seed: rng.state.seed, calls: rng.state.calls }
      } else {
        const prior = initialState?.[id]
        out[id] = {
          seed: prior?.seed ?? `${seed}:${id}`,
          calls: prior?.calls ?? 0,
        }
      }
    }
    return out
  }

  return { baseSeed: seed, get, getByName, snapshot }
}
