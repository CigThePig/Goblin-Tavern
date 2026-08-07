import type { SimContext } from '../../core/context'
import { clampPercent } from '../../state/normalize'
import {
  audiencesOf,
  bumpRumourTotal,
  liveRumours,
} from '../rumours/rumourState'
import { correctRumour, openContradiction } from '../rumours/belief'
import { noteStanding } from '../factions/standing'
import { noteDealing } from '../npcs/dealings'
import {
  COUNTER_RUMOUR_RUNAWAY_EVENT,
  RUMOUR_DENIAL_BACKFIRE_EVENT,
  scheduleRumourConsequence,
} from '../rumours/rumourEvents'

import { TIME_COST_QUICK, TIME_COST_SHORT, TIME_COST_STANDARD } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
} from './types'

// Expansion Phase 8 §8.4 — what the owner can do about talk.
//
// DEP-10 names these: "rumour-facing response slots (deny, counter, name the
// source)". They existed as response-profile slots on issue cards, which
// meant they were only reachable when a card happened to be dealt. As owner
// actions they are on the board whenever there is something being said —
// which is the difference between a mechanic and a card effect.
//
// The three are a genuine trade rather than three flavours of "make it stop":
//
//   deny_rumour     cheap and immediate, and it works — unless the thing was
//                   TRUE, in which case the denial is on the calendar and
//                   will come apart. The player often does not know which.
//   counter_rumour  puts a contradicting story about. Both stories lose
//                   credibility, which is the point; but a counter can run
//                   away and become something the house never said.
//   name_the_source expensive in time and costs standing with whoever is
//                   named — but it re-anchors the story, which is the only
//                   move that reduces distortion rather than volume.

const SOURCE = 'ownerActions'

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

/** Rumours anybody has actually heard. Nothing else is worth answering. */
function answerableRumours(ctx: SimContext): ActionTarget[] {
  return liveRumours(ctx.state)
    .filter((rumour) => audiencesOf(rumour).length > 0)
    .map((rumour) => ({
      id: rumour.id,
      label: rumour.label,
      hint:
        `repeated ${Math.round(rumour.strength)}, credited ${rumour.credibility ?? 50}` +
        `, heard by ${audiencesOf(rumour).length}` +
        ((rumour.distortion ?? 0) >= 40 ? ', much changed in the telling' : ''),
    }))
}

// ---------- deny_rumour ----------

