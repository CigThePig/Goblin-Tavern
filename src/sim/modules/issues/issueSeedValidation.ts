import type { EntityRef, TavernState } from '../../state/TavernState'
import type {
  IssueSeed,
  IssueSeedFamilyId,
  SeedValidation,
  TextIngredients,
} from './issueSeedTypes'
import {
  EXPANDED_ISSUE_SEED_FAMILIES,
  TEXT_INGREDIENT_LIMITS,
} from './issueSeedTypes'

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

  // Phase 39 §39.3 / §39.16 — expanded text ingredient arrays.
  const EXPANDED_ARRAY_FIELDS = [
    'namedEntities',
    'socialContext',
    'relevantMemories',
    'perceivedBlame',
    'pressureContext',
    'calendarContext',
    'marketContext',
    'arcContext',
  ] as const

  for (const field of EXPANDED_ARRAY_FIELDS) {
    const values = ingredients[field]
    if (!values) continue
    const limits = TEXT_INGREDIENT_LIMITS[field]
    if (values.length > limits.maxEntries) {
      push(`${field} has more than ${limits.maxEntries} entries`)
    }
    for (const entry of values) {
      const text =
        field === 'namedEntities'
          ? (entry as { displayName: string }).displayName
          : (entry as string)
      if (wordCount(text) > limits.maxWordsPerEntry) {
        push(`${field} "${text}" exceeds ${limits.maxWordsPerEntry} words`)
      }
    }
  }

  return { errors, warnings }
}

// Phase 39 §39.16 — Reference resolution.
//
// Expanded seeds name world entities. The seed must point at entities the
// simulation still believes in: a regular that was banned, a supplier
// that left town, or an arc that resolved last week should not appear in
// a freshly generated seed.

function entityRefResolves(state: TavernState, ref: EntityRef): boolean {
  switch (ref.kind) {
    case 'staff':
      return Boolean(state.staff[ref.id])
    case 'customer_group':
      return Boolean(state.customerGroups[ref.id])
    case 'area':
      return Boolean(state.areas[ref.id])
    case 'stock':
      return Boolean(state.stock[ref.id])
    case 'supplier':
      return Boolean(state.world.suppliers[ref.id])
    case 'faction':
      return Boolean(state.world.factions[ref.id])
    case 'regular':
      return Boolean(state.world.regulars[ref.id])
    case 'culture':
      return Boolean(state.world.cultures[ref.id])
    case 'notable_npc':
      return Boolean(state.world.notableNpcs[ref.id])
    case 'local_event':
      return Boolean(state.world.localEvents[ref.id])
    case 'rumour':
      return Boolean(state.world.socialRumours[ref.id])
    case 'tavern_identity':
      return state.meta.tavernId === ref.id
    case 'role':
    case 'system':
    case 'other':
      // System/role refs are by definition non-state; treat as resolved.
      return true
    default:
      return true
  }
}

const EXPANDED_FAMILY_SET: ReadonlySet<string> = new Set(
  EXPANDED_ISSUE_SEED_FAMILIES,
)

const EXPANDED_PRESSURE_FAMILY_REQUIREMENT: Record<string, string[]> = {
  staff_identity: ['staff_loyalty_risk', 'staff_burnout'],
  regular_customer: ['regular_customer_loss'],
  supplier_relationship: ['supplier_distrust', 'market_instability'],
  faction_request: ['faction_anger', 'cultural_tension'],
  culture_conflict: ['cultural_tension'],
  area_atmosphere: ['maintenance'],
  seasonal_arc: ['arc_escalation', 'festival_readiness'],
  policy_backlash: ['policy_backlash', 'faction_anger'],
  rumour_crisis: ['rumour_pressure', 'reputation_drift'],
  rival_tavern: ['rival_tavern_pressure'],
}

const FAMILIES_REQUIRING_MEMORY_OR_ATTRIBUTION: ReadonlySet<string> = new Set([
  'rumour_crisis',
  'supplier_relationship',
  'staff_identity',
  'regular_customer',
])

