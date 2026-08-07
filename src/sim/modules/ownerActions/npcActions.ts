import type { SimContext } from '../../core/context'
import { addCoin, spendCoin } from '../stock/ledger'
import {
  bumpNpcTotal,
  getNpcModuleState,
  getNpcRecord,
  openProposalFor,
  openProposals,
  writeNpcSlice,
} from '../npcs/npcState'
import { closeProposal } from '../npcs/npcEvents'
import { noteDealing } from '../npcs/dealings'

import { TIME_COST_QUICK, TIME_COST_SHORT } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 8 §8.3 — dealing with people.
//
// Three actions, and between them they cover the whole of what a promoted
// NPC can put to the house plus the one thing the player can start:
//
//   accept_npc_offer   take the terms
//   decline_npc_offer  turn them down to their face
//   cultivate_npc      seek somebody out and build the relationship
//
// `cultivate_npc` is the one that makes §8.3's repeated-interaction
// threshold something the player can DRIVE rather than only wait for. A
// player who wants the market factor to become somebody they can deal with
// can go and make that happen; the cost is owner time, which is the scarce
// thing (`phase-186-day-clock-time-economy.md`).

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function npcsWithOffer(ctx: SimContext): ActionTarget[] {
  return openProposals(ctx.state).map((proposal) => {
    const npc = ctx.state.world.notableNpcs[proposal.npcId]
    return {
      id: proposal.npcId,
      label: npc?.name.display ?? proposal.npcId,
      hint: `${proposal.readable} — by day ${proposal.dueOnDay}`,
    }
  })
}

/** Everybody the house could go and see today. */
function npcsWorthSeeing(ctx: SimContext): ActionTarget[] {
  const slice = getNpcModuleState(ctx.state)
  return [...slice.aboutToday]
    .sort()
    .map((npcId) => {
      const npc = ctx.state.world.notableNpcs[npcId]
      const record = slice.records[npcId]
      return {
        id: npcId,
        label: npc?.name.display ?? npcId,
        hint: record
          ? `${record.interactionCount} dealings, standing ${record.ownerStanding}`
          : 'not yet known to the house',
      }
    })
}

// ---------- accept_npc_offer ----------

