import type { SimContext } from '../../core/context'
import {
  ARC_REPEAT_COOLDOWN_DAYS,
  type ArcOutcomeKind,
  type ArcOutcomeSpec,
  type ArcPermanentChange,
  type LocalArcProgression,
} from '../../content/events/localArcTypes'
import { localArcRegistry } from '../../content/events/localArcRegistry'
import { writeSupplierAccount, getSupplierAccount } from '../suppliers/state'

import { applyArcEffect } from './arcEffects'
import {
  bumpArcRunTotal,
  noteArcRun,
  writeArcRun,
  writeArcSlice,
  type ArcRun,
} from './arcRuns'
import { LOCAL_ARCS_MODULE_ID } from './types'

// Expansion Phase 9 §9.2 — how an arc ends, and what the world keeps.
//
// §9.2 asks for four things at the end of an arc — "success, compromise,
// failure, and aftermath" — and then, separately, for "permanent or
// long-lived changes". The distinction is the point of this file.
//
// AFTERMATH is a one-off application of the outcome's effects: pressure
// settles, a reputation axis moves, a market condition lifts. All of it
// decays or lapses on its own, exactly like every other arc effect.
//
// A PERMANENT CHANGE does not. It is a fact about the world that outlives
// the arc entirely — a room that keeps a trait, a crowd whose base custom
// moved, a thing the house is now known for, a house rule, a supplier that
// deals differently from now on, a reputation floor that will not fall back.
// Six kinds, and each is applied by the domain that owns the thing being
// changed rather than by writing over it here.
//
// That is also what closes `HOOK-blight_brand_lock_*`: "brand may lock in
// long-term" was a promise about a permanent change, and now there is a kind
// of change that means it.

const SOURCE = LOCAL_ARCS_MODULE_ID

function outcomeSpec(
  progression: LocalArcProgression,
  outcome: ArcOutcomeKind,
): ArcOutcomeSpec {
  return progression.outcomes[outcome]
}

/**
 * Apply a permanent change through the domain that owns it.
 *
 * Returns a readable key recorded on the run, so the report can say what the
 * world kept and a test can assert the change was applied exactly once.
 */
export function applyPermanentChange(
  ctx: SimContext,
  run: ArcRun,
  change: ArcPermanentChange,
): string | undefined {
  const today = ctx.state.calendar.totalDaysElapsed
  const cause = {
    source: `${SOURCE}.permanent_change`,
    sourceType: 'local_event' as const,
    tags: ['local_arc', 'permanent', run.definitionId],
    relatedActors: [{ kind: 'local_event' as const, id: run.arcId }],
    relatedSystems: ['local_arcs'],
  }

  switch (change.kind) {
    case 'area_trait': {
      const area = ctx.state.areas[change.areaId]
      if (!area) return undefined
      if (area.traits.includes(change.trait)) return `area_trait:${change.trait}`
      ctx.modifyArea(
        change.areaId,
        { traits: [...area.traits, change.trait] },
        {
          ...cause,
          target: change.areaId,
          targetType: 'area',
          amount: 1,
          readable: change.readable,
        },
      )
      return `area_trait:${change.areaId}:${change.trait}`
    }

    case 'customer_group_patronage': {
      const group = ctx.state.customerGroups[change.groupId]
      if (!group) return undefined
      ctx.modifyCustomerGroup(
        change.groupId,
        { patronage: Math.max(0, Math.min(100, group.patronage + change.delta)) },
        {
          ...cause,
          target: change.groupId,
          targetType: 'customer',
          amount: change.delta,
          readable: change.readable,
        },
      )
      return `customer_group_patronage:${change.groupId}:${change.delta}`
    }

    // The identity module owns `knownFor` and `houseRules` and recomputes
    // both from scratch every morning. Writing them here would have the
    // change erased overnight, so the arc records durable EVIDENCE instead
    // and the identity module unions it in. See `earnedLabels`.
    case 'identity_known_for':
      return recordEarnedLabel(ctx, 'knownFor', change.label, change.readable)

    case 'house_rule':
      return recordEarnedLabel(ctx, 'houseRules', change.label, change.readable)

    case 'supplier_terms': {
      const supplierId = change.supplierId ?? run.ownerRef?.id
      if (!supplierId || !getSupplierAccount(ctx.state, supplierId)) return undefined
      writeSupplierAccount(
        ctx,
        supplierId,
        (current) => ({
          ...current,
          termsAdjustment:
            Math.round(current.termsAdjustment * change.multiplier * 100) / 100,
          termsAdjustmentUntilDay: today + change.days,
          lastDecisionDay: today,
          lastDecisionReason: change.readable,
        }),
        'arc_outcome',
      )
      return `supplier_terms:${supplierId}:${change.multiplier}`
    }

    default:
      return undefined
  }
}

