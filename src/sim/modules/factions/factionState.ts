import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { ActorStateSchema } from '../../contracts/actors/index'

import type {
  FactionDemand,
  FactionFavour,
  FactionModuleState,
  FactionMoveEntry,
  FactionStance,
  FactionStanding,
  FactionTotals,
} from './types'

// Expansion Phase 8 §8.1 — reading and writing the factions slice.
//
// Every accessor normalises. A save written before this phase has
// `modules.factions = {}` (the slice's schema was an empty passthrough
// object), so it is PRESENT but empty — which means the generic
// `ensureModuleSlices` sweep, which only fills slices that are missing
// entirely, cannot repair it. `ensureFactionAgencyFields` in
// `state/migrations.ts` is the named §5.7 migration that does; this is the
// belt-and-braces that stops a slice which slipped past it from throwing.

export const FACTIONS_MODULE_ID = 'factions'

// -- §5.11 bounded growth ---------------------------------------------------
//
// Four collections, four rules. Stances and demands and favours are all
// self-limiting because each one carries an end day and the daily pass
// closes them; the caps below are the belt to that braces, sized so a
// pathological run cannot grow state without bound.

/** Moves kept for the report and for "what have they done to us lately". */
export const MAX_FACTION_MOVE_HISTORY = 40
/** Closed demands are pruned this many days after they close. */
export const CLOSED_RECORD_RETENTION_DAYS = 21
/** Hard cap on demand/favour records regardless of retention. */
export const MAX_FACTION_RECORDS = 24

export function createInitialFactionTotals(): FactionTotals {
  return {
    movesMade: 0,
    demandsMade: 0,
    demandsGranted: 0,
    demandsRefused: 0,
    demandsLapsed: 0,
    boycottsCalled: 0,
    boycottsEnded: 0,
    supportPledged: 0,
    sponsorshipsGiven: 0,
    favoursRepaid: 0,
    favoursCalledIn: 0,
    inspectionsPressed: 0,
    stancesContested: 0,
  }
}

export function createInitialFactionModuleState(): FactionModuleState {
  return {
    actors: {},
    standing: {},
    stances: {},
    demands: {},
    favours: {},
    moveHistory: [],
    movesToday: [],
    totals: createInitialFactionTotals(),
  }
}

