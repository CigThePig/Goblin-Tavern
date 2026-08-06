import { z } from 'zod'

import type { SimContext } from '../../core/context'
import type { EntityRef } from '../../state/TavernState'
import { registerScheduledEvent } from '../../contracts/scheduledEvents/registry'
import {
  getLiveScheduledEvents,
  scheduleEvent,
  type ScheduledEventDefinition,
  type ScheduledEventResolution,
} from '../../contracts/scheduledEvents/index'
import {
  ensureRequiredFactionsRegistered,
  factionRegistry,
} from '../../content/factions/factionRegistry'

import {
  FACTIONS_MODULE_ID,
  bumpFactionTotal,
  getFactionModuleState,
  writeFactionSlice,
} from './factionState'
import { noteStanding, worstGrievance } from './standing'
import { openStance } from './stances'
import type { FactionDemand, FactionFavour } from './types'

// Expansion Phase 8 §8.1 + Phase 1 §1.1 — five hook families stop being
// promises and start being faction moves.
//
// WHAT WAS BROKEN. Five `HOOK-*` rows in the implementation ledger belong
// to the faction layer, and all five were the same failure (`OBL-02`):
// a response profile told the player, in so many words, that a faction
// would bear a grudge / seek revenge / find out it had been played, or
// that a customer group might boycott, or that the shrine would want its
// favour back. The responses module drained the hook on its scheduled day
// and wrote a zero-weight cause, because no domain owned the string.
//
// This phase can keep those promises, because the factions module finally
// owns the records they are about: a grievance ledger, a bounded action
// set, and stances that other domains read. So the retaliation event does
// not invent a consequence — it hands the decision back to the faction and
// lets it choose the hostile move its goals and its memory actually
// support. Refusing the Miners' Union is answered by the Miners' Union,
// not by a number.
//
// The player is never ambushed by one of these: the faction's move is
// announced as intent before it lands (see `factionActors.ts`), the
// retaliation itself carries a warning window, and `appeal_to_faction` is
// on the board throughout.

export const FACTION_DEMAND_DEADLINE_EVENT = 'faction_demand_deadline'
export const FACTION_FAVOUR_DUE_EVENT = 'faction_favour_due'
export const FACTION_RETALIATION_EVENT = 'faction_retaliation'

const DemandPayloadSchema = z.object({ demandId: z.string(), factionId: z.string() })
const FavourPayloadSchema = z.object({ favourId: z.string(), factionId: z.string() })
const RetaliationPayloadSchema = z.object({
  factionId: z.string(),
  provocation: z.enum(['grudge', 'revenge', 'deception_exposed', 'boycott_threat']),
})

function noOp(reason: string, readable: string): ScheduledEventResolution {
  return { status: 'no_op', reason, readable }
}

function factionRef(factionId: string): EntityRef {
  return { kind: 'faction', id: factionId }
}

// ---------------------------------------------------------------------------
// faction_demand_deadline — an ask with an answer date
// ---------------------------------------------------------------------------

function closeDemand(
  ctx: SimContext,
  demandId: string,
  status: FactionDemand['status'],
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeFactionSlice(
    ctx,
    (current) => {
      const demand = current.demands[demandId]
      if (!demand) return current
      return {
        ...current,
        demands: {
          ...current.demands,
          [demandId]: { ...demand, status, closedOnDay: today },
        },
      }
    },
    `demand_${status}`,
  )
}

