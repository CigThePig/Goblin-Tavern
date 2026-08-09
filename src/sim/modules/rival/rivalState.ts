import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'
import {
  ActorStateSchema,
  createActorState,
  type ActorState,
} from '../../contracts/actors/index'

import type {
  RivalCourting,
  RivalModuleState,
  RivalMoveEntry,
  RivalRecord,
  RivalSetback,
  RivalSetbackKind,
  RivalTotals,
} from './types'

// Expansion Phase 9 §9.1 — reading and writing the rival slice.
//
// The slice is NEW, so unlike the Phase 8 domains there is no empty `{}` in
// old saves to walk past — the generic `ensureModuleSlices` sweep would
// install a blank one correctly. It is still migrated by name
// (`ensureRivalAgencyFields`) because a blank one would be WRONG in a way
// the sweep cannot know about: a save whose monthly slice already records a
// rival with appeal 62 running a `cheap` house has met that rival, and
// starting it over as an unknown newcomer would lose competition the player
// has already lived through.

export const RIVAL_MODULE_ID = 'rival'

/** The one rival the world starts with. Matches `systemRef('rival_tavern')`. */
export const PRIMARY_RIVAL_ID = 'rival_tavern'

export function rivalRef(rivalId: string = PRIMARY_RIVAL_ID): EntityRef {
  return { kind: 'system', id: rivalId }
}

// -- §5.11 bounded growth ---------------------------------------------------
//
// Four collections. `courting` is bounded structurally (one entry per
// registered customer group, and entries whose effort decays to nothing are
// dropped), so the three that could grow without limit carry explicit caps.

/** Moves kept for the report and for "what have they been up to". */
export const MAX_RIVAL_MOVE_HISTORY = 40
/** Hard cap on setback records, recovered or not. */
export const MAX_RIVAL_SETBACKS = 8
/** Recovered setbacks are pruned this many days after they close. */
export const RECOVERED_SETBACK_RETENTION_DAYS = 21
/** Courting below this is not a campaign any more; the record is dropped. */
export const COURTING_FLOOR = 4

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export function createInitialRivalTotals(): RivalTotals {
  return {
    movesMade: 0,
    positionsChosen: 0,
    staffRecruited: 0,
    priceShifts: 0,
    groupsCourted: 0,
    backingsSought: 0,
    rumoursSpread: 0,
    rumoursAnswered: 0,
    weaknessesExploited: 0,
    setbacksOpened: 0,
    setbacksRecovered: 0,
    trucesAgreed: 0,
    trucesBroken: 0,
  }
}

export function createInitialRivalModuleState(): RivalModuleState {
  return {
    rivals: {},
    moveHistory: [],
    movesToday: [],
    totals: createInitialRivalTotals(),
  }
}

/**
 * Names the rival house can be called.
 *
 * A fixed list rather than the name generator: the generator builds PEOPLE
 * from cultural profiles, and a tavern sign is a different kind of thing.
 * The list is content, and the pick is one draw from a named stream so an
 * extra service roll cannot rename the competition (architecture rule 7).
 */
const RIVAL_HOUSE_NAMES: ReadonlyArray<string> = [
  'The Gilded Tusk',
  'The Copper Kettle',
  'The Long Vein',
  'The Rat and Regret',
  'The Second Bell',
  'The Broken Pick',
  'The Amber Door',
  'The Quiet Wheel',
  'The Hollow Crown',
  'The Salt Lantern',
]

/** Where a rival with no history starts. Deliberately level with the house. */
export const BASELINE_CAPABILITY = {
  staffing: 45,
  quality: 45,
  priceLevel: 50,
  reach: 35,
} as const

export const RIVAL_GOALS = {
  WIN_THE_TRADE: 'win_the_trade',
  EXPLOIT_WEAKNESS: 'exploit_weakness',
  BUILD_STANDING: 'build_standing',
  PUT_OUR_HOUSE_IN_ORDER: 'put_our_house_in_order',
  KEEP_THE_PEACE: 'keep_the_peace',
} as const

/** A blank actor for a rival. Goals are re-derived every day it decides. */
export function createRivalActor(rivalId: string): ActorState {
  return createActorState({
    ref: rivalRef(rivalId),
    ownerModuleId: RIVAL_MODULE_ID,
    budget: 2,
    goals: [],
  })
}