/**
 * Record a label the arc permanently earned.
 *
 * Returns the key even when the label is already held, because "the house
 * was already known for this" is a correct outcome rather than a failure —
 * the caller records it once either way, which is what keeps a permanent
 * change idempotent across a re-fire.
 */
function recordEarnedLabel(
  ctx: SimContext,
  field: 'knownFor' | 'houseRules',
  label: string,
  readable: string,
): string {
  const key = `${field === 'knownFor' ? 'identity_known_for' : 'house_rule'}:${label}`
  writeArcSlice(
    ctx,
    (current) => {
      const earned = current.earnedLabels ?? { knownFor: [], houseRules: [] }
      if (earned[field].includes(label)) return current
      return {
        ...current,
        earnedLabels: { ...earned, [field]: [...earned[field], label] },
      }
    },
    'earned_label',
  )
  ctx.addLog({ message: readable, level: 'info', data: { label, field } }, 'localArcs')
  return key
}

export type ArcClosure = {
  arcId: string
  outcome: ArcOutcomeKind
  readable: string
  permanentChange?: string
}

/**
 * Close a run: record the outcome, apply the aftermath and whatever the
 * world keeps, and set the cooldown that decides whether it can come round
 * again.
 *
 * `recurrence` is the §9.2 "cooldown or recurrence" requirement, and the
 * two values mean genuinely different things: `recurring` sets a cooldown
 * and the arc may return, `once_per_run` sets a cooldown past any plausible
 * game length, which is how an arc that permanently changed the world avoids
 * changing it a second time.
 */
export function closeArcRun(
  ctx: SimContext,
  run: ArcRun,
  outcome: ArcOutcomeKind,
): ArcClosure | undefined {
  if (!localArcRegistry.has(run.definitionId)) return undefined
  const definition = localArcRegistry.get(run.definitionId)
  const progression = definition.progression
  if (!progression) return undefined
  const spec = outcomeSpec(progression, outcome)
  const today = ctx.state.calendar.totalDaysElapsed

  // Aftermath first: the effects the outcome carries, applied once.
  for (const effect of spec.effects ?? []) {
    const arc = ctx.state.world.localEvents[run.arcId]
    if (!arc) break
    applyArcEffect({ ctx, arc, definition, effect })
  }

  // Then whatever the world keeps.
  let permanentKey: string | undefined
  if (spec.permanentChange) {
    permanentKey = applyPermanentChange(ctx, run, spec.permanentChange)
    if (permanentKey) bumpArcRunTotal(ctx, 'permanentChangesApplied')
  }

  writeArcRun(
    ctx,
    run.arcId,
    (current) => ({
      ...current,
      outcome,
      closedOnDay: today,
      permanentChanges: permanentKey
        ? [...new Set([...current.permanentChanges, permanentKey])]
        : current.permanentChanges,
    }),
    `close_${outcome}`,
  )
  noteArcRun(ctx, run.arcId, spec.readable)
  bumpArcRunTotal(
    ctx,
    outcome === 'success'
      ? 'runsSucceeded'
      : outcome === 'compromise'
        ? 'runsCompromised'
        : 'runsFailed',
  )

  // Cooldown. `once_per_run` is expressed as a cooldown rather than a flag
  // so there is one mechanism to reason about and one field to persist.
  const cooldownDays =
    progression.recurrence === 'once_per_run'
      ? 100_000
      : (spec.cooldownDays ?? ARC_REPEAT_COOLDOWN_DAYS)
  writeArcSlice(
    ctx,
    (current) => ({
      ...current,
      cooldowns: { ...current.cooldowns, [run.definitionId]: today + cooldownDays },
    }),
    'cooldown',
  )

  if (spec.memoryId) {
    ctx.addMemory({
      id: spec.memoryId,
      source: `${SOURCE}.${run.definitionId}`,
      actors: [{ kind: 'local_event', id: run.arcId }],
      metadata: { arcId: run.arcId, outcome },
    })
  }

  ctx.addHistory({
    category: 'monthly',
    summary: `${definition.label}: ${spec.readable}`,
    tags: ['local_arc', 'outcome', outcome, run.definitionId],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: ['local_arcs'],
    mechanicalRefs: [run.arcId],
  })

  return {
    arcId: run.arcId,
    outcome,
    readable: spec.readable,
    ...(permanentKey ? { permanentChange: permanentKey } : {}),
  }
}
