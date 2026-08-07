import type { SimContext } from '../../core/context'
import type { CultureWorldState, TavernState } from '../../state/TavernState'
import { recipeRegistry } from '../../registries/recipeRegistry'
import { cultureRegistry } from '../../content/cultures/cultureRegistry'
import { getServiceModuleState } from '../service/serviceModule'
import type { ServiceParty } from '../service/flow/types'

import {
  bumpCultureTotal,
  emptyCultureStanding,
  frictionKey,
  getCultureModuleState,
  writeCultureSlice,
} from './cultureState'
import { noteEvidence } from './standing'
import { separatingGroups } from './friction'
import type { CultureFrictionState } from './types'

// Expansion Phase 8 §8.2 — what actually happened to each culture tonight.
//
// THIS FILE IS THE POINT OF §8.2. The plan names two things as wrong, and
// both were wrong in the same way — the culture layer inferred experience
// from proxies rather than reading it:
//
//   "Food taboo and delight must depend on what was actually served or
//    offered to that culture, not merely on tagged stock somewhere in
//    storage."
//
//     `emitFoodTaboos` scanned the CELLAR. If a single crate of something a
//     culture does not eat sat in storage with quantity > 0, every group of
//     that culture with enough patronage took offence — whether or not a
//     plate of it ever left the kitchen, and whether or not anybody of that
//     culture came in that night.
//
//   "Seating tension must depend on actual placement and crowding from
//    Phase 4."
//
//     `emitSeatingConflicts` compared two groups' `patronage` meters and a
//     static hostility map. Two groups could "conflict over seating" on a
//     night when neither sat down, in a tavern with empty tables.
//
// Phase 4 already records the truth both of them were guessing at.
// `flow.parties` says which cohort of which group sat in WHICH ROOM, on
// which wave, and exactly which recipes reached their table. So the fix is
// not a better heuristic — it is reading the record that already exists.

const SOURCE = 'cultures.service'

/** Occupancy above this fraction of a room's seats reads as crowded. */
const CROWDING_THRESHOLD = 0.8

/**
 * Tags that describe what a tavern serves, not what a culture came for.
 *
 * Every culture's `preferredStockTags` includes `food` or `drink`, and every
 * recipe carries both — so without this exclusion literally every serving
 * scored as a delight, 1,200 of them in a fortnight, and comfort saturated
 * at 100 for every culture inside ten days. A delight has to be the house
 * getting something RIGHT for these people specifically; being handed a
 * drink in a pub is the baseline, not a kindness.
 *
 * Taboos need no equivalent exclusion: disliked tags are already specific
 * (`expensive`, `filth`, `danger`, `risky`), so a taboo match already means
 * something.
 */
const GENERIC_SERVICE_TAGS = new Set([
  'food',
  'drink',
  'dish',
  'service_item',
  'alcohol',
])

type CultureContext = {
  culture: CultureWorldState
  preferred: Set<string>
  disliked: Set<string>
  likesTraits: Set<string>
  dislikesTraits: Set<string>
  frictionWith: Set<string>
}

function cultureContext(
  state: TavernState,
  cultureId: string,
): CultureContext | undefined {
  const culture = state.world.cultures[cultureId]
  if (!culture) return undefined
  const def = cultureRegistry.get(cultureId)
  const standing = getCultureModuleState(state).standing[cultureId]
  return {
    culture,
    // Learned preferences count alongside the definition's: §8.2 asks for
    // preference shifts, and a shift that nothing reads is not a shift.
    preferred: new Set([
      ...culture.preferredStockTags,
      ...(standing?.learnedPreferences ?? []),
    ]),
    disliked: new Set([
      ...culture.dislikedTags,
      ...(standing?.learnedDislikes ?? []),
    ]),
    likesTraits: new Set(def?.areaTraitPreferences?.likes ?? []),
    dislikesTraits: new Set(def?.areaTraitPreferences?.dislikes ?? []),
    frictionWith: new Set(def?.frictionWith ?? []),
  }
}

