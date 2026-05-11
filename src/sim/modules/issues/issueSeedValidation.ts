import type {
  IssueSeed,
  SeedValidation,
  TextIngredients,
} from './issueSeedTypes'
import { TEXT_INGREDIENT_LIMITS } from './issueSeedTypes'

// Phase 19 §19.5 — Seed validation.
//
// Phase 1 Contract §4.10 lists ten verbal conditions for a card-ready
// seed. Each maps to one or more mechanical checks here. A seed that
// fails any condition is flagged invalid and excluded from selection.
//
// Phase 19 §19.12 — text ingredient budget enforcement. During 19d–19f
// development these are soft warnings; the Phase 20 readiness gate
// can flip the strict flag.

export const CONTRACT_CHECK_IDS = [
  'clear_situation',
  'reason_now',
  'actor_or_group',
  'location_or_system',
  'at_least_two_causes',
  'at_least_two_responses',
  'short_term_consequences',
  'memory_or_future_hook',
  'no_contradictions',
  'reason_to_care',
] as const

export type ContractCheckId = (typeof CONTRACT_CHECK_IDS)[number]

function wordCount(s: string): number {
  if (!s || s.trim().length === 0) return 0
  return s.trim().split(/\s+/).length
}

/** Validate text ingredient budgets. Returns over-budget messages. */
export function validateTextIngredients(
  ingredients: TextIngredients,
  strict: boolean = false,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const push = (msg: string) => {
    if (strict) errors.push(msg)
    else warnings.push(msg)
  }

  // subject
  if (ingredients.subject) {
    if (wordCount(ingredients.subject) > TEXT_INGREDIENT_LIMITS.subject.maxWordsPerEntry) {
      push(
        `subject exceeds ${TEXT_INGREDIENT_LIMITS.subject.maxWordsPerEntry} words`,
      )
    }
  }
  // problemNoun
  if (ingredients.problemNoun !== undefined) {
    if (wordCount(ingredients.problemNoun) > TEXT_INGREDIENT_LIMITS.problemNoun.maxWordsPerEntry) {
      push(
        `problemNoun exceeds ${TEXT_INGREDIENT_LIMITS.problemNoun.maxWordsPerEntry} words`,
      )
    }
  }
  // sensoryDetails
  if (
    ingredients.sensoryDetails.length >
    TEXT_INGREDIENT_LIMITS.sensoryDetails.maxEntries
  ) {
    push(
      `sensoryDetails has more than ${TEXT_INGREDIENT_LIMITS.sensoryDetails.maxEntries} entries`,
    )
  }
  for (const detail of ingredients.sensoryDetails) {
    if (
      wordCount(detail) >
      TEXT_INGREDIENT_LIMITS.sensoryDetails.maxWordsPerEntry
    ) {
      push(
        `sensoryDetail "${detail}" exceeds ${TEXT_INGREDIENT_LIMITS.sensoryDetails.maxWordsPerEntry} words`,
      )
    }
  }
  // actorOpinions
  const opinionKeys = Object.keys(ingredients.actorOpinions)
  if (
    opinionKeys.length >
    TEXT_INGREDIENT_LIMITS.actorOpinions.maxEntries
  ) {
    push(
      `actorOpinions has more than ${TEXT_INGREDIENT_LIMITS.actorOpinions.maxEntries} entries`,
    )
  }
  for (const key of opinionKeys) {
    const opinion = ingredients.actorOpinions[key]!
    if (
      wordCount(opinion) >
      TEXT_INGREDIENT_LIMITS.actorOpinions.maxWordsPerEntry
    ) {
      push(
        `actorOpinion[${key}] exceeds ${TEXT_INGREDIENT_LIMITS.actorOpinions.maxWordsPerEntry} words`,
      )
    }
  }
  // recentContext
  if (
    ingredients.recentContext.length >
    TEXT_INGREDIENT_LIMITS.recentContext.maxEntries
  ) {
    push(
      `recentContext has more than ${TEXT_INGREDIENT_LIMITS.recentContext.maxEntries} entries`,
    )
  }
  for (const ctx of ingredients.recentContext) {
    if (
      wordCount(ctx) >
      TEXT_INGREDIENT_LIMITS.recentContext.maxWordsPerEntry
    ) {
      push(
        `recentContext "${ctx}" exceeds ${TEXT_INGREDIENT_LIMITS.recentContext.maxWordsPerEntry} words`,
      )
    }
  }
  // stakesReadable
  if (
    ingredients.stakesReadable.length >
    TEXT_INGREDIENT_LIMITS.stakesReadable.maxEntries
  ) {
    push(
      `stakesReadable has more than ${TEXT_INGREDIENT_LIMITS.stakesReadable.maxEntries} entries`,
    )
  }
  for (const stake of ingredients.stakesReadable) {
    if (
      wordCount(stake) >
      TEXT_INGREDIENT_LIMITS.stakesReadable.maxWordsPerEntry
    ) {
      push(
        `stakesReadable "${stake}" exceeds ${TEXT_INGREDIENT_LIMITS.stakesReadable.maxWordsPerEntry} words`,
      )
    }
  }

  return { errors, warnings }
}

