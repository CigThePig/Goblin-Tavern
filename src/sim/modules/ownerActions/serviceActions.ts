import type { SimContext } from '../../core/context'
import type { RegularWorldState } from '../../state/TavernState'
import { outstandingAmount } from '../../contracts/obligations/index'
import { getServiceModuleState } from '../service/serviceModule'
import {
  collectPatronTab,
  forgivePatronTab,
  forgivePatronTabsForDebtor,
  listPatronTabs,
  type PatronTabIndexEntry,
} from '../service/tabs'
import type { ServiceModuleState } from '../service/types'
import { rememberService } from '../regulars/regularMemory'
import { openRequestFor, resolveRequest } from '../regulars/regularRequests'
import { favouriteAvailability } from '../regulars/visits'

import {
  TIME_COST_QUICK,
  TIME_COST_SHORT,
  TIME_COST_STANDARD,
} from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 4 §"Player-facing work" — the service-floor capabilities.
//
// WHAT THE PLAYER COULD DO BEFORE THIS PHASE, about service: set staff
// priorities, restock, and ban a group. Nothing about the people in the room.
// Tabs were a number that vanished, regulars were a list on a world screen, and
// the only lever on either was indirect.
//
// FOUR ACTIONS, each the counterplay to something the simulation now does on
// its own (§5's "a player cannot discover what action is available and why" is
// a phase-failing condition):
//
//   collect_tab            ← a slate somebody ran up last night
//   forgive_tab            ← the same slate, when the relationship is worth more
//   greet_regular          ← a regular drifting toward not coming back
//   answer_regular_request ← something a named person actually asked you for
//
// NOTHING HERE WRITES SERVICE OR REGULAR STATE DIRECTLY. Every apply asks the
// owning domain to make the transition (§5.4) — `service/tabs.ts` for debt,
// `regulars/regularMemory.ts` and `regulars/regularRequests.ts` for how a named
// person feels about it.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

function readServiceSlice(ctx: SimContext): ServiceModuleState {
  return getServiceModuleState(ctx.state)
}

/** Live tab index entries whose obligation still has something owing. */
export function liveTabEntries(ctx: SimContext): PatronTabIndexEntry[] {
  const open = new Map(
    listPatronTabs(ctx.state).map((record) => [record.id, record]),
  )
  return readServiceSlice(ctx)
    .patronTabs.filter((entry) => {
      const record = open.get(entry.obligationId)
      return record !== undefined && outstandingAmount(record) > 0
    })
    .sort((a, b) =>
      a.openedOnDay === b.openedOnDay
        ? a.obligationId.localeCompare(b.obligationId)
        : a.openedOnDay - b.openedOnDay,
    )
}

function tabTargets(ctx: SimContext): ActionTarget[] {
  return liveTabEntries(ctx).map((entry) => {
    const record = listPatronTabs(ctx.state).find(
      (row) => row.id === entry.obligationId,
    )
    const owed = record ? outstandingAmount(record) : 0
    return {
      id: entry.obligationId,
      label: entry.readable,
      hint: `${owed} coin owed · ${Math.round(entry.collectionProbability * 100)}% chance · chased ${entry.chases}×`,
    }
  })
}

function findTabEntry(
  ctx: SimContext,
  obligationId: string | undefined,
): PatronTabIndexEntry | undefined {
  if (!obligationId) return undefined
  return liveTabEntries(ctx).find((entry) => entry.obligationId === obligationId)
}

/** Write the index back with one entry replaced or dropped. */
function writeTabEntry(
  ctx: SimContext,
  obligationId: string,
  next: PatronTabIndexEntry | undefined,
  reason: string,
  totals: Partial<ServiceModuleState['totals']> = {},
): void {
  ctx.modifyModuleState<ServiceModuleState>(
    'service',
    (current) => {
      const base = current ?? readServiceSlice(ctx)
      const patronTabs = base.patronTabs
        .map((entry) => (entry.obligationId === obligationId ? next : entry))
        .filter((entry): entry is PatronTabIndexEntry => entry !== undefined)
      return {
        ...base,
        patronTabs,
        totals: { ...base.totals, ...totals },
      }
    },
    { source: 'service.tabs', reason },
  )
}

/** Drop several settled ledger records from the bounded chase index at once. */
function dropTabEntries(
  ctx: SimContext,
  obligationIds: ReadonlyArray<string>,
  reason: string,
  totals: Partial<ServiceModuleState['totals']> = {},
): void {
  if (obligationIds.length === 0 && Object.keys(totals).length === 0) return
  const dropped = new Set(obligationIds)
  ctx.modifyModuleState<ServiceModuleState>(
    'service',
    (current) => {
      const base = current ?? readServiceSlice(ctx)
      return {
        ...base,
        patronTabs: base.patronTabs.filter(
          (entry) => !dropped.has(entry.obligationId),
        ),
        totals: { ...base.totals, ...totals },
      }
    },
    { source: 'service.tabs', reason },
  )
}