/** The culture a party belongs to, via its customer group. */
export function cultureIdForParty(
  state: TavernState,
  party: ServiceParty,
): string | undefined {
  return state.customerGroups[party.groupId]?.cultureId
}

/** Every tag a served dish carries — its own and its cultural ones. */
export function recipeTags(recipeId: string): string[] {
  if (!recipeRegistry.has(recipeId)) return []
  const def = recipeRegistry.get(recipeId)
  return [...def.tags, ...def.culturalTags]
}

/**
 * Read the evening and record what each culture experienced.
 *
 * Runs at `closing`, when `flow` is complete. Nothing here reads a meter: it
 * reads parties, their order lines, their rooms and their outcomes.
 */
export function observeServiceEvidence(ctx: SimContext): void {
  const state = ctx.state
  const flow = getServiceModuleState(state).result.flow
  if (!flow.ran || flow.parties.length === 0) return

  const contexts = new Map<string, CultureContext>()
  const contextFor = (cultureId: string): CultureContext | undefined => {
    const cached = contexts.get(cultureId)
    if (cached) return cached
    const built = cultureContext(state, cultureId)
    if (built) contexts.set(cultureId, built)
    return built
  }

  const seatsByArea = new Map(
    flow.capacity.seatsByArea.map((entry) => [entry.areaId, entry.seats]),
  )
  const seatedByArea = new Map<string, number>()
  for (const party of flow.parties) {
    if (!party.areaId || party.seatedWave === undefined) continue
    seatedByArea.set(party.areaId, (seatedByArea.get(party.areaId) ?? 0) + party.size)
  }

  // Deterministic order: parties are already in arrival order, and every
  // aggregate below is keyed rather than positional.
  for (const party of flow.parties) {
    const cultureId = cultureIdForParty(state, party)
    if (!cultureId) continue
    const context = contextFor(cultureId)
    if (!context) continue

    recordDishes(ctx, party, context)
    recordSeat(ctx, party, context, seatsByArea, seatedByArea)
    recordOutcome(ctx, party, context)
  }

  recordSeatingFriction(ctx, flow.parties, contextFor)
}

// ---------------------------------------------------------------------------
// What they were actually served
// ---------------------------------------------------------------------------

function recordDishes(
  ctx: SimContext,
  party: ServiceParty,
  context: CultureContext,
): void {
  for (const line of party.order) {
    // DELIVERED, not ordered. A dish the kitchen never got out is not
    // something this culture ate, and §8.2's whole complaint is about
    // counting food that never reached anybody.
    if (line.delivered <= 0) continue
    const tags = recipeTags(line.recipeId)
    if (tags.length === 0) continue

    const delights = tags.filter(
      (tag) => context.preferred.has(tag) && !GENERIC_SERVICE_TAGS.has(tag),
    )
    const taboos = tags.filter((tag) => context.disliked.has(tag))

    noteDishExperience(ctx, context.culture.id, line.recipeId, {
      served: line.delivered,
      delight: delights.length > 0 ? line.delivered : 0,
      taboo: taboos.length > 0 ? line.delivered : 0,
    })
    bumpCultureTotal(ctx, 'dishesServed', line.delivered)

    // A taboo outranks a delight on the same plate: being served something
    // you do not eat is not cancelled by it also being warm.
    if (taboos.length > 0) {
      bumpCultureTotal(ctx, 'taboosServed', line.delivered)
      // The memory the cultural-tension pressure calculator already reads.
      // It keeps its id and its tags; what changed is that it is now only
      // written when a plate of the offending thing actually reached one of
      // their tables, rather than when a crate of it sat in the cellar.
      ctx.addMemory({
        id: 'food_taboo_recently',
        source: SOURCE,
        actors: [{ kind: 'culture', id: context.culture.id }],
        tags: ['food_taboo', 'culture', context.culture.id],
        metadata: {
          cultureId: context.culture.id,
          recipeId: line.recipeId,
          servings: line.delivered,
          tags: taboos,
        },
      })
      noteEvidence(ctx, {
        cultureId: context.culture.id,
        id: `taboo_${line.recipeId}`,
        kind: 'taboo',
        weight: Math.min(24, 6 + line.delivered * 2),
        readable: `${context.culture.label} were served ${line.delivered} of ${recipeLabel(line.recipeId)}, which they do not eat (${taboos.join(', ')}).`,
        subjectId: line.recipeId,
        tags: ['food', 'taboo', ...taboos],
      })
    } else if (delights.length > 0) {
      bumpCultureTotal(ctx, 'delightsServed', line.delivered)
      noteEvidence(ctx, {
        cultureId: context.culture.id,
        id: `delight_${line.recipeId}`,
        kind: 'delight',
        weight: Math.min(18, 4 + line.delivered),
        readable: `${context.culture.label} got ${line.delivered} of ${recipeLabel(line.recipeId)}, which is exactly what they came for.`,
        subjectId: line.recipeId,
        tags: ['food', 'delight', ...delights],
      })
    }
  }
}

