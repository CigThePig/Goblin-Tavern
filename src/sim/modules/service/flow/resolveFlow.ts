import type { SimContext } from '../../../core/context'
import type {
  CustomerGroupState,
  RegularWorldState,
} from '../../../state/TavernState'
import { recipeRegistry } from '../../../registries/recipeRegistry'
import { sellRecipe } from '../recipes'
import { recordShortage } from '../../stock/sales'
import type { ShortageRecord } from '../../stock/types'

import { cookStretchFactor, readServiceCapacity } from './capacity'
import { chooseOrder } from './choice'
import { buildParties, normaliseParty, type PartyBuildInput } from './parties'
import {
  SERVICE_WAVES,
  emptyBlockedCounts,
  emptyFlowResult,
  type FlowBlockReason,
  type ServiceCapacitySnapshot,
  type ServiceFlowResult,
  type ServiceParty,
  type ServiceWaveSummary,
} from './types'

// Expansion Phase 4 §4.1 — the deterministic within-service substep model.
//
// One wave moves every party exactly one step along:
//
//   reset → arrive → queue → seat → order → prep → deliver → pay → depart
//
// and each step has a real ceiling taken from `readServiceCapacity`. A party
// that cannot pass a step waits and is recorded as blocked BY THAT STEP, which
// is what turns "the tavern had a bad night" into "the kitchen was the
// bottleneck on four waves out of six and here is the party list".
//
// DETERMINISM. The loop itself draws no randomness at all: party composition
// and arrival timing are rolled once in `buildParties`, and everything after
// that is arithmetic over a stable ordering (arrival wave, then party id). Same
// state in, same evening out — on a replay, after a reload, and identically
// whether the day ran as one batch or as three segments, because the whole loop
// runs inside a single `service` hook in segment B.
//
// NO DOUBLE SALE. Stock is consumed and coin is earned in exactly one place —
// the delivery step's `sellRecipe` call — and each serving passes through it
// once. Servings the cellar could not back are removed from the party's order
// with a shortage recorded, never retried, and never billed.

/** Waves a served party keeps its seats before leaving. */
const DWELL_WAVES = 1

/** Extra waves a SEATED party will wait beyond its queue patience. */
const SEATED_PATIENCE_BONUS = 1

/**
 * Record what a party asked for and the cellar could not supply.
 *
 * Uses the stock module's own `recordShortage`, so an unmet order lands in the
 * same place as every other shortage and the weekly reliability signal, the
 * repeated-shortage memory pattern and the restock issue seeds all see it.
 * Reports against the recipe's tightest input — the ingredient that actually
 * ran out is the one the player has to buy.
 */
function recordUnmetDemand(
  ctx: SimContext,
  recipeId: string,
  servings: number,
): ShortageRecord | undefined {
  if (!recipeRegistry.has(recipeId)) return undefined
  const def = recipeRegistry.get(recipeId)
  let tightest: { ingredientId: string; needed: number; available: number } | undefined
  for (const input of def.inputs) {
    const available = ctx.state.stock[input.ingredientId]?.quantity ?? 0
    const needed = servings * input.quantity
    if (available >= needed) continue
    if (!tightest || available - needed < tightest.available - tightest.needed) {
      tightest = { ingredientId: input.ingredientId, needed, available }
    }
  }
  if (!tightest) return undefined
  return recordShortage(
    ctx,
    tightest.ingredientId,
    tightest.needed,
    tightest.available,
    'unmet_demand',
  )
}

/** Mess drags on how fast tables can be turned round. */
function resetEfficiency(ctx: SimContext, areaId: string): number {
  const area = ctx.state.areas[areaId]
  if (!area) return 1
  // A filthy room is slower to reset — which is how `better_tables`
  // (mess −5) and a diligent cleaner buy turnover without a new field.
  return Math.max(0.5, 1 - area.mess / 200)
}

type SeatBlock = {
  areaId: string
  total: number
  occupied: number
  dirty: number
}

type Ticket = {
  partyId: string
  groupId: string
  recipeId: string
  servings: number
}

export type ServiceFlowInput = PartyBuildInput & {
  /** Regulars who came in tonight, for order preferences. */
  regularsById: Record<string, RegularWorldState>
}

export type ServiceFlowOutput = {
  result: ServiceFlowResult
  /** Shortages surfaced by the delivery step, for the aggregate result. */
  shortages: ShortageRecord[]
  /** Stock consumed across the evening, by stock id. */
  stockConsumed: Record<string, number>
}