function regularFor(
  ctx: SimContext,
  entry: PatronTabIndexEntry,
): RegularWorldState | undefined {
  if (entry.debtorKind !== 'regular') return undefined
  return ctx.state.world.regulars[entry.debtorId]
}

// ---------------------------------------------------------------------------
// collect_tab
// ---------------------------------------------------------------------------

export const COLLECT_TAB_ACTION_ID = 'collect_tab'

const collectTabAction: OwnerActionDefinition = {
  id: COLLECT_TAB_ACTION_ID,
  label: 'Collect a Slate',
  category: 'immediate',
  tags: ['service', 'tab', 'money'],
  effectsPreview: 'Chase what somebody owes — and spend some goodwill doing it',
  pressureAffinity: ['debt'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  getValidTargets: tabTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'collect_tab requires a slate to chase.')
    }
    const entry = findTabEntry(ctx, input.targetId)
    if (!entry) {
      return reject(
        'tab_settled',
        'That slate is already closed — nothing left to collect.',
      )
    }
    return OK
  },
  apply: (ctx, input) => {
    const entry = findTabEntry(ctx, input.targetId!)!
    const result = collectPatronTab(ctx, entry)
    const chased: PatronTabIndexEntry = { ...entry, chases: entry.chases + 1 }
    const totals = readServiceSlice(ctx).totals
    writeTabEntry(
      ctx,
      entry.obligationId,
      result.status === 'collected' || result.status === 'gone' ? undefined : chased,
      'tab_chased',
      {
        tabsCollected:
          result.status === 'collected'
            ? totals.tabsCollected + 1
            : totals.tabsCollected,
        coinRecovered: totals.coinRecovered + result.recovered,
      },
    )

    // §4.5 "relationship and attribution consequences". Being chased is a
    // slight against a named person, and it is the reason they might stop
    // coming — which is what makes forgiving one a real alternative.
    const regular = regularFor(ctx, entry)
    if (regular) {
      rememberService(ctx, regular, {
        kind: 'tab_chased',
        readable: `You sent someone after ${regular.name.display} about their slate.`,
        standingDelta: -5,
      })
    }

    return {
      actionId: COLLECT_TAB_ACTION_ID,
      label: 'Collected a Slate',
      targetId: entry.obligationId,
      targetLabel: entry.readable,
      timeCost: TIME_COST_SHORT,
      effects: [
        result.readable,
        ...(result.recovered > 0 ? [`coin +${result.recovered}`] : []),
      ],
      data: {
        obligationId: entry.obligationId,
        debtorKind: entry.debtorKind,
        debtorId: entry.debtorId,
        status: result.status,
        recovered: result.recovered,
        coin: { earned: result.recovered },
      },
    }
  },
}

// ---------------------------------------------------------------------------
// forgive_tab
// ---------------------------------------------------------------------------

export const FORGIVE_TAB_ACTION_ID = 'forgive_tab'