const acceptNpcOffer: OwnerActionDefinition = {
  id: 'accept_npc_offer',
  label: 'Accept an Offer',
  category: 'social',
  tags: ['social', 'npc', 'offer'],
  effectsPreview: 'Takes the terms somebody has put to the house',
  pressureAffinity: ['faction_anger'],
  targetType: 'regular',
  timeCost: TIME_COST_SHORT,
  getValidTargets: npcsWithOffer,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'accept_npc_offer requires targetId')
    const npc = ctx.state.world.notableNpcs[input.targetId]
    if (!npc) return reject('unknown_target', `Unknown person '${input.targetId}'`)
    const proposal = openProposalFor(ctx.state, input.targetId)
    if (!proposal) {
      return reject('no_open_offer', `${npc.name.display} has put nothing to the house.`)
    }
    if (proposal.coin > ctx.state.coin) {
      return reject(
        'insufficient_coin',
        `${proposal.coin} coin needed, ${ctx.state.coin} in the till.`,
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const npc = ctx.state.world.notableNpcs[input.targetId!]!
    const proposal = openProposalFor(ctx.state, npc.id)!
    const effects: string[] = []

    if (proposal.coin > 0) {
      spendCoin(ctx, proposal.coin, {
        category: 'purchase',
        source: `${SOURCE}.accept_npc_offer`,
        sourceType: 'owner_action',
        target: 'coin',
        targetType: 'coin',
        amount: -proposal.coin,
        readable: `Took ${npc.name.display} up on ${proposal.readable}.`,
        tags: ['owner_action', 'npc', 'offer', npc.id],
        relatedActors: [{ kind: 'notable_npc', id: npc.id }],
        relatedSystems: ['npcs', 'economy'],
      })
      effects.push(`coin -${proposal.coin}`)
    } else if (proposal.coin < 0) {
      const received = -proposal.coin
      addCoin(ctx, received, {
        category: 'other',
        source: `${SOURCE}.accept_npc_offer`,
        sourceType: 'owner_action',
        target: 'coin',
        targetType: 'coin',
        amount: received,
        readable: `${npc.name.display} put ${received} coin into the house.`,
        tags: ['owner_action', 'npc', 'credit', npc.id],
        relatedActors: [{ kind: 'notable_npc', id: npc.id }],
        relatedSystems: ['npcs', 'economy'],
      })
      effects.push(`coin +${received}`)
    }

    // Goods actually arrive. A supply offer that delivered nothing would be
    // the same empty promise this arc exists to stop making.
    if (proposal.stockId && proposal.units && ctx.state.stock[proposal.stockId]) {
      const stock = ctx.state.stock[proposal.stockId]!
      ctx.modifyStock(
        proposal.stockId,
        { quantity: stock.quantity + proposal.units },
        {
          source: `${SOURCE}.accept_npc_offer`,
          sourceType: 'owner_action',
          target: `stock:${proposal.stockId}.quantity`,
          targetType: 'stock',
          amount: proposal.units,
          readable: `${npc.name.display} delivered ${proposal.units} of ${stock.label}.`,
          tags: ['owner_action', 'npc', 'supply', npc.id],
          relatedActors: [{ kind: 'notable_npc', id: npc.id }],
          relatedSystems: ['npcs', 'stock'],
        },
      )
      effects.push(`${stock.label} +${proposal.units}`)
    }

    // Taking coin off somebody is a favour owed; settling one clears it.
    const favourDelta =
      proposal.kind === 'credit_offer' ? 1 : proposal.kind === 'favour_request' ? -1 : 0
    if (favourDelta !== 0) adjustFavours(ctx, npc.id, favourDelta)

    closeProposal(ctx, proposal.id, 'accepted')
    bumpNpcTotal(ctx, 'proposalsAccepted')
    noteDealing(ctx, {
      npcId: npc.id,
      kind: 'answered',
      readable: `The house took ${npc.name.display} up on ${proposal.readable}.`,
      weight: 12,
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house accepted ${npc.name.display}'s offer.`,
      tags: ['owner_action', 'npc', 'offer', npc.id],
      relatedActors: [{ kind: 'notable_npc', id: npc.id }],
      relatedSystems: ['ownerActions', 'npcs'],
      mechanicalRefs: ['accept_npc_offer', proposal.id],
    })

    return {
      actionId: acceptNpcOffer.id,
      label: `Accepted ${npc.name.display}'s Offer`,
      targetId: npc.id,
      timeCost: TIME_COST_SHORT,
      effects,
      data: { npcId: npc.id, proposalId: proposal.id, kind: proposal.kind },
    }
  },
}

// ---------- decline_npc_offer ----------

const declineNpcOffer: OwnerActionDefinition = {
  id: 'decline_npc_offer',
  label: 'Decline an Offer',
  category: 'social',
  tags: ['social', 'npc', 'offer'],
  effectsPreview: 'Turns somebody down to their face',
  pressureAffinity: ['faction_anger'],
  targetType: 'regular',
  timeCost: TIME_COST_QUICK,
  getValidTargets: npcsWithOffer,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'decline_npc_offer requires targetId')
    const npc = ctx.state.world.notableNpcs[input.targetId]
    if (!npc) return reject('unknown_target', `Unknown person '${input.targetId}'`)
    if (!openProposalFor(ctx.state, input.targetId)) {
      return reject('no_open_offer', `${npc.name.display} has put nothing to the house.`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const npc = ctx.state.world.notableNpcs[input.targetId!]!
    const proposal = openProposalFor(ctx.state, npc.id)!

    closeProposal(ctx, proposal.id, 'declined')
    bumpNpcTotal(ctx, 'proposalsDeclined')
    // Turning somebody down to their face costs less than ignoring them —
    // the deadline resolver charges -14 for silence against -6 here.
    noteDealing(ctx, {
      npcId: npc.id,
      kind: 'refused',
      readable: `The house turned ${npc.name.display} down over ${proposal.readable}.`,
      weight: -6,
    })

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house declined ${npc.name.display}'s offer.`,
      tags: ['owner_action', 'npc', 'offer', 'declined', npc.id],
      relatedActors: [{ kind: 'notable_npc', id: npc.id }],
      relatedSystems: ['ownerActions', 'npcs'],
      mechanicalRefs: ['decline_npc_offer', proposal.id],
    })

    return {
      actionId: declineNpcOffer.id,
      label: `Declined ${npc.name.display}`,
      targetId: npc.id,
      timeCost: TIME_COST_QUICK,
      effects: ['offer declined'],
      data: { npcId: npc.id, proposalId: proposal.id },
    }
  },
}