export function normalizeFactionSlice(
  slice: Partial<FactionModuleState> | undefined,
): FactionModuleState {
  const base = createInitialFactionModuleState()
  if (!slice) return base
  return {
    actors: slice.actors ?? base.actors,
    standing: slice.standing ?? base.standing,
    stances: slice.stances ?? base.stances,
    demands: slice.demands ?? base.demands,
    favours: slice.favours ?? base.favours,
    moveHistory: slice.moveHistory ?? base.moveHistory,
    movesToday: slice.movesToday ?? base.movesToday,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getFactionModuleState(state: {
  modules: Record<string, unknown>
}): FactionModuleState {
  return normalizeFactionSlice(
    state.modules[FACTIONS_MODULE_ID] as Partial<FactionModuleState> | undefined,
  )
}

export function writeFactionSlice(
  ctx: SimContext,
  updater: (current: FactionModuleState) => FactionModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<FactionModuleState>(
    FACTIONS_MODULE_ID,
    (current) => updater(normalizeFactionSlice(current)),
    { source: `${FACTIONS_MODULE_ID}.${reason}`, reason },
  )
}

export function bumpFactionTotal(
  ctx: SimContext,
  key: keyof FactionTotals,
  by = 1,
): void {
  if (by === 0) return
  writeFactionSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialFactionTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

// -- readers ----------------------------------------------------------------

export function getFactionStanding(
  state: TavernState,
  factionId: string,
): FactionStanding | undefined {
  return getFactionModuleState(state).standing[factionId]
}

export function stanceId(factionId: string, kind: FactionStance['kind']): string {
  return `${factionId}:${kind}`
}

/** Every stance still inside its window today. */
export function activeStances(state: TavernState): FactionStance[] {
  const today = state.calendar.totalDaysElapsed
  return Object.values(getFactionModuleState(state).stances)
    .filter((stance) => stance.endsOnDay >= today)
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function activeStance(
  state: TavernState,
  factionId: string,
  kind: FactionStance['kind'],
): FactionStance | undefined {
  const today = state.calendar.totalDaysElapsed
  const stance = getFactionModuleState(state).stances[stanceId(factionId, kind)]
  if (!stance || stance.endsOnDay < today) return undefined
  return stance
}

export function openDemands(state: TavernState): FactionDemand[] {
  return Object.values(getFactionModuleState(state).demands)
    .filter((demand) => demand.status === 'open')
    .sort((a, b) => a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id))
}

export function openDemandFor(
  state: TavernState,
  factionId: string,
): FactionDemand | undefined {
  return openDemands(state).find((demand) => demand.factionId === factionId)
}

export function owedFavours(state: TavernState): FactionFavour[] {
  return Object.values(getFactionModuleState(state).favours)
    .filter((favour) => favour.status === 'owed')
    .sort((a, b) => a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id))
}

export function owedFavourFor(
  state: TavernState,
  factionId: string,
): FactionFavour | undefined {
  return owedFavours(state).find((favour) => favour.factionId === factionId)
}

// -- pruning ----------------------------------------------------------------

function pruneRecords<T extends { status: string; closedOnDay?: number; id: string }>(
  records: Record<string, T>,
  today: number,
  liveStatus: string,
): Record<string, T> {
  const entries = Object.entries(records).filter(([, record]) => {
    if (record.status === liveStatus) return true
    const closed = record.closedOnDay
    if (closed === undefined) return true
    return today - closed <= CLOSED_RECORD_RETENTION_DAYS
  })
  if (entries.length <= MAX_FACTION_RECORDS) return Object.fromEntries(entries) as Record<string, T>
  // Over the hard cap: keep the live ones and the most recently closed.
  const live = entries.filter(([, r]) => r.status === liveStatus)
  const closed = entries
    .filter(([, r]) => r.status !== liveStatus)
    .sort((a, b) => (b[1].closedOnDay ?? 0) - (a[1].closedOnDay ?? 0))
  return Object.fromEntries([
    ...live,
    ...closed.slice(0, Math.max(0, MAX_FACTION_RECORDS - live.length)),
  ]) as Record<string, T>
}

/**
 * Drop what nobody needs any more.
 *
 * Expired stances go entirely — a boycott that ended is described by the
 * move history, and keeping the stance record would make `activeStances`
 * walk a list that only grows. Closed demands and favours linger for three
 * weeks so "you refused them a fortnight ago" is still answerable, then go.
 */
export function pruneFactionRecords(
  slice: FactionModuleState,
  today: number,
): FactionModuleState {
  const stances = Object.fromEntries(
    Object.entries(slice.stances).filter(([, stance]) => stance.endsOnDay >= today),
  )
  const moveHistory =
    slice.moveHistory.length > MAX_FACTION_MOVE_HISTORY
      ? slice.moveHistory.slice(slice.moveHistory.length - MAX_FACTION_MOVE_HISTORY)
      : slice.moveHistory
  return {
    ...slice,
    stances,
    demands: pruneRecords(slice.demands, today, 'open'),
    favours: pruneRecords(slice.favours, today, 'owed'),
    moveHistory,
  }
}

export function recordFactionMove(
  ctx: SimContext,
  entry: FactionMoveEntry,
): void {
  writeFactionSlice(
    ctx,
    (current) => ({
      ...current,
      movesToday: [...current.movesToday, entry],
      moveHistory: [...current.moveHistory, entry].slice(-MAX_FACTION_MOVE_HISTORY),
      totals: {
        ...createInitialFactionTotals(),
        ...current.totals,
        movesMade: (current.totals.movesMade ?? 0) + 1,
      },
    }),
    'move',
  )
}

// -- schema -----------------------------------------------------------------

const StandingEntrySchema = z.object({
  id: z.string(),
  onDay: z.number().int(),
  kind: z.enum(['favour', 'grievance']),
  weight: z.number(),
  readable: z.string(),
  tags: z.array(z.string()),
})

const StanceSchema = z.object({
  id: z.string(),
  factionId: z.string(),
  kind: z.enum(['support', 'boycott', 'protection', 'supply_squeeze', 'rival_backing']),
  strength: z.number(),
  startedOnDay: z.number().int(),
  endsOnDay: z.number().int(),
  reason: z.string(),
  goalId: z.string(),
  contestedOnDay: z.number().int().optional(),
})

const DemandSchema = z.object({
  id: z.string(),
  factionId: z.string(),
  kind: z.enum(['coin_contribution', 'public_backing']),
  askCoin: z.number(),
  openedOnDay: z.number().int(),
  dueOnDay: z.number().int(),
  status: z.enum(['open', 'granted', 'refused', 'lapsed']),
  readable: z.string(),
  goalId: z.string(),
  closedOnDay: z.number().int().optional(),
})

const FavourSchema = z.object({
  id: z.string(),
  factionId: z.string(),
  grantedValue: z.number(),
  openedOnDay: z.number().int(),
  dueOnDay: z.number().int(),
  status: z.enum(['owed', 'repaid', 'called_in']),
  readable: z.string(),
  closedOnDay: z.number().int().optional(),
})

const MoveSchema = z.object({
  onDay: z.number().int(),
  factionId: z.string(),
  actionId: z.string(),
  goalId: z.string(),
  result: z.enum(['succeeded', 'failed', 'partial']),
  readable: z.string(),
})

export const FactionModuleStateSchema = z
  .object({
    actors: z.record(z.string(), ActorStateSchema).default({}),
    standing: z
      .record(
        z.string(),
        z.object({
          factionId: z.string(),
          entries: z.array(StandingEntrySchema),
          net: z.number(),
          lastUpdatedOnDay: z.number().int(),
        }),
      )
      .default({}),
    stances: z.record(z.string(), StanceSchema).default({}),
    demands: z.record(z.string(), DemandSchema).default({}),
    favours: z.record(z.string(), FavourSchema).default({}),
    moveHistory: z.array(MoveSchema).default([]),
    movesToday: z.array(MoveSchema).default([]),
    totals: z.record(z.string(), z.number()).default({}),
  })
  .partial()
  .passthrough()
  .optional()
