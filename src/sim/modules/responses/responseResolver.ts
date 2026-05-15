import type {
  CauseEntry,
  TavernState,
} from '../../state/TavernState'
import type { EffectResult } from '../../core/effect'
import type { ReportSection } from '../../core/reports'
import { createStateDiff } from '../../core/diff'
import type { MemoryDraft } from '../memories/memoryTypes'
import type {
  IssueSeed,
  ResponseIntent,
  ResponseResolutionResult,
} from '../issues/issueSeedTypes'
import { scoreAppliedEffects } from '../issues/impactScoring'

import { applyResponseProfile, type ApplyOrigin } from './applyResponseProfile'
import { createCloneApplier } from './cloneApplier'
import { selectConsequence } from './selectConsequence'

// Phase 19 §19.10 / Phase 41 §41 — Response resolver.
//
// Takes a TavernState, the issue seed, and the player-side response
// intent. Picks the matching consequence profile, applies effects to a
// cloned state through the shared `applyResponseProfile` walker + a
// `CloneApplier`, and returns the resulting state diff + added
// memories/future hooks/causes.
//
// The resolver does not call into the engine — it is a pure transform
// usable from tests, debug runners, and future card-layer drivers.
// Phase 41 / ISSUE-001 extends the dispatch so all five effect kinds
// mutate state: `cause` appends to `state.causes`, `memory` appends to
// `state.memories`, and `future_hook` / `delayedEffects` /
// `futureHooks` enqueue into `state.modules.responses.pending`. The
// engine-side `responsesModule` uses the same `applyResponseProfile`
// walker with a `CtxApplier` so both paths produce equivalent state.

function cloneState(state: TavernState): TavernState {
  return structuredClone(state)
}

/** Phase 19 §19.10 — resolve a response intent against an issue seed.
 *  Returns the cloned state with the consequence profile applied, plus
 *  diff + applied effects + memories/causes/futureHooks records for
 *  callers that want them. The resolver does not mutate the input. */
export function resolveResponseIntent(
  state: TavernState,
  seed: IssueSeed,
  intent: ResponseIntent,
): ResponseResolutionResult & { state: TavernState } {
  const before = cloneState(state)
  const after = cloneState(state)
  const { profile, slot } = selectConsequence(seed, intent)

  const applied: EffectResult[] = []
  let memoriesAdded: MemoryDraft[] = []
  let futureHooksAdded: MemoryDraft[] = []
  const causesAdded: ResponseResolutionResult['causesAdded'] = []

  if (profile && slot) {
    const today = after.calendar.totalDaysElapsed
    const origin: ApplyOrigin = {
      seedId: seed.id,
      intentId: intent.id,
      profileId: profile.id,
      responseSlotId: slot.id,
      verb: intent.verb,
      enqueuedDay: today,
    }
    const applier = createCloneApplier(after)
    const result = applyResponseProfile(profile, origin, applier)
    for (const e of result.appliedEffects) applied.push(e)
    for (const c of applier.causesAdded) causesAdded.push(c)
    // Backward-compatibility: the existing return shape exposes
    // `memoriesAdded` and `futureHooksAdded` arrays built from
    // `profile.memories` and `profile.futureHooks`. Keep populating
    // them — the state-side mutations are additive.
    memoriesAdded = profile.memories.map((m) => ({ ...m }))
    futureHooksAdded = [
      ...profile.futureHooks.map((m) => ({ ...m })),
      ...profile.delayedEffects
        .filter((e) => e.kind === 'future_hook')
        .map((e) => ({
          id: e.target,
          tags: e.tags,
        })) as MemoryDraft[],
    ]
  }

  const stateDiff = createStateDiff(before, after)
  const impactScore = scoreAppliedEffects(applied)
  const report = buildResolutionReport(intent, applied, stateDiff, impactScore)

  return {
    state: after,
    appliedEffects: applied,
    stateDiff,
    memoriesAdded,
    futureHooksAdded,
    causesAdded,
    impactScore,
    report,
  }
}

function buildResolutionReport(
  intent: ResponseIntent,
  applied: EffectResult[],
  diff: { significantChanges: { readable: string }[] },
  impact: number,
): ReportSection {
  const lines: string[] = []
  lines.push(`Response: ${intent.verb} (${intent.shape})`)
  lines.push(`Impact: ${impact}`)
  lines.push('Effects:')
  if (applied.length === 0) {
    lines.push('  (none)')
  } else {
    for (const e of applied) {
      lines.push(`  - ${e.readable}${e.applied ? '' : ' (not applied)'}`)
    }
  }
  lines.push('Significant state changes:')
  if (diff.significantChanges.length === 0) {
    lines.push('  (none)')
  } else {
    for (const c of diff.significantChanges.slice(0, 8)) {
      lines.push(`  - ${c.readable}`)
    }
  }
  return {
    id: 'response_resolution',
    source: 'responses',
    title: 'RESPONSE RESOLUTION',
    lines,
    data: { impact, intent },
  }
}

/** Synthesize a CauseEntry from a resolver-added cause record. Tests and
 *  drivers can use this to mirror cause attribution into state.causes. */
export function causeEntryFromAdded(
  added: ResponseResolutionResult['causesAdded'][number],
  stamp: CauseEntry['timestamp'],
): CauseEntry {
  const amount = added.amount
  const direction: CauseEntry['direction'] =
    amount > 0 ? 'increase' : amount < 0 ? 'decrease' : 'neutral'
  return {
    id: `response-${stamp.absoluteDay}-${added.target}`,
    timestamp: stamp,
    source: added.source,
    sourceType: 'system',
    target: added.target,
    targetType: 'global',
    amount,
    direction,
    weight: Math.abs(amount),
    readable: added.readable,
    tags: ['response'],
    relatedActors: [],
    relatedLocations: [],
    relatedSystems: [],
    ageDays: 0,
  }
}
