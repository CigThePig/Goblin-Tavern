import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { SimulationHook, SimulationModule } from '../../core/module'

import { getRule } from '../../contracts/ruleset/index'
import {
  OBLIGATIONS_MODULE_ID,
  nextObligationId,
  openObligation,
  scheduleObligationDueDate,
  upsertObligation,
} from '../../contracts/obligations/index'
import {
  registerScheduledEvent,
  scheduleEvent,
  unregisterScheduledEvent,
  type ScheduledEventDefinition,
} from '../../contracts/scheduledEvents/index'
import { evaluateHysteresis } from '../../contracts/meters/index'
import {
  createActorState,
  decideActorAction,
  declareActorIntent,
  performActorAction,
  type ActorActionDefinition,
  type ActorState,
} from '../../contracts/actors/index'
import { applyResponseProfile } from '../../modules/responses/applyResponseProfile'
import { createCtxApplier } from '../../modules/responses/ctxApplier'

// Expansion Phase 1 — the obligation/scheduled-event probe expansion.
//
// WHY THIS EXISTS. Phase 1 builds the shared machinery for obligations and
// typed scheduled events; the domains that will USE it — suppliers (Phase 6),
// loans and tenancy (Phase 7), employment (Phase 3), construction (Phase 2) —
// do not exist yet, and the arc's working conventions forbid building them
// early ("Do not skip ahead"). So the only way to exercise the machinery end
// to end this phase is with a producer that calls the same public API those
// domains will call.
//
// That is what this is: a real `SimulationModule`, in a real pipeline, using
// the sanctioned `openObligation` / `scheduleObligationDueDate` /
// `scheduleEvent` API, running through the real engine — including segments,
// save/reload, and the report pass. It is NOT fixture injection: nothing here
// writes state the public API could not produce. It follows the precedent set
// by `candleShortage.ts`, the Phase 1 §9.2 fake expansion.
//
// It ships in `testing/` and is not in `FULL_PIPELINE`, so it cannot affect
// production behaviour.

export const OBLIGATION_PROBE_MODULE_ID = 'obligation_probe_expansion'

/** A mechanical event owned by this expansion, for the ownership tests. */
export const PROBE_EVENT_TYPE = 'probe_landlord_visit'

/**
 * A second owned type, named as a response future hook would name it, with a
 * `fromFutureHook` adapter. It exists to exercise the MECHANICAL branch of
 * the bridge — the branch no shipped hook family can reach yet, because no
 * domain owns one until Phase 2.
 */
export const PROBE_HOOK_EVENT_TYPE = 'probe_landlord_grudge'

/** A hook name nothing owns, to exercise the narrative branch alongside it. */
export const PROBE_UNOWNED_HOOK = 'probe_unowned_mutter'

const ProbePayloadSchema = z.object({ note: z.string() })

/**
 * Config for one probe run. The probe opens ONE obligation on
 * `openOnDay` and then leaves the shared machinery to do the rest — which
 * is the point: if the due date, the grace window, the late charges and the
 * escalation all happen without the probe touching them again, the machinery
 * is genuinely self-driving.
 */
export type ObligationProbeConfig = {
  openOnDay: number
  principal: number
  /** Days after `openOnDay` the sum comes due. */
  dueInDays: number
  counterpartyId: string
  /**
   * Day on which to push a profile carrying two future hooks — one owned,
   * one not — through the real response applier. Omit to skip.
   */
  declareFutureHooksOnDay?: number
  /** Run the hysteresis + actor primitives every day. */
  exercisePrimitives?: boolean
}

let config: ObligationProbeConfig = {
  openOnDay: 1,
  principal: 40,
  dueInDays: 2,
  counterpartyId: 'the_landlord',
}

export function configureObligationProbe(next: ObligationProbeConfig): void {
  config = next
}

/** Ids of obligations this probe has opened, in order. */
const opened: string[] = []

export function probeOpenedObligationIds(): ReadonlyArray<string> {
  return [...opened]
}

export function resetObligationProbe(): void {
  opened.length = 0
  probeActor = createActorState({
    ref: { kind: 'system', id: 'probe_actor' },
    ownerModuleId: OBLIGATION_PROBE_MODULE_ID,
    budget: 10,
    goals: [{ id: 'tidy', weight: 1, readable: 'Wants the room presentable' }],
  })
}

