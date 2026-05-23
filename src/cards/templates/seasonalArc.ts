// Phase 140 / ISSUE-109 — Voiced Surface arc, Phase 14 (Periodic & Narrative Beats).
//
// Compositional template for the seasonal_arc family. First dedicated
// card for the family — pre-Phase 14, every seasonal_arc seed (both
// `arc_milestone` and `festival_preparation` types, both active-arc
// Path A and anticipation Path B at `expandedSeedGenerators.ts:4285`)
// rendered through `fallbackCard`.
//
// Single template covers BOTH paths and BOTH types — the seed's
// primaryActor is either a `local_event` ref (Path A, active arc) or
// `undefined` (Path B, anticipation). `local_event` refs carry no
// `castAttributes`, so the template renders in a NARRATOR-VOICED
// register: every snippet pool is free of voiceAxis / verbalTic
// conditions, and variety comes from theme tags (5 themes already in
// `seed.toneHints`), the two arc pressures, prior-arc memories, and
// severity bands.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via `pressureRising arc_escalation|festival_readiness`, theme tags
//     paired with an arc-pressure co-condition (themes are seed-shape,
//     not state-lookup — same pattern as `cultureConflict` and
//     `reputationShift`), `seedType arc_milestone` for the climax rung,
//     `memoryPresent arc|festival` for prior arc choices, and
//     `severityAtLeast`.
//   - reaction_line (flavor, ≤12 words).
//   - manner_note (flavor, ≤10 words, optional).
//
// Title is `${arcLabel ?? themeLabel ?? 'Seasonal event'}: ${snippet}`
// — for Path A, `state.world.localEvents[ref.id]?.label` supplies the
// arc's label; for Path B (no primaryActor) the theme name in
// `seed.toneHints[2]` is title-cased; the literal `'Seasonal event'`
// catches malformed seeds. Mirrors the `rivalTavern.ts:109-122` title
// pattern.
//
// Voice register `civic_floor` — populace / world-event framing
// matching `cultureConflict`'s register for population-wide beats.

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
  seasonalArcChoiceLabelPool,
  seasonalArcEffectPreviewPool,
  seasonalArcEstablishingLinePool,
  seasonalArcMannerNotePool,
  seasonalArcReactionLinePool,
  seasonalArcTitlePool,
} from '../compose/pools/seasonalArc'

const SEASONAL_ARC_THEME_LABELS: Record<string, string> = {
  mushroom_blight: 'Mushroom blight',
  miner_payday_boom: 'Miner payday',
  inspection_campaign: 'Inspection sweep',
  rival_tavern_expansion: 'Rival expansion',
  festival_approaching: 'Festival approaching',
}

export const seasonalArcTemplate: CompositionalCardTemplate = {
  id: 'seasonal_arc.arc_milestone',
  appliesTo: {
    seedFamilies: ['seasonal_arc'],
    seedTypes: ['arc_milestone', 'festival_preparation'],
    timings: ['morning_prep'],
  },
  priority: 70,
  voiceRegister: 'civic_floor',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: seasonalArcTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: seasonalArcEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: seasonalArcReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: seasonalArcMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildSeasonalArcTitle(filled, seed, state),
      body: buildSeasonalArcBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: seasonalArcChoiceLabelPool,
        previewPool: seasonalArcEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildSeasonalArcTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const arcLabel =
    ref && ref.kind === 'local_event'
      ? state.world.localEvents[ref.id]?.label
      : undefined
  // The seasonal_arc generator emits toneHints as ['arc', 'calendar', theme]
  // (`expandedSeedGenerators.ts:4473`); the theme is the index-2 entry.
  const theme = seed.toneHints[2]
  const themeLabel =
    theme && SEASONAL_ARC_THEME_LABELS[theme]
      ? SEASONAL_ARC_THEME_LABELS[theme]
      : undefined
  const display = arcLabel ?? themeLabel ?? 'Seasonal event'
  const snippet = filled['title'] ?? 'a shape settles on the calendar'
  return `${display}: ${snippet}`
}

function buildSeasonalArcBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const seasonalArcCard: CardDefinition = defineCompositionalCard(
  seasonalArcTemplate,
)
