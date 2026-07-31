import { z } from 'zod'

import type { ShortageRecord } from '../../stock/types'

// Expansion Phase 4 §4.1 — the within-service flow's type surface.
//
// WHAT THIS REPLACES. Until this phase a service day was one arithmetic pass:
// the customers module turned a forecast into a visitor count, multiplied that
// count by a fixed basket, sold the result, and the service module aggregated
// the total. Nothing in that chain could be a bottleneck, because nothing in it
// was a queue: seats did not fill, the kitchen had no backlog, nobody waited and
// therefore nobody could leave. "Capacity" was a number in a report.
//
// THE MODEL. The evening is cut into `SERVICE_WAVES` waves. Each wave is a
// bounded, deterministic substep that moves parties along exactly one step of a
// pipeline —
//
//     arrive → queue → seat → order → prep → deliver → pay → leave → reset
//
// — with a real limit at each stage, taken from the tavern's actual capacity:
// usable seats from `areas`, kitchen throughput from workstations and the
// kitchen roster, delivery from the service roster, table reset from the
// cleaning roster. A party that cannot get past a stage waits, and a party that
// waits past its patience leaves. That is the whole point of §4.1: the least
// granular model that still creates real bottlenecks and recoverable choices.
//
// WHAT IT DELIBERATELY DOES NOT MODEL. Not seconds, not individual patrons, not
// permanent entities for every drinker. A party is a bounded cohort — the plan's
// §4.2 requirement that "customer groups stay scalable persistent populations"
// means the population is the group, and the party is how a slice of it shows up
// tonight. Only regulars are named, because only regulars persist.

/** Waves the trading evening is cut into. Six blocks of a long evening. */
export const SERVICE_WAVES = 6

/**
 * Hard ceiling on parties instantiated in one day (§"bounded party/event counts
 * under extreme traffic").
 *
 * Above this, extra demand makes the parties BIGGER rather than making more of
 * them, so a payday flood is heavier to serve without being more expensive to
 * simulate. Every downstream collection derived from parties inherits this
 * bound.
 */
export const MAX_PARTIES_PER_DAY = 48

/** Largest cohort that can arrive as one party. */
export const MAX_PARTY_SIZE = 12

/** How a party's evening ended. Every party lands in exactly one of these. */
export type PartyOutcome =
  /** Seated, fed, and paid (in coin, on a tab, or partly both). */
  | 'served'
  /** Gave up in the queue without ever sitting down. */
  | 'abandoned_queue'
  /** Sat down, waited past patience for food that never came, walked out. */
  | 'abandoned_wait'
  /** Still waiting when the doors shut. */
  | 'unserved_at_close'

/** Why a party could not move on this wave. The day's bottleneck evidence. */
export type FlowBlockReason =
  | 'seats'
  | 'kitchen'
  | 'delivery'
  | 'cleaning'
  | 'stock'

export const FLOW_BLOCK_REASONS: ReadonlyArray<FlowBlockReason> = [
  'seats',
  'kitchen',
  'delivery',
  'cleaning',
  'stock',
] as const

/** One line of a party's order: a recipe and how many servings of it. */
export type PartyOrderLine = {
  recipeId: string
  servings: number
  /** Servings actually prepared and delivered. */
  delivered: number
  /** Why this line was chosen — the top scoring drivers, for reports. */
  drivers: string[]
}

/**
 * A bounded cohort of patrons arriving together.
 *
 * `regularId` is what makes §4.3's "visit as identifiable participants" true:
 * when a regular comes in, their party carries their id, their favourite seat
 * preference, and their order — and what happens to that party happens to a
 * named person the game already knows about.
 */
export type ServiceParty = {
  id: string
  groupId: string
  size: number
  regularId?: string | undefined
  arrivalWave: number
  /** Waves this party will wait before giving up. */
  patience: number
  wavesWaited: number
  seatedWave?: number | undefined
  areaId?: string | undefined
  servedWave?: number | undefined
  leftWave?: number | undefined
  outcome: PartyOutcome
  order: PartyOrderLine[]
  /** Coin that reached the till from this party. */
  paid: number
  /** Coin this party left owing. */
  tab: number
  /** Last reason this party was held up, if it ever was. */
  blockedBy?: FlowBlockReason | undefined
  notes: string[]
}