const forgiveTabAction: OwnerActionDefinition = {
  id: FORGIVE_TAB_ACTION_ID,
  label: 'Wipe a Slate',
  category: 'social',
  tags: ['service', 'tab', 'social'],
  effectsPreview: 'Write off what they owe and buy the goodwill instead',
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  getValidTargets: tabTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'forgive_tab requires a slate to wipe.')
    }
    if (!findTabEntry(ctx, input.targetId)) {
      return reject('tab_settled', 'That slate is already closed.')
    }
    return OK
  },
  apply: (ctx, input) => {
    const entry = findTabEntry(ctx, input.targetId!)!
    const outcome = forgivePatronTab(
      ctx,
      entry,
      'the owner wrote it off',
    )
    const totals = readServiceSlice(ctx).totals
    writeTabEntry(ctx, entry.obligationId, undefined, 'tab_forgiven', {
      tabsForgiven: totals.tabsForgiven + 1,
    })

    const regular = regularFor(ctx, entry)
    if (regular) {
      rememberService(ctx, regular, {
        kind: 'tab_forgiven',
        readable: `You wiped ${regular.name.display}'s slate.`,
        standingDelta: 12,
      })
      // A wiped slate answers the request that asked for exactly this.
      const request = openRequestFor(regular)
      if (request?.kind === 'forgive_my_slate') {
        const live = ctx.state.world.regulars[regular.id]
        if (live) {
          resolveRequest(
            ctx,
            live,
            'granted',
            `${regular.name.display} asked you to wipe their slate, and you did.`,
          )
        }
      }
    } else {
      // A cohort has no relationship to move, so the goodwill lands on the
      // group's patronage instead — word gets round that the house is decent.
      const group = ctx.state.customerGroups[entry.groupId]
      if (group) {
        ctx.modifyCustomerGroup(
          group.id,
          { loyalty: Math.min(100, group.loyalty + 2) },
          {
            source: 'service.tabs.forgiven',
            sourceType: 'customer',
            direction: 'increase',
            amount: 2,
            readable: `Word got round that you wiped the ${group.label}'s slate.`,
            tags: ['service', 'tab', 'forgiven', group.id],
            relatedActors: [{ kind: 'customer_group', id: group.id }],
            relatedSystems: ['service', 'customers'],
          },
        )
      }
    }

    return {
      actionId: FORGIVE_TAB_ACTION_ID,
      label: 'Wiped a Slate',
      targetId: entry.obligationId,
      targetLabel: entry.readable,
      timeCost: TIME_COST_QUICK,
      effects: [outcome?.readable ?? 'Nothing left to wipe.'],
      data: {
        obligationId: entry.obligationId,
        debtorKind: entry.debtorKind,
        debtorId: entry.debtorId,
        forgiven: outcome?.forgiven ?? 0,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// greet_regular
// ---------------------------------------------------------------------------

export const GREET_REGULAR_ACTION_ID = 'greet_regular'

/** Standing a personal word is worth. */
export const GREET_STANDING_GAIN = 7

function regularTargets(ctx: SimContext): ActionTarget[] {
  return Object.values(ctx.state.world.regulars)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((regular) => {
      const parts: string[] = [`loyalty ${regular.loyalty}`]
      if (regular.irritation >= 40) parts.push(`irritation ${regular.irritation}`)
      if (regular.stoppedVisiting) parts.push('has stopped coming in')
      const request = openRequestFor(regular)
      if (request) parts.push('has asked you for something')
      return {
        id: regular.id,
        label: regular.name.display,
        hint: parts.join(' · '),
      }
    })
}

const greetRegularAction: OwnerActionDefinition = {
  id: GREET_REGULAR_ACTION_ID,
  label: 'Have a Word with a Regular',
  category: 'social',
  tags: ['service', 'regular', 'social'],
  effectsPreview: 'Time on one named drinker — worth more the worse it has got',
  pressureAffinity: ['regular_customer_loss'],
  targetType: 'regular',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: regularTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'greet_regular requires a regular.')
    }
    if (!ctx.state.world.regulars[input.targetId]) {
      return reject('unknown_regular', `No regular '${input.targetId}'.`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const regular = ctx.state.world.regulars[input.targetId!]!
    const effects: string[] = []

    rememberService(ctx, regular, {
      kind: 'good_service',
      readable: `You sat with ${regular.name.display} for a while.`,
      weight: 2,
      standingDelta: GREET_STANDING_GAIN,
      irritationDelta: -6,
    })
    effects.push(`${regular.name.display} appreciated the attention.`)

    // A lapsed regular can be talked back in person — the one route that does
    // not wait on `returnCondition`, because the owner turning up IS the
    // changed condition.
    const live = ctx.state.world.regulars[regular.id]
    if (live?.stoppedVisiting) {
      ctx.modifyRegular(
        live.id,
        { stoppedVisiting: undefined, consecutiveBadVisits: 0 },
        {
          source: 'regulars.greeted_back',
          sourceType: 'regular',
          target: live.id,
          targetType: 'regular',
          amount: 1,
          direction: 'increase',
          readable: `${live.name.display} agreed to give the place another go.`,
          tags: ['regular', 'return', 'owner_action'],
          relatedActors: [{ kind: 'regular', id: live.id }],
          relatedSystems: ['regulars'],
        },
      )
      effects.push(`${live.name.display} will come back in.`)
    }

    const favourite = favouriteAvailability(ctx.state, regular)
    if (favourite.subject && !favourite.available) {
      effects.push(`They mentioned ${favourite.subject} is off again.`)
    }

    return {
      actionId: GREET_REGULAR_ACTION_ID,
      label: 'Had a Word',
      targetId: regular.id,
      targetLabel: regular.name.display,
      timeCost: TIME_COST_STANDARD,
      effects,
      data: {
        regularId: regular.id,
        standingGain: GREET_STANDING_GAIN,
        wasLapsed: live?.stoppedVisiting !== undefined,
      },
    }
  },
}

// ---------------------------------------------------------------------------
// answer_regular_request
// ---------------------------------------------------------------------------

export const ANSWER_REGULAR_REQUEST_ACTION_ID = 'answer_regular_request'

function requestTargets(ctx: SimContext): ActionTarget[] {
  const out: ActionTarget[] = []
  for (const regular of Object.values(ctx.state.world.regulars).sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const request = openRequestFor(regular)
    if (!request) continue
    out.push({
      id: regular.id,
      label: request.readable,
      hint: `${request.kind} · expires day ${request.expiresOnDay}`,
    })
  }
  return out
}

const answerRegularRequestAction: OwnerActionDefinition = {
  id: ANSWER_REGULAR_REQUEST_ACTION_ID,
  label: 'Answer a Regular',
  category: 'social',
  tags: ['service', 'regular', 'social'],
  effectsPreview: 'Say yes or no to something a named drinker actually asked',
  pressureAffinity: ['regular_customer_loss'],
  targetType: 'regular',
  timeCost: TIME_COST_QUICK,
  getValidTargets: requestTargets,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'answer_regular_request requires a regular.')
    }
    const regular = ctx.state.world.regulars[input.targetId]
    if (!regular) {
      return reject('unknown_regular', `No regular '${input.targetId}'.`)
    }
    if (!openRequestFor(regular)) {
      return reject('no_request', `${regular.name.display} has not asked for anything.`)
    }
    return OK
  },
  apply: (ctx, input) => {
    const regular = ctx.state.world.regulars[input.targetId!]!
    const request = openRequestFor(regular)!
    // `amount` is the answer: anything but an explicit 0 is yes. A refusal is a
    // real choice with a real cost, so it has to be expressible.
    const granted = input.amount !== 0
    let slateForgiven = 0

    // Saying yes to a slate request must perform the debt transition before
    // the social request is scored. The old order awarded standing and closed
    // the request while every receivable remained live.
    if (granted && request.kind === 'forgive_my_slate') {
      const outcome = forgivePatronTabsForDebtor(
        ctx,
        'regular',
        regular.id,
        'the owner granted the regular\'s request',
      )
      slateForgiven = outcome.forgiven
      const totals = readServiceSlice(ctx).totals
      dropTabEntries(ctx, outcome.obligationIds, 'tab_request_forgiven', {
        tabsForgiven: totals.tabsForgiven + outcome.obligationIds.length,
      })
      const live = ctx.state.world.regulars[regular.id]
      if (live && outcome.forgiven > 0) {
        rememberService(ctx, live, {
          kind: 'tab_forgiven',
          readable: `You wiped ${live.name.display}'s ${outcome.forgiven}-coin slate.`,
          standingDelta: 12,
        })
      }
    }

    // Granting `keep_my_seat` is a promise the flow can keep: it is their
    // favourite area, and the seating step tries that first.
    if (granted && request.kind === 'keep_my_seat' && request.subjectId) {
      ctx.modifyRegular(
        regular.id,
        { favoriteAreaId: request.subjectId },
        {
          source: 'regulars.request_granted',
          sourceType: 'regular',
          target: regular.id,
          targetType: 'regular',
          readable: `${regular.name.display} has a table kept in ${request.subjectId}.`,
          tags: ['regular', 'request', 'seat'],
          relatedActors: [{ kind: 'regular', id: regular.id }],
          relatedLocations: [{ kind: 'area', id: request.subjectId }],
          relatedSystems: ['regulars', 'service'],
        },
      )
    }

    const live = ctx.state.world.regulars[regular.id] ?? regular
    resolveRequest(
      ctx,
      live,
      granted ? 'granted' : 'refused',
      granted
        ? request.kind === 'forgive_my_slate'
          ? `${regular.name.display}'s ${slateForgiven}-coin slate was wiped.`
          : `You agreed: ${request.readable}`
        : `You turned ${regular.name.display} down.`,
    )

    return {
      actionId: ANSWER_REGULAR_REQUEST_ACTION_ID,
      label: granted ? 'Granted a Request' : 'Refused a Request',
      targetId: regular.id,
      targetLabel: regular.name.display,
      timeCost: TIME_COST_QUICK,
      effects: [
        granted
          ? `Agreed: ${request.readable}`
          : `Refused: ${request.readable}`,
      ],
      data: {
        regularId: regular.id,
        requestId: request.id,
        requestKind: request.kind,
        granted,
        ...(request.kind === 'forgive_my_slate' ? { slateForgiven } : {}),
      },
    }
  },
}

export const SERVICE_ACTIONS: OwnerActionDefinition[] = [
  collectTabAction,
  forgiveTabAction,
  greetRegularAction,
  answerRegularRequestAction,
]

export {
  collectTabAction,
  forgiveTabAction,
  greetRegularAction,
  answerRegularRequestAction,
}