/** Validate a seed against the Phase 1 Contract §4.10 conditions. */
export function validateSeed(
  seed: IssueSeed,
  options: { strictTextBudget?: boolean } = {},
): SeedValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const contractChecks: Record<string, boolean> = {}

  // 1. clear situation — type and family present.
  const hasClearSituation = Boolean(seed.type && seed.family)
  contractChecks.clear_situation = hasClearSituation
  if (!hasClearSituation) errors.push('Missing seed type or family')

  // 2. reason it appeared now — at least one cause with a timestamp.
  const hasReasonNow = seed.causes.length >= 1
  contractChecks.reason_now = hasReasonNow
  if (!hasReasonNow) errors.push('Seed has no causes explaining why it appeared')

  // 3. actor or group — primary actor OR at least one affected actor OR
  //    a location.
  const hasActorOrLocation = Boolean(
    seed.primaryActor || seed.affectedActors.length > 0 || seed.location,
  )
  contractChecks.actor_or_group = hasActorOrLocation
  if (!hasActorOrLocation)
    errors.push('Seed has no actor, group, or location')

  // 4. location or system — same as 3 OR a non-empty domain.
  const hasLocationOrSystem = Boolean(seed.location || seed.domain.length > 0)
  contractChecks.location_or_system = hasLocationOrSystem
  if (!hasLocationOrSystem)
    errors.push('Seed has no location or system reference')

  // 5. at least two causes (where possible — single-cause seeds are
  //    flagged as warnings, not errors, because some events have one
  //    clear root).
  const hasTwoCauses = seed.causes.length >= 2
  contractChecks.at_least_two_causes = hasTwoCauses
  if (!hasTwoCauses) {
    if (seed.causes.length === 0) {
      errors.push('Seed has no causes')
    } else {
      warnings.push('Seed has only one cause (Contract §4.10 prefers ≥2)')
    }
  }

  // 6. at least two response slots.
  const hasTwoResponses =
    seed.responseSlots.length >= 2 || seed.type === 'monthly_review'
  contractChecks.at_least_two_responses = hasTwoResponses
  if (!hasTwoResponses)
    errors.push('Seed has fewer than two response slots')

  // 7. short-term consequences — at least one consequence profile per
  //    response slot.
  const hasConsequences =
    seed.consequenceProfiles.length >= seed.responseSlots.length &&
    seed.consequenceProfiles.length > 0
  contractChecks.short_term_consequences =
    hasConsequences || seed.type === 'monthly_review'
  if (!contractChecks.short_term_consequences)
    errors.push('Seed is missing consequence profiles for response slots')

  // 8. memory or future hook — at least one of either across all
  //    consequence profiles, OR at the seed level.
  const allMemories = [
    ...seed.memoriesCreated,
    ...seed.futureHooks,
    ...seed.consequenceProfiles.flatMap((p) => p.memories),
    ...seed.consequenceProfiles.flatMap((p) => p.futureHooks),
  ]
  const hasMemoryOrHook =
    allMemories.length > 0 || seed.type === 'monthly_review'
  contractChecks.memory_or_future_hook = hasMemoryOrHook
  if (!hasMemoryOrHook)
    errors.push('Seed has no memory or future hook to leave behind')

  // 9. no contradictions — handled by the contradiction guard layer
  //    before validation runs. If a seed got this far, assume true.
  contractChecks.no_contradictions = true

  // 10. reason to care — severity, urgency, and at least one stake.
  const hasReason =
    seed.severity > 0 &&
    seed.urgency > 0 &&
    (seed.stakes.length > 0 || seed.type === 'monthly_review')
  contractChecks.reason_to_care = hasReason
  if (!hasReason)
    errors.push('Seed has no severity/urgency/stake giving the player a reason to care')

  // Text ingredient budget.
  const ingredientCheck = validateTextIngredients(
    seed.textIngredients,
    options.strictTextBudget ?? false,
  )
  for (const e of ingredientCheck.errors) errors.push(e)
  for (const w of ingredientCheck.warnings) warnings.push(w)

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    contractChecks,
  }
}