const denyRumour: OwnerActionDefinition = {
  id: 'deny_rumour',
  label: 'Deny It',
  category: 'social',
  tags: ['social', 'rumour', 'denial'],
  effectsPreview: 'Says publicly that it is not true — and hopes it is not',
  pressureAffinity: ['rumour_pressure'],
  targetType: 'global',
  timeCost: TIME_COST_QUICK,
  getValidTargets: answerableRumours,
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'deny_rumour requires targetId')
    const rumour = ctx.state.world.socialRumours[input.targetId]
    if (!rumour) return reject('unknown_target', `No such rumour '${input.targetId}'`)
    if (rumour.correctedOnDay !== undefined) {
      return reject('already_settled', 'That matter is already settled.')
    }
    if (rumour.tags.includes('denied')) {
      return reject('already_denied', 'The house has already denied that one.')
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const rumour = ctx.state.world.socialRumours[input.targetId!]!
    const nextStrength = clampPercent(rumour.strength - 20)
    const quietened = audiencesOf(rumour).map((audience) => ({
      ...audience,
      belief: clampPercent(audience.belief - 15),
    }))

    ctx.modifySocialRumour(
      rumour.id,
      {
        strength: nextStrength,
        audiences: quietened,
        tags: [...new Set([...rumour.tags, 'denied'])],
      },
      {
        source: `${SOURCE}.deny_rumour`,
        sourceType: 'owner_action',
        target: rumour.id,
        targetType: 'rumour',
        amount: nextStrength - rumour.strength,
        direction: 'decrease',
        readable: `The house denied "${rumour.label}" publicly.`,
        tags: ['owner_action', 'rumour', 'denial', rumour.id],
        relatedActors: [{ kind: 'rumour', id: rumour.id }],
        relatedSystems: ['rumours'],
      },
    )
    bumpRumourTotal(ctx, 'deniedByOwner')

    // The gamble. A denial of something TRUE is on the calendar from here,
    // and the resolver re-reads `accuracy` when it fires — so the player is
    // betting on what they know rather than on a dice roll.
    const risky = rumour.accuracy === 'true' || rumour.accuracy === 'partial'
    const scheduled = risky
      ? scheduleRumourConsequence(ctx, RUMOUR_DENIAL_BACKFIRE_EVENT, rumour.id, {
          source: `${SOURCE}.deny_rumour`,
          readable: `The house has denied "${rumour.label}".`,
          offsetDays: 10,
        })
      : false

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house denied "${rumour.label}".`,
      tags: ['owner_action', 'rumour', 'denial', rumour.id],
      relatedActors: [{ kind: 'rumour', id: rumour.id }],
      relatedSystems: ['ownerActions', 'rumours'],
      mechanicalRefs: ['deny_rumour', rumour.id],
    })

    return {
      actionId: denyRumour.id,
      label: `Denied "${rumour.label}"`,
      targetId: rumour.id,
      timeCost: TIME_COST_QUICK,
      effects: [
        `repeated ${Math.round(rumour.strength)} → ${nextStrength}`,
        'belief shaken',
      ],
      data: { rumourId: rumour.id, backfireScheduled: scheduled },
    }
  },
}

// ---------- counter_rumour ----------

const counterRumour: OwnerActionDefinition = {
  id: 'counter_rumour',
  label: 'Put a Story About',
  category: 'social',
  tags: ['social', 'rumour', 'counter'],
  effectsPreview: 'Answers one story with another — both lose credit',
  pressureAffinity: ['rumour_pressure'],
  targetType: 'global',
  timeCost: TIME_COST_SHORT,
  getValidTargets: (ctx) =>
    answerableRumours(ctx).filter(
      (target) => !ctx.state.world.socialRumours[target.id]?.counterRumourId,
    ),
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'counter_rumour requires targetId')
    const rumour = ctx.state.world.socialRumours[input.targetId]
    if (!rumour) return reject('unknown_target', `No such rumour '${input.targetId}'`)
    if (rumour.counterRumourId) {
      return reject('already_countered', 'A story is already going about against that one.')
    }
    if (rumour.tags.includes('counter_rumour')) {
      return reject(
        'is_a_counter',
        'That story is already the house’s own answer to something else.',
      )
    }
    if (rumour.correctedOnDay !== undefined) {
      return reject('already_settled', 'That matter is already settled.')
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const rumour = ctx.state.world.socialRumours[input.targetId!]!
    const counter = openContradiction(ctx, {
      rumourId: rumour.id,
      label: `They are saying the opposite of "${rumour.label}"`,
      credibility: 55,
    })
    bumpRumourTotal(ctx, 'counteredByOwner')

    // A story you started can get away from you. On the calendar, re-read
    // when it fires, so settling the matter first cancels it.
    const scheduled = counter
      ? scheduleRumourConsequence(ctx, COUNTER_RUMOUR_RUNAWAY_EVENT, rumour.id, {
          source: `${SOURCE}.counter_rumour`,
          readable: `The house put a story about to answer "${rumour.label}".`,
          offsetDays: 8,
        })
      : false

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house put a story about against "${rumour.label}".`,
      tags: ['owner_action', 'rumour', 'counter', rumour.id],
      relatedActors: [{ kind: 'rumour', id: rumour.id }],
      relatedSystems: ['ownerActions', 'rumours'],
      mechanicalRefs: ['counter_rumour', rumour.id],
    })

    return {
      actionId: counterRumour.id,
      label: `Countered "${rumour.label}"`,
      targetId: rumour.id,
      timeCost: TIME_COST_SHORT,
      effects: counter
        ? ['a contradicting story is going about', 'both lose credit while it stands']
        : ['nothing came of it'],
      data: { rumourId: rumour.id, counterId: counter?.id, runawayScheduled: scheduled },
    }
  },
}

// ---------- name_the_source ----------

