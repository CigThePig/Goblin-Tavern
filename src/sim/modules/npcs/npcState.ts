import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { ActorStateSchema } from '../../contracts/actors/index'

import type {
  NpcModuleState,
  NpcMoveEntry,
  NpcProposal,
  NpcRecord,
  NpcTotals,
} from './types'

// Expansion Phase 8 §8.3 — reading and writing the npcs slice.
//
// New slice rather than a repair of an existing one: the notable-NPC layer
// has never had module state at all, so unlike factions and cultures there
// is no empty `{}` in old saves to walk past. `ensureNpcAgencyFields` still
// exists (§5.7) because `ensureModuleSlices` would install the defaults but
// not the `NotableNpcWorldState.lastSeenDay` repair that goes with them.

export const NPCS_MODULE_ID = 'npcs'

// -- §8.3's two thresholds --------------------------------------------------
//
// "Use importance and repeated interaction thresholds." Both, not either:
// somebody the house deals with constantly but who matters to nothing live
// stays a name, and so does somebody important the house has never met.

/** Dealings before an NPC can be promoted at all. */
export const PROMOTION_INTERACTION_THRESHOLD = 4
/** …and how much they have to matter, 0..100. */
export const PROMOTION_IMPORTANCE_THRESHOLD = 45
/** Below this they go back to being a name. Hysteresis, so nobody flickers. */
export const DEMOTION_IMPORTANCE_THRESHOLD = 25
/**
 * Hard ceiling on promoted NPCs at once.
 *
 * The cost of an agent is not simulation time, it is the player's attention:
 * a world where six people are all making moves at you is noise. Four is the
 * most that can be legible at once, and the least important is demoted when
 * a fifth earns their place.
 */
export const MAX_PROMOTED_NPCS = 4
/** Days a newly promoted NPC is safe from demotion, so a promotion means something. */
export const PROMOTION_GRACE_DAYS = 5

// -- §5.11 bounded growth ---------------------------------------------------

export const MAX_NPC_INTERACTIONS = 12
export const NPC_MEMORY_DAYS = 30
export const MAX_NPC_RELATIONSHIPS = 8
export const MAX_NPC_MOVE_HISTORY = 32
export const MAX_NPC_PROPOSALS = 16
export const PROPOSAL_RETENTION_DAYS = 14

export function createInitialNpcTotals(): NpcTotals {
  return {
    promoted: 0,
    demoted: 0,
    visitsMade: 0,
    proposalsMade: 0,
    proposalsAccepted: 0,
    proposalsDeclined: 0,
    proposalsLapsed: 0,
    wordsPutIn: 0,
    reportsToWatch: 0,
    favoursCalled: 0,
    movesMade: 0,
  }
}

export function createInitialNpcModuleState(): NpcModuleState {
  return {
    records: {},
    actors: {},
    proposals: {},
    moveHistory: [],
    movesToday: [],
    aboutToday: [],
    totals: createInitialNpcTotals(),
  }
}