function recipeLabel(recipeId: string): string {
  return recipeRegistry.has(recipeId) ? recipeRegistry.get(recipeId).label : recipeId
}

function noteDishExperience(
  ctx: SimContext,
  cultureId: string,
  recipeId: string,
  delta: { served: number; delight: number; taboo: number },
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeCultureSlice(
    ctx,
    (current) => {
      const standing =
        current.standing[cultureId] ?? emptyCultureStanding(cultureId, today)
      const existing = standing.dishExperience[recipeId] ?? {
        served: 0,
        delight: 0,
        taboo: 0,
      }
      return {
        ...current,
        standing: {
          ...current.standing,
          [cultureId]: {
            ...standing,
            dishExperience: {
              ...standing.dishExperience,
              [recipeId]: {
                served: existing.served + delta.served,
                delight: existing.delight + delta.delight,
                taboo: existing.taboo + delta.taboo,
              },
            },
          },
        },
      }
    },
    'dish_experience',
  )
}

// ---------------------------------------------------------------------------
// Where they actually sat
// ---------------------------------------------------------------------------

function recordSeat(
  ctx: SimContext,
  party: ServiceParty,
  context: CultureContext,
  seatsByArea: Map<string, number>,
  seatedByArea: Map<string, number>,
): void {
  const areaId = party.areaId
  if (!areaId || party.seatedWave === undefined) return
  const area = ctx.state.areas[areaId]
  if (!area) return

  const likes = area.traits.filter((trait) => context.likesTraits.has(trait))
  const dislikes = area.traits.filter((trait) => context.dislikesTraits.has(trait))

  // Crowding is real occupancy against the room's real usable seats — the
  // Phase 4 capacity snapshot, not a guess.
  const seats = seatsByArea.get(areaId) ?? 0
  const seated = seatedByArea.get(areaId) ?? 0
  const crowded = seats > 0 && seated / seats >= CROWDING_THRESHOLD

  const good = likes.length > dislikes.length && !crowded
  noteAreaExperience(ctx, context.culture.id, areaId, good)

  if (crowded || dislikes.length > likes.length) {
    const why = crowded
      ? `packed in (${seated} of ${seats} seats taken)`
      : `sat somewhere that does not suit them (${dislikes.join(', ')})`
    noteEvidence(ctx, {
      cultureId: context.culture.id,
      id: `bad_seat_${areaId}`,
      kind: 'bad_seat',
      weight: crowded ? 10 : 7,
      readable: `${context.culture.label} were ${why} in the ${area.label}.`,
      subjectId: areaId,
      tags: ['seating', areaId, ...(crowded ? ['crowding'] : dislikes)],
    })
  } else if (good) {
    noteEvidence(ctx, {
      cultureId: context.culture.id,
      id: `good_seat_${areaId}`,
      kind: 'good_seat',
      weight: 5,
      readable: `${context.culture.label} were comfortable in the ${area.label} (${likes.join(', ')}).`,
      subjectId: areaId,
      tags: ['seating', areaId, ...likes],
    })
  }
}