export type ExpandedSeedStateOptions = {
  state: TavernState
  strictTextBudget?: boolean
}

/** Phase 39 §39.16 — validation that requires live state.
 *
 * The pure `validateSeed` continues to check Phase 1 §4.10 conditions
 * without reading state (so tests can construct fixtures freely). This
 * function adds the expanded checks that need state: ref resolution,
 * matching pressure snapshots, attribution/memory backing, etc. */
export function validateSeedAgainstState(
  seed: IssueSeed,
  options: ExpandedSeedStateOptions,
): SeedValidation {
  const base = validateSeed(seed, options)
  if (!EXPANDED_FAMILY_SET.has(seed.family)) return base

  const { state } = options
  const errors = [...base.errors]
  const warnings = [...base.warnings]
  const contractChecks = { ...base.contractChecks }

  // 1. namedEntities refs resolve.
  const named = seed.textIngredients.namedEntities ?? []
  for (const entry of named) {
    if (!entityRefResolves(state, entry.ref)) {
      errors.push(`namedEntity ref ${entry.ref.kind}:${entry.ref.id} does not resolve`)
    }
  }
  // 2. primary/affected actor refs resolve.
  if (seed.primaryActor && !entityRefResolves(state, seed.primaryActor)) {
    errors.push(
      `primaryActor ${seed.primaryActor.kind}:${seed.primaryActor.id} does not resolve`,
    )
  }
  for (const actor of seed.affectedActors) {
    if (!entityRefResolves(state, actor)) {
      errors.push(`affectedActor ${actor.kind}:${actor.id} does not resolve`)
    }
  }
  // 3. matching pressure snapshot.
  const requiredPressures = EXPANDED_PRESSURE_FAMILY_REQUIREMENT[seed.family]
  if (requiredPressures && requiredPressures.length > 0) {
    const snapshotIds = new Set(seed.pressures.map((p) => p.id))
    const hasMatch = requiredPressures.some((p) => snapshotIds.has(p))
    if (!hasMatch) {
      errors.push(
        `Family ${seed.family} requires at least one of these pressure snapshots: ${requiredPressures.join(', ')}`,
      )
    }
  }
  // 4. memory/attribution requirement for relationship-driven families.
  if (FAMILIES_REQUIRING_MEMORY_OR_ATTRIBUTION.has(seed.family)) {
    const hasMemory =
      (seed.textIngredients.relevantMemories?.length ?? 0) > 0
    const hasBlame =
      (seed.textIngredients.perceivedBlame?.length ?? 0) > 0
    if (!hasMemory && !hasBlame) {
      errors.push(
        `Family ${seed.family} requires a memory or attribution ingredient`,
      )
    }
  }
  // 5. response slots targeting named entity kinds must resolve.
  for (const slot of seed.responseSlots) {
    for (const target of slot.targetOptions) {
      if (!entityRefResolves(state, target)) {
        errors.push(
          `Response slot ${slot.id} target ${target.kind}:${target.id} does not resolve`,
        )
      }
    }
  }
  // 6. seasonal_arc seeds must reference an active or recently-ended arc.
  if (seed.family === 'seasonal_arc') {
    const arcRef = seed.primaryActor
    if (arcRef) {
      const arc = state.world.localEvents[arcRef.id]
      if (!arc) {
        errors.push(`Seasonal arc seed references missing arc ${arcRef.id}`)
      } else if (
        arc.stage === 'resolved' ||
        arc.stage === 'failed'
      ) {
        // Allow if recently ended.
        const lastUpdated = arc.lastUpdatedDay ?? arc.startedDay
        const today = state.calendar.totalDaysElapsed
        if (today - lastUpdated > 7) {
          errors.push(
            `Seasonal arc seed references arc ${arcRef.id} resolved more than 7 days ago`,
          )
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    contractChecks,
  }
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