function freeSeats(block: SeatBlock): number {
  return Math.max(0, block.total - block.occupied - block.dirty)
}

/**
 * Where a party sits.
 *
 * A regular's favourite area is tried first — §4.3's "select a favorite
 * seat/area" is a real allocation, not a label — then the room with the most
 * space, so a party is never wedged into a corner while the main room stands
 * empty. Ties break on area id.
 */
function pickArea(
  blocks: SeatBlock[],
  party: ServiceParty,
  regular: RegularWorldState | undefined,
): SeatBlock | undefined {
  const fits = blocks.filter((block) => freeSeats(block) >= party.size)
  if (fits.length === 0) return undefined
  if (regular?.favoriteAreaId) {
    const favourite = fits.find((block) => block.areaId === regular.favoriteAreaId)
    if (favourite) return favourite
  }
  return fits.sort((a, b) =>
    freeSeats(b) === freeSeats(a)
      ? a.areaId.localeCompare(b.areaId)
      : freeSeats(b) - freeSeats(a),
  )[0]
}

function totalDirty(blocks: SeatBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.dirty, 0)
}

function totalOccupied(blocks: SeatBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.occupied, 0)
}

/** Release a party's seats back into the room as dirty tables. */
function releaseSeats(blocks: SeatBlock[], party: ServiceParty): void {
  if (!party.areaId) return
  const block = blocks.find((entry) => entry.areaId === party.areaId)
  if (!block) return
  block.occupied = Math.max(0, block.occupied - party.size)
  block.dirty += party.size
}

function bump(record: Record<string, number>, key: string, amount: number): void {
  record[key] = (record[key] ?? 0) + amount
}

