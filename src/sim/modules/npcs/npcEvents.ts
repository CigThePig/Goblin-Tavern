import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, NotableNpcWorldState } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'

import {
  NPCS_MODULE_ID,
  bumpNpcTotal,
  getNpcModuleState,
  openProposalFor,
  writeNpcSlice,
} from './npcState'
import { noteDealing } from './dealings'
import type { NpcProposal, NpcProposalKind, NpcRecord } from './types'

// Expansion Phase 8 §8.3 — an NPC's offer is a promise with a date on it.
//
// Everything a promoted NPC puts to the house goes through one record and one
// dated event, for the reason the whole arc exists: an offer nobody has to
// answer is not a decision, and a deadline nobody enforces is not a deadline.
// `npc_proposal_deadline` is the enforcement — an unanswered offer lapses,
// and the NPC takes the silence personally.

export const NPC_PROPOSAL_DEADLINE_EVENT = 'npc_proposal_deadline'

const ProposalPayloadSchema = z.object({ proposalId: z.string(), npcId: z.string() })

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function npcRef(npcId: string): EntityRef {
  return { kind: 'notable_npc', id: npcId }
}

/** What this person is in a position to put on the table. */
function proposalShape(
  npc: NotableNpcWorldState,
  record: NpcRecord,
  forced?: NpcProposalKind,
): { kind: NpcProposalKind; coin: number; stockId?: string; units?: number; readable: string } | undefined {
  if (forced === 'favour_request' || record.resources.favoursOwed > 0) {
    return {
      kind: 'favour_request',
      coin: 0,
      readable: 'the favour they are owed, called in',
    }
  }
  if (npc.kind === 'creditor' && record.resources.coin >= 60) {
    const coin = Math.min(200, Math.round(record.resources.coin / 2))
    return {
      kind: 'credit_offer',
      // NEGATIVE: coin flows toward the house now, and the favour is the price.
      coin: -coin,
      readable: `${coin} coin up front, against a favour owed`,
    }
  }
  const stockId = record.resources.goods[0]
  if (stockId) {
    const units = 20
    const coin = Math.max(10, Math.round(units * 1.6))
    return {
      kind: 'supply_offer',
      coin,
      stockId,
      units,
      readable: `${units} of ${stockId} for ${coin} coin`,
    }
  }
  return undefined
}

/** Open a proposal and put its answer-by day on the calendar. */
export function openProposal(
  ctx: SimContext,
  npc: NotableNpcWorldState,
  record: NpcRecord,
  forced?: NpcProposalKind,
): NpcProposal | undefined {
  if (openProposalFor(ctx.state, npc.id)) return undefined
  const shape = proposalShape(npc, record, forced)
  if (!shape) return undefined

  const today = ctx.state.calendar.totalDaysElapsed
  const proposal: NpcProposal = {
    id: `npc_proposal_${npc.id}_${today}`,
    npcId: npc.id,
    kind: shape.kind,
    coin: shape.coin,
    ...(shape.stockId !== undefined ? { stockId: shape.stockId } : {}),
    ...(shape.units !== undefined ? { units: shape.units } : {}),
    openedOnDay: today,
    dueOnDay: today + 4,
    status: 'open',
    readable: shape.readable,
  }

  writeNpcSlice(
    ctx,
    (current) =>
      current.proposals[proposal.id]
        ? current
        : { ...current, proposals: { ...current.proposals, [proposal.id]: proposal } },
    'proposal_opened',
  )
  bumpNpcTotal(ctx, 'proposalsMade')
  noteDealing(ctx, {
    npcId: npc.id,
    kind: 'asked',
    readable: `${npc.name.display} asked the house about ${proposal.readable}.`,
    weight: 0,
  })

  scheduleEvent(ctx, {
    type: NPC_PROPOSAL_DEADLINE_EVENT,
    target: npcRef(npc.id),
    scheduledForDay: proposal.dueOnDay,
    payload: { proposalId: proposal.id, npcId: npc.id },
    origin: {
      source: 'npcs.actors.offer_terms',
      readable: `${npc.name.display} is waiting on an answer about ${proposal.readable}.`,
    },
  })
  return proposal
}

export function closeProposal(
  ctx: SimContext,
  proposalId: string,
  status: NpcProposal['status'],
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeNpcSlice(
    ctx,
    (current) => {
      const proposal = current.proposals[proposalId]
      if (!proposal || proposal.status !== 'open') return current
      return {
        ...current,
        proposals: {
          ...current.proposals,
          [proposalId]: { ...proposal, status, closedOnDay: today },
        },
      }
    },
    `proposal_${status}`,
  )
}

const proposalDeadlineEvent: ScheduledEventDefinition = {
  type: NPC_PROPOSAL_DEADLINE_EVENT,
  kind: 'mechanical',
  ownerModuleId: NPCS_MODULE_ID,
  label: 'Somebody is waiting on an answer',
  payloadSchema: ProposalPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 4,
  warningWindowDays: 2,
  expiryDays: 4,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = ProposalPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.proposalId : 'unknown'}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = ProposalPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a proposal', record.origin.readable)
    }
    const proposal = getNpcModuleState(ctx.state).proposals[parsed.data.proposalId]
    const npc = ctx.state.world.notableNpcs[parsed.data.npcId]
    if (!proposal || !npc) {
      return noOp('the offer is no longer on the table', record.origin.readable)
    }
    if (proposal.status !== 'open') {
      // Answered already. The dealing was recorded when it was, so saying so
      // is the whole of the work here.
      return noOp(
        `${npc.name.display}'s offer was already ${proposal.status}`,
        record.origin.readable,
      )
    }

    closeProposal(ctx, proposal.id, 'lapsed')
    bumpNpcTotal(ctx, 'proposalsLapsed')
    // Being ignored costs the house more than being turned down does — the
    // same rule the faction demands use, for the same reason.
    noteDealing(ctx, {
      npcId: npc.id,
      kind: 'refused',
      readable: `${npc.name.display} got no answer at all about ${proposal.readable}.`,
      weight: -14,
    })

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'notable_npc',
          targetId: npc.id,
          field: 'ownerStanding',
          readable: `${npc.name.display} took the silence personally.`,
        },
      ],
      readable: `${npc.name.display} never got an answer about ${proposal.readable}.`,
      memory: {
        id: `npc_ignored_${npc.id}`,
        source: 'npcs.proposal',
        actors: [npcRef(npc.id)],
        tags: ['npc', 'ignored', npc.id],
        durationDays: 21,
        metadata: { npcId: npc.id, proposalId: proposal.id },
      },
      history: {
        category: 'state_change',
        summary: `${npc.name.display}'s offer went unanswered.`,
        tags: ['npc', 'proposal', 'ignored', npc.id],
        relatedActors: [npcRef(npc.id)],
        relatedSystems: ['npcs'],
        mechanicalRefs: [npc.id, NPC_PROPOSAL_DEADLINE_EVENT],
      },
    }
  },
}

export const NPC_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  proposalDeadlineEvent,
]

let registered = false

export function ensureNpcScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of NPC_SCHEDULED_EVENTS) registerScheduledEvent(definition)
  registered = true
}

ensureNpcScheduledEventsRegistered()

export const NPC_SCHEDULED_EVENT_TYPES = NPC_SCHEDULED_EVENTS.map((d) => d.type)
