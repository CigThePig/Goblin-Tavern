import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef, SocialRumourState, TavernState } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import type {
  ScheduledEventDefinition,
  ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import { performActorAction } from '../../contracts/actors/index'
import {
  buildPerception as buildFactionPerception,
  deriveGoals as deriveFactionGoals,
  ensureActor as ensureFactionActor,
  FACTION_ACTOR_ACTION_LIST,
} from '../factions/factionActors'
import { openDemandRecord } from '../factions/factionEvents'
import {
  activeStance,
  getFactionModuleState,
  openDemandFor,
} from '../factions/factionState'
import { getSupplierAccount, writeSupplierAccount } from '../suppliers/state'

import {
  arcFromHookName,
  arcRef,
  pickCreditorFaction,
  pickCreditorSupplier,
} from './arcEvents'
import { getArcRun } from './arcRuns'
import { LOCAL_ARCS_MODULE_ID } from './types'

// Expansion Phase 9 — the last four hook families, all of them `arcKey`-shaped
// promises made by the seasonal-arc seed generator.
//
// WHAT WAS BROKEN, one more time. Four response profiles told the player
// something specific about what came next. Prep the cellars for payday and
// "the supplier expects standing demand". Gouge the miners on payday night
// and "next payday may boycott". Let the room brawl and "the legend of the
// night may grow". Host the quarter's festival and it "sets a yearly
// expectation". On the promised day the responses module drained the hook
// and wrote a zero-weight cause, because no domain owned the string. That is
// `OBL-02`, four times.
//
// WHY THESE FOUR LIVE TOGETHER, AND HERE. All four are keyed by `arcKey` —
// they are promises made ABOUT a local arc, and resolving one starts by
// asking which arc it was and who was standing in it. That question is this
// module's, and the answer is already here in `arcFromHookName`. What each
// one then does belongs to somebody else: a supplier's account, a faction's
// own boycott move, the rumour layer's propagation, a faction's demand book.
// So none of these resolvers decides what those domains conclude — each one
// hands the decision over and reports what came back, or says plainly why
// nothing happened. That is the same division `arc_debt_called_in` already
// draws, and it is why the local-arcs contract already declares writes into
// factions, suppliers and `world.socialRumours`.

export const PAYDAY_SUPPLIER_STANDING_EVENT = 'payday_supplier_standing'
export const PAYDAY_BOYCOTT_REVIEW_EVENT = 'payday_boycott_review'
export const PAYDAY_BRAWL_LEGEND_EVENT = 'payday_brawl_legend'
export const FESTIVAL_OBLIGATION_EVENT = 'festival_obligation_review'

const ArcPayloadSchema = z.object({ arcId: z.string() })

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function arcOf(state: TavernState, payload: unknown) {
  const parsed = ArcPayloadSchema.safeParse(payload)
  if (!parsed.success) return undefined
  return getArcRun(state, parsed.data.arcId)
}

/**
 * Turn `<prefix><arcKey>` into a payload naming the arc it was promised about.
 *
 * Declining when the arc cannot be found is not a failure: the bridge keeps
 * the hook as a narrative expectation rather than collecting a promise about
 * a payday against whatever arc happens to be running.
 */
function arcHookAdapter(prefix: string) {
  return ({
    hookName,
    state,
  }: {
    hookName: string
    state?: TavernState | undefined
  }) => {
    if (!state || !hookName.startsWith(prefix)) return undefined
    const run = arcFromHookName(hookName, prefix, state)
    if (!run) return undefined
    return { payload: { arcId: run.arcId }, target: arcRef(run.arcId) }
  }
}

function arcExactOnceKey({
  type,
  payload,
  scheduledForDay,
}: {
  type: string
  payload: unknown
  scheduledForDay: number
}): string {
  const parsed = ArcPayloadSchema.safeParse(payload)
  return `${type}:${parsed.success ? parsed.data.arcId : 'unknown'}:${scheduledForDay}`
}

// ---------------------------------------------------------------------------
// payday_supplier_return_* — the brewer expected this to keep up
// ---------------------------------------------------------------------------

/** Days of quiet after which a supplier stops expecting the standing order. */
const STANDING_DEMAND_WINDOW_DAYS = 14
/** How long the concession or the hardening lasts. */
const STANDING_TERM_DAYS = 21

const supplierStandingEvent: ScheduledEventDefinition = {
  type: PAYDAY_SUPPLIER_STANDING_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'The supplier expected the big orders to keep coming',
  payloadSchema: ArcPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 10,
  warningWindowDays: 3,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: arcExactOnceKey,
  futureHookPrefixes: ['payday_supplier_return_'],
  fromFutureHook: arcHookAdapter('payday_supplier_return_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const run = arcOf(ctx.state, record.payload)
    const supplierId =
      run?.ownerRef?.kind === 'supplier'
        ? run.ownerRef.id
        : pickCreditorSupplier(ctx.state)
    if (!supplierId || !ctx.state.world.suppliers[supplierId]) {
      return noOp('nobody was left expecting anything', record.origin.readable)
    }
    const supplier = ctx.state.world.suppliers[supplierId]!
    const today = ctx.state.calendar.totalDaysElapsed
    const account = getSupplierAccount(ctx.state, supplierId)

    // THE WHOLE QUESTION: did the house actually keep buying? The promise
    // was standing DEMAND, so it is answered by the order book rather than
    // by goodwill — a house that paid its bills and then stopped ordering
    // has still let the expectation down.
    const lastOrder = account.lastOrderDay
    const keptUp =
      lastOrder !== undefined && today - lastOrder <= STANDING_DEMAND_WINDOW_DAYS

    if (keptUp) {
      writeSupplierAccount(
        ctx,
        supplierId,
        (current) => ({
          ...current,
          termsAdjustment: Math.min(current.termsAdjustment, 0.9),
          termsAdjustmentUntilDay: Math.max(
            current.termsAdjustmentUntilDay ?? 0,
            today + STANDING_TERM_DAYS,
          ),
          lastDecisionDay: today,
          lastDecisionReason: 'standing demand since the payday run',
        }),
        'payday_standing_kept',
      )
      ctx.modifySupplier(
        supplierId,
        { relationship: Math.min(100, supplier.relationship + 4) },
        { source: LOCAL_ARCS_MODULE_ID, reason: 'payday_standing_kept' },
      )
      const readable = `${supplier.label} cut their unit price — the house has been buying like it meant it.`
      return {
        status: 'resolved',
        mutations: [
          {
            targetKind: 'supplier_account',
            targetId: supplierId,
            field: 'termsAdjustment',
            readable: `Unit prices ×0.90 until day ${today + STANDING_TERM_DAYS}.`,
          },
        ],
        readable,
        cause: {
          source: `${LOCAL_ARCS_MODULE_ID}.payday_standing`,
          sourceType: 'local_event',
          target: supplierId,
          targetType: 'supplier',
          amount: 0,
          readable,
          tags: ['local_arc', 'payday', 'supplier', 'standing_demand'],
          relatedActors: [{ kind: 'supplier', id: supplierId }],
          relatedSystems: ['local_arcs', 'suppliers'],
        },
      }
    }

    // The other side of the same promise. A supplier who geared up for a
    // standing order and got one big night prices the disappointment in.
    writeSupplierAccount(
      ctx,
      supplierId,
      (current) => ({
        ...current,
        termsAdjustment: Math.min(1.5, Math.round(current.termsAdjustment * 108) / 100),
        termsAdjustmentUntilDay: today + STANDING_TERM_DAYS,
        lastDecisionDay: today,
        lastDecisionReason: 'the standing demand never came',
      }),
      'payday_standing_lapsed',
    )
    ctx.modifySupplier(
      supplierId,
      { relationship: Math.max(0, supplier.relationship - 4) },
      { source: LOCAL_ARCS_MODULE_ID, reason: 'payday_standing_lapsed' },
    )
    const readable = `${supplier.label} geared up for standing orders that never came, and the price says so.`
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'supplier_account',
          targetId: supplierId,
          field: 'termsAdjustment',
          readable: `Unit prices ×1.08 until day ${today + STANDING_TERM_DAYS}.`,
        },
      ],
      readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.payday_standing`,
        sourceType: 'local_event',
        target: supplierId,
        targetType: 'supplier',
        amount: 0,
        readable,
        tags: ['local_arc', 'payday', 'supplier', 'standing_demand'],
        relatedActors: [{ kind: 'supplier', id: supplierId }],
        relatedSystems: ['local_arcs', 'suppliers'],
      },
    }
  },
}

// ---------------------------------------------------------------------------
// payday_gouging_remembered_* — they said next payday might boycott
// ---------------------------------------------------------------------------

const boycottReviewEvent: ScheduledEventDefinition = {
  type: PAYDAY_BOYCOTT_REVIEW_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'They remember what the house charged them',
  payloadSchema: ArcPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 5,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: arcExactOnceKey,
  futureHookPrefixes: ['payday_gouging_remembered_'],
  fromFutureHook: arcHookAdapter('payday_gouging_remembered_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const run = arcOf(ctx.state, record.payload)
    const factionId =
      run?.ownerRef?.kind === 'faction' ? run.ownerRef.id : pickAggrievedFaction(ctx.state)
    if (!factionId || !ctx.state.world.factions[factionId]) {
      return noOp('nobody was left to remember it', record.origin.readable)
    }
    const faction = ctx.state.world.factions[factionId]!

    // THE COUNTERPLAY, and it is the one the seed's own effect points at:
    // gouging cost the faction standing, so a house that has since made it
    // back up with them is not boycotted. This is the whole reason the
    // grievance layer and `address_grievance` exist.
    if (faction.relationship >= 45) {
      return noOp(
        `${faction.label} let it go — the house has been square with them since`,
        record.origin.readable,
      )
    }
    if (activeStance(ctx.state, factionId, 'boycott')) {
      return noOp(
        `${faction.label} are already keeping their people away`,
        record.origin.readable,
      )
    }

    // Hand the decision to the faction. It calls a boycott through its OWN
    // move, scored against what it actually perceives — so a faction with a
    // grievance but nobody to withdraw complains rather than acts, and the
    // no-op says which.
    const action = FACTION_ACTOR_ACTION_LIST.find((entry) => entry.id === 'call_boycott')
    if (!action) return noOp('they have no such move', record.origin.readable)
    const perception = buildFactionPerception(ctx.state, faction)
    const goals = deriveFactionGoals(ctx.state, faction)
    const actor = ensureFactionActor(
      getFactionModuleState(ctx.state),
      ctx.state,
      faction,
    )
    const goal =
      goals.find((entry) => action.servesGoals.includes(entry.id)) ?? goals[0]
    if (!goal) return noOp(`${faction.label} want nothing badly enough`, record.origin.readable)
    const targets = action.eligibleTargets(perception, ctx.state)
    const target = targets[0]
    if (!target) {
      return noOp(
        `${faction.label} have nobody to keep away from the door`,
        record.origin.readable,
      )
    }
    const performed = performActorAction(ctx, {
      actor: { ...actor, goals },
      action,
      target,
      goalId: goal.id,
    })
    if (performed.outcome.result !== 'succeeded') {
      return noOp(performed.outcome.readable, record.origin.readable)
    }
    const readable = `${faction.label} called the boycott they warned about after the payday prices.`
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'faction',
          targetId: factionId,
          field: 'stances',
          readable: performed.outcome.readable,
        },
      ],
      readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.payday_boycott`,
        sourceType: 'local_event',
        target: factionId,
        targetType: 'faction',
        amount: 0,
        readable,
        tags: ['local_arc', 'payday', 'faction', 'boycott'],
        relatedActors: [{ kind: 'faction', id: factionId }],
        relatedSystems: ['local_arcs', 'factions'],
      },
    }
  },
}