const probeEventDefinition: ScheduledEventDefinition = {
  type: PROBE_EVENT_TYPE,
  kind: 'mechanical',
  ownerModuleId: OBLIGATION_PROBE_MODULE_ID,
  label: 'The landlord drops by',
  payloadSchema: ProbePayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 2,
  warningWindowDays: 1,
  expiryDays: 2,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, target }) =>
    `${type}|${target ? `${target.kind}:${target.id}` : 'none'}`,
  resolve: (ctx) => {
    // An authoritative mutation on a real state field, so the probe proves
    // the "resolved must mutate" contract rather than asserting around it.
    const privy = ctx.state.areas['privy']
    if (!privy) {
      return {
        status: 'no_op',
        reason: 'no privy to inspect',
        readable: 'The landlord found nothing to look at.',
      }
    }
    ctx.modifyArea(
      'privy',
      { smell: Math.max(0, privy.smell - 5) },
      {
        source: `${OBLIGATION_PROBE_MODULE_ID}.visit`,
        reason: 'landlord_visit',
      },
    )
    return {
      status: 'resolved',
      readable: 'The landlord came by and you scrubbed the privy first.',
      mutations: [
        {
          targetKind: 'area',
          targetId: 'privy',
          field: 'smell',
          readable: 'Privy smell down 5 ahead of the visit.',
        },
      ],
    }
  },
}

/**
 * The event a response future hook can reach.
 *
 * `fromFutureHook` is the adapter §1.1's bridge requires: the bare hook name
 * carries no payload, and only the owning domain knows how to build one, so
 * the owner supplies this rather than the bridge guessing.
 */
const hookEventDefinition: ScheduledEventDefinition = {
  type: PROBE_HOOK_EVENT_TYPE,
  kind: 'mechanical',
  ownerModuleId: OBLIGATION_PROBE_MODULE_ID,
  label: 'The landlord holds a grudge',
  payloadSchema: z.object({ readable: z.string() }),
  beat: 'wrap_up',
  defaultOffsetDays: 3,
  warningWindowDays: 0,
  expiryDays: 3,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, scheduledForDay }) => `${type}|${scheduledForDay}`,
  fromFutureHook: ({ readable }) => ({ payload: { readable } }),
  resolve: (ctx, record) => {
    const cellar = ctx.state.areas['cellar']
    if (!cellar) {
      return {
        status: 'no_op',
        reason: 'no cellar to neglect',
        readable: record.origin.readable,
      }
    }
    ctx.modifyArea(
      'cellar',
      { risk: Math.min(100, cellar.risk + 3) },
      { source: `${OBLIGATION_PROBE_MODULE_ID}.grudge`, reason: 'landlord_grudge' },
    )
    return {
      status: 'resolved',
      readable: 'The landlord stopped sending anyone to look at the cellar.',
      mutations: [
        {
          targetKind: 'area',
          targetId: 'cellar',
          field: 'risk',
          readable: 'Cellar risk up 3 while the landlord sulks.',
        },
      ],
    }
  },
}

/**
 * Drive the future-hook bridge through the REAL response applier.
 *
 * `applyResponseProfile` + `createCtxApplier` is exactly how the responses
 * module itself dispatches a profile, so this exercises the production path
 * rather than a stand-in — including both branches of the bridge, since the
 * profile below declares one owned hook name and one unowned one.
 */
const futureHookHook: SimulationHook = (ctx: SimContext): void => {
  if (!config.declareFutureHooksOnDay) return
  if (ctx.state.calendar.totalDaysElapsed !== config.declareFutureHooksOnDay) {
    return
  }
  const origin = {
    seedId: 'probe_seed',
    intentId: 'probe_intent',
    profileId: 'probe_profile',
    responseSlotId: 'probe_slot',
    verb: 'probe',
    enqueuedDay: ctx.state.calendar.totalDaysElapsed,
    selectionLabel: 'Tell the landlord where to go',
  }
  applyResponseProfile(
    {
      id: 'probe_profile',
      immediateEffects: [],
      delayedEffects: [],
      memories: [],
      futureHooks: [
        {
          id: PROBE_HOOK_EVENT_TYPE,
          label: 'The landlord will remember this.',
          metadata: { scheduledInDays: 2 },
        },
        {
          id: PROBE_UNOWNED_HOOK,
          label: 'Someone mutters about it.',
          metadata: { scheduledInDays: 2 },
        },
      ],
    } as unknown as Parameters<typeof applyResponseProfile>[0],
    origin,
    createCtxApplier(ctx),
  )
}

/**
 * Exercise the two Phase 1 primitives that need a live context: the
 * hysteresis latch (§1.5) and actor execution (§1.6).
 *
 * `decideActorAction` is pure and is tested directly, but `declareActorIntent`
 * and `performActorAction` spend budget, set cooldowns, take commitments and
 * fold outcomes back into beliefs — none of which can be observed without a
 * real ctx and a real day. Phase 8 is the first DOMAIN to own an actor; until
 * then this is what proves the machinery runs.
 */
export const PROBE_LATCH_KEY = 'probe:main_room_band'

let probeActor = createActorState({
  ref: { kind: 'system', id: 'probe_actor' },
  ownerModuleId: OBLIGATION_PROBE_MODULE_ID,
  budget: 10,
  goals: [{ id: 'tidy', weight: 1, readable: 'Wants the room presentable' }],
})

export function probeActorState(): ActorState {
  return probeActor
}

