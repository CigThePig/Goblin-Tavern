import { createRng } from '../../core/rng'

import type { MonthModifier, MonthModifierId } from './types'

// Phase 15 §15.9 — Month modifiers.
//
// A small, fixed catalogue. One modifier is picked per month using a
// deterministic seed derived from (runSeed, year, month). Same inputs
// produce the same modifier — replay safety stays intact.

export const MONTH_MODIFIERS: Record<MonthModifierId, MonthModifier> = {
  rainy_month: {
    id: 'rainy_month',
    label: 'Rainy Month',
    tags: ['weather', 'roof'],
    description: 'Persistent rain. Roof condition matters more.',
  },
  festival_month: {
    id: 'festival_month',
    label: 'Festival Month',
    tags: ['traffic', 'mess'],
    description: 'Crowds and revelry. Mess builds faster.',
  },
  tax_month: {
    id: 'tax_month',
    label: 'Tax Month',
    tags: ['economy', 'landlord'],
    description: 'Levies tighten purses. Rent collection bites harder.',
  },
  mold_bloom: {
    id: 'mold_bloom',
    label: 'Mold Bloom',
    tags: ['cellar', 'sanitation'],
    description: 'Damp creeping in. Cellar smell and risk drift up.',
  },
  quiet_roads: {
    id: 'quiet_roads',
    label: 'Quiet Roads',
    tags: ['traffic', 'recovery'],
    description: 'Little traffic, calmer shifts. Staff catch their breath.',
  },
  adventurer_season: {
    id: 'adventurer_season',
    label: 'Adventurer Season',
    tags: ['traffic', 'damage'],
    description: 'Boots on tables, fights at midnight. Main room takes a beating.',
  },
}

const ALL_MODIFIER_IDS: ReadonlyArray<MonthModifierId> = [
  'rainy_month',
  'festival_month',
  'tax_month',
  'mold_bloom',
  'quiet_roads',
  'adventurer_season',
]

export function getMonthModifier(id: MonthModifierId): MonthModifier {
  const modifier = MONTH_MODIFIERS[id]
  if (!modifier) {
    throw new Error(`Unknown month modifier id: ${id}`)
  }
  return modifier
}

export function listMonthModifiers(): MonthModifier[] {
  return ALL_MODIFIER_IDS.map((id) => getMonthModifier(id))
}

/**
 * Pick the modifier active for a given calendar month, deterministically
 * from the run seed plus the (year, month) coordinate. Calling the same
 * function with the same arguments always yields the same modifier; the
 * Phase 15 RNG-determinism test relies on this contract.
 */
export function pickMonthModifier(
  runSeed: string,
  year: number,
  month: number,
): MonthModifier {
  const monthSeed = `${runSeed}::month::${year}::${month}`
  const rng = createRng(monthSeed)
  const id = rng.pick([...ALL_MODIFIER_IDS])
  return getMonthModifier(id)
}