const demandDeadlineEvent: ScheduledEventDefinition = {
  type: FACTION_DEMAND_DEADLINE_EVENT,
  kind: 'mechanical',
  ownerModuleId: FACTIONS_MODULE_ID,
  label: 'A faction is waiting on an answer',
  payloadSchema: DemandPayloadSchema,
  // Wrap-up, so an answer given during today's owner actions counts.
  beat: 'wrap_up',
  defaultOffsetDays: 4,
  warningWindowDays: 3,
  expiryDays: 4,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = DemandPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.demandId : 'unknown'}`
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = DemandPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a faction demand', record.origin.readable)
    }
    const demand = getFactionModuleState(ctx.state).demands[parsed.data.demandId]
    const faction = ctx.state.world.factions[parsed.data.factionId]
    if (!demand || !faction) {
      return noOp('the demand is no longer on the books', record.origin.readable)
    }
    if (demand.status !== 'open') {
      // The player already answered it. The grievance or the favour was
      // recorded when they did, so there is nothing left to do here — and
      // saying so is the difference between an explained no-op and the
      // drained-without-firing bug this arc exists to stop.
      return noOp(
        `${faction.label}'s request was already ${demand.status}`,
        record.origin.readable,
      )
    }

    // Unanswered. That is its own answer, and the faction takes it as one.
    closeDemand(ctx, demand.id, 'lapsed')
    bumpFactionTotal(ctx, 'demandsLapsed')
    noteStanding(ctx, {
      factionId: faction.id,
      id: `demand_ignored_${demand.id}`,
      kind: 'grievance',
      weight: demand.kind === 'coin_contribution' ? 18 : 14,
      readable: `${faction.label} were left waiting on ${demand.readable}`,
      tags: ['demand', 'ignored'],
    })

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'faction',
          targetId: faction.id,
          field: 'standing',
          readable: `${faction.label} hold it against the house that nobody answered.`,
        },
      ],
      readable: `${faction.label} got no answer about ${demand.readable}`,
      memory: {
        id: `faction_demand_ignored_${faction.id}`,
        source: 'factions.demand_deadline',
        actors: [factionRef(faction.id)],
        tags: ['faction', 'demand', 'ignored', faction.id],
        durationDays: 21,
        metadata: { factionId: faction.id, demandId: demand.id },
      },
      history: {
        category: 'state_change',
        summary: `${faction.label}'s request went unanswered.`,
        tags: ['faction', 'demand', 'ignored', faction.id],
        relatedActors: [factionRef(faction.id)],
        relatedSystems: ['factions'],
        mechanicalRefs: [faction.id, FACTION_DEMAND_DEADLINE_EVENT],
      },
    }
  },
}

export function scheduleDemandDeadline(
  ctx: SimContext,
  demand: FactionDemand,
): boolean {
  const faction = ctx.state.world.factions[demand.factionId]
  if (!faction) return false
  const result = scheduleEvent(ctx, {
    type: FACTION_DEMAND_DEADLINE_EVENT,
    target: factionRef(demand.factionId),
    scheduledForDay: demand.dueOnDay,
    payload: { demandId: demand.id, factionId: demand.factionId },
    origin: {
      source: 'factions.actors.make_demand',
      readable: `${faction.label} have asked for ${demand.readable}`,
    },
  })
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// faction_favour_due — a sponsorship comes back around
// ---------------------------------------------------------------------------

const favourDueEvent: ScheduledEventDefinition = {
  type: FACTION_FAVOUR_DUE_EVENT,
  kind: 'mechanical',
  ownerModuleId: FACTIONS_MODULE_ID,
  label: 'A faction wants its favour back',
  payloadSchema: FavourPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 12,
  warningWindowDays: 4,
  expiryDays: 5,
  missingTarget: 'resolve_anyway',
  exactOnceKey: ({ type, payload }) => {
    const parsed = FavourPayloadSchema.safeParse(payload)
    return `${type}:${parsed.success ? parsed.data.favourId : 'unknown'}`
  },
  // `shrine_favour_owed_*` is the ledger's name for exactly this: the shrine
  // put something in and expects something back. The adapter finds the live
  // favour rather than trusting the hook name, and declines when the tavern
  // owes nobody — a promise whose subject cannot be verified is the promise
  // this arc exists to stop making.
  futureHookPrefixes: ['shrine_favour_owed_'],
  fromFutureHook: ({ hookName, state }) => {
    if (!hookName.startsWith('shrine_favour_owed_')) return undefined
    if (!state) return undefined
    const slice = getFactionModuleState(state)
    const owed = Object.values(slice.favours)
      .filter((favour) => favour.status === 'owed')
      .sort((a, b) => a.dueOnDay - b.dueOnDay || a.id.localeCompare(b.id))
    const favour =
      owed.find((entry) => entry.factionId === 'local_shrine') ?? owed[0]
    if (!favour) return undefined
    return {
      payload: { favourId: favour.id, factionId: favour.factionId },
      target: factionRef(favour.factionId),
    }
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = FavourPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a faction favour', record.origin.readable)
    }
    const favour = getFactionModuleState(ctx.state).favours[parsed.data.favourId]
    const faction = ctx.state.world.factions[parsed.data.factionId]
    if (!favour || !faction) {
      return noOp('nobody is owed anything', record.origin.readable)
    }
    if (favour.status !== 'owed') {
      return noOp(
        `${faction.label}'s favour was already ${favour.status}`,
        record.origin.readable,
      )
    }

    const today = ctx.state.calendar.totalDaysElapsed
    writeFactionSlice(
      ctx,
      (current) => {
        const live = current.favours[favour.id]
        if (!live) return current
        return {
          ...current,
          favours: {
            ...current.favours,
            [favour.id]: { ...live, status: 'called_in', closedOnDay: today },
          },
        }
      },
      'favour_called_in',
    )
    bumpFactionTotal(ctx, 'favoursCalledIn')

    // Calling a favour in is not a punishment: it is the faction asking for
    // what it paid for. So the outcome is a DEMAND with its own deadline,
    // not a fine. Refusing it is a separate, later, visible choice.
    const demand = openDemandRecord(ctx, {
      factionId: faction.id,
      kind: 'public_backing',
      askCoin: 0,
      goalId: 'faction_favour',
      readable: `the favour they are owed for ${favour.readable}`,
      dueInDays: 4,
    })
    noteStanding(ctx, {
      factionId: faction.id,
      id: `favour_called_${favour.id}`,
      kind: 'grievance',
      weight: 6,
      readable: `${faction.label} had to ask for the favour back.`,
      tags: ['favour', 'called_in'],
    })

    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'faction',
          targetId: faction.id,
          field: 'favours',
          readable: `${faction.label} called in the favour they were owed.`,
        },
      ],
      readable: demand
        ? `${faction.label} want ${demand.readable}`
        : `${faction.label} called in their favour.`,
      history: {
        category: 'state_change',
        summary: `${faction.label} called in a favour.`,
        tags: ['faction', 'favour', faction.id],
        relatedActors: [factionRef(faction.id)],
        relatedSystems: ['factions'],
        mechanicalRefs: [faction.id, FACTION_FAVOUR_DUE_EVENT],
      },
    }
  },
}