// ---------- cultivate_npc ----------

const cultivateNpc: OwnerActionDefinition = {
  id: 'cultivate_npc',
  label: 'Seek Somebody Out',
  category: 'social',
  tags: ['social', 'npc', 'relationship'],
  effectsPreview: 'Builds a working relationship with somebody worth knowing',
  pressureAffinity: ['faction_anger'],
  targetType: 'regular',
  timeCost: TIME_COST_SHORT,
  getValidTargets: npcsWorthSeeing,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'cultivate_npc requires targetId')
    const npc = ctx.state.world.notableNpcs[input.targetId]
    if (!npc) return reject('unknown_target', `Unknown person '${input.targetId}'`)
    if (!getNpcModuleState(ctx.state).aboutToday.includes(input.targetId)) {
      return reject('not_about', `${npc.name.display} is not about today.`)
    }
    const record = getNpcRecord(ctx.state, input.targetId)
    if (record && record.interactions.some((entry) => entry.kind === 'cultivated' && entry.onDay === ctx.state.calendar.totalDaysElapsed)) {
      return reject('already_seen', `The house has already sought ${npc.name.display} out today.`)
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const npc = ctx.state.world.notableNpcs[input.targetId!]!
    noteDealing(ctx, {
      npcId: npc.id,
      kind: 'cultivated',
      readable: `The owner sought ${npc.name.display} out.`,
      weight: 8,
    })
    const record = getNpcRecord(ctx.state, npc.id)

    ctx.addHistory({
      category: 'owner_action',
      summary: `The owner sought out ${npc.name.display}.`,
      tags: ['owner_action', 'npc', 'cultivate', npc.id],
      relatedActors: [{ kind: 'notable_npc', id: npc.id }],
      relatedSystems: ['ownerActions', 'npcs'],
      mechanicalRefs: ['cultivate_npc', npc.id],
    })

    return {
      actionId: cultivateNpc.id,
      label: `Sought Out ${npc.name.display}`,
      targetId: npc.id,
      timeCost: TIME_COST_SHORT,
      effects: [
        `standing ${record?.ownerStanding ?? 0}`,
        `${(record?.interactionCount ?? 0) + 1} dealings`,
      ],
      data: { npcId: npc.id, interactionCount: (record?.interactionCount ?? 0) + 1 },
    }
  },
}

function adjustFavours(ctx: SimContext, npcId: string, delta: number): void {
  writeNpcSlice(
    ctx,
    (current) => {
      const record = current.records[npcId]
      if (!record) return current
      return {
        ...current,
        records: {
          ...current.records,
          [npcId]: {
            ...record,
            resources: {
              ...record.resources,
              favoursOwed: Math.max(0, record.resources.favoursOwed + delta),
            },
          },
        },
      }
    },
    'favours',
  )
}

export const NPC_ACTIONS: OwnerActionDefinition[] = [
  acceptNpcOffer,
  declineNpcOffer,
  cultivateNpc,
]

export { acceptNpcOffer, declineNpcOffer, cultivateNpc }
