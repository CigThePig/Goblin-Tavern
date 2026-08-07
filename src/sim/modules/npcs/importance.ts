import type { SimContext } from '../../core/context'
import type { NotableNpcWorldState, TavernState } from '../../state/TavernState'
import { getRegulatoryModuleState } from '../regulatory/state'
import { openCases } from '../regulatory/types'
import { getFinanceModuleState, listLoans } from '../finance/state'
import { activeStances, openDemandFor, owedFavourFor } from '../factions/factionState'
import { liveMisunderstandingFor } from '../cultures/cultureState'
import { observancesToday } from '../cultures/observance'

import {
  DEMOTION_IMPORTANCE_THRESHOLD,
  MAX_PROMOTED_NPCS,
  PROMOTION_GRACE_DAYS,
  PROMOTION_IMPORTANCE_THRESHOLD,
  PROMOTION_INTERACTION_THRESHOLD,
  getNpcModuleState,
  interactionWeightToday,
  writeNpcSlice,
} from './npcState'
import type { NpcRecord } from './types'

// Expansion Phase 8 §8.3 — who is worth being an agent, and why.
//
// "Do not promote every generated name into a full agent. Use importance and
// repeated interaction thresholds."
//
// IMPORTANCE IS ABOUT THE WORLD, NOT THE PERSON. A watch inspector is not
// intrinsically important; they are important WHILE THERE IS A CASE OPEN.
// A creditor matters while money is owed. A shrine priest matters on the day
// their festival falls. So importance is computed from what is live in the
// domains this NPC fronts — which means promotion tracks the game's actual
// stakes, and an NPC stops taking turns when the thing they were about is
// settled.
//
// REPEATED INTERACTION IS ABOUT THE PLAYER. Somebody can matter enormously
// and still be a stranger. The house has to have dealt with them
// `PROMOTION_INTERACTION_THRESHOLD` times before they can act — which is
// what stops a new game opening with nine agents nobody has met.
//
// BOTH, AND CAPPED. The two conditions are ANDed, the roster is capped at
// `MAX_PROMOTED_NPCS`, and demotion uses a lower threshold than promotion so
// nobody flickers in and out on a borderline day.

const SOURCE = 'npcs.importance'

/**
 * How much this NPC matters to the tavern right now, 0..100.
 *
 * Every term names a live record somewhere else in the simulation. Nothing
 * here is intrinsic to the role — a role only decides WHICH live records the
 * NPC is measured against.
 */