export function normalizeNpcSlice(
  slice: Partial<NpcModuleState> | undefined,
): NpcModuleState {
  const base = createInitialNpcModuleState()
  if (!slice) return base
  return {
    records: slice.records ?? base.records,
    actors: slice.actors ?? base.actors,
    proposals: slice.proposals ?? base.proposals,
    moveHistory: slice.moveHistory ?? base.moveHistory,
    movesToday: slice.movesToday ?? base.movesToday,
    aboutToday: slice.aboutToday ?? base.aboutToday,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getNpcModuleState(state: {
  modules: Record<string, unknown>
}): NpcModuleState {
  return normalizeNpcSlice(
    state.modules[NPCS_MODULE_ID] as Partial<NpcModuleState> | undefined,
  )
}

export function writeNpcSlice(
  ctx: SimContext,
  updater: (current: NpcModuleState) => NpcModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<NpcModuleState>(
    NPCS_MODULE_ID,
    (current) => updater(normalizeNpcSlice(current)),
    { source: `${NPCS_MODULE_ID}.${reason}`, reason },
  )
}

export function bumpNpcTotal(ctx: SimContext, key: keyof NpcTotals, by = 1): void {
  if (by === 0) return
  writeNpcSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialNpcTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

// -- readers ----------------------------------------------------------------

export function getNpcRecord(
  state: TavernState,
  npcId: string,
): NpcRecord | undefined {
  return getNpcModuleState(state).records[npcId]
}

/** Everyone currently taking turns, in id order. */
export function promotedNpcs(state: TavernState): NpcRecord[] {
  return Object.values(getNpcModuleState(state).records)
    .filter((record) => record.promoted)
    .sort((a, b) => a.npcId.localeCompare(b.npcId))
}

export function openProposals(state: TavernState): NpcProposal[] {
  return Object.values(getNpcModuleState(state).proposals)
    .filter((proposal) => proposal.status === 'open')
    .sort((a, b) => a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id))
}

export function openProposalFor(
  state: TavernState,
  npcId: string,
): NpcProposal | undefined {
  return openProposals(state).find((proposal) => proposal.npcId === npcId)
}

/** How much of an NPC's interaction record still counts today. */
export function interactionWeightToday(
  entry: { onDay: number; weight: number },
  today: number,
): number {
  const age = Math.max(0, today - entry.onDay)
  if (age >= NPC_MEMORY_DAYS) return 0
  return Math.round(entry.weight * (1 - age / NPC_MEMORY_DAYS) * 100) / 100
}

// -- pruning ----------------------------------------------------------------

export function pruneNpcRecords(
  slice: NpcModuleState,
  today: number,
): NpcModuleState {
  const records: Record<string, NpcRecord> = {}
  for (const [npcId, record] of Object.entries(slice.records)) {
    records[npcId] = {
      ...record,
      interactions: record.interactions
        .filter((entry) => today - entry.onDay < NPC_MEMORY_DAYS)
        .slice(-MAX_NPC_INTERACTIONS),
      relationships: [...record.relationships]
        .sort((a, b) => Math.abs(b.affinity) - Math.abs(a.affinity))
        .slice(0, MAX_NPC_RELATIONSHIPS)
        .sort((a, b) => a.withRef.id.localeCompare(b.withRef.id)),
    }
  }

  const proposalEntries = Object.entries(slice.proposals).filter(([, proposal]) => {
    if (proposal.status === 'open') return true
    const closed = proposal.closedOnDay
    if (closed === undefined) return true
    return today - closed <= PROPOSAL_RETENTION_DAYS
  })
  const proposals = Object.fromEntries(
    proposalEntries.length <= MAX_NPC_PROPOSALS
      ? proposalEntries
      : [
          ...proposalEntries.filter(([, p]) => p.status === 'open'),
          ...proposalEntries
            .filter(([, p]) => p.status !== 'open')
            .sort((a, b) => (b[1].closedOnDay ?? 0) - (a[1].closedOnDay ?? 0))
            .slice(0, MAX_NPC_PROPOSALS),
        ].slice(0, MAX_NPC_PROPOSALS),
  )

  // An actor record only belongs to somebody still promoted; a demoted NPC
  // keeps their Tier 1 record and loses their turns.
  const actors = Object.fromEntries(
    Object.entries(slice.actors).filter(([npcId]) => records[npcId]?.promoted),
  )

  return {
    ...slice,
    records,
    actors,
    proposals,
    moveHistory: slice.moveHistory.slice(-MAX_NPC_MOVE_HISTORY),
  }
}

export function recordNpcMove(ctx: SimContext, entry: NpcMoveEntry): void {
  writeNpcSlice(
    ctx,
    (current) => ({
      ...current,
      movesToday: [...current.movesToday, entry],
      moveHistory: [...current.moveHistory, entry].slice(-MAX_NPC_MOVE_HISTORY),
      totals: {
        ...createInitialNpcTotals(),
        ...current.totals,
        movesMade: (current.totals.movesMade ?? 0) + 1,
      },
    }),
    'move',
  )
}

// -- schema -----------------------------------------------------------------

const RefSchema = z.object({ kind: z.string(), id: z.string() })

const InteractionSchema = z.object({
  onDay: z.number().int(),
  kind: z.enum([
    'visit',
    'faction_dealing',
    'regulatory_dealing',
    'trade_dealing',
    'cultivated',
    'asked',
    'answered',
    'refused',
  ]),
  readable: z.string(),
  weight: z.number(),
})

const RecordSchema = z.object({
  npcId: z.string(),
  interactions: z.array(InteractionSchema),
  interactionCount: z.number().int(),
  importance: z.number(),
  promoted: z.boolean(),
  promotedOnDay: z.number().int().optional(),
  promotionReason: z.string().optional(),
  ownerStanding: z.number(),
  relationships: z.array(
    z.object({
      withRef: RefSchema,
      affinity: z.number(),
      readable: z.string(),
      lastChangedOnDay: z.number().int(),
    }),
  ),
  availability: z.object({
    pattern: z.enum(['most_days', 'market_days', 'paydays', 'nights', 'by_arrangement']),
    lastAboutOnDay: z.number().int().optional(),
    nextExpectedDay: z.number().int().optional(),
  }),
  resources: z.object({
    coin: z.number(),
    standing: z.number(),
    goods: z.array(z.string()),
    favoursOwed: z.number(),
  }),
  lastUpdatedOnDay: z.number().int(),
})

const ProposalSchema = z.object({
  id: z.string(),
  npcId: z.string(),
  kind: z.enum(['supply_offer', 'credit_offer', 'favour_request', 'backing_request']),
  coin: z.number(),
  stockId: z.string().optional(),
  units: z.number().optional(),
  openedOnDay: z.number().int(),
  dueOnDay: z.number().int(),
  status: z.enum(['open', 'accepted', 'declined', 'lapsed']),
  readable: z.string(),
  closedOnDay: z.number().int().optional(),
})

const MoveSchema = z.object({
  onDay: z.number().int(),
  npcId: z.string(),
  actionId: z.string(),
  goalId: z.string(),
  result: z.enum(['succeeded', 'failed', 'partial']),
  readable: z.string(),
})

export const NpcModuleStateSchema = z
  .object({
    records: z.record(z.string(), RecordSchema).default({}),
    actors: z.record(z.string(), ActorStateSchema).default({}),
    proposals: z.record(z.string(), ProposalSchema).default({}),
    moveHistory: z.array(MoveSchema).default([]),
    movesToday: z.array(MoveSchema).default([]),
    aboutToday: z.array(z.string()).default([]),
    totals: z.record(z.string(), z.number()).default({}),
  })
  .partial()
  .passthrough()
  .optional()
