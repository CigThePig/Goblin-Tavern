import type { CauseDraft } from '../causes/causeTypes'
import type { TeleologyEntry, TeleologyLifecycleStatus } from '../../state/TavernState'

export type StageId = string

export type LifecycleEffect =
  | { kind: 'entry_patch'; target: 'self'; changes: Partial<TeleologyEntry> }
  | { kind: 'transformation'; id: string; label: string; tags: string[] }

export type LifecycleCondition =
  | { kind: 'progress_at_least'; value: number }
  | { kind: 'tag_present'; tag: string }
  | { kind: 'transformation_active'; id: string }

// `terminal` lets the milestone *data* declare that reaching this outcome
// ends the lifecycle (status → 'completed'), instead of the kernel
// hardcoding a domain stage id. Modules translate it into a
// `LifecycleTriggerResult.status`; the kernel stays generic.
export type MilestoneOutcome = {
  when: LifecycleCondition[]
  effects: LifecycleEffect[]
  nextStage: StageId
  terminal?: boolean
}

export type BranchingMilestone = {
  id: string
  fromStage: StageId
  requirements: LifecycleCondition[]
  outcomes: MilestoneOutcome[]
  fallback: { effects: LifecycleEffect[]; nextStage: StageId; terminal?: boolean }
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
  /** When set, the kernel writes this status into the entry on advance.
   *  Domain modules supply it (e.g. from a milestone's `terminal` flag) so
   *  the kernel never hardcodes which stage ends a lifecycle. */
  status?: TeleologyLifecycleStatus
}

export type LifecycleTrigger = (
  entry: TeleologyEntry,
  ctx: { state: import('../../state/TavernState').TavernState },
  definition: LifecycleDefinition,
) => LifecycleTriggerResult
