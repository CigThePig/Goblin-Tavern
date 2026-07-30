import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import {
  bumpStaffTotal,
  getStaffModuleState,
  writeStaffSlice,
} from './workforceState'
import {
  EDGE_EXPIRY_DAYS,
  FORMING_EDGE_EXPIRY_DAYS,
  MAX_ACTIVE_EDGES_PER_STAFF,
  MAX_RELATIONSHIP_EDGES,
  MIN_CONTACTS_FOR_ACTIVE_EDGE,
  isActiveEdge,
  type StaffRelationshipEdge,
} from './workforceTypes'

// Expansion Phase 3 §3.3 — bounded relationships, built from actual contact.
//
// THE TWO THINGS THIS DELIBERATELY DOES NOT DO. It does not run every pair every
// day — the plan forbids it, and nine staff members would be 36 edges nobody
// reads. And it does not create an edge the first time two people are in the
// same room: an edge starts FORMING on first contact and only starts having
// consequences at `MIN_CONTACTS_FOR_ACTIVE_EDGE`, so "who does this person
// actually work with" is a fact the run earned rather than a graph it was
// handed.
//
// WHERE CONTACT COMES FROM. Three real events, no more: two people rostered on
// the same station on the same day (`roster.ts`), an owner action aimed at
// somebody (`workforceActions.ts`), and a referral hire vouching for a new
// starter (`laborMarket.ts`). Everything downstream — cover, conflict, training
// help, negotiation, who takes a departure badly — reads the edges those events
// produced.
//
// BOUNDED (§5.11). Per person: `MAX_ACTIVE_EDGES_PER_STAFF` active edges, and
// the weakest is dropped when a stronger one forms. Globally:
// `MAX_RELATIONSHIP_EDGES`. Over time: an active edge lapses after
// `EDGE_EXPIRY_DAYS` without contact, a forming one after
// `FORMING_EDGE_EXPIRY_DAYS` — two people who met twice in a fortnight are not
// colleagues, they are a coincidence.

export const OWNER_REF: EntityRef = { kind: 'system', id: 'owner' }

/** Stable id for a staff–staff edge, order-independent. */
export function coworkerEdgeId(a: string, b: string): string {
  return a < b ? `rel:${a}|${b}` : `rel:${b}|${a}`
}

export function ownerEdgeId(staffId: string): string {
  return `rel:owner|${staffId}`
}

function clampAffinity(value: number): number {
  return Math.max(-100, Math.min(100, Math.round(value)))
}