export function runServiceFlow(
  ctx: SimContext,
  input: ServiceFlowInput,
): ServiceFlowOutput {
  const capacity = readServiceCapacity(ctx)
  const result = emptyFlowResult()
  result.capacity = capacity
  result.demandByGroup = { ...input.demandByGroup }

  const shortages: ShortageRecord[] = []
  const stockConsumed: Record<string, number> = {}

  const parties = buildParties(ctx, input)
  result.parties = parties
  const totalDemand = Object.values(input.demandByGroup).reduce(
    (sum, value) => sum + Math.max(0, value),
    0,
  )
  if (parties.length === 0 || totalDemand <= 0) {
    return { result, shortages, stockConsumed }
  }
  result.ran = true

  const blocks: SeatBlock[] = capacity.seatsByArea.map((row) => ({
    areaId: row.areaId,
    total: row.seats,
    occupied: 0,
    dirty: 0,
  }))

  const byId = new Map<string, ServiceParty>()
  for (const party of parties) byId.set(party.id, party)

  const dayType = ctx.getDayType()
  const stretchFactor = cookStretchFactor(ctx.state)
  const queue: ServiceParty[] = []
  const seated: ServiceParty[] = []
  let kitchenQueue: Ticket[] = []
  let readyQueue: Ticket[] = []
  /** Servings still owed to a party — delivered or written off closes them. */
  const pending = new Map<string, number>()
  const delivered = new Map<string, number>()

  const groupOf = (party: ServiceParty): CustomerGroupState | undefined =>
    ctx.state.customerGroups[party.groupId]

  const dropTickets = (partyId: string): void => {
    kitchenQueue = kitchenQueue.filter((ticket) => ticket.partyId !== partyId)
    readyQueue = readyQueue.filter((ticket) => ticket.partyId !== partyId)
    pending.delete(partyId)
  }

  let arrivalCursor = 0
  for (let wave = 0; wave < SERVICE_WAVES; wave++) {
    const blocked = emptyBlockedCounts()
    const summary: ServiceWaveSummary = {
      wave,
      arrived: 0,
      queued: 0,
      seated: 0,
      served: 0,
      abandoned: 0,
      departed: 0,
      occupied: 0,
      dirty: 0,
      prepared: 0,
      delivered: 0,
      blocked,
    }

    // ---- 1. reset. Cleaning turns dirty tables back into usable seats. ----
    let resetBudget = capacity.resetPerWave
    for (const block of blocks) {
      if (resetBudget <= 0) break
      if (block.dirty <= 0) continue
      const efficiency = resetEfficiency(ctx, block.areaId)
      const canReset = Math.max(1, Math.floor(resetBudget * efficiency))
      const reset = Math.min(block.dirty, canReset)
      block.dirty -= reset
      resetBudget -= reset
    }

    // ---- 2. arrivals ----
    while (
      arrivalCursor < parties.length &&
      parties[arrivalCursor]!.arrivalWave === wave
    ) {
      const party = parties[arrivalCursor]!
      queue.push(party)
      summary.arrived += party.size
      bump(result.demandByGroup, party.groupId, 0)
      arrivalCursor += 1
    }

    // ---- 3. seating ----
    const stillQueued: ServiceParty[] = []
    for (const party of queue) {
      const regular = party.regularId
        ? input.regularsById[party.regularId]
        : undefined
      const block = pickArea(blocks, party, regular)
      if (!block) {
        // Attribute honestly: if the seats exist but are waiting on a wipe,
        // this is a CLEANING bottleneck, not a seating one.
        const reason: FlowBlockReason =
          totalDirty(blocks) >= party.size ? 'cleaning' : 'seats'
        blocked[reason] += 1
        party.blockedBy = reason
        stillQueued.push(party)
        continue
      }
      block.occupied += party.size
      party.areaId = block.areaId
      party.seatedWave = wave
      party.blockedBy = undefined
      seated.push(party)
      summary.seated += party.size
      bump(result.seatedByGroup, party.groupId, party.size)

      // ---- 4. order ----
      const group = groupOf(party)
      if (!group) continue
      const order = chooseOrder(
        ctx,
        party,
        {
          group,
          ...(regular ? { regular } : {}),
          wavesWaited: party.wavesWaited,
          dayType,
        },
        { stretchFactor },
      )
      const lines = order.lines

      // §4.2 — what they wanted and could not have. Recorded here, at the
      // moment of ordering, because that is when the demand existed; the
      // delivery step below only ever sees what the cellar could back.
      for (const missed of order.unmet) {
        const shortage = recordUnmetDemand(ctx, missed.recipeId, missed.servings)
        if (!shortage) continue
        blocked.stock += 1
        party.blockedBy = 'stock'
        party.notes.push(`No ${shortage.stockId} left for them.`)
        // Deduped PER GROUP, not globally: "the miners ran out of ale" and
        // "the goblins ran out of ale" are two facts about two crowds, and the
        // weekly reliability signal counts records. Collapsing them to one
        // would understate a night the whole room went short.
        const perGroup = result.shortagesByGroup[party.groupId] ?? []
        if (!perGroup.some((entry) => entry.stockId === shortage.stockId)) {
          perGroup.push(shortage)
          result.shortagesByGroup[party.groupId] = perGroup
          shortages.push(shortage)
        }
      }

      if (lines.length === 0) {
        // Nothing on the menu they could or would have. They do not stay.
        blocked.stock += 1
        party.blockedBy = 'stock'
        party.outcome = 'abandoned_wait'
        party.leftWave = wave
        party.notes.push('Nothing on the menu they would eat.')
        releaseSeats(blocks, party)
        seated.splice(seated.indexOf(party), 1)
        summary.abandoned += party.size
        bump(result.abandonedByGroup, party.groupId, party.size)
        continue
      }
      let owed = 0
      for (const line of lines) {
        party.order.push({
          recipeId: line.recipeId,
          servings: line.servings,
          delivered: 0,
          drivers: line.drivers,
        })
        kitchenQueue.push({
          partyId: party.id,
          groupId: party.groupId,
          recipeId: line.recipeId,
          servings: line.servings,
        })
        owed += line.servings
      }
      pending.set(party.id, owed)
    }
    queue.length = 0
    queue.push(...stillQueued)

    // ---- 5. prep. The kitchen works the ticket rail in order. ----
    let prepBudget = capacity.prepPerWave
    const nextKitchen: Ticket[] = []
    for (const ticket of kitchenQueue) {
      if (prepBudget <= 0) {
        nextKitchen.push(ticket)
        blocked.kitchen += 1
        const party = byId.get(ticket.partyId)
        if (party) party.blockedBy = 'kitchen'
        continue
      }
      const cooked = Math.min(ticket.servings, prepBudget)
      prepBudget -= cooked
      summary.prepared += cooked
      readyQueue.push({ ...ticket, servings: cooked })
      if (cooked < ticket.servings) {
        nextKitchen.push({ ...ticket, servings: ticket.servings - cooked })
        blocked.kitchen += 1
      }
    }
    kitchenQueue = nextKitchen

    // ---- 6. delivery + payment. The ONLY place stock is sold. ----
    let deliveryBudget = capacity.deliveryPerWave
    const carried: Ticket[] = []
    const buckets = new Map<string, { groupId: string; recipeId: string; tickets: Ticket[] }>()
    for (const ticket of readyQueue) {
      if (deliveryBudget <= 0) {
        carried.push(ticket)
        blocked.delivery += 1
        const party = byId.get(ticket.partyId)
        if (party) party.blockedBy = 'delivery'
        continue
      }
      const take = Math.min(ticket.servings, deliveryBudget)
      deliveryBudget -= take
      const key = `${ticket.groupId}::${ticket.recipeId}`
      const bucket = buckets.get(key) ?? {
        groupId: ticket.groupId,
        recipeId: ticket.recipeId,
        tickets: [],
      }
      bucket.tickets.push({ ...ticket, servings: take })
      buckets.set(key, bucket)
      if (take < ticket.servings) {
        carried.push({ ...ticket, servings: ticket.servings - take })
        blocked.delivery += 1
      }
    }
    readyQueue = carried

    // Stable bucket order so the sale sequence — and therefore which party
    // loses out when the cellar runs dry — is identical on every replay.
    const bucketKeys = [...buckets.keys()].sort((a, b) => a.localeCompare(b))
    for (const key of bucketKeys) {
      const bucket = buckets.get(key)!
      const requested = bucket.tickets.reduce((sum, t) => sum + t.servings, 0)
      if (requested <= 0) continue
      const sale = sellRecipe(ctx, bucket.recipeId, requested, {
        buyerGroupId: bucket.groupId,
        source: `service.flow.${bucket.groupId}.${bucket.recipeId}`,
      })
      for (const consumed of sale.itemsConsumed) {
        bump(stockConsumed, consumed.stockId, consumed.quantity)
      }
      for (const shortage of sale.shortages) {
        const perGroup = result.shortagesByGroup[bucket.groupId] ?? []
        if (!perGroup.some((entry) => entry.stockId === shortage.stockId)) {
          perGroup.push(shortage)
          result.shortagesByGroup[bucket.groupId] = perGroup
          shortages.push(shortage)
        }
      }
      const perServing = sale.sold > 0 ? sale.earned / sale.sold : 0
      let left = sale.sold
      for (const ticket of bucket.tickets) {
        const party = byId.get(ticket.partyId)
        if (!party) continue
        const got = Math.min(ticket.servings, left)
        left -= got
        const missed = ticket.servings - got
        const line = party.order.find((entry) => entry.recipeId === ticket.recipeId)
        if (line) line.delivered += got
        if (got > 0) {
          party.paid += perServing * got
          // Coin is booked HERE, where the plate and the money changed hands —
          // not when the party is finally marked served. A party that was
          // partly fed and then walked out still paid for what it ate, and the
          // coin ledger has that money; booking it at "served" left the
          // aggregate short of the ledger by exactly those sales.
          bump(result.coinByGroup, party.groupId, perServing * got)
          summary.delivered += got
          delivered.set(party.id, (delivered.get(party.id) ?? 0) + got)
        }
        if (missed > 0) {
          // The cellar could not back it. Written off, not retried and not
          // billed — a shortage is already on the record.
          blocked.stock += 1
          party.blockedBy = 'stock'
          party.notes.push(`Ran out before ${missed} serving(s) reached them.`)
          if (line) line.servings -= missed
        }
        const owed = (pending.get(party.id) ?? 0) - ticket.servings
        pending.set(party.id, Math.max(0, owed))
      }
    }

    // ---- 7. mark parties whose order is complete as served ----
    for (const party of [...seated]) {
      if (party.servedWave !== undefined) continue
      if ((pending.get(party.id) ?? 0) > 0) continue
      const got = delivered.get(party.id) ?? 0
      if (got <= 0) continue
      party.servedWave = wave
      party.outcome = 'served'
      party.paid = Math.round(party.paid)
      party.blockedBy = undefined
      summary.served += party.size
      bump(result.servedByGroup, party.groupId, party.size)
    }

    // ---- 8. turnover. Parties that have had their dwell leave. ----
    for (const party of [...seated]) {
      if (party.servedWave === undefined) continue
      if (wave < party.servedWave + DWELL_WAVES) continue
      party.leftWave = wave
      releaseSeats(blocks, party)
      seated.splice(seated.indexOf(party), 1)
      summary.departed += party.size
    }

    // ---- 9. patience. Waiting is what makes a bottleneck cost something. ----
    for (const party of [...queue]) {
      party.wavesWaited += 1
      if (party.wavesWaited <= party.patience) continue
      party.outcome = 'abandoned_queue'
      party.leftWave = wave
      party.notes.push(`Gave up after ${party.wavesWaited} wave(s) in the queue.`)
      queue.splice(queue.indexOf(party), 1)
      summary.abandoned += party.size
      bump(result.abandonedByGroup, party.groupId, party.size)
    }
    for (const party of [...seated]) {
      if (party.servedWave !== undefined) continue
      party.wavesWaited += 1
      if (party.wavesWaited <= party.patience + SEATED_PATIENCE_BONUS) continue
      party.outcome = 'abandoned_wait'
      party.leftWave = wave
      party.notes.push(
        `Walked out after ${party.wavesWaited} wave(s) waiting to be served.`,
      )
      dropTickets(party.id)
      releaseSeats(blocks, party)
      seated.splice(seated.indexOf(party), 1)
      summary.abandoned += party.size
      bump(result.abandonedByGroup, party.groupId, party.size)
    }

    summary.queued = queue.reduce((sum, party) => sum + party.size, 0)
    summary.occupied = totalOccupied(blocks)
    summary.dirty = totalDirty(blocks)
    result.peakQueue = Math.max(result.peakQueue, summary.queued)
    result.waves.push(summary)
  }

  // ---- closing state ----
  for (const party of queue) {
    party.outcome = 'unserved_at_close'
    party.notes.push('Still waiting when the doors shut.')
    bump(result.abandonedByGroup, party.groupId, party.size)
  }
  for (const party of seated) {
    if (party.servedWave === undefined) {
      party.outcome = 'unserved_at_close'
      party.notes.push('Sat all night and never got served.')
      bump(result.abandonedByGroup, party.groupId, party.size)
    }
    releaseSeats(blocks, party)
  }
  result.unresetSeats = totalDirty(blocks)
  for (const block of blocks) {
    if (block.dirty > 0) result.unresetByArea[block.areaId] = block.dirty
  }
  const bottleneck = findBottleneck(result.waves, capacity)
  if (bottleneck) result.bottleneck = bottleneck

  // One canonical key order per party, once, at the end — see `normaliseParty`.
  result.parties = result.parties.map(normaliseParty)

  return { result, shortages, stockConsumed }
}

