import type { SimContext } from '../../core/context'
import type { EntityRef } from '../../state/TavernState'

import {
  beliefBetween,
  bumpBeliefTotal,
  easeAttribution,
  houseRef,
  isActing,
} from '../attribution/index'

import { TIME_COST_STANDARD, pushSocialAction } from './stateHelpers'
import type {
  ActionTarget,
  ActionValidationResult,
  OwnerActionApplied,
  OwnerActionDefinition,
  OwnerSocialActionRecord,
} from './types'

// Expansion Phase 8 §8.5 — the player's answer to what somebody believes.
//
// Every other half of this phase is people acting on beliefs the player
// cannot touch: the supplier quoting higher, the group staying home, the
// server listing it as a reason to leave. §5 does not accept that — a system
// whose consequences the player can only watch is not a mechanic — so this
// is the move on the other side of it.
//
// AND IT CAN BE THE WRONG MOVE. Answering a belief somebody is RIGHT about
// does not settle it; it hardens it, exactly as denying a true rumour does in
// §8.4. The remedy line names what would actually work, so the player who
// reads before acting is the one who gets the good outcome.

const OK: ActionValidationResult = { ok: true }

function reject(code: string, reason: string): ActionValidationResult {
  return { ok: false, code, reason }
}

/** How far a false belief's grip is loosened by being answered properly. */
const FALSE_CONFIDENCE_DROP = 25
const FALSE_STRENGTH_DROP = 8
/** …and a partly-true one, which can be clarified but not dismissed. */
const PARTIAL_CONFIDENCE_DROP = 12
const PARTIAL_STRENGTH_DROP = 4
/** Answering something they are right about makes them surer of it. */
const TRUE_STRENGTH_GAIN = 5

/** `<kind>:<id>` — the same composite-target convention the upgrades use. */
function parseHolder(targetId: string): EntityRef | undefined {
  const split = targetId.indexOf(':')
  if (split <= 0) return undefined
  const kind = targetId.slice(0, split)
  const id = targetId.slice(split + 1)
  if (!kind || !id) return undefined
  return { kind: kind as EntityRef['kind'], id }
}

function holderLabel(ctx: SimContext, holder: EntityRef): string {
  switch (holder.kind) {
    case 'staff':
      return ctx.state.staff[holder.id]?.name.display ?? holder.id
    case 'supplier':
      return ctx.state.world.suppliers[holder.id]?.label ?? holder.id
    case 'regular':
      return ctx.state.world.regulars[holder.id]?.name.display ?? holder.id
    case 'customer_group':
      return ctx.state.customerGroups[holder.id]?.label ?? holder.id
    case 'faction':
      return ctx.state.world.factions[holder.id]?.label ?? holder.id
    default:
      return holder.id
  }
}

/** Everybody currently holding something against the house that is acting. */
function grievanceHolders(ctx: SimContext): ActionTarget[] {
  const house = houseRef(ctx.state)
  const out: ActionTarget[] = []
  const candidates: EntityRef[] = [
    ...Object.keys(ctx.state.staff).map((id) => ({ kind: 'staff' as const, id })),
    ...Object.keys(ctx.state.world.suppliers).map((id) => ({ kind: 'supplier' as const, id })),
    ...Object.keys(ctx.state.world.regulars).map((id) => ({ kind: 'regular' as const, id })),
    ...Object.keys(ctx.state.customerGroups).map((id) => ({ kind: 'customer_group' as const, id })),
    ...Object.keys(ctx.state.world.factions).map((id) => ({ kind: 'faction' as const, id })),
  ]
  for (const holder of candidates) {
    const belief = beliefBetween(ctx.state, holder, house)
    if (!isActing(belief)) continue
    out.push({
      id: `${holder.kind}:${holder.id}`,
      label: holderLabel(ctx, holder),
      hint:
        `${belief!.readable} (holding it at ${Math.round(belief!.weight * 100)})` +
        (belief!.accuracy === 'true' ? ' — and they are right' : ''),
    })
  }
  // Sorted so the picker is stable across reloads rather than following the
  // iteration order of five different records.
  out.sort((a, b) => a.id.localeCompare(b.id))
  return out
}