function noteAreaExperience(
  ctx: SimContext,
  cultureId: string,
  areaId: string,
  good: boolean,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeCultureSlice(
    ctx,
    (current) => {
      const standing =
        current.standing[cultureId] ?? emptyCultureStanding(cultureId, today)
      const existing = standing.areaExperience[areaId] ?? {
        seated: 0,
        good: 0,
        bad: 0,
      }
      return {
        ...current,
        standing: {
          ...current.standing,
          [cultureId]: {
            ...standing,
            areaExperience: {
              ...standing.areaExperience,
              [areaId]: {
                seated: existing.seated + 1,
                good: existing.good + (good ? 1 : 0),
                bad: existing.bad + (good ? 0 : 1),
              },
            },
          },
        },
      }
    },
    'area_experience',
  )
}

// ---------------------------------------------------------------------------
// How the evening went for them
// ---------------------------------------------------------------------------

function recordOutcome(
  ctx: SimContext,
  party: ServiceParty,
  context: CultureContext,
): void {
  if (party.outcome === 'served') {
    // Only count a clean service — a party that got half its order is not
    // evidence that the house looks after them.
    const wanted = party.order.reduce((sum, line) => sum + line.servings, 0)
    const got = party.order.reduce((sum, line) => sum + line.delivered, 0)
    if (wanted > 0 && got >= wanted) {
      noteEvidence(ctx, {
        cultureId: context.culture.id,
        id: 'well_served',
        kind: 'well_served',
        weight: 4,
        readable: `${context.culture.label} were served properly tonight.`,
        tags: ['service'],
      })
    }
    return
  }
  noteEvidence(ctx, {
    cultureId: context.culture.id,
    id: 'turned_away',
    kind: 'turned_away',
    weight: party.outcome === 'abandoned_queue' ? 6 : 9,
    readable:
      party.outcome === 'abandoned_queue'
        ? `${context.culture.label} gave up waiting to get in.`
        : `${context.culture.label} sat waiting for food that never came.`,
    tags: ['service', party.outcome],
  })
}

// ---------------------------------------------------------------------------
// Who they actually sat next to
// ---------------------------------------------------------------------------

/**
 * Friction is earned by SHARING A ROOM, not by both existing.
 *
 * Two parties count as sharing when they sat in the same area with
 * overlapping stays — which is what "actual placement" means. A culture that
 * distrusts merchants and never sits near one has no friction to show for
 * it, however much its definition dislikes them.
 */
