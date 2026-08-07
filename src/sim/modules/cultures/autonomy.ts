import type { SimContext } from '../../core/context'
import type { CustomerGroupState, TavernState } from '../../state/TavernState'
import { clampPercent } from '../../state/normalize'
import { cultureRegistry } from '../../content/cultures/cultureRegistry'

import {
  MAX_LEARNED_TAGS,
  bumpCultureTotal,
  cultureNet,
  getCultureModuleState,
  writeCultureSlice,
} from './cultureState'
import { recipeTags } from './serviceEvidence'
import { accommodationRate } from './standing'

// Expansion Phase 8 §8.2 — what a culture DOES about how it has been treated.
//
// §8.2 is explicit that this must not be faction behaviour: "Cultures need
// not behave like political factions. Their autonomous effects can occur
// through group attendance, preference shifts, recommendations, event
// organization, and community response." A culture has no budget, no action
// set and no intent — it is a population, not an actor, and what it does is
// what populations do: turn up or stay home, change what they order, tell
// people, and drift together.
//
// Three effects live here, and each is read by the domain that owns the
// thing it changes rather than being applied from here:
//
//   attendance      → `customerInfluence.ts`, read by the customers module's
//                     own forecast rule
//   preference      → the culture's own learned tag lists, read back by the
//                     service evidence pass and by the choice scorer
//   recommendation  → the customer group's patronage, which is the
//                     population this culture is a description of
//
// The fourth, community response, is the misunderstanding loop in
// `standing.ts`: a slighted culture withholds until the house makes amends.

const SOURCE = 'cultures.autonomy'

/**
 * How much a recommendation moves a group's standing population in a week.
 *
 * Asymmetric, and deliberately so. A culture warning people off drifts the
 * population down by one; a culture recommending the place brings two.
 * Patronage feeds the forecast's BASE term directly, so a symmetric step
 * compounded into an 11% traffic loss across a passive month — the culture
 * layer quietly becoming the largest single demand input in the game. One
 * down, two up keeps word of mouth a real force without letting neglect
 * alone empty the room, and leaves the upside worth playing for.
 */
const PATRONAGE_STEP_UP = 2
const PATRONAGE_STEP_DOWN = 1

/** Servings of one dish before a culture forms an opinion about it here. */
const PREFERENCE_SHIFT_THRESHOLD = 8

/**
 * A culture that has been looked after tells people; one that has not warns
 * them off.
 *
 * The effect lands on `patronage` — the size of the standing population that
 * considers this house at all — rather than on tonight's turnout, because a
 * recommendation is about next week, not this evening. Turnout is the
 * forecast's business and is handled separately.
 */
export function applyRecommendations(ctx: SimContext): void {
  const state = ctx.state
  // Word of mouth is a WEEK's worth of talking, not a daily nudge. Run daily
  // it moved five groups' patronage every single day, which swamped every
  // other demand input; once a week it is a trend the player can notice and
  // answer. Tied to the calendar rather than a counter so a reload cannot
  // hand a culture a second turn at it.
  if (state.calendar.dayOfWeek !== 1) return
  for (const groupId of Object.keys(state.customerGroups).sort()) {
    const group = state.customerGroups[groupId]!
    const culture = state.world.cultures[group.cultureId]
    if (!culture) continue

    const net = cultureNet(state, culture.id)
    const trust = culture.trust ?? 50
    // Word of mouth needs BOTH a settled opinion and enough familiarity to
    // have an opinion worth passing on. A culture that has barely been here
    // has nothing to tell anybody.
    if (culture.familiarity < 30) continue
    const direction = net >= 25 && trust >= 60 ? 1 : net <= -25 && trust <= 40 ? -1 : 0
    if (direction === 0) continue

    const step = direction > 0 ? PATRONAGE_STEP_UP : PATRONAGE_STEP_DOWN
    const next = clampPercent(group.patronage + direction * step)
    if (next === group.patronage) continue

    ctx.modifyCustomerGroup(
      group.id,
      { patronage: next },
      {
        source: `${SOURCE}.recommendation`,
        sourceType: 'culture',
        target: `customer_group:${group.id}.patronage`,
        targetType: 'customer',
        amount: next - group.patronage,
        readable:
          direction > 0
            ? `${culture.label} have been telling people about this place (patronage ${group.patronage} → ${next}).`
            : `${culture.label} have been warning people off (patronage ${group.patronage} → ${next}).`,
        tags: ['culture', 'recommendation', culture.id, group.id],
        relatedActors: [
          { kind: 'culture', id: culture.id },
          { kind: 'customer_group', id: group.id },
        ],
        relatedSystems: ['cultures', 'customers'],
      },
    )
    bumpCultureTotal(ctx, 'recommendationsMade')
  }
}