export function createRivalRecord(
  input: {
    id?: string
    name: string
    today: number
    capability?: Partial<RivalRecord['capability']>
    position?: RivalRecord['position']
    purse?: number
  },
): RivalRecord {
  const id = input.id ?? PRIMARY_RIVAL_ID
  return {
    id,
    name: input.name,
    actor: createRivalActor(id),
    position: input.position ?? 'unknown',
    positionSinceDay: input.today,
    menuFocus: 'rounds',
    capability: { ...BASELINE_CAPABILITY, ...(input.capability ?? {}) },
    purse: input.purse ?? 40,
    courting: {},
    backingFactionIds: [],
    setbacks: [],
  }
}

/** Pick the rival's name once, from a named stream. */
export function pickRivalName(ctx: SimContext, rivalId: string): string {
  const rng = ctx.getRngStreamByName(`rival_identity:${rivalId}`)
  const index = rng.int(0, RIVAL_HOUSE_NAMES.length - 1)
  return RIVAL_HOUSE_NAMES[index] ?? RIVAL_HOUSE_NAMES[0]!
}

// ---------------------------------------------------------------------------
// Slice access
// ---------------------------------------------------------------------------

export function normalizeRivalSlice(
  slice: Partial<RivalModuleState> | undefined,
): RivalModuleState {
  const base = createInitialRivalModuleState()
  if (!slice) return base
  return {
    rivals: slice.rivals ?? base.rivals,
    moveHistory: slice.moveHistory ?? base.moveHistory,
    movesToday: slice.movesToday ?? base.movesToday,
    totals: { ...base.totals, ...(slice.totals ?? {}) },
  }
}

export function getRivalModuleState(state: {
  modules: Record<string, unknown>
}): RivalModuleState {
  return normalizeRivalSlice(
    state.modules[RIVAL_MODULE_ID] as Partial<RivalModuleState> | undefined,
  )
}

/** The primary rival, when the world has one yet. */
export function getPrimaryRival(state: {
  modules: Record<string, unknown>
}): RivalRecord | undefined {
  return getRivalModuleState(state).rivals[PRIMARY_RIVAL_ID]
}

export function writeRivalSlice(
  ctx: SimContext,
  updater: (current: RivalModuleState) => RivalModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<RivalModuleState>(
    RIVAL_MODULE_ID,
    (current) => updater(normalizeRivalSlice(current)),
    { source: `${RIVAL_MODULE_ID}.${reason}`, reason },
  )
}

export function writeRival(
  ctx: SimContext,
  rivalId: string,
  updater: (current: RivalRecord) => RivalRecord,
  reason: string,
): void {
  writeRivalSlice(
    ctx,
    (current) => {
      const rival = current.rivals[rivalId]
      if (!rival) return current
      return { ...current, rivals: { ...current.rivals, [rivalId]: updater(rival) } }
    },
    reason,
  )
}

export function bumpRivalTotal(
  ctx: SimContext,
  key: keyof RivalTotals,
  by = 1,
): void {
  if (by === 0) return
  writeRivalSlice(
    ctx,
    (current) => ({
      ...current,
      totals: {
        ...createInitialRivalTotals(),
        ...current.totals,
        [key]: (current.totals[key] ?? 0) + by,
      },
    }),
    'totals',
  )
}

export function recordRivalMove(ctx: SimContext, entry: RivalMoveEntry): void {
  writeRivalSlice(
    ctx,
    (current) => {
      const history = [...current.moveHistory, entry]
      return {
        ...current,
        movesToday: [...current.movesToday, entry],
        moveHistory:
          history.length > MAX_RIVAL_MOVE_HISTORY
            ? history.slice(history.length - MAX_RIVAL_MOVE_HISTORY)
            : history,
        totals: {
          ...createInitialRivalTotals(),
          ...current.totals,
          movesMade: (current.totals.movesMade ?? 0) + 1,
        },
      }
    },
    'move',
  )
}

// ---------------------------------------------------------------------------
// Setbacks
// ---------------------------------------------------------------------------

/**
 * Open a setback on the rival.
 *
 * Returns the record so a caller can report it. Re-opening the same kind
 * deepens the existing one rather than stacking a second: a rival that has
 * lost two cooks has one staffing problem, not two.
 */