function recordSeatingFriction(
  ctx: SimContext,
  parties: ReadonlyArray<ServiceParty>,
  contextFor: (cultureId: string) => CultureContext | undefined,
): void {
  const state = ctx.state
  const today = state.calendar.totalDaysElapsed

  // The house may be deliberately keeping them apart. That is the whole
  // point of `seat_groups_apart`, and it has already been paid for in seats
  // the floor could not use (`flow/capacity.ts`), so the friction it buys
  // off is genuinely bought rather than waived.
  if (separatingGroups(state)) {
    decayFriction(ctx)
    return
  }

  const seated = parties.filter(
    (party) => party.areaId !== undefined && party.seatedWave !== undefined,
  )
  const pairsToday = new Map<string, { a: string; b: string; areaId: string }>()

  for (let i = 0; i < seated.length; i += 1) {
    const first = seated[i]!
    const cultureA = cultureIdForParty(state, first)
    if (!cultureA) continue
    const contextA = contextFor(cultureA)
    if (!contextA) continue

    for (let j = i + 1; j < seated.length; j += 1) {
      const second = seated[j]!
      if (second.areaId !== first.areaId) continue
      const cultureB = cultureIdForParty(state, second)
      if (!cultureB || cultureB === cultureA) continue
      if (!overlaps(first, second)) continue

      const contextB = contextFor(cultureB)
      if (!contextB) continue
      const bCulture = state.world.cultures[cultureB]
      const aCulture = state.world.cultures[cultureA]
      if (!aCulture || !bCulture) continue

      // Friction runs either way: it is enough that one of them minds.
      const aMinds = bCulture.tags.some((tag) => contextA.frictionWith.has(tag))
      const bMinds = aCulture.tags.some((tag) => contextB.frictionWith.has(tag))
      if (!aMinds && !bMinds) continue

      pairsToday.set(frictionKey(cultureA, cultureB), {
        a: cultureA,
        b: cultureB,
        areaId: first.areaId!,
      })
    }
  }

  if (pairsToday.size === 0) {
    decayFriction(ctx)
    return
  }

  for (const [key, pair] of [...pairsToday.entries()].sort((x, y) =>
    x[0].localeCompare(y[0]),
  )) {
    const area = state.areas[pair.areaId]
    const aLabel = state.world.cultures[pair.a]?.label ?? pair.a
    const bLabel = state.world.cultures[pair.b]?.label ?? pair.b
    bumpFriction(ctx, key, pair, today)
    bumpCultureTotal(ctx, 'seatingFrictionDays')

    for (const [cultureId, otherLabel] of [
      [pair.a, bLabel],
      [pair.b, aLabel],
    ] as const) {
      noteEvidence(ctx, {
        cultureId,
        id: `seating_friction_${key}`,
        kind: 'seating_friction',
        weight: 8,
        readable: `${state.world.cultures[cultureId]?.label ?? cultureId} were put in the ${area?.label ?? pair.areaId} alongside ${otherLabel}.`,
        subjectId: pair.areaId,
        tags: ['seating', 'friction', pair.a, pair.b],
      })
    }

    // The memory the cultural-tension pressure calculator already reads.
    // It keeps its id and its tags — what changed is that it is now only
    // written when two cultures genuinely shared a room.
    ctx.addMemory({
      id: 'seating_conflict_recently',
      source: SOURCE,
      actors: [
        { kind: 'culture', id: pair.a },
        { kind: 'culture', id: pair.b },
      ],
      tags: ['seating_conflict', 'culture', pair.areaId],
      metadata: { cultureA: pair.a, cultureB: pair.b, areaId: pair.areaId },
    })
  }

  decayFriction(ctx, new Set(pairsToday.keys()))
}

/** Did these two parties actually overlap in the room? */
function overlaps(a: ServiceParty, b: ServiceParty): boolean {
  const aStart = a.seatedWave ?? 0
  const bStart = b.seatedWave ?? 0
  const aEnd = a.leftWave ?? Number.MAX_SAFE_INTEGER
  const bEnd = b.leftWave ?? Number.MAX_SAFE_INTEGER
  return aStart <= bEnd && bStart <= aEnd
}

function bumpFriction(
  ctx: SimContext,
  key: string,
  pair: { a: string; b: string; areaId: string },
  today: number,
): void {
  writeCultureSlice(
    ctx,
    (current) => {
      const existing = current.friction[key]
      const next: CultureFrictionState = existing
        ? {
            ...existing,
            level: Math.min(100, existing.level + 12),
            sharedDays: existing.sharedDays + 1,
            lastSharedOnDay: today,
            areaId: pair.areaId,
          }
        : {
            id: key,
            cultureA: pair.a < pair.b ? pair.a : pair.b,
            cultureB: pair.a < pair.b ? pair.b : pair.a,
            level: 12,
            sharedDays: 1,
            lastSharedOnDay: today,
            areaId: pair.areaId,
          }
      return { ...current, friction: { ...current.friction, [key]: next } }
    },
    'friction',
  )
}

/** Friction the house has kept apart cools off. */
function decayFriction(
  ctx: SimContext,
  sharedToday: ReadonlySet<string> = new Set(),
): void {
  const slice = getCultureModuleState(ctx.state)
  if (Object.keys(slice.friction).length === 0) return
  let changed = false
  const next: Record<string, CultureFrictionState> = {}
  for (const [key, entry] of Object.entries(slice.friction)) {
    if (sharedToday.has(key)) {
      next[key] = entry
      continue
    }
    const level = Math.max(0, entry.level - 4)
    if (level !== entry.level) changed = true
    next[key] = { ...entry, level }
  }
  if (!changed) return
  writeCultureSlice(ctx, (current) => ({ ...current, friction: next }), 'friction_decay')
}
