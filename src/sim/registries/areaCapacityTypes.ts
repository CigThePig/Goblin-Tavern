// Expansion Phase 2 §2.1 — the physical capacity vocabulary.
//
// Before this phase an area was six linear meters plus identity: a room
// could be filthy or damaged, but it had no size. Nothing could ask "how
// many patrons fit in here", "is that workbench free", or "does the cellar
// hold the order I just placed" — so capacity language in cards and issue
// seeds (`service:capacity`, `global.service_capacity`) pointed at nothing
// the simulation owned.
//
// These four kinds are deliberately the whole list. They are abstract
// counts, not a tile simulation (the plan explicitly permits a zone model),
// and each one has exactly one meaning and at least one consumer:
//
//   seats         customer-facing places to sit. Consumed by crowding.
//   workstations  exclusive work positions. Consumed by construction
//                 concurrency and kitchen throughput.
//   storage       stock slots. Consumed by spoilage/keeping quality.
//   beds          overnight places. Declared now because two areas have
//                 them physically; the lodging system that consumes them
//                 is not this phase's work.
//
// This file is deliberately tiny and dependency-free: both the area
// registry (base capacity) and the upgrade catalogue (capacity effects)
// import it, and neither may import the other.

export type AreaCapacityKind = 'seats' | 'workstations' | 'storage' | 'beds'

export const AREA_CAPACITY_KINDS: ReadonlyArray<AreaCapacityKind> = [
  'seats',
  'workstations',
  'storage',
  'beds',
]

/** A sparse capacity vector. An absent kind means "none of this here". */
export type AreaCapacity = Partial<Record<AreaCapacityKind, number>>

/**
 * Expansion Phase 2 §2.1 — one access link between two areas.
 *
 * Adjacency is static: rooms do not move. It lives on the registry
 * definition rather than in `TavernState` for the same reason
 * `ingredientYield` does. Links are declared once per unordered pair and
 * read in both directions (`areAreasAdjacent`), so a definition cannot
 * claim a neighbour that does not claim it back.
 */
export type AreaAdjacency = {
  areaId: string
  /**
   * Why these two rooms are connected. Not decoration: §2.4 forbids an
   * all-to-all network, and every propagation edge has to name the
   * physical route it travels along.
   */
  kind: 'door' | 'stair' | 'structural' | 'airflow' | 'plumbing' | 'yard'
  reason: string
}

/** Sum two capacity vectors, dropping kinds that end at zero. */
export function addCapacity(
  base: AreaCapacity,
  delta: AreaCapacity,
): AreaCapacity {
  const out: AreaCapacity = {}
  for (const kind of AREA_CAPACITY_KINDS) {
    const total = (base[kind] ?? 0) + (delta[kind] ?? 0)
    if (total !== 0) out[kind] = total
  }
  return out
}

/** Read one kind, treating an absent kind as zero. */
export function capacityOf(
  capacity: AreaCapacity,
  kind: AreaCapacityKind,
): number {
  return capacity[kind] ?? 0
}
