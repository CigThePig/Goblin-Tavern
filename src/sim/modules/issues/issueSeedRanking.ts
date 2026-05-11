import type {
  CooldownEntry,
  IssueSeed,
  IssueSeedModuleState,
} from './issueSeedTypes'

// Phase 19 §19.3 / §19.4 — Seed ranking, novelty, and cooldown.
//
// Ranking combines severity, urgency, base cardWorthiness, novelty (how
// rarely this template has fired recently), and a repetition penalty
// (how often the same actor or location has been featured). The output
// `cardWorthiness` is the final ranked score the query API exposes.

/** Lookback window (days) for "recently featured" actor/location penalty. */
const RECENT_FEATURE_WINDOW_DAYS = 7

/** Penalty per recent generation of the same template id. */
const TEMPLATE_REPETITION_PENALTY = 8

/** Reward for a high number of unrelated systems affected. */
const SYSTEM_DIVERSITY_REWARD = 3

/** Penalty for low impact consequence range. */
const LOW_IMPACT_PENALTY = 10

/** Reward for unresolved-duration accumulated context. */
const UNRESOLVED_DURATION_REWARD = 2

/** Novelty cap. */
const MAX_NOVELTY = 100

export type RankingInput = {
  seed: IssueSeed
  templateId: string
  cooldowns: Record<string, CooldownEntry>
  absoluteDay: number
}

/** Compute novelty 0–100. 100 = unseen template in the recent window. */
export function computeNovelty(
  templateId: string,
  cooldowns: Record<string, CooldownEntry>,
  absoluteDay: number,
): number {
  const entry = cooldowns[templateId]
  if (!entry || entry.timesGenerated === 0) return MAX_NOVELTY
  const daysSince = Math.max(0, absoluteDay - entry.lastGeneratedDay)
  const recencyDecay = Math.max(0, RECENT_FEATURE_WINDOW_DAYS - daysSince)
  const novelty =
    MAX_NOVELTY -
    (recencyDecay * 12 + Math.min(40, entry.timesGenerated * 5))
  return Math.max(0, Math.min(MAX_NOVELTY, Math.round(novelty)))
}

/** Compute card-worthiness 0–100. */
export function computeCardWorthiness(input: RankingInput): number {
  const { seed, templateId, cooldowns, absoluteDay } = input
  const severity = Math.max(0, Math.min(100, seed.severity))
  const urgency = Math.max(0, Math.min(100, seed.urgency))
  const novelty = computeNovelty(templateId, cooldowns, absoluteDay)

  // Base score blends severity + urgency + novelty.
  let score = severity * 0.4 + urgency * 0.35 + novelty * 0.25

  // System diversity reward: more distinct domains = more cross-system
  // problem = more interesting card.
  if (seed.domain.length >= 2) {
    score += SYSTEM_DIVERSITY_REWARD * Math.min(4, seed.domain.length - 1)
  }

  // Number of stakes (gives player a reason to care).
  if (seed.stakes.length >= 2) {
    score += 2 * Math.min(3, seed.stakes.length - 1)
  }

  // Repetition penalty for templates already generated several times in
  // recent window.
  const entry = cooldowns[templateId]
  if (entry) {
    const daysSince = absoluteDay - entry.lastGeneratedDay
    if (daysSince < RECENT_FEATURE_WINDOW_DAYS) {
      score -= TEMPLATE_REPETITION_PENALTY
    }
  }

  // Low impact penalty — if every consequence profile is below 15, the
  // choice barely matters.
  if (seed.consequenceProfiles.length > 0) {
    const maxImpact = Math.max(
      ...seed.consequenceProfiles.map((p) => p.impactScore),
    )
    if (maxImpact < 15) score -= LOW_IMPACT_PENALTY
  }

  // Unresolved-duration bonus: when the dominant cause is old, the
  // problem has been ignored — that's interesting.
  const oldestCauseAge = seed.causes.length > 0
    ? Math.max(...seed.causes.map((c) => c.ageDays))
    : 0
  if (oldestCauseAge >= 3) {
    score += UNRESOLVED_DURATION_REWARD * Math.min(5, oldestCauseAge - 2)
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

/** Sort seeds by card-worthiness, then severity, then urgency. */
export function rankSeeds(seeds: IssueSeed[]): IssueSeed[] {
  return [...seeds].sort((a, b) => {
    if (b.cardWorthiness !== a.cardWorthiness)
      return b.cardWorthiness - a.cardWorthiness
    if (b.severity !== a.severity) return b.severity - a.severity
    return b.urgency - a.urgency
  })
}

/** Record that a template was generated today. */
export function bumpCooldownOnGenerate(
  slice: IssueSeedModuleState,
  templateId: string,
  family: string,
  absoluteDay: number,
  actorIds: string[],
  locationIds: string[],
): IssueSeedModuleState {
  const existing = slice.cooldowns[templateId]
  const next: CooldownEntry = existing
    ? {
        ...existing,
        lastGeneratedDay: absoluteDay,
        timesGenerated: existing.timesGenerated + 1,
        actorIds: dedupe([...existing.actorIds, ...actorIds]),
        locationIds: dedupe([...existing.locationIds, ...locationIds]),
      }
    : {
        templateId,
        family,
        lastGeneratedDay: absoluteDay,
        lastSelectedDay: -1,
        timesSelected: 0,
        timesGenerated: 1,
        actorIds: dedupe(actorIds),
        locationIds: dedupe(locationIds),
      }
  return {
    ...slice,
    cooldowns: { ...slice.cooldowns, [templateId]: next },
  }
}

function dedupe(arr: string[]): string[] {
  const out: string[] = []
  for (const item of arr) {
    if (!out.includes(item)) out.push(item)
  }
  return out
}