export function scheduleFavourDue(ctx: SimContext, favour: FactionFavour): boolean {
  const faction = ctx.state.world.factions[favour.factionId]
  if (!faction) return false
  const result = scheduleEvent(ctx, {
    type: FACTION_FAVOUR_DUE_EVENT,
    target: factionRef(favour.factionId),
    scheduledForDay: favour.dueOnDay,
    payload: { favourId: favour.id, factionId: favour.factionId },
    origin: {
      source: 'factions.actors.sponsor_house',
      readable: `${faction.label} will want something back for ${favour.readable}`,
    },
  })
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// faction_retaliation — the four "they will remember this" families
// ---------------------------------------------------------------------------

/** `${groupId}_boycott` claims, one per group a faction actually speaks for. */
function boycottHookPrefixes(): string[] {
  ensureRequiredFactionsRegistered()
  const prefixes = new Set<string>()
  for (const def of factionRegistry.all()) {
    for (const groupId of def.representedGroupIds) {
      prefixes.add(`${groupId}_boycott`)
    }
  }
  return [...prefixes].sort()
}

/** The faction that speaks for a group, when one does. */
function factionForGroup(groupId: string): string | undefined {
  ensureRequiredFactionsRegistered()
  return [...factionRegistry.all()]
    .filter((def) => def.representedGroupIds.includes(groupId))
    .sort((a, b) => a.id.localeCompare(b.id))[0]?.id
}

const retaliationEvent: ScheduledEventDefinition = {
  type: FACTION_RETALIATION_EVENT,
  kind: 'mechanical',
  ownerModuleId: FACTIONS_MODULE_ID,
  label: 'A faction is deciding what to do about it',
  payloadSchema: RetaliationPayloadSchema,
  beat: 'wrap_up',
  defaultOffsetDays: 5,
  warningWindowDays: 3,
  expiryDays: 5,
  missingTarget: 'cancel',
  exactOnceKey: ({ type, payload, scheduledForDay }) => {
    const parsed = RetaliationPayloadSchema.safeParse(payload)
    const factionId = parsed.success ? parsed.data.factionId : 'unknown'
    const provocation = parsed.success ? parsed.data.provocation : 'grudge'
    return `${type}:${factionId}:${provocation}:${scheduledForDay}`
  },
  futureHookPrefixes: [
    'faction_grudge_',
    'faction_revenge_',
    'faction_deception_exposed_',
    ...boycottHookPrefixes(),
  ],
  fromFutureHook: ({ hookName, state }) => {
    if (!state) return undefined
    const named: Array<[string, 'grudge' | 'revenge' | 'deception_exposed']> = [
      ['faction_grudge_', 'grudge'],
      ['faction_revenge_', 'revenge'],
      ['faction_deception_exposed_', 'deception_exposed'],
    ]
    for (const [prefix, provocation] of named) {
      if (!hookName.startsWith(prefix)) continue
      const factionId = hookName.slice(prefix.length)
      if (!factionId || !state.world.factions[factionId]) return undefined
      return {
        payload: { factionId, provocation },
        target: factionRef(factionId),
      }
    }
    // `<groupId>_boycott_possible`. A boycott is a faction move, so it needs
    // a faction that actually speaks for the group. When none does, decline
    // and let the hook stay the narrative expectation it always was rather
    // than inventing an organiser nobody has met.
    const boycott = hookName.match(/^(.*)_boycott(_possible)?$/)
    if (boycott) {
      const groupId = boycott[1]!
      if (!state.customerGroups[groupId]) return undefined
      const factionId = factionForGroup(groupId)
      if (!factionId || !state.world.factions[factionId]) return undefined
      return {
        payload: { factionId, provocation: 'boycott_threat' },
        target: factionRef(factionId),
      }
    }
    return undefined
  },
  resolve: (ctx, record): ScheduledEventResolution => {
    const parsed = RetaliationPayloadSchema.safeParse(record.payload)
    if (!parsed.success) {
      return noOp('event payload was not a faction provocation', record.origin.readable)
    }
    const faction = ctx.state.world.factions[parsed.data.factionId]
    if (!faction) {
      return noOp('that faction is no longer in the world', record.origin.readable)
    }
    const def = factionRegistry.get(faction.id)
    const grievance = worstGrievance(ctx.state, faction.id)

    // The player may have MENDED it in the days since. That is the whole
    // point of the warning window, so a faction whose books are square by
    // the time this fires does nothing and says why.
    const net = getFactionModuleState(ctx.state).standing[faction.id]?.net ?? 0
    if (net >= -10 && faction.relationship >= 45) {
      return noOp(
        `${faction.label} were talked round before it came to anything`,
        record.origin.readable,
      )
    }

    const severity = Math.min(
      90,
      35 + Math.abs(Math.min(0, net)) / 2 + (parsed.data.provocation === 'revenge' ? 15 : 0),
    )
    const reason =
      grievance?.readable ?? record.origin.readable ?? `${faction.label} have had enough.`

    // WHICH move is not fixed by the hook name — it comes from what this
    // faction is capable of and what it has to work with, in a declared
    // order. A boycott threat becomes a boycott if they have people to keep
    // away; the watch, who have nobody, put the word in instead.
    const chosen = chooseRetaliation(ctx, faction.id, parsed.data.provocation)
    if (!chosen) {
      return noOp(
        `${faction.label} have no way to make anything of it`,
        record.origin.readable,
      )
    }

    const stance = openStance(ctx, {
      factionId: faction.id,
      kind: chosen,
      strength: severity,
      reason,
      goalId: 'settle_the_score',
    })
    if (!stance) {
      return noOp(`${faction.label} thought better of it`, record.origin.readable)
    }
    if (chosen === 'boycott') bumpFactionTotal(ctx, 'boycottsCalled')

    const readable = describeStance(faction.label, chosen, def?.representedGroupIds ?? [])
    return {
      status: 'resolved',
      mutations: [
        {
          targetKind: 'faction',
          targetId: faction.id,
          field: `stance:${chosen}`,
          readable,
        },
      ],
      readable,
      memory: {
        id: `faction_retaliated_${faction.id}`,
        source: 'factions.retaliation',
        actors: [factionRef(faction.id)],
        tags: ['faction', 'grudge', 'retaliation', faction.id],
        durationDays: 21,
        metadata: {
          factionId: faction.id,
          provocation: parsed.data.provocation,
          stance: chosen,
        },
      },
      history: {
        category: 'state_change',
        summary: readable,
        tags: ['faction', 'retaliation', faction.id],
        relatedActors: [factionRef(faction.id)],
        relatedSystems: ['factions'],
        mechanicalRefs: [faction.id, FACTION_RETALIATION_EVENT],
      },
    }
  },
}

/**
 * The hostile move this faction can actually make, in declared order.
 *
 * Deterministic: no RNG, and the order is fixed, so the same provoked
 * faction in the same world always answers the same way.
 */
function chooseRetaliation(
  ctx: SimContext,
  factionId: string,
  provocation: 'grudge' | 'revenge' | 'deception_exposed' | 'boycott_threat',
): 'boycott' | 'supply_squeeze' | 'rival_backing' | undefined {
  const def = factionRegistry.get(factionId)
  if (!def) return undefined
  const canBoycott =
    def.actions.includes('call_boycott') &&
    def.representedGroupIds.some((groupId) => {
      const group = ctx.state.customerGroups[groupId]
      return group !== undefined && group.patronage > 0
    })
  const canSqueeze =
    def.actions.includes('squeeze_supply') &&
    Object.values(ctx.state.world.suppliers).some(
      (supplier) => supplier.factionId === factionId,
    )
  const canBackRival = def.actions.includes('back_rival')

  if (provocation === 'boycott_threat') {
    return canBoycott ? 'boycott' : canSqueeze ? 'supply_squeeze' : undefined
  }
  if (canBoycott) return 'boycott'
  if (canSqueeze) return 'supply_squeeze'
  if (canBackRival) return 'rival_backing'
  return undefined
}

function describeStance(
  label: string,
  kind: 'boycott' | 'supply_squeeze' | 'rival_backing',
  groupIds: ReadonlyArray<string>,
): string {
  switch (kind) {
    case 'boycott':
      return groupIds.length > 0
        ? `${label} called a boycott and told the ${groupIds.join(' and ')} to drink elsewhere.`
        : `${label} called a boycott.`
    case 'supply_squeeze':
      return `${label} leaned on their suppliers: worse terms, and less credit.`
    case 'rival_backing':
      return `${label} threw their weight behind the competition.`
  }
}

/**
 * Schedule a faction's answer to a provocation.
 *
 * Used by the retaliation hook bridge and by the demand resolver when a
 * refusal is bad enough to be worth answering. Guarded against stacking so
 * a faction that is already deciding does not decide twice.
 */
export function scheduleRetaliation(
  ctx: SimContext,
  factionId: string,
  input: {
    provocation: 'grudge' | 'revenge' | 'deception_exposed' | 'boycott_threat'
    source: string
    readable: string
    offsetDays?: number
  },
): boolean {
  const faction = ctx.state.world.factions[factionId]
  if (!faction) return false
  const alreadyLive = getLiveScheduledEvents(ctx.state).some(
    (event) =>
      event.type === FACTION_RETALIATION_EVENT &&
      event.target?.kind === 'faction' &&
      event.target.id === factionId,
  )
  if (alreadyLive) return false
  const today = ctx.state.calendar.totalDaysElapsed
  const result = scheduleEvent(ctx, {
    type: FACTION_RETALIATION_EVENT,
    target: factionRef(factionId),
    scheduledForDay: today + (input.offsetDays ?? 5),
    payload: { factionId, provocation: input.provocation },
    origin: { source: input.source, readable: input.readable },
  })
  return result.status === 'scheduled'
}

// ---------------------------------------------------------------------------
// Demand records (shared by the actor pass and the favour resolver)
// ---------------------------------------------------------------------------

export function openDemandRecord(
  ctx: SimContext,
  input: {
    factionId: string
    kind: FactionDemand['kind']
    askCoin: number
    goalId: string
    readable: string
    dueInDays: number
  },
): FactionDemand | undefined {
  const faction = ctx.state.world.factions[input.factionId]
  if (!faction) return undefined
  const today = ctx.state.calendar.totalDaysElapsed
  const demand: FactionDemand = {
    id: `demand_${input.factionId}_${today}`,
    factionId: input.factionId,
    kind: input.kind,
    askCoin: Math.max(0, Math.round(input.askCoin)),
    openedOnDay: today,
    dueOnDay: today + input.dueInDays,
    status: 'open',
    readable: input.readable,
    goalId: input.goalId,
  }
  writeFactionSlice(
    ctx,
    (current) =>
      current.demands[demand.id]
        ? current
        : { ...current, demands: { ...current.demands, [demand.id]: demand } },
    'demand_opened',
  )
  bumpFactionTotal(ctx, 'demandsMade')
  scheduleDemandDeadline(ctx, demand)
  return demand
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const FACTION_SCHEDULED_EVENTS: ReadonlyArray<ScheduledEventDefinition> = [
  demandDeadlineEvent,
  favourDueEvent,
  retaliationEvent,
]

let registered = false

/**
 * Register the factions module's mechanical event types.
 *
 * Idempotent and called at import, like every other `ensureRequired*`
 * bootstrap, because the response bridge has to find these types the first
 * time a hook is routed — which can happen before any faction code runs.
 */
export function ensureFactionScheduledEventsRegistered(): void {
  if (registered) return
  for (const definition of FACTION_SCHEDULED_EVENTS) {
    registerScheduledEvent(definition)
  }
  registered = true
}

ensureFactionScheduledEventsRegistered()

export const FACTION_SCHEDULED_EVENT_TYPES = FACTION_SCHEDULED_EVENTS.map(
  (definition) => definition.type,
)