/**
 * Which faction remembers being gouged.
 *
 * Worst standing FIRST, but only among factions that could actually do
 * something about it. An earlier draft picked purely on standing and kept
 * landing on the Town Watch — who have the grievance and nobody to withdraw,
 * so the promise no-opped with "nobody to keep away from the door" almost
 * every time. That is a true sentence about the wrong faction: the people
 * who were charged too much on payday night are the ones with a crowd to
 * keep home, and they are who the card was talking about.
 */
function pickAggrievedFaction(state: TavernState): string | undefined {
  const action = FACTION_ACTOR_ACTION_LIST.find((entry) => entry.id === 'call_boycott')
  const candidates = Object.values(state.world.factions).sort(
    (a, b) => a.relationship - b.relationship || a.id.localeCompare(b.id),
  )
  if (action) {
    const canAct = candidates.find(
      (faction) =>
        action.eligibleTargets(buildFactionPerception(state, faction), state).length > 0,
    )
    if (canAct) return canAct.id
  }
  return candidates[0]?.id
}

// ---------------------------------------------------------------------------
// payday_brawl_legend_* — the legend of the night may grow
// ---------------------------------------------------------------------------

const brawlLegendEvent: ScheduledEventDefinition = {
  type: PAYDAY_BRAWL_LEGEND_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'The story of that night is still going round',
  payloadSchema: ArcPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 10,
  warningWindowDays: 4,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: arcExactOnceKey,
  futureHookPrefixes: ['payday_brawl_legend_'],
  fromFutureHook: arcHookAdapter('payday_brawl_legend_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = ArcPayloadSchema.safeParse(record.payload)
    const arcId = parsed.success ? parsed.data.arcId : 'the_payday'
    const today = ctx.state.calendar.totalDaysElapsed

    // THE COUNTERPLAY. A legend needs a house people still think of that
    // way. If the room has been quiet since — the house is no longer read
    // as dangerous — there is no story left to grow, and that is a recorded
    // reason rather than a punishment for a reputation already repaired.
    if (ctx.state.reputation.dangerous < 40) {
      return noOp(
        'the night stopped being worth telling — the room has been quiet since',
        record.origin.readable,
      )
    }

    const rumourId = `brawl_legend_${arcId}`
    if (ctx.state.world.socialRumours[rumourId]) {
      return noOp('the story is already going round', record.origin.readable)
    }

    // The legend becomes a RUMOUR rather than a reputation nudge, which is
    // the point: §8.4 owns whether a story spreads, who hears it, whether
    // they believe it and what it does to them. A direct `reputation.dangerous
    // += 6` here would be exactly the "only consequence is a meter
    // adjustment" failure §5 names — and it would also make the legend
    // uncontestable, when denying it is a move the player already has.
    const rumour: SocialRumourState = {
      id: rumourId,
      label: 'They still talk about the night the miners took the place apart.',
      strength: Math.min(70, 35 + Math.round(ctx.state.reputation.dangerous / 4)),
      accuracy: 'true',
      firstHeardDay: today,
      lastSpreadDay: today,
      tags: ['brawl', 'legend', 'reputation', 'payday'],
      reach: 'public',
      involvedRefs: [arcRef(arcId)],
    }
    ctx.addSocialRumour(rumour, {
      source: `${LOCAL_ARCS_MODULE_ID}.brawl_legend`,
      sourceType: 'local_event',
      target: rumourId,
      targetType: 'rumour',
      amount: rumour.strength,
      readable: rumour.label,
      tags: ['local_arc', 'payday', 'rumour', 'brawl'],
      relatedActors: [arcRef(arcId)],
      relatedSystems: ['local_arcs', 'rumours'],
    })
    const readable = 'The brawl has become a story people tell about this house.'
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'rumour',
          targetId: rumourId,
          field: 'strength',
          readable: `A public story at strength ${rumour.strength}.`,
        },
      ],
      readable,
    }
  },
}

