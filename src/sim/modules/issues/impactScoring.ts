import type { EffectPreview, EffectResult } from '../../core/effect'
import type { ConsequenceProfile } from './issueSeedTypes'

// Phase 19 §19.11 — Impact scoring.
//
// Each effect contributes a weighted value. State changes weigh more
// than future hooks; future hooks weigh more than passive memories.
// The total is clamped to 0–100 so reports can rank choices.

const STATE_CHANGE_WEIGHT = 1.0
const PRESSURE_WEIGHT = 0.8
const CAUSE_WEIGHT = 0.6
const MEMORY_WEIGHT = 0.4
const FUTURE_HOOK_WEIGHT = 0.5

function weightFor(kind: EffectPreview['kind']): number {
  switch (kind) {
    case 'state_change':
      return STATE_CHANGE_WEIGHT
    case 'pressure':
      return PRESSURE_WEIGHT
    case 'cause':
      return CAUSE_WEIGHT
    case 'memory':
      return MEMORY_WEIGHT
    case 'future_hook':
      return FUTURE_HOOK_WEIGHT
    default:
      return 0.5
  }
}

/** Compute the impact score from a set of effect previews + memory drafts. */
export function scoreEffects(
  immediate: EffectPreview[],
  delayed: EffectPreview[],
  memoriesCount: number,
  futureHooksCount: number,
): number {
  let total = 0
  for (const e of immediate) {
    const magnitude = Math.abs(e.amount ?? 5)
    total += weightFor(e.kind) * magnitude
  }
  for (const e of delayed) {
    const magnitude = Math.abs(e.amount ?? 5)
    total += weightFor(e.kind) * magnitude * 0.7
  }
  total += MEMORY_WEIGHT * 8 * memoriesCount
  total += FUTURE_HOOK_WEIGHT * 10 * futureHooksCount
  return Math.max(0, Math.min(100, Math.round(total)))
}

/** Compute the impact score from a single consequence profile. */
export function scoreProfile(
  profile: Omit<ConsequenceProfile, 'impactScore'>,
): number {
  return scoreEffects(
    profile.immediateEffects,
    profile.delayedEffects,
    profile.memories.length,
    profile.futureHooks.length,
  )
}

/** Compute impact for actually-applied effects (resolver output). */
export function scoreAppliedEffects(applied: EffectResult[]): number {
  const valid = applied.filter((e) => e.applied)
  let total = 0
  for (const e of valid) {
    const magnitude = Math.abs(e.amount ?? 5)
    total += weightFor(e.kind) * magnitude
  }
  return Math.max(0, Math.min(100, Math.round(total)))
}

/** Impact thresholds (Phase 19 §19.11). */
export const IMPACT_THRESHOLDS = {
  MINOR: 15,
  NORMAL: 30,
  MAJOR: 60,
  MONTHLY: 70,
} as const

/** Classify an impact score. */
export function classifyImpact(
  score: number,
): 'weak' | 'minor' | 'normal' | 'major' | 'strategic' {
  if (score < IMPACT_THRESHOLDS.MINOR) return 'weak'
  if (score < IMPACT_THRESHOLDS.NORMAL) return 'minor'
  if (score < IMPACT_THRESHOLDS.MAJOR) return 'normal'
  if (score < IMPACT_THRESHOLDS.MONTHLY) return 'major'
  return 'strategic'
}
