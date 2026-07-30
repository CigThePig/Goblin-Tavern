import type { SimContext } from '../../core/context'
import type { AreaState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { areAreasAdjacent, getAreaAdjacency } from '../../registries/areaRegistry'

import { PATRONS_PER_PRIVY_STALL, getUsableCapacity } from './capacity'
import { writeAreasSlice, type AreaPropagationEntry } from './state'

// Expansion Phase 2 §2.4 — bounded area interaction.
//
// The rule the plan sets is not "connect everything": it is "each propagation
// edge must have a clear physical or functional reason", and "avoid an
// all-to-all network". This file is the whole list. Nine areas could carry 36
// undirected pairs; there are EIGHT edges here, and the two that cross
// between rooms travel along an adjacency link declared in `areaRegistry`
// (`door`, `stair`, `structural`, `plumbing`, `yard`). The rest act within one
// area, along a physical route named in the edge's own `reason` string.
//
// Two properties are enforced by test rather than by hope:
//
//   * every edge names a real route — `assertPropagationEdgesAreGrounded`
//     checks each area-to-area edge against the adjacency graph;
//   * propagation does not cascade — edges read the state at the top of the
//     pass and each writes at most one target, so a filthy kitchen cannot
//     ricochet through four rooms in one day. Chains form across DAYS, which
//     is legible, rather than within one tick, which is not.

const SOURCE = 'areas.propagation'

export type AreaPropagationEdge = {
  id: string
  fromAreaId: string
  /** Absent when the consequence lands outside the area graph (stock, yield). */
  toAreaId?: string
  /** The physical route. Read by the grounding test, not just by the report. */
  reason: string
  /**
   * Apply the edge. Returns a readable line when it fired, `undefined` when
   * the precondition was not met. Must write at most one target.
   */
  apply: (ctx: SimContext, snapshot: PropagationSnapshot) => string | undefined
}

/**
 * State read once at the top of the pass.
 *
 * Every edge reads this rather than live state, so the order edges run in
 * cannot change the outcome — the determinism the segmented-route and
 * save/reload equivalence checks depend on.
 */
export type PropagationSnapshot = {
  areas: Record<string, AreaState>
  /** Patrons the tavern held today, from the customers module's turnouts. */
  occupancy: number
  /** Pooled usable seating across customer-facing areas. */
  usableSeats: number
}

function nudgeArea(
  ctx: SimContext,
  areaId: string,
  field: 'condition' | 'cleanliness' | 'mess' | 'damage' | 'smell' | 'risk',
  delta: number,
  edge: { id: string; reason: string },
  readable: string,
): string | undefined {
  const area = ctx.state.areas[areaId]
  if (!area) return undefined
  const next = clampPercent(area[field] + delta)
  if (next === area[field]) return undefined
  ctx.modifyArea(
    areaId,
    { [field]: next },
    {
      source: `${SOURCE}.${edge.id}`,
      reason: edge.id,
      target: `area:${areaId}.${field}`,
      targetType: 'area',
      amount: next - area[field],
      readable,
      tags: ['area', 'propagation', edge.id, areaId, field],
      relatedLocations: [{ kind: 'area', id: areaId }],
      relatedSystems: ['areas'],
    },
  )
  return readable
}

function addProblem(
  ctx: SimContext,
  areaId: string,
  problem: string,
  edgeId: string,
  readable: string,
): void {
  const area = ctx.state.areas[areaId]
  if (!area || area.activeProblems.includes(problem)) return
  ctx.modifyArea(
    areaId,
    { activeProblems: [...area.activeProblems, problem] },
    {
      source: `${SOURCE}.${edgeId}`,
      reason: edgeId,
      target: `area:${areaId}.activeProblems`,
      targetType: 'area',
      readable,
      tags: ['area', 'propagation', edgeId, areaId, problem],
      relatedLocations: [{ kind: 'area', id: areaId }],
      relatedSystems: ['areas'],
    },
  )
}

export const AREA_PROPAGATION_EDGES: ReadonlyArray<AreaPropagationEdge> = [
  // 1. Kitchen filth → food safety. The route is the food itself: what is
  //    prepped on a filthy surface goes out to the room.
  {
    id: 'kitchen_filth_to_food_safety',
    fromAreaId: 'kitchen',
    reason: 'Food prepped on filthy surfaces goes straight out to the room.',
    apply: (ctx, snapshot) => {
      const kitchen = snapshot.areas['kitchen']
      if (!kitchen || kitchen.cleanliness >= 30) return undefined
      addProblem(
        ctx,
        'kitchen',
        'unsafe_food_prep',
        'kitchen_filth_to_food_safety',
        'The kitchen is too filthy to prep food safely.',
      )
      return nudgeArea(
        ctx,
        'kitchen',
        'risk',
        2,
        {
          id: 'kitchen_filth_to_food_safety',
          reason: 'Food prepped on filthy surfaces goes straight out to the room.',
        },
        `Kitchen filth (cleanliness ${kitchen.cleanliness}) made the prep bench unsafe.`,
      )
    },
  },

  // 2. Cellar pests → stock. The route is the stair the barrels come up:
  //    what gets into the cellar gets into what is stored there.
  {
    id: 'cellar_pests_to_stock',
    fromAreaId: 'cellar',
    reason: 'Pests in the cellar get into the barrels stored there.',
    apply: (ctx, snapshot) => {
      const cellar = snapshot.areas['cellar']
      if (!cellar || cellar.risk < 60) return undefined
      // Hits the perishable item with the most units in the cellar, so the
      // loss is concrete and attributable rather than a spread smear.
      const stored = Object.values(ctx.state.stock)
        .filter((item) => item.storageAreaId === 'cellar' && item.quantity > 0)
        .sort((a, b) => b.quantity - a.quantity || a.id.localeCompare(b.id))
      const target = stored[0]
      if (!target) return undefined
      const spoilage = clampPercent(target.spoilage + 4)
      if (spoilage === target.spoilage) return undefined
      ctx.modifyStock(
        target.id,
        { spoilage },
        {
          source: `${SOURCE}.cellar_pests_to_stock`,
          sourceType: 'area',
          direction: 'increase',
          amount: spoilage - target.spoilage,
          readable: `Cellar pests got at the ${target.label}.`,
          tags: ['area', 'propagation', 'pests', 'cellar', target.id],
          relatedActors: [{ kind: 'stock', id: target.id }],
          relatedLocations: [{ kind: 'area', id: 'cellar' }],
          relatedSystems: ['areas', 'stock'],
        },
      )
      return `Cellar pests (risk ${cellar.risk}) got at the ${target.label}.`
    },
  },

  // 3. Roof damage → the room under it. The route is the structural
  //    adjacency: water comes through the ceiling into whatever is below.
  {
    id: 'roof_damage_to_main_room',
    fromAreaId: 'roof',
    toAreaId: 'main_room',
    reason: 'The roof sits directly over the main room; water comes through.',
    apply: (ctx, snapshot) => {
      const roof = snapshot.areas['roof']
      if (!roof || roof.damage < 55) return undefined
      return nudgeArea(
        ctx,
        'main_room',
        'condition',
        -1,
        {
          id: 'roof_damage_to_main_room',
          reason: 'The roof sits directly over the main room; water comes through.',
        },
        `Roof damage (${roof.damage}) let water into the main room.`,
      )
    },
  },

  // 4. Roof damage → the kitchen. Same route, second room: the flue and the
  //    kitchen ceiling share the same structure.
  {
    id: 'roof_damage_to_kitchen',
    fromAreaId: 'roof',
    toAreaId: 'kitchen',
    reason: 'The kitchen flue runs up through the roof; a bad roof soaks the kitchen.',
    apply: (ctx, snapshot) => {
      const roof = snapshot.areas['roof']
      if (!roof || roof.damage < 70) return undefined
      return nudgeArea(
        ctx,
        'kitchen',
        'damage',
        1,
        {
          id: 'roof_damage_to_kitchen',
          reason:
            'The kitchen flue runs up through the roof; a bad roof soaks the kitchen.',
        },
        `Roof damage (${roof.damage}) reached the kitchen through the flue.`,
      )
    },
  },

  // 5. Crowding → mess and wear in the main room. The route is the bodies:
  //    more patrons than seats means more spillage and more shoving.
  {
    id: 'crowding_to_main_room_wear',
    fromAreaId: 'main_room',
    reason: 'More patrons than seats means more spillage and more shoving.',
    apply: (ctx, snapshot) => {
      const overflow = snapshot.occupancy - snapshot.usableSeats
      if (overflow <= 0) return undefined
      const mess = Math.min(4, 1 + Math.floor(overflow / 12))
      return nudgeArea(
        ctx,
        'main_room',
        'mess',
        mess,
        {
          id: 'crowding_to_main_room_wear',
          reason: 'More patrons than seats means more spillage and more shoving.',
        },
        `${overflow} patrons over ${snapshot.usableSeats} usable seats left the room in a state.`,
      )
    },
  },

  // 6. Crowding → conflict risk. Same overflow, different consequence, and
  //    deliberately a second edge rather than a second write in edge 5: one
  //    edge, one target.
  {
    id: 'crowding_to_main_room_risk',
    fromAreaId: 'main_room',
    reason: 'A packed room with no room to step back is where fights start.',
    apply: (ctx, snapshot) => {
      const overflow = snapshot.occupancy - snapshot.usableSeats
      if (overflow < 15) return undefined
      return nudgeArea(
        ctx,
        'main_room',
        'risk',
        Math.min(3, Math.floor(overflow / 15)),
        {
          id: 'crowding_to_main_room_risk',
          reason: 'A packed room with no room to step back is where fights start.',
        },
        `${overflow} patrons past capacity had nowhere to step back to.`,
      )
    },
  },

  // 7. Privy overload → smell, which travels back through the door patrons
  //    walk through. The stall count is real capacity, so building
  //    `stone_drainage` is what fixes it.
  {
    id: 'privy_overload_to_smell',
    fromAreaId: 'privy',
    reason: 'Too few working stalls for the crowd; the smell comes back through the door.',
    apply: (ctx, snapshot) => {
      const privy = snapshot.areas['privy']
      if (!privy) return undefined
      const stalls = getUsableCapacity(privy, 'seats')
      const needed = Math.ceil(snapshot.occupancy / PATRONS_PER_PRIVY_STALL)
      if (needed <= stalls) return undefined
      return nudgeArea(
        ctx,
        'privy',
        'smell',
        Math.min(4, (needed - stalls) * 2),
        {
          id: 'privy_overload_to_smell',
          reason:
            'Too few working stalls for the crowd; the smell comes back through the door.',
        },
        `${snapshot.occupancy} patrons needed ${needed} stalls; ${stalls} were usable.`,
      )
    },
  },

  // 8. Garden neglect → yield. The route is the soil: the weekly trickle in
  //    `areasModule`'s `endWeek` hook reads this problem flag.
  {
    id: 'garden_neglect_to_yield',
    fromAreaId: 'herb_garden',
    reason: 'An unweeded, unwatered bed grows less.',
    apply: (ctx, snapshot) => {
      const garden = snapshot.areas['herb_garden']
      if (!garden) return undefined
      const neglected = garden.condition < 40 || garden.cleanliness < 35
      const flagged = garden.activeProblems.includes('bed_neglected')
      if (neglected && !flagged) {
        addProblem(
          ctx,
          'herb_garden',
          'bed_neglected',
          'garden_neglect_to_yield',
          'The herb bed has gone to weeds — this week’s cut will be thin.',
        )
        return 'The herb bed has gone to weeds; the weekly cut will be thin.'
      }
      if (!neglected && flagged) {
        ctx.modifyArea(
          'herb_garden',
          {
            activeProblems: garden.activeProblems.filter(
              (p) => p !== 'bed_neglected',
            ),
          },
          {
            source: `${SOURCE}.garden_neglect_to_yield`,
            reason: 'garden_neglect_to_yield',
            target: 'area:herb_garden.activeProblems',
            targetType: 'area',
            readable: 'The herb bed is back in order.',
            tags: ['area', 'propagation', 'garden_neglect_to_yield', 'herb_garden'],
            relatedLocations: [{ kind: 'area', id: 'herb_garden' }],
            relatedSystems: ['areas'],
          },
        )
        return 'The herb bed is back in order.'
      }
      return undefined
    },
  },
]

/**
 * Build the snapshot every edge reads.
 *
 * `occupancy` comes from the customers module's turnouts, which are written
 * during the `service` phase — so propagation runs after service, never
 * before.
 */
export function buildPropagationSnapshot(state: TavernState): PropagationSnapshot {
  const turnouts =
    (state.modules['customers'] as
      | { turnouts?: ReadonlyArray<{ visitors: number }> }
      | undefined)?.turnouts ?? []
  const occupancy = turnouts.reduce((sum, t) => sum + Math.max(0, t.visitors), 0)

  let usableSeats = 0
  for (const area of Object.values(state.areas)) {
    if (!area.tags.includes('customer_facing')) continue
    usableSeats += getUsableCapacity(area, 'seats')
  }

  return { areas: state.areas, occupancy, usableSeats }
}

/** Run every edge once, in declaration order, against one frozen snapshot. */
export function applyAreaPropagation(ctx: SimContext): void {
  const snapshot = buildPropagationSnapshot(ctx.state)
  const fired: AreaPropagationEntry[] = []
  for (const edge of AREA_PROPAGATION_EDGES) {
    const readable = edge.apply(ctx, snapshot)
    if (!readable) continue
    fired.push({
      edgeId: edge.id,
      fromAreaId: edge.fromAreaId,
      ...(edge.toAreaId ? { toAreaId: edge.toAreaId } : {}),
      reason: edge.reason,
      readable,
    })
  }
  if (fired.length === 0) return
  writeAreasSlice(
    ctx,
    (current) => ({ ...current, propagation: fired }),
    'propagation',
  )
}

/**
 * §2.4's own guard, exported so a test can assert it rather than trusting the
 * comments: every edge that crosses between two areas must travel along a
 * declared adjacency link.
 */
export function findUngroundedPropagationEdges(): Array<{
  edgeId: string
  problem: string
}> {
  const problems: Array<{ edgeId: string; problem: string }> = []
  for (const edge of AREA_PROPAGATION_EDGES) {
    if (edge.reason.trim().length === 0) {
      problems.push({ edgeId: edge.id, problem: 'edge declares no reason' })
    }
    if (!edge.toAreaId) continue
    if (edge.toAreaId === edge.fromAreaId) {
      problems.push({
        edgeId: edge.id,
        problem: 'cross-area edge names its own source as the target',
      })
      continue
    }
    if (!areAreasAdjacent(edge.fromAreaId, edge.toAreaId)) {
      problems.push({
        edgeId: edge.id,
        problem: `${edge.fromAreaId} and ${edge.toAreaId} are not adjacent`,
      })
      continue
    }
    const link = getAreaAdjacency(edge.fromAreaId, edge.toAreaId)
    if (!link) {
      problems.push({ edgeId: edge.id, problem: 'adjacency link not resolvable' })
    }
  }
  return problems
}
