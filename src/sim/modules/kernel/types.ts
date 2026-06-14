import type { CauseDraft } from '../causes/causeTypes'
import type { TeleologyEntry } from '../../state/TavernState'

export type StageId = string

export type LifecycleEffect =
  | { kind: 'entry_patch'; target: 'self'; changes: Partial<TeleologyEntry> }
  | { kind: 'transformation'; id: string; label: string; tags: string[] }

export type LifecycleCondition =
  | { kind: 'progress_at_least'; value: number }
  | { kind: 'tag_present'; tag: string }
  | { kind: 'transformation_active'; id: string }

export type BranchingMilestone = {
  id: string
  fromStage: StageId
  requirements: LifecycleCondition[]
  outcomes: Array<{
    when: LifecycleCondition[]
    effects: LifecycleEffect[]
    nextStage: StageId
  }>
  fallback: { effects: LifecycleEffect[]; nextStage: StageId }
}

export type LifecycleDefinition = {
  id: string
  milestones: BranchingMilestone[]
}

export type LifecycleTriggerResult = {
  advanced: boolean
  toStage?: StageId
  effects?: LifecycleEffect[]
  cause?: CauseDraft
}

export type LifecycleTrigger = (
  entry: TeleologyEntry,
  ctx: { state: import('../../state/TavernState').TavernState },
  definition: LifecycleDefinition,
) => LifecycleTriggerResult