export function openRivalSetback(
  ctx: SimContext,
  input: {
    rivalId?: string
    kind: RivalSetbackKind
    severity: number
    readable: string
  },
): RivalSetback | undefined {
  const rivalId = input.rivalId ?? PRIMARY_RIVAL_ID
  const rival = getRivalModuleState(ctx.state).rivals[rivalId]
  if (!rival) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const existing = rival.setbacks.find(
    (setback) => setback.kind === input.kind && setback.recoveredOnDay === undefined,
  )
  const severity = Math.max(1, Math.min(100, Math.round(input.severity)))
  const record: RivalSetback = existing
    ? {
        ...existing,
        severity: Math.min(100, existing.severity + Math.round(severity / 2)),
        readable: input.readable,
      }
    : {
        id: `${rivalId}:${input.kind}:${today}`,
        kind: input.kind,
        severity,
        openedOnDay: today,
        readable: input.readable,
      }

  writeRival(
    ctx,
    rivalId,
    (current) => {
      const others = current.setbacks.filter((setback) => setback.id !== record.id)
      const next = [...others, record]
      return {
        ...current,
        setbacks:
          next.length > MAX_RIVAL_SETBACKS
            ? next.slice(next.length - MAX_RIVAL_SETBACKS)
            : next,
      }
    },
    `setback_${input.kind}`,
  )
  if (!existing) bumpRivalTotal(ctx, 'setbacksOpened')
  return record
}

/** Setbacks still costing the rival something. */
export function liveSetbacks(rival: RivalRecord): RivalSetback[] {
  return rival.setbacks
    .filter((setback) => setback.recoveredOnDay === undefined)
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
}

/** Total capability drag, 0..1, from everything currently going wrong. */
export function setbackDrag(rival: RivalRecord): number {
  const total = liveSetbacks(rival).reduce((sum, s) => sum + s.severity, 0)
  return Math.min(0.6, Math.round((total / 200) * 100) / 100)
}

// ---------------------------------------------------------------------------
// Courting
// ---------------------------------------------------------------------------

export function courtingFor(
  rival: RivalRecord,
  groupId: string,
): RivalCourting | undefined {
  return rival.courting[groupId]
}

/** Every group the rival is actively working, strongest first. */
export function activeCourting(rival: RivalRecord): RivalCourting[] {
  return Object.values(rival.courting)
    .filter((entry) => entry.effort >= COURTING_FLOOR)
    .sort((a, b) => b.effort - a.effort || a.groupId.localeCompare(b.groupId))
}

// ---------------------------------------------------------------------------
// Pruning — §5.11
// ---------------------------------------------------------------------------

export function pruneRivalRecords(
  slice: RivalModuleState,
  today: number,
): RivalModuleState {
  const rivals: Record<string, RivalRecord> = {}
  for (const [id, rival] of Object.entries(slice.rivals)) {
    const setbacks = rival.setbacks.filter(
      (setback) =>
        setback.recoveredOnDay === undefined ||
        today - setback.recoveredOnDay <= RECOVERED_SETBACK_RETENTION_DAYS,
    )
    const courting: Record<string, RivalCourting> = {}
    for (const [groupId, entry] of Object.entries(rival.courting)) {
      if (entry.effort < COURTING_FLOOR) continue
      courting[groupId] = entry
    }
    rivals[id] = { ...rival, setbacks, courting }
  }
  const moveHistory =
    slice.moveHistory.length > MAX_RIVAL_MOVE_HISTORY
      ? slice.moveHistory.slice(slice.moveHistory.length - MAX_RIVAL_MOVE_HISTORY)
      : slice.moveHistory
  return { ...slice, rivals, moveHistory }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RivalCapabilitySchema = z.object({
  staffing: z.number(),
  quality: z.number(),
  priceLevel: z.number(),
  reach: z.number(),
})

const RivalSetbackSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'staff_poached',
    'supply_failure',
    'rumour_exposed',
    'watch_trouble',
    'backing_withdrawn',
  ]),
  severity: z.number(),
  openedOnDay: z.number().int(),
  recoveredOnDay: z.number().int().optional(),
  readable: z.string(),
})

const RivalCourtingSchema = z.object({
  groupId: z.string(),
  effort: z.number(),
  startedOnDay: z.number().int(),
  lastPushedDay: z.number().int(),
  poaching: z.boolean(),
  reason: z.string(),
})

const RivalRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  actor: ActorStateSchema,
  position: z.enum(['unknown', 'cheap', 'clean', 'rowdy', 'fancy']),
  positionSinceDay: z.number().int(),
  menuFocus: z.enum(['rounds', 'food', 'spectacle', 'comfort']),
  capability: RivalCapabilitySchema,
  purse: z.number(),
  courting: z.record(z.string(), RivalCourtingSchema),
  backingFactionIds: z.array(z.string()),
  setbacks: z.array(RivalSetbackSchema),
  truceUntilDay: z.number().int().optional(),
  scoutedOnDay: z.number().int().optional(),
})

