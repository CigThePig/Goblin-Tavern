import type { SimContext } from '../../../core/context'
import type { EntityRef } from '../../../state/TavernState'
import type { PressureCalculationResult, PressureCauseRef } from '../pressureTypes'

import {
  combineToValue,
  pushCause,
  severityFromValue,
  urgencyFromSeverity,
} from './helpers'
import { getAttributions, totalMemoryStrengthByTags } from './expandedHelpers'

// Phase 38 §38.11 — Rumour pressure.
//
// Phase 206 / audit Wave 7 — recalibrated against the post-decay rumour
// regime. The original 0.3/0.2 slopes were set when nothing decayed
// rumour strength, so any sustained run pinned the meter at 100 (all 360
// balance-sweep cells peaked AND ended there — a meter with no signal).
// With `RUMOUR_DAILY_RETENTION` the live total now settles around
// 250–400 strength between weekly community passes; at 0.15/0.1 that
// reads mid-band (~50–75) on a neglected tavern, spikes toward the
// ceiling on a genuinely rumour-swamped one, and leaves managed routes
// measurably lower — which is what a meter is for.

const RUMOUR_PER_STRENGTH = 0.15
const FALSE_RUMOUR_BONUS = 0.1
const PUBLIC_ATTRIBUTION_DIVISOR = 12
const FALSE_BLAME_MEMORY_DIVISOR = 10
const REPUTATION_DRIFT_DIVISOR = 10
const FACTION_ANGER_DIVISOR = 12

export function calculateRumourPressure(
  ctx: SimContext,
): PressureCalculationResult {
  const causes: PressureCauseRef[] = []

  // Social rumours.
  //
  // Expansion Phase 8 §8.4 — weighted by how much the town CREDITS each
  // story, not just how often it is repeated. Before §8.4 a rumour had only
  // a strength, so volume was the only thing pressure could read; now a
  // story carries a credibility that rises when it is confirmed from two
  // directions and falls when it is denied, countered, contradicted or
  // traced back to its source. A loud story nobody believes should not press
  // on the house as hard as a quiet one everybody does — and it is what
  // makes the three rumour owner actions move this meter honestly, by
  // changing what people credit rather than by deducting points.
  let totalStrength = 0
  let falseStrength = 0
  // A fond name is recognition, not a scandal to suppress. Unflattering
  // nicknames still contribute; established positive identity must not create
  // false-accusation pressure merely because three names are repeated.
  const pressingRumours = Object.values(ctx.state.world.socialRumours).filter(r =>
    !r.tags.includes('earned_nickname') || r.tags.includes('identity:an unfussy floor') || r.tags.includes('identity:a rough edge') || r.accuracy === 'false' || r.accuracy === 'partial',
  )
  for (const rumour of pressingRumours) {
    const credited = (rumour.strength * (rumour.credibility ?? 50)) / 100
    totalStrength += credited
    if (rumour.accuracy === 'false' || rumour.accuracy === 'partial') {
      falseStrength += credited
    }
  }
  if (totalStrength > 0) {
    pushCause(causes, {
      id: 'active_rumours',
      readable: `Active rumours, weighted by belief, total ${Math.round(totalStrength)}.`,
      amount: Math.round(totalStrength * RUMOUR_PER_STRENGTH),
      tags: ['rumour'],
      relatedSystems: ['rumours'],
    })
  }

  // Per-rumour causes for the strongest few, so the calculator carries
  // named actor refs (the rumour itself plus its subject) into the audit.
  //
  // Phase 206 / audit Wave 7 — amount 0: these rumours' strength is
  // already inside `active_rumours` above, and giving the named entries
  // an amount as well counted the loudest rumours twice (up to ~30 extra
  // points at the old slope). The entries stay for their actor refs and
  // readable lines; `weight` keeps them ranked in cause displays.
  const sortedRumours = pressingRumours
    .filter((r) => r.strength >= 30)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
  for (const rumour of sortedRumours) {
    const actors: EntityRef[] = [{ kind: 'rumour', id: rumour.id }]
    if (rumour.subject) actors.push(rumour.subject)
    pushCause(causes, {
      id: `rumour_${rumour.id}`,
      readable: `${rumour.label} circulating (strength ${Math.round(rumour.strength)}, credited ${rumour.credibility ?? 50}).`,
      amount: 0,
      weight: Math.round(
        ((rumour.strength * (rumour.credibility ?? 50)) / 100) *
          RUMOUR_PER_STRENGTH,
      ),
      tags: ['rumour', ...rumour.tags],
      relatedActors: actors,
      relatedSystems: ['rumours'],
    })
  }

  if (falseStrength >= 20) {
    pushCause(causes, {
      id: 'false_rumours',
      readable: `False or partial rumours circulating (strength ${Math.round(falseStrength)}).`,
      amount: Math.round(falseStrength * FALSE_RUMOUR_BONUS),
      tags: ['rumour', 'false'],
      relatedSystems: ['rumours'],
    })
  }

  // Highly public attributions amplify rumours.
  let publicAttributionScore = 0
  for (const attribution of getAttributions(ctx.state)) {
    if (attribution.publicness >= 60) {
      publicAttributionScore += (attribution.publicness * attribution.strength) / 100
    }
  }
  if (publicAttributionScore >= 30) {
    pushCause(causes, {
      id: 'public_attributions',
      readable: `Highly public attributions (strength ${Math.round(publicAttributionScore)}).`,
      amount: Math.round(publicAttributionScore / PUBLIC_ATTRIBUTION_DIVISOR),
      tags: ['attribution', 'public'],
      relatedSystems: ['attribution'],
    })
  }

  // False blame memories.
  const falseBlame = totalMemoryStrengthByTags(ctx, ['false_blame'])
  if (falseBlame >= 25) {
    pushCause(causes, {
      id: 'false_blame_memories',
      readable: `False-blame memories (strength ${Math.round(falseBlame)}).`,
      amount: Math.round(falseBlame / FALSE_BLAME_MEMORY_DIVISOR),
      tags: ['memory', 'false_blame'],
      relatedSystems: ['memories'],
    })
  }

  // Reputation drift and faction anger amplify.
  const repDrift = ctx.state.pressures['reputation_drift']
  if (repDrift && repDrift.value >= 35) {
    pushCause(causes, {
      id: 'rep_drift_amplifies',
      readable: `Reputation drift (${repDrift.value}) makes rumours stick.`,
      amount: Math.round(repDrift.value / REPUTATION_DRIFT_DIVISOR),
      tags: ['reputation', 'web'],
      relatedSystems: ['reputation', 'pressures'],
    })
  }
  const factionAnger = ctx.state.pressures['faction_anger']
  if (factionAnger && factionAnger.value >= 30) {
    pushCause(causes, {
      id: 'faction_anger_amplifies',
      readable: `Faction anger (${factionAnger.value}) seeds rumours.`,
      amount: Math.round(factionAnger.value / FACTION_ANGER_DIVISOR),
      tags: ['faction', 'web'],
      relatedSystems: ['factions', 'pressures'],
    })
  }

  const value = combineToValue(0, causes)
  const severity = severityFromValue(value)
  const urgency = urgencyFromSeverity(severity)

  return {
    value,
    severity,
    urgency,
    causes,
    relatedSystems: ['rumours', 'attribution', 'memories'],
    tags: ['rumour', 'social'],
    consequences:
      severity >= 40
        ? [
            'Reputation shift seeds become likely.',
            'False accusation seeds may appear.',
            'Apology / social-action response slots open up.',
          ]
        : [],
  }
}