/** What one wave of the evening did. Reported, and the reconciliation unit. */
export type ServiceWaveSummary = {
  wave: number
  arrived: number
  queued: number
  seated: number
  served: number
  abandoned: number
  departed: number
  /** Seats occupied at the end of the wave. */
  occupied: number
  /** Seats waiting to be reset before they can be used again. */
  dirty: number
  /** Servings the kitchen produced. */
  prepared: number
  /** Servings the floor got to a table. */
  delivered: number
  /** Parties held up this wave, by cause. */
  blocked: Record<FlowBlockReason, number>
}

/** Per-stage capacity the day actually ran on. Reported so a bottleneck is explicable. */
export type ServiceCapacitySnapshot = {
  /** Usable seats pooled across customer-facing areas. */
  seats: number
  seatsByArea: Array<{ areaId: string; seats: number }>
  /** Servings the kitchen can produce per wave. */
  prepPerWave: number
  /** Servings the floor can deliver per wave. */
  deliveryPerWave: number
  /** Seats the cleaning effort can reset per wave. */
  resetPerWave: number
  /** Security cover on the floor, 0 upward. Raises the bar for escalation. */
  securityCover: number
  /** The roster contributions each of the above was derived from. */
  drivers: {
    kitchen: number
    service: number
    cleaning: number
    security: number
    kitchenThroughput: number
  }
}

/**
 * The day's flow, start to finish.
 *
 * `servedByGroup` / `coinByGroup` are what the aggregate `DailyServiceResult`
 * is now DERIVED from rather than computed alongside — which is what makes the
 * §"reports reconcile service substeps to aggregate ledger totals" test a real
 * check instead of two independent calculations that happen to agree.
 */
export type ServiceFlowResult = {
  parties: ServiceParty[]
  waves: ServiceWaveSummary[]
  capacity: ServiceCapacitySnapshot
  /** Patrons who wanted to come, by group. */
  demandByGroup: Record<string, number>
  /** Patrons who got through the door and sat down, by group. */
  seatedByGroup: Record<string, number>
  /** Patrons served, by group. */
  servedByGroup: Record<string, number>
  /** Patrons who left without being served, by group. */
  abandonedByGroup: Record<string, number>
  /** Coin taken, by group. */
  coinByGroup: Record<string, number>
  /** Coin left on a tab, by group. */
  tabByGroup: Record<string, number>
  /** Shortages this group ran into, by group. */
  shortagesByGroup: Record<string, ShortageRecord[]>
  /** Peak queue length across the evening. */
  peakQueue: number
  /** The stage that held the day up most, when one did. */
  bottleneck?: {
    reason: FlowBlockReason
    partiesHeld: number
    readable: string
  }
  /** Seats still dirty when the doors shut — tomorrow's mess. */
  unresetSeats: number
  /** Where those unwiped seats are, so the mess lands in the right room. */
  unresetByArea: Record<string, number>
  /** Whether the flow ran at all (a closed or empty day writes an idle result). */
  ran: boolean
}

// ---------- Schemas (§5.7) ----------

const BlockedSchema = z.object({
  seats: z.number().min(0),
  kitchen: z.number().min(0),
  delivery: z.number().min(0),
  cleaning: z.number().min(0),
  stock: z.number().min(0),
})

export const PartyOrderLineSchema = z.object({
  recipeId: z.string(),
  servings: z.number().min(0),
  delivered: z.number().min(0),
  drivers: z.array(z.string()),
})

/**
 * KEY ORDER IS LOAD-BEARING and matches the literal in `parties.ts`.
 *
 * A saved party comes back through Zod, which rebuilds it in schema key order,
 * and the day diff renders a new module slice as one JSON string. If the
 * literal and the schema disagree about order, a reloaded day reads as a
 * different day and the §5.10 gate fails on formatting rather than behaviour.
 * `parties.ts` therefore declares every optional key up front — set to
 * `undefined`, which JSON drops — so the flow only ever assigns in place and
 * never appends a key.
 */
