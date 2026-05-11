import type { MemoryState, TavernState } from '../../state/TavernState'
import type { MemoryDraft } from './memoryTypes'
import { getMemoriesByDefinition } from './memoryQueries'

// Phase 16 §16.6 — Pattern detection.
//
// Pattern detection runs weekly. It scans the current memory list for
// repeated events and, when the threshold is hit, emits one or more
// pattern memory drafts (the memory module then adds them via the
// stacking strategy declared in the registry). This is intentionally
// simple: a handful of explicit rules backed by counts and thresholds.

export type PatternResult = MemoryDraft[]

// "3 ale shortages in 14 days" — count any ale shortage memory still
// alive (a stacked occurrence keeps a high strength even after the
// most recent one expires). We treat the count via stacked strength:
// the registry uses `increase_strength`, so the live memory's strength
// rises by ~35 each time. >= 80 strength corresponds to ~3 stacks.
function detectRepeatedAleShortages(memories: ReadonlyArray<MemoryState>): MemoryDraft | null {
  const aleMemories = getMemoriesByDefinition(memories, 'ale_shortage_recently')
  if (aleMemories.length === 0) return null
  const strongest = aleMemories.reduce(
    (max, m) => (m.strength > max ? m.strength : max),
    0,
  )
  if (strongest < 75) return null
  return {
    id: 'repeated_ale_shortages',
    strength: Math.min(100, strongest),
    relatedSystems: ['stock', 'reputation'],
    tags: ['pattern', 'stock', 'ale', 'shortage'],
    source: 'memories.pattern_detection',
  }
}

function detectRepeatedUnpaidWages(memories: ReadonlyArray<MemoryState>): MemoryDraft | null {
  const wageMemories = getMemoriesByDefinition(memories, 'wages_unpaid_recently')
  if (wageMemories.length === 0) return null
  const strongest = wageMemories.reduce(
    (max, m) => (m.strength > max ? m.strength : max),
    0,
  )
  // Each unpaid week stacks +50 strength → two weeks ≈ 100. One unpaid
  // week is enough to start the pattern memory.
  if (strongest < 50) return null
  return {
    id: 'repeated_unpaid_wages',
    strength: Math.min(100, strongest),
    relatedSystems: ['staff'],
    tags: ['pattern', 'staff', 'wages', 'risk'],
    source: 'memories.pattern_detection',
  }
}

// Phase 16 §16.6 — "roof below threshold for 10 days". We can read the
// current roof condition directly from state and count how long
// `roof_patched_recently` has been absent / how high `damage` has sat.
// We approximate the "10 days" rule with: roof damage >= 50 and no
// `roof_patched_recently` memory present.
function detectHabitualRoofNeglect(state: TavernState): MemoryDraft | null {
  const roof = state.areas['roof']
  if (!roof) return null
  if (roof.damage < 50 && roof.condition > 35) return null
  const patched = getMemoriesByDefinition(state.memories, 'roof_patched_recently')
  if (patched.length > 0) return null
  return {
    id: 'habitual_roof_neglect',
    strength: Math.min(100, 40 + roof.damage / 2),
    relatedSystems: ['areas'],
    tags: ['pattern', 'maintenance', 'roof'],
    source: 'memories.pattern_detection',
    locations: [{ kind: 'area', id: 'roof' }],
  }
}

// Phase 16 §16.6 — "merchant satisfaction falling for 2 weeks". We use
// stacked `merchants_unhappy_recently` memory strength as a proxy.
function detectMerchantDecline(memories: ReadonlyArray<MemoryState>): MemoryDraft | null {
  const merchMemories = getMemoriesByDefinition(memories, 'merchants_unhappy_recently')
  if (merchMemories.length === 0) return null
  const strongest = merchMemories.reduce(
    (max, m) => (m.strength > max ? m.strength : max),
    0,
  )
  if (strongest < 65) return null
  return {
    id: 'merchant_decline_pattern',
    strength: Math.min(100, strongest),
    relatedSystems: ['customers', 'reputation'],
    tags: ['pattern', 'customers', 'merchants'],
    source: 'memories.pattern_detection',
    actors: [{ kind: 'customer_group', id: 'merchants' }],
  }
}

export function detectPatterns(state: TavernState): PatternResult {
  const out: MemoryDraft[] = []
  const ale = detectRepeatedAleShortages(state.memories)
  if (ale) out.push(ale)
  const wages = detectRepeatedUnpaidWages(state.memories)
  if (wages) out.push(wages)
  const roof = detectHabitualRoofNeglect(state)
  if (roof) out.push(roof)
  const merch = detectMerchantDecline(state.memories)
  if (merch) out.push(merch)
  return out
}
