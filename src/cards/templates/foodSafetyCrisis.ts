// Phase 138 / ISSUE-107 — Voiced Surface arc, Phase 12 (Crises & Safety).
//
// Compositional template for the food_safety family (crisis type).
// Rewrites in place the legacy hand-written `foodSafetyCrisis`
// template, which built the body by concatenating
// `ti.sensoryDetails[0]`, `ti.recentContext[0]`, and
// `ti.stakesReadable[0]` through the Phase-95 `composeBody` and
// prepended a deterministic `pickSeverityAdjective` to the title —
// the high-severity fragment-dump-with-adjective-glue pattern the arc
// was built to retire.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via `signalEquals area.cleanliness|area.damage` on the kitchen
//     (resolved via the seed's `seed.location: areaRef('kitchen')` and
//     the Phase-11 `'location'` role), `signalEquals staff.stress|staff.fatigue`
//     on the cook, rising `food_safety` pressure, prior-choice memories
//     (warning / discarded / cleaned / served-questionable),
//     `repeatCount food_safety`, and `severityAtLeast` bands (70 and a
//     Phase-12 ceiling at 85 — "unsafe to serve from").
//   - reaction_line (flavor, ≤12 words) carries the cook's voiced
//     reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape — `food_safety` / `crisis` /
// `morning_prep` at `issueSeedGenerators.ts:323-327`. The legacy
// template's `timings: ['during_service']` mismatched the generator's
// emit timing (morning_prep), so the card was being rejected by the
// timing filter and falling through to `fallbackCard`; Phase 12
// aligns the template to what the generator emits.
//
// The `custom` predicate insists the resolved cook has Phase-A
// `castAttributes` populated. Graceful degradation per framework §5,
// identical to staffBurnout / staffAside / factionRequest.

import {
  buildStakes,
  composeChoicesFromSeed,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'
import { defineCompositionalCard } from '../compose/defineCompositionalCard'
import type {
  CompositionalCardTemplate,
  FilledSlots,
} from '../compose/types'
import type { IssueSeed } from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import {
  foodSafetyChoiceLabelPool,
  foodSafetyEffectPreviewPool,
  foodSafetyEstablishingLinePool,
  foodSafetyMannerNotePool,
  foodSafetyReactionLinePool,
  foodSafetyTitlePool,
} from '../compose/pools/foodSafety'

export const foodSafetyCrisisTemplate: CompositionalCardTemplate = {
  id: 'food_safety.crisis',
  appliesTo: {
    seedFamilies: ['food_safety'],
    seedTypes: ['crisis'],
    timings: ['morning_prep'],
    minSeverity: 60,
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'staff') return false
      return state.staff[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 80,
  voiceRegister: 'back_of_house',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: foodSafetyTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: foodSafetyEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: foodSafetyReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: foodSafetyMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildFoodSafetyTitle(filled, seed, state),
      body: buildFoodSafetyBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: foodSafetyChoiceLabelPool,
        previewPool: foodSafetyEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildFoodSafetyTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const staff =
    ref && ref.kind === 'staff' ? state.staff[ref.id] : undefined
  const display =
    staff?.name.display ?? seed.textIngredients.subject ?? 'The cook'
  const snippet = filled['title'] ?? 'a kitchen worry'
  return `${display}: ${snippet}`
}

function buildFoodSafetyBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const foodSafetyCrisisCard: CardDefinition = defineCompositionalCard(
  foodSafetyCrisisTemplate,
)