const RivalMoveEntrySchema = z.object({
  onDay: z.number().int(),
  rivalId: z.string(),
  actionId: z.string(),
  goalId: z.string(),
  targetId: z.string().optional(),
  result: z.enum(['succeeded', 'failed', 'partial']),
  readable: z.string(),
})

export const RivalModuleStateSchema = z.object({
  rivals: z.record(z.string(), RivalRecordSchema),
  moveHistory: z.array(RivalMoveEntrySchema),
  movesToday: z.array(RivalMoveEntrySchema),
  totals: z.object({
    movesMade: z.number(),
    positionsChosen: z.number(),
    staffRecruited: z.number(),
    priceShifts: z.number(),
    groupsCourted: z.number(),
    backingsSought: z.number(),
    rumoursSpread: z.number(),
    rumoursAnswered: z.number(),
    weaknessesExploited: z.number(),
    setbacksOpened: z.number(),
    setbacksRecovered: z.number(),
    trucesAgreed: z.number(),
    trucesBroken: z.number(),
  }),
})

/** True while a settlement pact holds. Every hostile move is off. */
export function underTruce(rival: RivalRecord | undefined, today: number): boolean {
  return rival?.truceUntilDay !== undefined && today <= rival.truceUntilDay
}

export function rivalLabel(state: TavernState, rivalId = PRIMARY_RIVAL_ID): string {
  return getRivalModuleState(state).rivals[rivalId]?.name ?? 'the rival house'
}

// ---------------------------------------------------------------------------
// Reading the pre-Phase-9 record
// ---------------------------------------------------------------------------
//
// Every post-Phase-15 save already records a rival in
// `modules.monthly.rivalTavern` — an appeal, a pressure and a strategy the
// player has been living with. When the rival record is opened for the
// first time on such a save, it must open at the standing the save recorded
// rather than as an unknown newcomer, or the migration would throw away a
// competition already played. These two readers plus
// `rivalCapabilityFromRecordedAppeal` are how; they live here rather than in
// `state/migrations.ts` so the migration and the module's own `ensureRival`
// read the save the same way, from one implementation.

function readRecordedRival(state: {
  modules: Record<string, unknown>
}): Record<string, unknown> | undefined {
  const monthly = state.modules['monthly']
  if (typeof monthly !== 'object' || monthly === null) return undefined
  const rival = (monthly as Record<string, unknown>)['rivalTavern']
  if (typeof rival !== 'object' || rival === null) return undefined
  return rival as Record<string, unknown>
}

/** The strategy the save recorded, when it is one the rival can hold. */
export function recordedRivalPosition(state: {
  modules: Record<string, unknown>
}): RivalRecord['position'] {
  const strategy = readRecordedRival(state)?.['strategy']
  return strategy === 'cheap' ||
    strategy === 'clean' ||
    strategy === 'rowdy' ||
    strategy === 'fancy'
    ? strategy
    : 'unknown'
}

/** The appeal the save recorded, or the pre-Phase-9 neutral. */
export function recordedRivalAppeal(state: {
  modules: Record<string, unknown>
}): number {
  const appeal = readRecordedRival(state)?.['appeal']
  return typeof appeal === 'number' ? appeal : 30
}

/**
 * What a recorded appeal is worth as capability.
 *
 * 30 was the recorded neutral and `BASELINE_CAPABILITY` is level with the
 * house, so a save that never let its rival get going opens a rival that is
 * exactly level — no competition is invented — while one whose rival had
 * pulled well ahead opens a rival that is already ahead.
 */
export function rivalCapabilityFromRecordedAppeal(
  appeal: number,
): RivalRecord['capability'] {
  const lift = Math.max(-30, Math.min(40, Math.round(appeal - 30)))
  return {
    staffing: Math.max(0, Math.min(100, BASELINE_CAPABILITY.staffing + Math.round(lift * 0.6))),
    quality: Math.max(0, Math.min(100, BASELINE_CAPABILITY.quality + Math.round(lift * 0.6))),
    priceLevel: BASELINE_CAPABILITY.priceLevel,
    reach: Math.max(0, Math.min(100, BASELINE_CAPABILITY.reach + Math.round(lift * 0.8))),
  }
}