export function computeImportance(
  state: TavernState,
  npc: NotableNpcWorldState,
): { importance: number; reason: string } {
  const reasons: Array<{ weight: number; readable: string }> = []

  // Regulation — the watch matter while the watch are interested.
  if (npc.kind === 'authority') {
    const slice = getRegulatoryModuleState(state)
    const cases = openCases(slice)
    if (cases.length > 0) {
      reasons.push({ weight: 45, readable: 'the watch have a case open on the house' })
    }
    const suspicion = slice.watch?.standing
    if (typeof suspicion === 'number' && suspicion <= 40) {
      reasons.push({ weight: 15, readable: 'the watch think poorly of the house' })
    }
  }

  // Money — a creditor matters exactly as long as the debt does.
  if (npc.kind === 'creditor') {
    const loans = listLoans(state)
    if (loans.length > 0) {
      reasons.push({ weight: 45, readable: 'the house is carrying a loan' })
    }
    const finance = getFinanceModuleState(state)
    if ((finance.totals?.loansDefaulted ?? 0) > 0) {
      reasons.push({ weight: 20, readable: 'the house has defaulted before' })
    }
  }

  // Supply — a market factor matters while the house is buying, and more
  // while their own people are being leaned on.
  if (npc.kind === 'merchant_prince' || npc.kind === 'smuggler') {
    const shortage = state.pressures['stock_shortage']?.value ?? 0
    if (shortage >= 45) {
      reasons.push({ weight: 30, readable: 'the cellar keeps running short' })
    }
  }

  // Their faction is making moves, and they are its face.
  if (npc.factionId) {
    const faction = state.world.factions[npc.factionId]
    const stances = activeStances(state).filter(
      (stance) => stance.factionId === npc.factionId,
    )
    if (stances.length > 0) {
      reasons.push({
        weight: 35,
        readable: `${faction?.label ?? npc.factionId} have taken a position`,
      })
    }
    if (openDemandFor(state, npc.factionId)) {
      reasons.push({
        weight: 25,
        readable: `${faction?.label ?? npc.factionId} are waiting on an answer`,
      })
    }
    if (owedFavourFor(state, npc.factionId)) {
      reasons.push({
        weight: 20,
        readable: `the house owes ${faction?.label ?? npc.factionId} a favour`,
      })
    }
    if (faction && faction.influence >= 55) {
      reasons.push({ weight: 10, readable: `${faction.label} carry weight in town` })
    }
  }

  // Their culture has something outstanding with the house.
  if (npc.cultureId) {
    const culture = state.world.cultures[npc.cultureId]
    if (liveMisunderstandingFor(state, npc.cultureId)) {
      reasons.push({
        weight: 25,
        readable: `${culture?.label ?? npc.cultureId} are holding something against the house`,
      })
    }
  }

  // A priest matters on the day that matters to them.
  if (npc.kind === 'priest' && npc.factionId) {
    const observing = observancesToday({
      state,
      getDayType: () => state.calendar.dayType,
    } as never)
    if (observing.some((entry) => entry.cultureId === npc.cultureId)) {
      reasons.push({ weight: 30, readable: 'their observance falls today' })
    }
  }

  // A gossip matters when there is talk to carry. §8.4 will give them a
  // rumour network to work; until then the rumour pressure the world already
  // computes is the honest reading of how much is being said.
  if (npc.kind === 'gossip') {
    const rumour = state.pressures['rumour_pressure']?.value ?? 0
    if (rumour >= 40) {
      reasons.push({ weight: 35, readable: 'there is talk going round about the house' })
    } else if (rumour >= 20) {
      reasons.push({ weight: 15, readable: 'people have started talking' })
    }
  }

  // A rival keeper matters when the competition is actually pulling people.
  if (npc.kind === 'rival') {
    const monthly = state.modules['monthly'] as
      | { rivalTavern?: { appeal?: number } }
      | undefined
    const appeal = monthly?.rivalTavern?.appeal ?? 30
    if (appeal >= 45) {
      reasons.push({ weight: 30, readable: 'the rival house is drawing a crowd' })
    }
  }

  const importance = Math.max(
    0,
    Math.min(
      100,
      reasons.reduce((sum, entry) => sum + entry.weight, 0),
    ),
  )
  const strongest = [...reasons].sort((a, b) => b.weight - a.weight)[0]
  return {
    importance,
    reason: strongest?.readable ?? 'nothing they are involved in is live',
  }
}

/** Live dealings, decayed. The repeated-interaction reading. */
export function recentDealings(record: NpcRecord, today: number): number {
  return record.interactions.reduce(
    (sum, entry) => sum + Math.abs(interactionWeightToday(entry, today)),
    0,
  )
}

/**
 * Re-score everybody, then promote and demote.
 *
 * Deterministic and order-independent: candidates are ranked by importance
 * with the NPC id as the tie-break, so the same world always promotes the
 * same people.
 */
