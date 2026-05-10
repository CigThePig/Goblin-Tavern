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
