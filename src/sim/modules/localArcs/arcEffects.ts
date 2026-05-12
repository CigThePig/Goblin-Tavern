import type { SimContext } from '../../core/context'
import type {
  LocalArcDefinition,
  LocalArcEffect,
} from '../../content/events/localArcTypes'
import type { LocalEventWorldState } from '../../state/TavernState'
import { LOCAL_ARCS_MODULE_ID, type LocalArcsAppliedEffectRecord } from './types'

// Phase 35 §35.7 — Arc effects.
//
// Each entry in `definition.effects` is a small mechanical nudge. The
// engine batches all active arcs' effects each monthly tick and:
//
//   - pressure_delta: nudges `state.pressures[id].value` via
//     `ctx.modifyPressure` (the Phase 18 pipeline takes care of trend
//     and history bookkeeping the next tick).
//   - market_condition: defers to the supplier module's slice; the
//     localArcs module simply collects the condition ids and lets the
//     supplier module's daily hook pick them up. Phase 35 wires the
//     accumulator on `state.modules.localArcs.activeMarketConditionIds`.
//   - customer_group_modifier: adds a flag tag onto the customer group
//     so subsequent service rolls see it.
//   - supplier_modifier: adds a flag tag onto the supplier record.
//   - calendar_tag / issue_seed_tag: stored on the module slice for
//     downstream (issue seed selection, calendar-tag readers) to read.
//   - reputation_signal: nudges a reputation axis modestly.
//
// Sizes are deliberately small. Phase 35 introduces the seam; later
// phases may retune.

const SOURCE = LOCAL_ARCS_MODULE_ID

/**
 * Phase 35 §35.7 — applied-effect summary returned to the module. The
 * module writes these onto the arc's `activeEffects` list and onto the
 * module slice's `recentlyAppliedEffects` trace for reports.
 */
export type ArcEffectApplication = {
  arc: LocalEventWorldState
  effect: LocalArcEffect
  /** Stable identifier the module records on `arc.activeEffects`. */
  effectKey: string
}

function effectKeyFor(effect: LocalArcEffect): string {
  switch (effect.kind) {
    case 'pressure_delta':
      return `pressure_delta:${effect.id}:${effect.amount}`
    case 'market_condition':
      return `market_condition:${effect.id}`
    case 'customer_group_modifier':
      return `customer_group_modifier:${effect.id}`
    case 'supplier_modifier':
      return `supplier_modifier:${effect.id}`
    case 'calendar_tag':
      return `calendar_tag:${effect.id}`
    case 'issue_seed_tag':
      return `issue_seed_tag:${effect.id}`
    case 'reputation_signal':
      return `reputation_signal:${effect.id}:${effect.amount}`
  }
}

export function applyArcEffect(args: {
  ctx: SimContext
  arc: LocalEventWorldState
  definition: LocalArcDefinition
  effect: LocalArcEffect
}): ArcEffectApplication {
  const { ctx, arc, definition, effect } = args
  const effectKey = effectKeyFor(effect)
  switch (effect.kind) {
    case 'pressure_delta': {
      const pressure = ctx.state.pressures[effect.id]
      if (pressure !== undefined) {
        const cause = {
          source: `${SOURCE}.${arc.id}.${effect.id}`,
          sourceType: 'local_event' as const,
          target: `pressure:${effect.id}`,
          targetType: 'pressure' as const,
          amount: effect.amount,
          direction: (effect.amount > 0 ? 'increase' : effect.amount < 0 ? 'decrease' : 'neutral') as
            | 'increase'
            | 'decrease'
            | 'neutral',
          weight: Math.abs(effect.amount),
          readable: `${definition.label} pressures ${effect.id} (${effect.amount >= 0 ? '+' : ''}${effect.amount}).`,
          tags: ['local_arc', definition.id, 'pressure'],
          relatedSystems: ['local_arcs', 'monthly'],
        }
        ctx.modifyPressure(effect.id, effect.amount, cause)
        ctx.addCause(cause)
      }
      break
    }
    case 'reputation_signal': {
      const current = (ctx.state.reputation as Record<string, number>)[effect.id]
      if (typeof current === 'number') {
        const next = Math.max(0, Math.min(100, current + effect.amount))
        if (next !== current) {
          const cause = {
            source: `${SOURCE}.${arc.id}.${effect.id}`,
            sourceType: 'local_event' as const,
            target: `reputation:${effect.id}`,
            targetType: 'reputation' as const,
            amount: effect.amount,
            direction: (effect.amount > 0 ? 'increase' : effect.amount < 0 ? 'decrease' : 'neutral') as
              | 'increase'
              | 'decrease'
              | 'neutral',
            weight: Math.abs(effect.amount),
            readable: `${definition.label} shifts ${effect.id} reputation ${effect.amount >= 0 ? '+' : ''}${effect.amount}.`,
            tags: ['local_arc', definition.id, 'reputation'],
          }
          ctx.modifyReputation(
            {
              ...ctx.state.reputation,
              [effect.id]: next,
            },
            cause,
          )
          ctx.addCause(cause)
        }
      }
      break
    }
    case 'customer_group_modifier': {
      const group = ctx.state.customerGroups[effect.id]
      if (group) {
        const flag = `arc:${definition.id}`
        if (!group.activeGrudges.includes(flag)) {
          ctx.modifyCustomerGroup(
            effect.id,
            { activeGrudges: [...group.activeGrudges, flag] },
            {
              source: `${SOURCE}.${arc.id}`,
              sourceType: 'local_event',
              target: effect.id,
              targetType: 'customer',
              amount: 0,
              readable: `${definition.label} flagged group ${effect.id}.`,
              tags: ['local_arc', definition.id, 'customer_group'],
            },
          )
        }
      }
      break
    }
    case 'supplier_modifier': {
      const supplier = ctx.state.world.suppliers[effect.id]
      if (supplier) {
        const flag = `arc:${definition.id}`
        if (!supplier.activeFlags.includes(flag)) {
          ctx.modifySupplier(
            effect.id,
            { activeFlags: [...supplier.activeFlags, flag] },
            {
              source: `${SOURCE}.${arc.id}`,
              sourceType: 'local_event',
              target: effect.id,
              targetType: 'supplier',
              amount: 0,
              readable: `${definition.label} flagged supplier ${effect.id}.`,
              tags: ['local_arc', definition.id, 'supplier'],
            },
          )
        }
      }
      break
    }
    case 'market_condition':
    case 'calendar_tag':
    case 'issue_seed_tag':
      // Accumulated on the module slice by the caller; no direct state
      // mutation here. Storing the ids in the module slice keeps the
      // arc record itself clean (Phase 25's planned shape is preserved).
      break
  }
  return { arc, effect, effectKey }
}

export function effectKeyOf(effect: LocalArcEffect): string {
  return effectKeyFor(effect)
}

export function makeAppliedEffectRecord(args: {
  application: ArcEffectApplication
  day: number
}): LocalArcsAppliedEffectRecord {
  const { application, day } = args
  return {
    arcId: application.arc.id,
    day,
    effect: application.effect,
    appliedAtStage: application.arc.stage ?? 'seeded',
  }
}