const probeAction: ActorActionDefinition<{ kind: 'area'; id: string }> = {
  id: 'probe_tidy',
  readable: 'Tidies the main room',
  cost: 2,
  cooldownDays: 2,
  commitmentDays: 1,
  servesGoals: ['tidy'],
  eligibleTargets: () => [{ kind: 'area' as const, id: 'main_room' }],
  score: ({ state }) =>
    (100 - (state.areas['main_room']?.cleanliness ?? 100)) / 100,
  perform: (ctx) => {
    const main = ctx.state.areas['main_room']
    if (!main) {
      return { result: 'failed', readable: 'No main room to tidy.' }
    }
    ctx.modifyArea(
      'main_room',
      { mess: Math.max(0, main.mess - 2) },
      { source: `${OBLIGATION_PROBE_MODULE_ID}.actor`, reason: 'probe_tidy' },
    )
    return {
      result: 'succeeded',
      readable: 'Someone quietly tidied the main room.',
      learned: { last_tidy: 'worked' },
    }
  },
}

const primitivesHook: SimulationHook = (ctx: SimContext): void => {
  if (!config.exercisePrimitives) return

  // Hysteresis: a categorical reading of a wobbling number. The band must
  // not flip the moment cleanliness crosses 50.
  const cleanliness = ctx.state.areas['main_room']?.cleanliness ?? 0
  evaluateHysteresis(
    ctx,
    PROBE_LATCH_KEY,
    cleanliness >= 50 ? 'presentable' : 'grim',
    3,
  )

  // Actor: decide, announce, and (once announced) act.
  const decision = decideActorAction({
    actor: probeActor,
    perception: { readings: { cleanliness }, beliefs: {}, visibleTargets: [] },
    actions: [probeAction],
    state: ctx.state,
    today: ctx.state.calendar.totalDaysElapsed,
  })
  if (decision.decision.status !== 'decided') return

  if (!probeActor.intent) {
    // Visible intent first: the player gets a turn to react before it acts.
    probeActor = declareActorIntent(
      probeActor,
      decision.decision,
      'Someone is thinking about tidying up.',
      ctx.state.calendar.totalDaysElapsed,
    )
    return
  }

  probeActor = performActorAction(ctx, {
    actor: probeActor,
    action: probeAction,
    target: decision.decision.target,
    goalId: decision.decision.goalId,
  }).actor
}

const openHook: SimulationHook = (ctx: SimContext): void => {
  const today = ctx.state.calendar.totalDaysElapsed
  if (today !== config.openOnDay) return

  const id = nextObligationId(ctx.state, OBLIGATION_PROBE_MODULE_ID)
  const record = openObligation({
    id,
    ownerModuleId: OBLIGATION_PROBE_MODULE_ID,
    counterparty: { kind: 'system', id: config.counterpartyId },
    direction: 'payable',
    principal: config.principal,
    openedOnDay: today,
    dueOnDay: today + config.dueInDays,
    // Read from the ruleset, exactly as a real domain must — which is also
    // what makes the obligation half of difficulty divergence testable.
    graceDays: getRule(ctx.state, 'obligationGraceDays'),
    lateChargeRate: getRule(ctx.state, 'obligationLateChargeRate'),
    readable: `${config.principal} coin owed to the landlord`,
    tags: ['probe', 'rent'],
  })
  upsertObligation(ctx, record, 'probe_open')
  scheduleObligationDueDate(ctx, record)
  opened.push(id)

  // And one event this expansion owns itself, so the registry's ownership
  // and warning-window behaviour are exercised by a second, unrelated type.
  scheduleEvent(ctx, {
    type: PROBE_EVENT_TYPE,
    target: { kind: 'system', id: config.counterpartyId },
    scheduledForDay: today + config.dueInDays,
    payload: { note: 'quarterly look round' },
    origin: {
      source: `${OBLIGATION_PROBE_MODULE_ID}.schedule`,
      readable: 'The landlord said they would drop by.',
    },
  })
}

export const obligationProbeModule: SimulationModule = {
  id: OBLIGATION_PROBE_MODULE_ID,
  version: '0.1.0',
  dependsOn: [OBLIGATIONS_MODULE_ID],
  hooks: {
    // `applyOwnerActions` is where a player-driven domain would open an
    // obligation, so the probe opens its one there too.
    applyOwnerActions: [openHook],
    // `applyResponses` is where the real responses module dispatches a
    // profile, so the future-hook probe runs in the same phase.
    applyResponses: [futureHookHook],
    // `afterOwnerActions` is where an autonomous actor would move: after the
    // player has had their say, before service resolves.
    afterOwnerActions: [primitivesHook],
  },
}

let installed = false

export function installObligationProbeExpansion(): void {
  if (installed) return
  registerScheduledEvent(probeEventDefinition)
  registerScheduledEvent(hookEventDefinition)
  installed = true
}

export function uninstallObligationProbeExpansion(): void {
  if (!installed) return
  unregisterScheduledEvent(PROBE_EVENT_TYPE)
  unregisterScheduledEvent(PROBE_HOOK_EVENT_TYPE)
  installed = false
  resetObligationProbe()
}

export function isObligationProbeInstalled(): boolean {
  return installed
}