/**
 * Which stage held the evening up.
 *
 * Counts party-waves held per cause and names the largest. Reported so the
 * player can act on it: a kitchen bottleneck and a seating bottleneck look
 * identical in the takings and call for completely different spending.
 */
export function findBottleneck(
  waves: ReadonlyArray<ServiceWaveSummary>,
  capacity: ServiceCapacitySnapshot,
): ServiceFlowResult['bottleneck'] {
  const totals = emptyBlockedCounts()
  for (const wave of waves) {
    for (const reason of Object.keys(totals) as FlowBlockReason[]) {
      totals[reason] += wave.blocked[reason]
    }
  }
  let worst: { reason: FlowBlockReason; count: number } | undefined
  for (const reason of Object.keys(totals) as FlowBlockReason[]) {
    const count = totals[reason]
    if (count <= 0) continue
    if (!worst || count > worst.count) worst = { reason, count }
  }
  if (!worst) return undefined
  return {
    reason: worst.reason,
    partiesHeld: worst.count,
    readable: describeBottleneck(worst.reason, capacity),
  }
}

function describeBottleneck(
  reason: FlowBlockReason,
  capacity: ServiceCapacitySnapshot,
): string {
  switch (reason) {
    case 'seats':
      return `Not enough seats — ${capacity.seats} usable across the customer rooms.`
    case 'kitchen':
      return `The kitchen could not keep up — ${capacity.prepPerWave} servings a wave.`
    case 'delivery':
      return `Nobody to carry the plates — ${capacity.deliveryPerWave} servings a wave.`
    case 'cleaning':
      return `Tables sat dirty — ${capacity.resetPerWave} seats a wave get wiped.`
    case 'stock':
      return 'The cellar ran dry mid-service.'
    default:
      return 'Service was held up.'
  }
}
