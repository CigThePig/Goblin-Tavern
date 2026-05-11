import type { FeedbackEvidence } from '../feedbackLoopTypes'

export function pushEvidence(
  list: FeedbackEvidence[],
  draft: { id: string; readable: string; weight: number; tags?: string[] },
): void {
  list.push({
    id: draft.id,
    readable: draft.readable,
    weight: draft.weight,
    tags: draft.tags ? [...draft.tags] : [],
  })
}

export function evidenceWeightTotal(evidence: ReadonlyArray<FeedbackEvidence>): number {
  let sum = 0
  for (const e of evidence) sum += e.weight
  return sum
}
