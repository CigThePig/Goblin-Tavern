import type { SimContext } from '../../core/context'
import type { TeleologyEntry } from '../../state/TavernState'
import type { BranchingMilestone, LifecycleCondition, LifecycleDefinition, LifecycleEffect, LifecycleTrigger } from './types'

export function conditionMatches(entry: TeleologyEntry, ctx: SimContext | { state: SimContext['state'] }, condition: LifecycleCondition): boolean {
  if (condition.kind === 'progress_at_least') return entry.progress >= condition.value
  if (condition.kind === 'tag_present') return entry.tags.includes(condition.tag)
  if (condition.kind === 'transformation_active') return ctx.state.transformations[condition.id]?.active === true
  return false
}

export function resolveBranchingMilestone(entry: TeleologyEntry, ctx: SimContext | { state: SimContext['state'] }, milestone: BranchingMilestone) {
  if (entry.stage !== milestone.fromStage) return undefined
  if (!milestone.requirements.every((c) => conditionMatches(entry, ctx, c))) return undefined
  const outcome = milestone.outcomes.find((o) => o.when.every((c) => conditionMatches(entry, ctx, c)))
  return outcome ?? milestone.fallback
}

function applyLifecycleEffects(ctx: SimContext, entry: TeleologyEntry, effects: LifecycleEffect[]): void {
  for (const effect of effects) {
    if (effect.kind === 'entry_patch') {
      if (entry.kind === 'venture') ctx.modifyVenture(entry.id, { ...effect.changes, updatedAtDay: ctx.state.calendar.totalDaysElapsed }, { source: 'kernel.effect', readable: `Lifecycle effect applied to ${entry.label}.`, tags: ['teleology', entry.kind, entry.id] })
      else ctx.modifyArc(entry.id, { ...effect.changes, updatedAtDay: ctx.state.calendar.totalDaysElapsed }, { source: 'kernel.effect', readable: `Lifecycle effect applied to ${entry.label}.`, tags: ['teleology', entry.kind, entry.id] })
    } else {
      ctx.modifyTransformation(effect.id, { id: effect.id, label: effect.label, active: true, tags: effect.tags, activatedAtDay: ctx.state.calendar.totalDaysElapsed }, { source: 'kernel.transformation', readable: `Transformation active: ${effect.label}.`, tags: ['teleology', 'transformation', effect.id, ...effect.tags] })
    }
  }
}

export function advanceLifecycleEntry(ctx: SimContext, entry: TeleologyEntry, definition: LifecycleDefinition, trigger: LifecycleTrigger): boolean {
  const result = trigger(entry, ctx, definition)
  if (!result.advanced) return false
  const toStage = result.toStage ?? entry.stage
  const effects = result.effects ?? []
  const patch: Partial<TeleologyEntry> = { stage: toStage, progress: 0, updatedAtDay: ctx.state.calendar.totalDaysElapsed }
  if (toStage === 'licensed') patch.status = 'completed'
  if (entry.kind === 'venture') ctx.modifyVenture(entry.id, patch, result.cause ?? { source: 'kernel.advance', readable: `${entry.label} advanced to ${toStage}.`, tags: ['teleology', 'advance', entry.id, `stage:${toStage}`] })
  else ctx.modifyArc(entry.id, patch, result.cause ?? { source: 'kernel.advance', readable: `${entry.label} advanced to ${toStage}.`, tags: ['teleology', 'advance', entry.id, `stage:${toStage}`] })
  applyLifecycleEffects(ctx, { ...entry, ...patch }, effects)
  return true
}
