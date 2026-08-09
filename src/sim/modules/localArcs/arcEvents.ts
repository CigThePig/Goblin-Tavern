import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  getLiveScheduledEvents,
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import { localArcRegistry } from '../../content/events/localArcRegistry'
import { openDemandRecord } from '../factions/factionEvents'
import { noteStanding } from '../factions/standing'
import { getSupplierAccount, writeSupplierAccount } from '../suppliers/state'

import {
  bumpArcRunTotal,
  getArcRun,
  liveArcRuns,
  noteArcRun,
  writeArcRun,
  type ArcRun,
} from './arcRuns'
import { computeOutcome, progressionFor, stageFor } from './arcProgress'
import { applyPermanentChange, closeArcRun } from './arcOutcomes'
import { LOCAL_ARCS_MODULE_ID } from './types'

// Expansion Phase 9 §9.2 + Phase 1 §1.1 — five hook families stop draining.
//
// WHAT WAS BROKEN. Five `HOOK-*` rows in the implementation ledger belong to
// the arc layer, and all five were the same `OBL-02` failure: a response
// profile told the player the arc might fail, that leaning into the blight
// might lock the brand in, that gouging the festival crowd would draw a
// backlash, that the supplier's favour would be called in, or that the
// faction would want repaying — and the responses module drained the hook
// into a zero-weight cause because no domain owned the string.
//
//   HOOK-arc_failure_*                → arc_outcome_review
//   HOOK-blight_brand_lock_*          → arc_permanent_lock
//   HOOK-arc_exploit_backlash_*       → arc_backlash
//   HOOK-arc_faction_debt_*           → arc_debt_called_in
//   HOOK-arc_supplier_favour_owed_*   → arc_debt_called_in
//
// This phase can keep all five, because an arc finally has a goal it can
// fail, an owner who can be angry, and a kind of change that outlives it.
// None of these resolvers invents a consequence: each asks the arc how it
// is actually going, or hands the decision to the domain that owns the
// actor doing the asking.

export const ARC_OUTCOME_REVIEW_EVENT = 'arc_outcome_review'
export const ARC_PERMANENT_LOCK_EVENT = 'arc_permanent_lock'
export const ARC_BACKLASH_EVENT = 'arc_backlash'
export const ARC_DEBT_CALLED_IN_EVENT = 'arc_debt_called_in'