/**
 * A culture's taste shifts toward what it has actually enjoyed here.
 *
 * §8.2 lists preference shifts as an autonomous effect, and this is the one
 * place in the arc where a culture's own definition stops being the last
 * word: eight good servings of something and they come to expect it here,
 * eight bad ones and they learn to avoid it. The learned tags are read back
 * by the service evidence pass, so the shift compounds — which is what makes
 * a house style something a population can acquire.
 */
export function applyPreferenceShifts(ctx: SimContext): void {
  const state = ctx.state
  const slice = getCultureModuleState(state)

  for (const cultureId of Object.keys(state.world.cultures).sort()) {
    const standing = slice.standing[cultureId]
    if (!standing) continue
    const def = cultureRegistry.get(cultureId)
    if (!def) continue

    const learnedPreferences = new Set(standing.learnedPreferences)
    const learnedDislikes = new Set(standing.learnedDislikes)
    const declaredPreferred = new Set(def.preferredStockTags)
    const declaredDisliked = new Set(def.dislikedTags)
    let changed = false

    for (const [recipeId, experience] of [...Object.entries(standing.dishExperience)].sort(
      (a, b) => a[0].localeCompare(b[0]),
    )) {
      if (experience.served < PREFERENCE_SHIFT_THRESHOLD) continue
      const tags = recipeTags(recipeId).filter(
        (tag) => !declaredPreferred.has(tag) && !declaredDisliked.has(tag),
      )
      if (tags.length === 0) continue

      // A dish they have had a lot of and never took offence at becomes
      // something they look for; one that keeps arriving wrong does not.
      const positive = experience.taboo === 0 && experience.delight > 0
      const negative = experience.taboo > experience.delight

      for (const tag of tags) {
        if (positive && !learnedPreferences.has(tag) && learnedPreferences.size < MAX_LEARNED_TAGS) {
          learnedPreferences.add(tag)
          learnedDislikes.delete(tag)
          changed = true
        } else if (
          negative &&
          !learnedDislikes.has(tag) &&
          learnedDislikes.size < MAX_LEARNED_TAGS
        ) {
          learnedDislikes.add(tag)
          learnedPreferences.delete(tag)
          changed = true
        }
      }
    }

    if (!changed) continue
    const culture = state.world.cultures[cultureId]!
    writeCultureSlice(
      ctx,
      (current) => {
        const live = current.standing[cultureId]
        if (!live) return current
        return {
          ...current,
          standing: {
            ...current.standing,
            [cultureId]: {
              ...live,
              learnedPreferences: [...learnedPreferences].sort(),
              learnedDislikes: [...learnedDislikes].sort(),
            },
          },
        }
      },
      'preference_shift',
    )
    bumpCultureTotal(ctx, 'preferenceShifts')
    ctx.addLog(
      {
        message: `${culture.label} have got used to what this house serves.`,
        level: 'info',
        data: {
          cultureId,
          learnedPreferences: [...learnedPreferences],
          learnedDislikes: [...learnedDislikes],
        },
      },
      'cultures',
    )
  }
}

/** Everything a culture has learned to look for here. Read by the choice scorer. */
export function culturePreferredTags(
  state: TavernState,
  cultureId: string,
): string[] {
  const culture = state.world.cultures[cultureId]
  if (!culture) return []
  const standing = getCultureModuleState(state).standing[cultureId]
  return [...culture.preferredStockTags, ...(standing?.learnedPreferences ?? [])]
}

/** Everything a culture has learned to avoid here. */
export function cultureDislikedTags(
  state: TavernState,
  cultureId: string,
): string[] {
  const culture = state.world.cultures[cultureId]
  if (!culture) return []
  const standing = getCultureModuleState(state).standing[cultureId]
  return [...culture.dislikedTags, ...(standing?.learnedDislikes ?? [])]
}

/** How willing this culture is to come at all, as a 0..1 reading. */
export function cultureWillingness(
  state: TavernState,
  group: CustomerGroupState,
): number {
  const culture = state.world.cultures[group.cultureId]
  if (!culture) return 0.5
  const trust = culture.trust ?? 50
  const comfort = culture.comfort
  const accommodation = accommodationRate(state, culture.id)
  const raw = trust / 200 + comfort / 300 + accommodation * 0.25
  return Math.max(0, Math.min(1, Math.round(raw * 100) / 100))
}