// ---------------------------------------------------------------------------
// festival_obligations_* — hosting it once sets a yearly expectation
// ---------------------------------------------------------------------------

/** How long the house gets to answer the expectation. */
const FESTIVAL_DEMAND_WINDOW_DAYS = 7

const festivalObligationEvent: ScheduledEventDefinition = {
  type: FESTIVAL_OBLIGATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: LOCAL_ARCS_MODULE_ID,
  label: 'They are expecting the house to host it again',
  payloadSchema: ArcPayloadSchema,
  beat: 'morning',
  defaultOffsetDays: 12,
  warningWindowDays: 5,
  expiryDays: 6,
  missingTarget: 'resolve_anyway',
  exactOnceKey: arcExactOnceKey,
  futureHookPrefixes: ['festival_obligations_'],
  fromFutureHook: arcHookAdapter('festival_obligations_'),
  resolve: (ctx, record): ScheduledEventResolution => {
    const run = arcOf(ctx.state, record.payload)
    const factionId =
      run?.ownerRef?.kind === 'faction' ? run.ownerRef.id : pickCreditorFaction(ctx.state)
    if (!factionId || !ctx.state.world.factions[factionId]) {
      return noOp('nobody is expecting anything of the house', record.origin.readable)
    }
    const faction = ctx.state.world.factions[factionId]!

    // An expectation is only an obligation to people who still deal with the
    // house. A faction that has fallen out with it since is not asking for
    // another festival — it has other business.
    if (faction.relationship < 35) {
      return noOp(
        `${faction.label} are not looking to this house for anything now`,
        record.origin.readable,
      )
    }
    if (openDemandFor(ctx.state, factionId)) {
      return noOp(
        `${faction.label} have an ask outstanding already`,
        record.origin.readable,
      )
    }

    // A `public_backing` demand rather than a coin one, because that is what
    // hosting IS: being seen to take their side inside a window. It goes on
    // the faction's own demand book, so granting it and refusing it are the
    // moves the player already has, and refusing costs standing the way
    // refusing any demand does.
    const demand = openDemandRecord(ctx, {
      factionId,
      kind: 'public_backing',
      askCoin: 0,
      goalId: 'keep_the_festival',
      readable: 'host the festival again, as the house did last time',
      dueInDays: FESTIVAL_DEMAND_WINDOW_DAYS,
    })
    if (!demand) {
      return noOp(`${faction.label} did not put it to the house`, record.origin.readable)
    }
    const readable = `${faction.label} are expecting the house to host the festival again.`
    return {
      status: 'resolved',
      mutations: [
        { targetKind: 'faction', targetId: factionId, field: 'demands', readable },
      ],
      readable,
      cause: {
        source: `${LOCAL_ARCS_MODULE_ID}.festival_obligation`,
        sourceType: 'local_event',
        target: factionId,
        targetType: 'faction',
        amount: 0,
        readable,
        tags: ['local_arc', 'festival', 'faction', 'obligation'],
        relatedActors: [{ kind: 'faction', id: factionId }],
        relatedSystems: ['local_arcs', 'factions'],
      },
    }
  },
}

export const PAYDAY_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  supplierStandingEvent,
  boycottReviewEvent,
  brawlLegendEvent,
  festivalObligationEvent,
]

export const PAYDAY_SCHEDULED_EVENT_TYPES: ReadonlyArray<string> =
  PAYDAY_SCHEDULED_EVENTS.map((definition) => definition.type)

let registered = false

export function ensurePaydayScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of PAYDAY_SCHEDULED_EVENTS) registerScheduledEvent(definition)
  registered = true
}

ensurePaydayScheduledEventsRegistered()

void (null as unknown as EntityRef)