const nameTheSource: OwnerActionDefinition = {
  id: 'name_the_source',
  label: 'Name the Source',
  category: 'social',
  tags: ['social', 'rumour', 'source'],
  effectsPreview: 'Says publicly who started it — settles the story, costs the standing',
  pressureAffinity: ['rumour_pressure'],
  targetType: 'global',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: (ctx) =>
    answerableRumours(ctx).filter(
      (target) => ctx.state.world.socialRumours[target.id]?.originRef !== undefined,
    ),
  canApply: (ctx, input) => {
    if (!input.targetId) return reject('missing_target', 'name_the_source requires targetId')
    const rumour = ctx.state.world.socialRumours[input.targetId]
    if (!rumour) return reject('unknown_target', `No such rumour '${input.targetId}'`)
    if (!rumour.originRef) {
      return reject('no_known_source', 'Nobody knows where that one started.')
    }
    if (rumour.correctedOnDay !== undefined) {
      return reject('already_settled', 'That matter is already settled.')
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const rumour = ctx.state.world.socialRumours[input.targetId!]!
    const origin = rumour.originRef!
    const originLabel = describeOrigin(ctx, origin)

    // The only move that SETTLES a story rather than making it quieter —
    // and the only one that undoes distortion, because naming where it
    // started re-anchors what was actually said.
    correctRumour(
      ctx,
      rumour.id,
      `The house named ${originLabel} as the source of "${rumour.label}", and the story stopped.`,
    )
    bumpRumourTotal(ctx, 'sourcesNamed')

    const effects = [`"${rumour.label}" settled`]

    // Naming somebody costs you with them. The faction and NPC ledgers §8.1
    // and §8.3 own that, so the cost lands there rather than in a meter here.
    if (origin.kind === 'faction' && ctx.state.world.factions[origin.id]) {
      noteFactionGrievance(ctx, origin.id, rumour.label)
      effects.push(`${originLabel} will not forget it`)
    } else if (origin.kind === 'notable_npc' && ctx.state.world.notableNpcs[origin.id]) {
      noteNpcGrievance(ctx, origin.id, rumour.label)
      effects.push(`${originLabel} will not forget it`)
    }

    ctx.addHistory({
      category: 'owner_action',
      summary: `The house named ${originLabel} over "${rumour.label}".`,
      tags: ['owner_action', 'rumour', 'source', rumour.id],
      relatedActors: [{ kind: 'rumour', id: rumour.id }],
      relatedSystems: ['ownerActions', 'rumours'],
      mechanicalRefs: ['name_the_source', rumour.id],
    })

    return {
      actionId: nameTheSource.id,
      label: `Named the source of "${rumour.label}"`,
      targetId: rumour.id,
      timeCost: TIME_COST_STANDARD,
      effects,
      data: { rumourId: rumour.id, origin },
    }
  },
}

function describeOrigin(
  ctx: SimContext,
  origin: NonNullable<
    import('../../state/TavernState').SocialRumourState['originRef']
  >,
): string {
  switch (origin.kind) {
    case 'faction':
      return ctx.state.world.factions[origin.id]?.label ?? origin.id
    case 'notable_npc':
      return ctx.state.world.notableNpcs[origin.id]?.name.display ?? origin.id
    case 'culture':
      return ctx.state.world.cultures[origin.id]?.label ?? origin.id
    case 'customer_group':
      return ctx.state.customerGroups[origin.id]?.label ?? origin.id
    default:
      return origin.id
  }
}

function noteFactionGrievance(ctx: SimContext, factionId: string, label: string): void {
  // Direct import: the dependency runs one way only. Factions and NPCs know
  // nothing about rumours, so an owner action reaching into their ledgers
  // creates no cycle.
  noteStanding(ctx, {
    factionId,
    id: `named_as_source_${factionId}`,
    kind: 'grievance',
    weight: 18,
    readable: `The house named them publicly over "${label}".`,
    tags: ['rumour', 'named'],
  })
}

function noteNpcGrievance(ctx: SimContext, npcId: string, label: string): void {
  noteDealing(ctx, {
    npcId,
    kind: 'refused',
    readable: `The house named them publicly over "${label}".`,
    weight: -20,
  })
}

export const RUMOUR_ACTIONS: OwnerActionDefinition[] = [
  denyRumour,
  counterRumour,
  nameTheSource,
]

export { denyRumour, counterRumour, nameTheSource }