function clampTrust(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function listEdges(state: {
  modules: Record<string, unknown>
}): StaffRelationshipEdge[] {
  return getStaffModuleState(state).relationships
}

export function getEdge(
  state: { modules: Record<string, unknown> },
  edgeId: string,
): StaffRelationshipEdge | undefined {
  return listEdges(state).find((edge) => edge.id === edgeId)
}

/** Every edge touching this staff member, active or forming. */
export function listEdgesFor(
  state: { modules: Record<string, unknown> },
  staffId: string,
): StaffRelationshipEdge[] {
  return listEdges(state).filter(
    (edge) => edge.from.id === staffId || edge.to.id === staffId,
  )
}

/** Only the edges that have consequences. */
export function listActiveEdgesFor(
  state: { modules: Record<string, unknown> },
  staffId: string,
): StaffRelationshipEdge[] {
  return listEdgesFor(state, staffId).filter(isActiveEdge)
}

/** How the owner and this staff member stand. Undefined until contact repeats. */
export function getOwnerEdge(
  state: { modules: Record<string, unknown> },
  staffId: string,
): StaffRelationshipEdge | undefined {
  return getEdge(state, ownerEdgeId(staffId))
}

/**
 * Owner trust, 0..100, with a neutral default.
 *
 * 50 rather than 0 for someone the owner has never dealt with: a new hire is
 * not suspicious, they are unknown, and starting every relationship at zero
 * trust would make the first raise request impossible for reasons the player
 * cannot see.
 */
export function ownerTrust(
  state: { modules: Record<string, unknown> },
  staffId: string,
): number {
  const edge = getOwnerEdge(state, staffId)
  if (!edge || !isActiveEdge(edge)) return 50
  return edge.trust
}

/**
 * A coworker who could help this member learn.
 *
 * Requires a genuine positive active edge and a real skill gap, so training help
 * is a consequence of the crew getting on rather than a bonus for having two
 * people.
 */
export function findTrainingHelper(
  state: TavernState,
  learnerId: string,
): string | undefined {
  const learner = state.staff[learnerId]
  if (!learner) return undefined
  const candidates = listActiveEdgesFor(state, learnerId)
    .filter((edge) => edge.kind === 'coworker' && edge.affinity >= 20)
    .map((edge) => (edge.from.id === learnerId ? edge.to.id : edge.from.id))
    .map((id) => state.staff[id])
    .filter(
      (other): other is NonNullable<typeof other> =>
        other !== undefined && other.skill >= learner.skill + 8,
    )
    .sort((a, b) => b.skill - a.skill || a.id.localeCompare(b.id))
  return candidates[0]?.id
}

/**
 * Who would cover for this member if they were out.
 *
 * A high-affinity colleague who is actually on duty and not already covering.
 * This is the §3.3 "willingness to cover" consequence, and it is why an owner
 * who lets the crew fall out pays for absences twice.
 *
 * BEING ON DUTY IS CHECKED HERE, not left to the caller. `unavailable` alone is
 * not enough: somebody working out notice carries an `absence` without it, and a
 * rest day is not an absence at all. Picking one of those and letting
 * `buildRoster` reject them meant the next willing colleague was never
 * considered — so an absence that the crew could have covered silently went
 * uncovered.
 */
export function findWillingCover(
  state: TavernState,
  absentStaffId: string,
  alreadyCovering: ReadonlySet<string>,
): string | undefined {
  const candidates = listActiveEdgesFor(state, absentStaffId)
    .filter((edge) => edge.kind === 'coworker' && edge.affinity >= 25)
    .map((edge) => (edge.from.id === absentStaffId ? edge.to.id : edge.from.id))
    .filter((id) => !alreadyCovering.has(id))
    .map((id) => state.staff[id])
    .filter(
      (other): other is NonNullable<typeof other> =>
        other !== undefined &&
        other.unavailable !== true &&
        other.absence === undefined &&
        other.shift !== 'rest',
    )
    .sort((a, b) => b.morale - a.morale || a.id.localeCompare(b.id))
  return candidates[0]?.id
}

/**
 * Somebody this member could TEACH — the mirror of `findTrainingHelper`.
 *
 * Needed because the `training_helper_<staffId>` hook family names the MENTOR as
 * its subject (the response profile gives that person the mentoring fatigue and
 * the loyalty for it), so the resolver has to find the apprentice rather than
 * assume the subject is one.
 */
export function findTrainingLearner(
  state: TavernState,
  helperId: string,
): string | undefined {
  const helper = state.staff[helperId]
  if (!helper) return undefined
  const candidates = listActiveEdgesFor(state, helperId)
    .filter((edge) => edge.kind === 'coworker' && edge.affinity >= 20)
    .map((edge) => (edge.from.id === helperId ? edge.to.id : edge.from.id))
    .map((id) => state.staff[id])
    .filter(
      (other): other is NonNullable<typeof other> =>
        other !== undefined && other.skill + 8 <= helper.skill,
    )
    .sort((a, b) => a.skill - b.skill || a.id.localeCompare(b.id))
  return candidates[0]?.id
}

/** Pairs on the same station who dislike each other enough to make trouble. */
export function findConflictPairs(
  state: { modules: Record<string, unknown> },
  sameStation: ReadonlyArray<[string, string]>,
): StaffRelationshipEdge[] {
  const out: StaffRelationshipEdge[] = []
  for (const [a, b] of sameStation) {
    const edge = getEdge(state, coworkerEdgeId(a, b))
    if (edge && isActiveEdge(edge) && edge.affinity <= -25) out.push(edge)
  }
  return out
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type ContactInput = {
  /** Staff–staff contact. Omit `bStaffId` and pass `withOwner` for an owner edge. */
  aStaffId: string
  bStaffId?: string
  withOwner?: boolean
  affinityDelta?: number
  trustDelta?: number
  reason: string
  /** Contact days to credit at once. A referral counts as several. */
  contacts?: number
  tags?: string[]
}

/**
 * Record that contact happened, and what it did to the relationship.
 *
 * The one writer. Creates the edge if this is the first contact, moves affinity
 * and trust, and enforces both caps in the same pass — so there is no window in
 * which the graph is over budget.
 */
export function noteContact(ctx: SimContext, input: ContactInput): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const a = ctx.state.staff[input.aStaffId]
  if (!a) return
  const isOwnerEdge = input.withOwner === true || input.bStaffId === undefined
  if (!isOwnerEdge && !ctx.state.staff[input.bStaffId!]) return

  const id = isOwnerEdge
    ? ownerEdgeId(input.aStaffId)
    : coworkerEdgeId(input.aStaffId, input.bStaffId!)
  const credit = Math.max(1, input.contacts ?? 1)

  let formed = false
  writeStaffSlice(
    ctx,
    (current) => {
      const existing = current.relationships.find((edge) => edge.id === id)
      let next: StaffRelationshipEdge
      if (existing) {
        next = {
          ...existing,
          contacts: existing.contacts + credit,
          affinity: clampAffinity(existing.affinity + (input.affinityDelta ?? 0)),
          trust: clampTrust(existing.trust + (input.trustDelta ?? 0)),
          lastContactOnDay: today,
          tags: mergeTags(existing.tags, input.tags),
        }
        formed =
          !isActiveEdge(existing) &&
          next.contacts >= MIN_CONTACTS_FOR_ACTIVE_EDGE
      } else {
        next = {
          id,
          kind: isOwnerEdge ? 'owner' : 'coworker',
          from: isOwnerEdge ? OWNER_REF : { kind: 'staff', id: input.aStaffId },
          to: isOwnerEdge
            ? { kind: 'staff', id: input.aStaffId }
            : {
                kind: 'staff',
                id:
                  input.aStaffId < input.bStaffId!
                    ? input.bStaffId!
                    : input.aStaffId,
              },
          contacts: credit,
          affinity: clampAffinity(input.affinityDelta ?? 0),
          // A relationship starts neutral rather than at nothing, so a first
          // interaction moves trust from a believable baseline.
          trust: clampTrust(50 + (input.trustDelta ?? 0)),
          lastContactOnDay: today,
          createdOnDay: today,
          tags: mergeTags([], input.tags),
        }
        // Canonical direction for a coworker edge: lower id first, so the pair
        // is stored once whichever way round the caller passed it.
        if (!isOwnerEdge) {
          const [low, high] =
            input.aStaffId < input.bStaffId!
              ? [input.aStaffId, input.bStaffId!]
              : [input.bStaffId!, input.aStaffId]
          next.from = { kind: 'staff', id: low }
          next.to = { kind: 'staff', id: high }
        }
        formed = credit >= MIN_CONTACTS_FOR_ACTIVE_EDGE
      }

      const others = current.relationships.filter((edge) => edge.id !== id)
      return {
        ...current,
        relationships: enforceCaps([...others, next], today),
      }
    },
    'contact',
  )

  if (formed) {
    bumpStaffTotal(ctx, 'relationshipsFormed')
    const other = isOwnerEdge
      ? 'you'
      : (ctx.state.staff[input.bStaffId!]?.name.display ?? input.bStaffId!)
    ctx.addHistory({
      category: 'state_change',
      summary: `${a.name.display} and ${other} now work together closely enough for it to matter (${input.reason}).`,
      tags: ['staff', 'relationship', input.aStaffId],
      relatedActors: [{ kind: 'staff', id: input.aStaffId }],
      relatedSystems: ['staff'],
      mechanicalRefs: [id],
    })
  }
}

/** Move an existing edge without crediting a contact day. */
export function adjustEdge(
  ctx: SimContext,
  edgeId: string,
  input: { affinityDelta?: number; trustDelta?: number; tags?: string[] },
): StaffRelationshipEdge | undefined {
  let result: StaffRelationshipEdge | undefined
  writeStaffSlice(
    ctx,
    (current) => {
      const existing = current.relationships.find((edge) => edge.id === edgeId)
      if (!existing) return current
      result = {
        ...existing,
        affinity: clampAffinity(existing.affinity + (input.affinityDelta ?? 0)),
        trust: clampTrust(existing.trust + (input.trustDelta ?? 0)),
        tags: mergeTags(existing.tags, input.tags),
      }
      return {
        ...current,
        relationships: current.relationships.map((edge) =>
          edge.id === edgeId ? result! : edge,
        ),
      }
    },
    'adjust_edge',
  )
  return result
}

/** Drop every edge touching a departed staff member. */
export function dropEdgesFor(
  ctx: SimContext,
  staffId: string,
  reason: string,
): void {
  writeStaffSlice(
    ctx,
    (current) => {
      const kept = current.relationships.filter(
        (edge) => edge.from.id !== staffId && edge.to.id !== staffId,
      )
      if (kept.length === current.relationships.length) return current
      return { ...current, relationships: kept }
    },
    'drop_edges',
  )
  void reason
}

/**
 * Age the graph: lapse the stale, and drop anything pointing at somebody who is
 * no longer employed.
 *
 * Run once a morning. Expiry is what makes the collection genuinely bounded
 * over a long run rather than merely capped: a tavern that reshuffles its crew
 * for a year does not accumulate a museum of former friendships.
 */
export function ageRelationships(ctx: SimContext): number {
  const today = ctx.state.calendar.totalDaysElapsed
  let dropped = 0
  writeStaffSlice(
    ctx,
    (current) => {
      const kept = current.relationships.filter((edge) => {
        const staffIds = [edge.from, edge.to]
          .filter((ref) => ref.kind === 'staff')
          .map((ref) => ref.id)
        if (staffIds.some((id) => !ctx.state.staff[id])) return false
        const idleFor = today - edge.lastContactOnDay
        const limit = isActiveEdge(edge)
          ? EDGE_EXPIRY_DAYS
          : FORMING_EDGE_EXPIRY_DAYS
        return idleFor <= limit
      })
      dropped = current.relationships.length - kept.length
      if (dropped === 0) return current
      return { ...current, relationships: kept }
    },
    'age_relationships',
  )
  return dropped
}

/**
 * Both §5.11 caps, applied together.
 *
 * Per-person: when someone has more than `MAX_ACTIVE_EDGES_PER_STAFF` active
 * edges, the one with the weakest feeling (|affinity| closest to zero) is
 * dropped — an indifferent acquaintance yields to a friend or an enemy, which
 * is the right thing to forget. Global: the oldest-contacted edges go first.
 */
function enforceCaps(
  edges: StaffRelationshipEdge[],
  today: number,
): StaffRelationshipEdge[] {
  let working = [...edges]

  const staffIds = new Set<string>()
  for (const edge of working) {
    if (edge.from.kind === 'staff') staffIds.add(edge.from.id)
    if (edge.to.kind === 'staff') staffIds.add(edge.to.id)
  }

  for (const staffId of [...staffIds].sort()) {
    const active = working.filter(
      (edge) =>
        isActiveEdge(edge) &&
        (edge.from.id === staffId || edge.to.id === staffId),
    )
    if (active.length <= MAX_ACTIVE_EDGES_PER_STAFF) continue
    // Keep the owner edge whatever happens: the player's own standing with
    // somebody is not a social nicety the graph may forget.
    const droppable = active
      .filter((edge) => edge.kind !== 'owner')
      .sort(
        (a, b) =>
          Math.abs(a.affinity) - Math.abs(b.affinity) ||
          a.lastContactOnDay - b.lastContactOnDay ||
          a.id.localeCompare(b.id),
      )
    const excess = active.length - MAX_ACTIVE_EDGES_PER_STAFF
    const drop = new Set(droppable.slice(0, excess).map((edge) => edge.id))
    working = working.filter((edge) => !drop.has(edge.id))
  }

  if (working.length > MAX_RELATIONSHIP_EDGES) {
    working = [...working]
      .sort(
        (a, b) =>
          b.lastContactOnDay - a.lastContactOnDay ||
          Math.abs(b.affinity) - Math.abs(a.affinity) ||
          a.id.localeCompare(b.id),
      )
      .slice(0, MAX_RELATIONSHIP_EDGES)
  }

  void today
  return working.sort((a, b) => a.id.localeCompare(b.id))
}

function mergeTags(
  existing: ReadonlyArray<string>,
  incoming: ReadonlyArray<string> | undefined,
): string[] {
  if (!incoming || incoming.length === 0) return [...existing]
  return [...new Set([...existing, ...incoming])].sort().slice(0, 8)
}
