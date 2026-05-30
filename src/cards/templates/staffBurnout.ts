// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel).
//
// Compositional template for the staff_burnout family. Replaces the
// legacy hand-written staffRequest template, which hand-glued a meter
// line ("morale 30, stress 80"), an actor opinion, and a context
// fragment through `composeBody` — no voice, no sim-backed claims, no
// specificity gradient.
//
// Body shape: [establishing_line, reaction_line, manner_note?].
//   - establishing_line (sim-backed, ≤14 words) states the situation
//     via signal bands, rising pressures, memory tags, repeat-count.
//   - reaction_line (flavor, ≤12 words) carries the staff member's
//     voiced reply via voice axes + verbal tics.
//   - manner_note (flavor, ≤10 words, optional) is a sensory beat.
//
// appliesTo matches the actual seed shape — `staff_burnout` /
// `staff_request` / `morning_prep`. The legacy template's
// `timings: ['closing']` never matched the real generator output
// (issueSeedGenerators.ts:1153 emits `timing: 'morning_prep'`), so
// staff_burnout seeds were falling through to the fallback card in
// production. The new template is the first card to actually handle
// the family.
//
// The `custom` predicate insists the resolved staff member has Phase-A
// `castAttributes` populated. Graceful degradation per framework §5,
// identical to staffAside.

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
  staffBurnoutChoiceLabelPool,
  staffBurnoutEffectPreviewPool,
  staffBurnoutEstablishingLinePool,
  staffBurnoutMannerNotePool,
  staffBurnoutReactionLinePool,
  staffBurnoutTitlePool,
} from '../compose/pools/staffBurnout'

export const staffBurnoutTemplate: CompositionalCardTemplate = {
  id: 'staff_burnout.staff_request',
  appliesTo: {
    seedFamilies: ['staff_burnout'],
    seedTypes: ['staff_request'],
    timings: ['morning_prep'],
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'staff') return false
      return state.staff[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 65,
  voiceRegister: 'staff_quarters',
  slots: [
    {
      id: 'title',
      role: 'title',
      pool: staffBurnoutTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    // Phase 150 / ISSUE-118 — Legible Surface arc, Phase 5 (Staff &
    // Personnel cluster). The staffBurnout card turns on stress ×
    // fatigue (plus the burnout/loyalty-risk pressures + the
    // bonus/workload/risk memory surface). `saliencePolicy: 'multi'`
    // lets the assembler tie-break top-specificity matches by salience
    // and append an orthogonal secondary fact when one resolves —
    // mirrors the supplier/stock/debt pattern from Phase 4.
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: staffBurnoutEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
      saliencePolicy: 'multi',
      multiFactJoin: ' — ',
    },
    {
      id: 'reaction_line',
      role: 'utterance',
      pool: staffBurnoutReactionLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: staffBurnoutMannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildStaffBurnoutTitle(filled, seed, state),
      body: buildStaffBurnoutBody(filled),
      stakes: buildStakes(seed, 2),
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: staffBurnoutChoiceLabelPool,
        previewPool: staffBurnoutEffectPreviewPool,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildStaffBurnoutTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const staff =
    ref && ref.kind === 'staff' ? state.staff[ref.id] : undefined
  const display =
    staff?.name.display ?? seed.textIngredients.subject ?? 'A staff member'
  const snippet = filled['title'] ?? 'a word before the day'
  return `${display}: ${snippet}`
}

function buildStaffBurnoutBody(filled: FilledSlots): string[] {
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const reaction = filled['reaction_line']
  if (reaction) lines.push(reaction)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const staffBurnoutCard: CardDefinition = defineCompositionalCard(
  staffBurnoutTemplate,
)
