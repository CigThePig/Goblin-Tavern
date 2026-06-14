import type { SimContext } from '../../core/context'
import type { CauseDraft } from '../causes/causeTypes'
import type { TeleologyEntry } from '../../state/TavernState'
import type { BranchingMilestone, LifecycleCondition, LifecycleDefinition, LifecycleEffect, LifecycleTrigger } from './types'

// The kernel never decides which slice an entry lives in — the calling
// module injects the write path (`ctx.modifyVenture` / `ctx.modifyArc`).
// This keeps the `if (kind === 'arc')` branch out of the kernel, per the
// teleology plan §1 ("structure and lifecycle only").
export type EntryMutator = (
  id: string,
  changes: Partial<TeleologyEntry>,
  meta: CauseDraft,
) => void

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

function applyLifecycleEffects(ctx: SimContext, entry: TeleologyEntry, effects: LifecycleEffect[], mutate: EntryMutator): void {
  for (const effect of effects) {
    if (effect.kind === 'entry_patch') {
      mutate(entry.id, { ...effect.changes, updatedAtDay: ctx.state.calendar.totalDaysElapsed }, { source: 'kernel.effect', readable: `Lifecycle effect applied to ${entry.label}.`, tags: ['teleology', entry.kind, entry.id] })
    } else {
      ctx.modifyTransformation(effect.id, { id: effect.id, label: effect.label, active: true, tags: effect.tags, activatedAtDay: ctx.state.calendar.totalDaysElapsed }, { source: 'kernel.transformation', readable: `Transformation active: ${effect.label}.`, tags: ['teleology', 'transformation', effect.id, ...effect.tags] })
    }
  }
}

export function advanceLifecycleEntry(ctx: SimContext, entry: TeleologyEntry, definition: LifecycleDefinition, trigger: LifecycleTrigger, mutate: EntryMutator): boolean {
  const result = trigger(entry, ctx, definition)
  if (!result.advanced) return false
  const toStage = result.toStage ?? entry.stage
  const effects = result.effects ?? []
  const patch: Partial<TeleologyEntry> = { stage: toStage, progress: 0, updatedAtDay: ctx.state.calendar.totalDaysElapsed }
  // Completion is milestone-data-driven via `result.status` — the kernel
  // does not know which stage is terminal for any given lifecycle.
  if (result.status) patch.status = result.status
  mutate(entry.id, patch, result.cause ?? { source: 'kernel.advance', readable: `${entry.label} advanced to ${toStage}.`, tags: ['teleology', 'advance', entry.id, `stage:${toStage}`] })
  applyLifecycleEffects(ctx, { ...entry, ...patch }, effects, mutate)
  return true
}
