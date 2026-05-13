import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import {
  hasCalendarTag,
  memoryStrengthForOwnerByTags,
  totalMemoryStrengthByTags,
} from './expandedHelpers'
import { ownerPolicies } from './expandedHelpers'

// Phase 38 §38.7 — Cultural tension pressure.

const CULTURE_TENSION_PER_CULTURE = 0.4
const CONFLICTING_GROUPS_PRESENT = 8
const CULTURAL_OBSERVANCE_IGNORED = 10
const TABOO_MEMORY_DIVISOR = 10
const FRICTION_POLICY_RELIEF = -8
const FACTION_ANGER_DIVISOR = 12

export function calculateCulturalTension(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []
  const relatedActors: EntityRef[] = []
  const seen = new Set<string>()
  const pushActor = (ref: EntityRef) => {
    const key = `${ref.kind}:${ref.id}`
    if (seen.has(key)) return
    seen.add(key)
    relatedActors.push(ref)
  }

  const cultures = Object.values(ctx.state.world.cultures)
  if (cultures.length > 0) {
    let tensionSum = 0
    for (const culture of cultures) tensionSum += culture.tension
    const avg = tensionSum / cultures.length
    if (avg >= 25) {
      pushCause(causes, {
        id: 'avg_cultural_tension',
        readable: `Average culture tension ${Math.round(avg)}.`,
        amount: Math.round(avg * CULTURE_TENSION_PER_CULTURE),
        tags: ['culture'],
        relatedSystems: ['cultures'],
      })
    }
  }

  // Conflicting customer groups co-present.
  const groups = Object.values(ctx.state.customerGroups)
  let conflictPairs = 0
  for (let i = 0; i < groups.length; i += 1) {
    const a = groups[i]!
    if (a.patronage < 25) continue
    const relMap = (a as { relationshipToOtherGroups?: Record<string, number> }).relationshipToOtherGroups
    if (!relMap) continue
    for (let j = i + 1; j < groups.length; j += 1) {
      const b = groups[j]!
      if (b.patronage < 25) continue
      const rel = relMap[b.id]
      if (rel !== undefined && rel <= -30) {
        conflictPairs += 1
        pushActor({ kind: 'customer_group', id: a.id })
        pushActor({ kind: 'customer_group', id: b.id })
      }
    }
  }
  if (conflictPairs > 0) {
    pushCause(causes, {
      id: 'conflicting_groups_present',
      readable: `${conflictPairs} hostile customer-group pair(s) co-present.`,
      amount: CONFLICTING_GROUPS_PRESENT * conflictPairs,
      tags: ['customers', 'conflict'],
      relatedActors: [...relatedActors],
      relatedSystems: ['customers', 'cultures'],
    })
  }

  // Cultural observance ignored: an importantCalendarTag is present but no
  // matching policy/project response.
  let ignoredObservances = 0
  for (const culture of cultures) {
    for (const tag of culture.importantCalendarTags) {
      if (hasCalendarTag(ctx.state, tag)) {
        ignoredObservances += 1
      }
    }
  }
  if (ignoredObservances > 0) {
    pushCause(causes, {
      id: 'observance_ignored',
      readable: `${ignoredObservances} cultural observance tag(s) active today.`,
      amount: CULTURAL_OBSERVANCE_IGNORED,
      tags: ['culture', 'calendar'],
      relatedSystems: ['cultures', 'calendar'],
    })
  }

  // Cultural misunderstanding / seating / food taboo memories.
  const tabooMemStrength =
    totalMemoryStrengthByTags(ctx, ['cultural_misunderstanding']) +
    totalMemoryStrengthByTags(ctx, ['seating_conflict']) +
    totalMemoryStrengthByTags(ctx, ['food_taboo'])
  if (tabooMemStrength >= 25) {
    pushCause(causes, {
      id: 'taboo_memory',
      readable: `Cultural taboo/conflict memories (strength ${Math.round(tabooMemStrength)}).`,
      amount: Math.round(tabooMemStrength / TABOO_MEMORY_DIVISOR),
      tags: ['culture', 'memory'],
      relatedSystems: ['cultures', 'memories'],
    })
  }

  // Friction-reducing policy/project relief.
  let frictionReducingPolicies = 0
  for (const policy of Object.values(ownerPolicies(ctx.state))) {
    if (!policy.enabled) continue
    if (
      policy.tags.includes('cultural_accommodation') ||
      policy.tags.includes('seating') ||
      policy.tags.includes('friction_reduction')
    ) {
      frictionReducingPolicies += 1
    }
  }
  if (frictionReducingPolicies > 0) {
    pushCause(causes, {
      id: 'friction_policy_relief',
      readable: `${frictionReducingPolicies} friction-reducing policy/policies active.`,
      amount: FRICTION_POLICY_RELIEF * frictionReducingPolicies,
      tags: ['policy', 'relief'],
      relatedSystems: ['policies', 'cultures'],
    })
  }

  // Faction anger bleed-in.
  const factionAnger = ctx.state.pressures['faction_anger']
  if (factionAnger && factionAnger.value >= 35) {
    pushCause(causes, {
      id: 'faction_anger_bleed',
      readable: `Faction anger (${factionAnger.value}) bleeds into cultural tension.`,
      amount: Math.round(factionAnger.value / FACTION_ANGER_DIVISOR),
      tags: ['faction', 'web'],
      relatedSystems: ['factions', 'pressures'],
    })
  }

  // Per-culture grudge memories.
  for (const culture of cultures) {
    const ref: EntityRef = { kind: 'culture', id: culture.id }
    const grudge = memoryStrengthForOwnerByTags(ctx, ref, ['grudge'])
    if (grudge >= 25) {
      pushActor(ref)
      pushCause(causes, {
        id: `culture_grudge_${culture.id}`,
        readable: `${culture.label} carries cultural grudges (strength ${Math.round(grudge)}).`,
        amount: Math.round(grudge / TABOO_MEMORY_DIVISOR),
        tags: ['culture', 'grudge'],
        relatedActors: [ref],
        relatedSystems: ['cultures', 'memories'],
      })
    }
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedActors,
    relatedSystems: ['cultures', 'customers', 'memories', 'policies'],
    tags: ['culture', 'social'],
    consequences:
      severity >= 50
        ? [
            'Cultural misunderstanding seeds become more likely.',
            'Seating preference conflicts.',
            'Festival request seeds may follow.',
            'Faction anger may rise.',
            'Violence risk may rise.',
          ]
        : [],
  }
}