export function reviewPromotions(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getNpcModuleState(ctx.state)
  const npcIds = Object.keys(ctx.state.world.notableNpcs).sort()

  const scored: Array<{
    npcId: string
    record: NpcRecord
    importance: number
    reason: string
  }> = []

  for (const npcId of npcIds) {
    const record = slice.records[npcId]
    if (!record) continue
    const npc = ctx.state.world.notableNpcs[npcId]!
    const { importance, reason } = computeImportance(ctx.state, npc)
    scored.push({ npcId, record, importance, reason })
  }
  if (scored.length === 0) return

  // Who is ELIGIBLE: both thresholds, both required.
  const eligible = scored
    .filter(
      (entry) =>
        entry.record.interactionCount >= PROMOTION_INTERACTION_THRESHOLD &&
        entry.importance >= PROMOTION_IMPORTANCE_THRESHOLD,
    )
    .sort(
      (a, b) => b.importance - a.importance || a.npcId.localeCompare(b.npcId),
    )

  const keep = new Set(eligible.slice(0, MAX_PROMOTED_NPCS).map((e) => e.npcId))

  // Somebody promoted recently keeps their place through the grace window
  // even if the world has quietened, so a promotion is never a single day;
  // and somebody still above the (lower) demotion line keeps theirs, so
  // nobody flickers on a borderline day.
  //
  // Both are PREFERENCES, not overrides. The cap is re-applied afterwards,
  // because a burst of promotions inside one grace window could otherwise
  // carry the roster past the ceiling that exists to keep it legible.
  for (const entry of scored) {
    if (!entry.record.promoted) continue
    const since = today - (entry.record.promotedOnDay ?? today)
    if (since < PROMOTION_GRACE_DAYS || entry.importance >= DEMOTION_IMPORTANCE_THRESHOLD) {
      keep.add(entry.npcId)
    }
  }

  if (keep.size > MAX_PROMOTED_NPCS) {
    const ranked = scored
      .filter((entry) => keep.has(entry.npcId))
      .sort((a, b) => {
        // Inside the grace window first, then importance, then id.
        const aGrace = a.record.promoted && today - (a.record.promotedOnDay ?? today) < PROMOTION_GRACE_DAYS
        const bGrace = b.record.promoted && today - (b.record.promotedOnDay ?? today) < PROMOTION_GRACE_DAYS
        if (aGrace !== bGrace) return aGrace ? -1 : 1
        return b.importance - a.importance || a.npcId.localeCompare(b.npcId)
      })
      .slice(0, MAX_PROMOTED_NPCS)
      .map((entry) => entry.npcId)
    keep.clear()
    for (const npcId of ranked) keep.add(npcId)
  }

  const nextRecords: Record<string, NpcRecord> = { ...slice.records }
  let promotedCount = 0
  let demotedCount = 0

  for (const entry of scored) {
    const shouldBePromoted = keep.has(entry.npcId)
    const record = entry.record
    const next: NpcRecord = {
      ...record,
      importance: entry.importance,
      lastUpdatedOnDay: today,
    }

    if (shouldBePromoted && !record.promoted) {
      next.promoted = true
      next.promotedOnDay = today
      next.promotionReason = entry.reason
      promotedCount += 1
      announce(ctx, entry.npcId, true, entry.reason)
    } else if (!shouldBePromoted && record.promoted) {
      next.promoted = false
      delete next.promotedOnDay
      delete next.promotionReason
      demotedCount += 1
      announce(ctx, entry.npcId, false, entry.reason)
    } else if (shouldBePromoted) {
      next.promotionReason = entry.reason
    }

    nextRecords[entry.npcId] = next
  }

  writeNpcSlice(
    ctx,
    (current) => ({
      ...current,
      records: nextRecords,
      totals: {
        ...current.totals,
        promoted: (current.totals.promoted ?? 0) + promotedCount,
        demoted: (current.totals.demoted ?? 0) + demotedCount,
      },
    }),
    'promotions',
  )
}

function announce(
  ctx: SimContext,
  npcId: string,
  promoted: boolean,
  reason: string,
): void {
  const npc = ctx.state.world.notableNpcs[npcId]
  if (!npc) return
  ctx.addLog(
    {
      message: promoted
        ? `${npc.name.display} has become somebody the house has to reckon with — ${reason}.`
        : `${npc.name.display} has gone back to being a face in the crowd.`,
      level: 'info',
      data: { npcId, promoted, reason },
    },
    SOURCE,
  )
}