export const ServicePartySchema = z.object({
  id: z.string(),
  groupId: z.string(),
  size: z.number().min(0),
  regularId: z.string().optional(),
  arrivalWave: z.number().int().min(0),
  patience: z.number().min(0),
  wavesWaited: z.number().min(0),
  seatedWave: z.number().int().min(0).optional(),
  areaId: z.string().optional(),
  servedWave: z.number().int().min(0).optional(),
  leftWave: z.number().int().min(0).optional(),
  outcome: z.enum([
    'served',
    'abandoned_queue',
    'abandoned_wait',
    'unserved_at_close',
  ]),
  order: z.array(PartyOrderLineSchema),
  paid: z.number(),
  tab: z.number().min(0),
  blockedBy: z.enum(['seats', 'kitchen', 'delivery', 'cleaning', 'stock']).optional(),
  notes: z.array(z.string()),
})

export const ServiceWaveSummarySchema = z.object({
  wave: z.number().int().min(0),
  arrived: z.number().min(0),
  queued: z.number().min(0),
  seated: z.number().min(0),
  served: z.number().min(0),
  abandoned: z.number().min(0),
  departed: z.number().min(0),
  occupied: z.number().min(0),
  dirty: z.number().min(0),
  prepared: z.number().min(0),
  delivered: z.number().min(0),
  blocked: BlockedSchema,
})

export const ServiceCapacitySnapshotSchema = z.object({
  seats: z.number().min(0),
  seatsByArea: z.array(
    z.object({ areaId: z.string(), seats: z.number().min(0) }),
  ),
  prepPerWave: z.number().min(0),
  deliveryPerWave: z.number().min(0),
  resetPerWave: z.number().min(0),
  securityCover: z.number().min(0),
  drivers: z.object({
    kitchen: z.number().min(0),
    service: z.number().min(0),
    cleaning: z.number().min(0),
    security: z.number().min(0),
    kitchenThroughput: z.number().min(0),
  }),
})

export const ServiceFlowResultSchema = z.object({
  parties: z.array(ServicePartySchema),
  waves: z.array(ServiceWaveSummarySchema),
  capacity: ServiceCapacitySnapshotSchema,
  demandByGroup: z.record(z.string(), z.number().min(0)),
  seatedByGroup: z.record(z.string(), z.number().min(0)),
  servedByGroup: z.record(z.string(), z.number().min(0)),
  abandonedByGroup: z.record(z.string(), z.number().min(0)),
  coinByGroup: z.record(z.string(), z.number()),
  tabByGroup: z.record(z.string(), z.number().min(0)),
  shortagesByGroup: z.record(
    z.string(),
    z.array(
      z.object({
        stockId: z.string(),
        requested: z.number().min(0),
        available: z.number().min(0),
        day: z.number().int().min(1),
        reason: z.string(),
      }),
    ),
  ),
  peakQueue: z.number().min(0),
  unresetSeats: z.number().min(0),
  unresetByArea: z.record(z.string(), z.number().min(0)),
  ran: z.boolean(),
  // Last, because the flow assigns it last — see the key-order note on
  // `ServicePartySchema`.
  bottleneck: z
    .object({
      reason: z.enum(['seats', 'kitchen', 'delivery', 'cleaning', 'stock']),
      partiesHeld: z.number().min(0),
      readable: z.string(),
    })
    .optional(),
})

export function emptyBlockedCounts(): Record<FlowBlockReason, number> {
  return { seats: 0, kitchen: 0, delivery: 0, cleaning: 0, stock: 0 }
}

export function emptyFlowResult(): ServiceFlowResult {
  return {
    parties: [],
    waves: [],
    capacity: {
      seats: 0,
      seatsByArea: [],
      prepPerWave: 0,
      deliveryPerWave: 0,
      resetPerWave: 0,
      securityCover: 0,
      drivers: {
        kitchen: 0,
        service: 0,
        cleaning: 0,
        security: 0,
        kitchenThroughput: 1,
      },
    },
    demandByGroup: {},
    seatedByGroup: {},
    servedByGroup: {},
    abandonedByGroup: {},
    coinByGroup: {},
    tabByGroup: {},
    shortagesByGroup: {},
    peakQueue: 0,
    unresetSeats: 0,
    unresetByArea: {},
    ran: false,
  }
}