const addressGrievance: OwnerActionDefinition = {
  id: 'address_grievance',
  label: 'Address Grievance',
  category: 'social',
  tags: ['social', 'belief', 'attribution'],
  effectsPreview: 'Hears out what somebody holds against the house — and answers it',
  pressureAffinity: ['rumour_pressure', 'reputation_drift'],
  targetType: 'global',
  timeCost: TIME_COST_STANDARD,
  getValidTargets: grievanceHolders,
  canApply: (ctx, input) => {
    if (!input.targetId) {
      return reject('missing_target', 'address_grievance requires targetId')
    }
    const holder = parseHolder(input.targetId)
    if (!holder) return reject('unknown_target', `Unreadable target '${input.targetId}'`)
    const belief = beliefBetween(ctx.state, holder, houseRef(ctx.state))
    if (!belief) {
      return reject('nothing_held', 'They hold nothing against the house.')
    }
    if (!isActing(belief)) {
      return reject(
        'not_serious',
        'Whatever they think, it is not weighing on them enough to be worth the hour.',
      )
    }
    return OK
  },
  apply: (ctx, input): OwnerActionApplied => {
    const holder = parseHolder(input.targetId!)!
    const belief = beliefBetween(ctx.state, holder, houseRef(ctx.state))!
    const label = holderLabel(ctx, holder)
    const day = ctx.state.calendar.totalDaysElapsed

    const rightAboutIt = belief.accuracy === 'true'
    const partly = belief.accuracy === 'partial'
    const strengthDelta = rightAboutIt
      ? TRUE_STRENGTH_GAIN
      : partly
        ? -PARTIAL_STRENGTH_DROP
        : -FALSE_STRENGTH_DROP
    const confidenceDelta = rightAboutIt
      ? 0
      : partly
        ? -PARTIAL_CONFIDENCE_DROP
        : -FALSE_CONFIDENCE_DROP

    const after = easeAttribution(ctx, belief.attributionId, {
      strengthDelta,
      confidenceDelta,
      readable: rightAboutIt
        ? `${label} was told it was not as they thought — and they were right, so it stuck harder.`
        : `The owner heard ${label} out and set the record straight.`,
      source: 'ownerActions.address_grievance',
      tags: ['owner_action', 'address_grievance', holder.id],
    })

    bumpBeliefTotal(ctx, rightAboutIt ? 'refusedAsTrue' : 'answered')

    const effects = [
      rightAboutIt
        ? `${label} is surer of it than before (strength +${TRUE_STRENGTH_GAIN})`
        : `${label} holds it less firmly (confidence ${belief.publicness >= 0 ? '' : ''}${confidenceDelta})`,
      rightAboutIt
        ? 'Only putting the thing right will settle this one.'
        : `"${belief.readable}"`,
    ]

    const record: OwnerSocialActionRecord = {
      id: `address_grievance.${holder.kind}.${holder.id}.${day}`,
      actionId: 'address_grievance',
      targetType:
        holder.kind === 'staff' ||
        holder.kind === 'supplier' ||
        holder.kind === 'regular' ||
        holder.kind === 'faction' ||
        holder.kind === 'customer_group'
          ? holder.kind
          : 'staff',
      targetId: holder.id,
      day,
      outcome: rightAboutIt ? 'worsened' : 'improved',
      notes: [belief.readable, `accuracy ${belief.accuracy}`],
      tags: ['social', 'belief', holder.id],
    }
    pushSocialAction(ctx, record, 'grievance_addressed')

    ctx.addHistory({
      category: 'owner_action',
      summary: rightAboutIt
        ? `Owner argued with ${label} about something they were right about.`
        : `Owner addressed what ${label} held against the house.`,
      tags: ['owner_action', 'social', 'address_grievance', holder.id],
      relatedActors: [{ ...holder }],
      relatedSystems: ['ownerActions', 'attribution'],
      mechanicalRefs: ['address_grievance', belief.attributionId],
    })

    return {
      actionId: addressGrievance.id,
      label: rightAboutIt ? `Argued with ${label}` : `Addressed ${label}'s grievance`,
      targetId: input.targetId!,
      timeCost: TIME_COST_STANDARD,
      effects,
      data: {
        holderKind: holder.kind,
        holderId: holder.id,
        attributionId: belief.attributionId,
        accuracy: belief.accuracy,
        strengthBefore: Math.round(belief.weight * 100),
        strengthAfter: after ? after.strength : undefined,
        rightAboutIt,
      },
    }
  },
}

export const BELIEF_ACTIONS: ReadonlyArray<OwnerActionDefinition> = [
  addressGrievance,
]