const ArcPayloadSchema = z.object({ arcId: z.string() })
const LockPayloadSchema = z.object({ arcId: z.string(), label: z.string() })
const DebtPayloadSchema = z.object({
  arcId: z.string(),
  from: z.enum(['faction', 'supplier']),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

export function arcRef(arcId: string): EntityRef {
  return { kind: 'local_event', id: arcId }
}

/**
 * Resolve a hook name to a LIVE arc.
 *
 * The seed generators build these names from `arcKey`, which is the arc
 * instance id for an active arc and the bare theme for an anticipation seed
 * — a promise made about an arc that had not started yet. Both are handled,
 * and a name that resolves to neither is DECLINED rather than pointed at
 * whichever arc happens to be running: a promise about a blight must not be
 * collected against an inspection campaign.
 */
export function arcFromHookName(
  hookName: string,
  prefix: string,
  state: TavernState,
): ArcRun | undefined {
  const key = hookName.slice(prefix.length)
  if (!key) return undefined
  const direct = getArcRun(state, key)
  if (direct && direct.outcome === undefined) return direct
  return liveArcRuns(state).find((run) => run.definitionId === key)
}

// ---------------------------------------------------------------------------
// arc_outcome_review — the arc is judged on how it actually went
// ---------------------------------------------------------------------------

const outcomeReviewEvent: ScheduledEventDefinition = {
  type: ARC_OUTCOME_REVIEW_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'This is where the arc is decided',
  payloadSchema: ArcPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 10,
  warningWindowDays: 5,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = ArcPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.arcId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['arc_failure_'],
  fromFutureHook: ({ hookName, state }) => {
    if (!state) return undefined
    const run = arcFromHookName(hookName, 'arc_failure_', state)
    if (!run) return undefined
    return { payload: { arcId: run.arcId }, target: arcRef(run.arcId) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = ArcPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no arc', record.origin.readable)
    }
    const run = getArcRun(ctx.state, parsed.data.arcId)
    if (!run) return noOp('that arc is no longer on the books', record.origin.readable)
    if (run.outcome !== undefined) {
      // It already finished on its own. Saying so is the difference between
      // an explained no-op and the drained-without-firing bug.
      return noOp(
        `that arc already ended in ${run.outcome}`,
        record.origin.readable,
      )
    }
    const progression = progressionFor(run.definitionId)
    const stage = progression ? stageFor(progression, run.stageId) : undefined
    if (!progression || !stage) {
      return noOp('that arc has no outcome to reach', record.origin.readable)
    }

    // THE COUNTERPLAY. The promise was that the arc MIGHT fail, and whether
    // it does is the comparison the arc has been running all along: how far
    // the house got against how hard the owner pushed. A player who worked
    // at it gets the success they earned, out of an event that was
    // scheduled expecting a failure.
    const { outcome: _stageOutcome, ...withoutOutcome } = stage
    const outcome = computeOutcome(run, withoutOutcome)
    const closure = closeArcRun(ctx, run, outcome)
    if (!closure) return noOp('that arc could not be closed', record.origin.readable)

    const arc = ctx.state.world.localEvents[run.arcId]
    if (arc) {
      ctx.modifyLocalEvent(
        run.arcId,
        {
          stage: outcome === 'failure' ? 'failed' : 'resolved',
          lastUpdatedDay: ctx.state.calendar.totalDaysElapsed,
        },
        {
          source: `${LOCAL_ARCS_MODULE_ID}.outcome_review`,
          sourceType: 'local_event',
          target: run.arcId,
          targetType: 'local_event',
          amount: 0,
          readable: closure.readable,
          tags: ['local_arc', 'outcome', outcome],
          relatedSystems: ['local_arcs'],
        },
      )
    }

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'local_event',
          targetId: run.arcId,
          field: 'outcome',
          readable: closure.readable,
        },
      ],
      readable: closure.readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.outcome_review`,
        sourceType: 'local_event',
        target: run.arcId,
        targetType: 'local_event',
        amount: outcome === 'failure' ? -1 : 1,
        readable: closure.readable,
        tags: ['local_arc', 'outcome', outcome],
        relatedActors: [arcRef(run.arcId)],
        relatedSystems: ['local_arcs'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// arc_permanent_lock — what the house leaned into sticks
// ---------------------------------------------------------------------------

const permanentLockEvent: ScheduledEventDefinition = {
  type: ARC_PERMANENT_LOCK_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'What the house leaned into may stick',
  payloadSchema: LockPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 5,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = LockPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.arcId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['blight_brand_lock_'],
  fromFutureHook: ({ hookName, state }) => {
    if (!state) return undefined
    const run = arcFromHookName(hookName, 'blight_brand_lock_', state)
    // A brand only locks in if the house is still leaning into it when the
    // day comes, so the arc has to still be running to be pointed at.
    if (!run) return undefined
    return {
      payload: { arcId: run.arcId, label: 'the place with the strange mushrooms' },
      target: arcRef(run.arcId),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = LockPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no arc', record.origin.readable)
    }
    const run = getArcRun(ctx.state, parsed.data.arcId)
    if (!run) return noOp('that arc is no longer on the books', record.origin.readable)

    // A CLOSED ARC CANNOT LOCK ANYTHING IN. The run record outlives the arc
    // for the report's sake, so this lookup succeeds long after the outcome
    // is set — and an arc that ended inside the warning window with progress
    // still under 55 was branding the house permanently for something that
    // was already over. The other three arc resolvers no-op a closed run;
    // this one did not, and a `knownFor` label is the least reversible thing
    // any of them can do.
    if (run.outcome !== undefined) {
      return noOp(
        `that arc already ended in ${run.outcome}, so there was nothing left to lean into`,
        record.origin.readable,
      )
    }

    // THE COUNTERPLAY. Leaning into something is only a brand while you are
    // still leaning. A house that spent the window putting the problem right
    // instead has nothing to lock in.
    if (run.goalProgress >= 55) {
      return noOp(
        'the house put it right instead, so there was nothing to lock in',
        record.origin.readable,
      )
    }

    const key = applyPermanentChange(ctx, run, {
      kind: 'identity_known_for',
      label: parsed.data.label,
      readable: `The house is known for ${parsed.data.label} now, and that will not wash off.`,
    })
    if (!key) {
      return noOp('the house was already known for it', record.origin.readable)
    }
    bumpArcRunTotal(ctx, 'permanentChangesApplied')
    writeArcRun(
      ctx,
      run.arcId,
      (current) => ({
        ...current,
        permanentChanges: [...new Set([...current.permanentChanges, key])],
      }),
      'lock_in',
    )
    noteArcRun(ctx, run.arcId, `Locked in: ${parsed.data.label}.`)

    const readable = `The house is known for ${parsed.data.label} now.`
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'tavern_identity',
          targetId: 'knownFor',
          field: 'knownFor',
          readable,
        },
      ],
      readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.brand_lock`,
        sourceType: 'local_event',
        target: 'tavernIdentity',
        targetType: 'tavern_identity',
        amount: 1,
        readable,
        tags: ['local_arc', 'identity', 'permanent'],
        relatedActors: [arcRef(run.arcId)],
        relatedSystems: ['local_arcs', 'tavernIdentity'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// arc_backlash — they did not care for being taken advantage of
// ---------------------------------------------------------------------------

const backlashEvent: ScheduledEventDefinition = {
  type: ARC_BACKLASH_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'Somebody did not care for being taken advantage of',
  payloadSchema: ArcPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 5,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = ArcPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.arcId : 'unknown'}:${scheduledForDay}`
  },
  futureHookPrefixes: ['arc_exploit_backlash_'],
  fromFutureHook: ({ hookName, state }) => {
    if (!state) return undefined
    const run = arcFromHookName(hookName, 'arc_exploit_backlash_', state)
    if (!run) return undefined
    return { payload: { arcId: run.arcId }, target: arcRef(run.arcId) }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = ArcPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no arc', record.origin.readable)
    }
    const run = getArcRun(ctx.state, parsed.data.arcId)
    if (!run) return noOp('that arc is no longer on the books', record.origin.readable)
    if (run.outcome !== undefined) {
      return noOp('that arc is already over', record.origin.readable)
    }
    if (!run.ownerRef) {
      return noOp('nobody owned that arc to take offence', record.origin.readable)
    }

    // THE COUNTERPLAY. A house that made it up to them in the meantime — by
    // taking the intervention that calms them rather than the one that
    // provokes — has nothing coming.
    if (run.opposition <= 20) {
      return noOp(
        `${run.ownerLabel ?? 'they'} were squared before it came to anything`,
        record.origin.readable,
      )
    }

    const bump = 22
    writeArcRun(
      ctx,
      run.arcId,
      (current) => ({
        ...current,
        opposition: Math.min(100, current.opposition + bump),
      }),
      'backlash',
    )
    noteArcRun(
      ctx,
      run.arcId,
      `${run.ownerLabel ?? 'They'} made it plain what they thought of being used.`,
    )

    // The other half belongs to whoever's domain the owner lives in.
    if (run.ownerRef.kind === 'faction') {
      noteStanding(ctx, {
        factionId: run.ownerRef.id,
        id: `arc_exploited_${run.arcId}`,
        kind: 'grievance',
        weight: 22,
        readable: `${run.ownerLabel ?? run.ownerRef.id} were taken advantage of during ${run.definitionId.replace(/_/g, ' ')}.`,
        tags: ['arc', 'exploit', 'grievance'],
      })
    }

    const readable = `${run.ownerLabel ?? 'They'} pushed back hard over being taken advantage of.`
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'local_event',
          targetId: run.arcId,
          field: 'opposition',
          readable,
        },
      ],
      readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.backlash`,
        sourceType: 'local_event',
        target: run.arcId,
        targetType: 'local_event',
        amount: bump,
        readable,
        tags: ['local_arc', 'backlash'],
        relatedActors: [arcRef(run.arcId), run.ownerRef],
        relatedSystems: ['local_arcs'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// arc_debt_called_in — the help was not free
// ---------------------------------------------------------------------------

const debtCalledInEvent: ScheduledEventDefinition = {
  type: ARC_DEBT_CALLED_IN_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'The help during the arc was not free',
  payloadSchema: DebtPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 11,
  warningWindowDays: 4,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = DebtPayloadSchema.safeParse(payload)
    const arcId = parsed.success ? parsed.data.arcId : 'unknown'
    const from = parsed.success ? parsed.data.from : 'faction'
    return `${type}:${arcId}:${from}:${scheduledForDay}`
  },
  futureHookPrefixes: ['arc_faction_debt_', 'arc_supplier_favour_owed_'],
  fromFutureHook: ({ hookName, state }) => {
    if (!state) return undefined
    const faction = hookName.startsWith('arc_faction_debt_')
    const prefix = faction ? 'arc_faction_debt_' : 'arc_supplier_favour_owed_'
    const run = arcFromHookName(hookName, prefix, state)
    if (!run) return undefined
    return {
      payload: { arcId: run.arcId, from: faction ? ('faction' as const) : ('supplier' as const) },
      target: arcRef(run.arcId),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = DebtPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload named no debt', record.origin.readable)
    }
    const run = getArcRun(ctx.state, parsed.data.arcId)
    if (!run) return noOp('that arc is no longer on the books', record.origin.readable)

    // WHO is owed comes from the arc's own owner where the kinds agree, and
    // from the world otherwise. Either way the debt is collected THROUGH the
    // creditor's own domain — a faction opens a real, answerable demand; a
    // supplier simply trades harder — rather than by this module deciding
    // what somebody else's records say.
    if (parsed.data.from === 'faction') {
      const factionId =
        run.ownerRef?.kind === 'faction' ? run.ownerRef.id : pickCreditorFaction(ctx.state)
      if (!factionId || !ctx.state.world.factions[factionId]) {
        return noOp('nobody was owed anything for it', record.origin.readable)
      }
      const faction = ctx.state.world.factions[factionId]!
      const demand = openDemandRecord(ctx, {
        factionId,
        kind: 'coin_contribution',
        askCoin: Math.max(20, Math.min(90, Math.round(faction.influence))),
        goalId: 'collect_what_is_owed',
        readable: `what they put in during ${run.definitionId.replace(/_/g, ' ')}`,
        dueInDays: 4,
      })
      if (!demand) {
        return noOp(
          `${faction.label} had an ask outstanding already`,
          record.origin.readable,
        )
      }
      const readable = `${faction.label} have come to collect for the help they gave.`
      return {
        status: 'resolved',
        mutations: [
          { targetKind: 'faction', targetId: factionId, field: 'demands', readable },
        ],
        readable,
        cause: {
          source: `${LOCAL_ARCS_MODULE_ID}.debt_called_in`,
          sourceType: 'local_event',
          target: factionId,
          targetType: 'faction',
          amount: demand.askCoin,
          readable,
          tags: ['local_arc', 'debt', 'faction'],
          relatedActors: [arcRef(run.arcId), { kind: 'faction', id: factionId }],
          relatedSystems: ['local_arcs', 'factions'],
        },
      }
    }

    const supplierId =
      run.ownerRef?.kind === 'supplier' ? run.ownerRef.id : pickCreditorSupplier(ctx.state)
    if (!supplierId || !getSupplierAccount(ctx.state, supplierId)) {
      return noOp('nobody was owed anything for it', record.origin.readable)
    }
    const today = ctx.state.calendar.totalDaysElapsed
    writeSupplierAccount(
      ctx,
      supplierId,
      (current) => ({
        ...current,
        termsAdjustment: Math.min(1.6, Math.round(current.termsAdjustment * 112) / 100),
        termsAdjustmentUntilDay: today + 28,
        lastDecisionDay: today,
        lastDecisionReason: 'Calling in the favour from the arc.',
      }),
      'arc_favour_called_in',
    )
    const readable = 'The supplier called in the favour, and the price says so.'
    return {
      status: 'resolved',
      mutations: [
        { targetKind: 'supplier', targetId: supplierId, field: 'termsAdjustment', readable },
      ],
      readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.debt_called_in`,
        sourceType: 'local_event',
        target: supplierId,
        targetType: 'supplier',
        amount: 0,
        readable,
        tags: ['local_arc', 'debt', 'supplier'],
        relatedActors: [arcRef(run.arcId), { kind: 'supplier', id: supplierId }],
        relatedSystems: ['local_arcs', 'suppliers'],
      },
    }
  },
}

/** The faction most plausibly owed, when the arc's owner is not one. */
export function pickCreditorFaction(state: TavernState): string | undefined {
  return Object.values(state.world.factions)
    .filter((faction) => faction.relationship >= 45)
    .sort((a, b) => b.influence - a.influence || a.id.localeCompare(b.id))[0]?.id
}

export function pickCreditorSupplier(state: TavernState): string | undefined {
  return Object.values(state.world.suppliers)
    .filter((supplier) => supplier.relationship >= 45)
    .sort((a, b) => b.relationship - a.relationship || a.id.localeCompare(b.id))[0]?.id
}

// ---------------------------------------------------------------------------
// Producers
// ---------------------------------------------------------------------------

/**
 * Stake a hook an intervention promised.
 *
 * `stakesHook` on an intervention names the family; this maps it to the
 * event that owns it, so a risky move the player takes actually schedules
 * the thing it warned about.
 */
export function scheduleArcHook(
  ctx: SimContext,
  input: { arcId: string; hook: string; source: string; readable: string; offsetDays?: number },
): boolean {
  const today = ctx.state.calendar.totalDaysElapsed
  const scheduledForDay = today + (input.offsetDays ?? 10)
  const already = getLiveScheduledEvents(ctx.state).some(
    (event) => event.target?.id === input.arcId && event.type === typeForHook(input.hook),
  )
  if (already) return false
  const type = typeForHook(input.hook)
  if (!type) return false

  const payload =
    type === ARC_DEBT_CALLED_IN_EVENT
      ? {
          arcId: input.arcId,
          from: input.hook === 'arc_faction_debt' ? 'faction' : 'supplier',
        }
      : type === ARC_PERMANENT_LOCK_EVENT
        ? { arcId: input.arcId, label: 'the place with the strange mushrooms' }
        : { arcId: input.arcId }

  const result = scheduleEvent(ctx, {
    type,
    target: arcRef(input.arcId),
    scheduledForDay,
    payload,
    origin: { source: input.source, readable: input.readable },
  })
  return result.status === 'scheduled'
}

function typeForHook(hook: string): string | undefined {
  switch (hook) {
    case 'arc_failure':
      return ARC_OUTCOME_REVIEW_EVENT
    case 'blight_brand_lock':
      return ARC_PERMANENT_LOCK_EVENT
    case 'arc_exploit_backlash':
      return ARC_BACKLASH_EVENT
    case 'arc_faction_debt':
    case 'arc_supplier_favour_owed':
      return ARC_DEBT_CALLED_IN_EVENT
    default:
      return undefined
  }
}

export const ARC_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  outcomeReviewEvent,
  permanentLockEvent,
  backlashEvent,
  debtCalledInEvent,
]

export const ARC_SCHEDULED_EVENT_TYPES: ReadonlyArray<string> =
  ARC_SCHEDULED_EVENTS.map((definition) => definition.type)

let registered = false

export function ensureArcScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of ARC_SCHEDULED_EVENTS) registerScheduledEvent(definition)
  registered = true
}

ensureArcScheduledEventsRegistered()

void localArcRegistry
