// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
// Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7 (Staff & Personnel):
// added a sim-backed `establishing_line` slot before the flavor
// aside_line; deleted the textIngredients sensoryDetails grounding
// fallback that previously appended a raw sensory fragment as the
// body's last line ("the dangling fragment" the arc identified).
//
// The Phase A cast attributes on staff (`createStaffCastAttributes`)
// drive voice selection through the same `voiceAxis` / `verbalTic`
// conditions `drink_order` uses; no runtime change required. The Phase
// 7 establishing line reaches for staff signals (stress, fatigue),
// pressures (staff_burnout, staff_loyalty_risk), memories (identity,
// warning), and the rolling staff repeat-count.
//
// Why this template attaches to `staff_identity / relationship_test /
// morning_prep`:
//
//   - `staff_identity` is the seed family that puts an individual staff
//     member as `primaryActor` (see
//     `src/sim/modules/issues/expandedSeedGenerators.ts:810`). It carries
//     the loyalty-risk / publicly-blamed framing the body speaks into.
//   - `relationship_test` is the seed type the generator emits for this
//     family (lines 798–799). The `staff_burnout / staff_request /
//     morning_prep` slice is covered by the Phase-7 `staff_burnout`
//     compositional template; partition is clean — no overlap.
//   - `morning_prep` is the timing the generator pins (line 800). It's
//     the natural beat for "a staff member surfacing themselves before
//     the day opens." The `staff_quarters` voice register keeps
//     exemplars cleanly separate from the customer-facing
//     `tavern_floor` register used by `drink_order`.
//
// The `custom` predicate insists the resolved staff member has Phase-A
// `castAttributes` populated. Without them the voice conditions have
// nothing to read, so the template steps aside and the fallback renders
// — graceful degradation per framework §5, identical to `drink_order`.

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
  asideLinePool,
  mannerNotePool,
  staffAsideChoiceLabelPool,
  staffAsideEffectPreviewPool,
  staffAsideEstablishingLinePool,
  staffAsideTitlePool,
} from '../compose/pools/staffAside'

// Exported so the Phase D gate harness (and a future Phase E run against
// `specs/cards/staff_aside.spec.yaml`) can run structural checks against
// the template's slots + pools directly. `defineCompositionalCard` only
// returns a `CardDefinition`; the gates work on `CompositionalCardTemplate`.
export const staffAsideTemplate: CompositionalCardTemplate = {
  id: 'staff_identity.staff_aside',
  appliesTo: {
    seedFamilies: ['staff_identity'],
    seedTypes: ['relationship_test'],
    timings: ['morning_prep'],
    // Only fire when the staff member we'd be voicing actually has
    // Phase-A attributes. New saves carry them; pre-Phase-A saves
    // migrate via `ensureCastAttributes`. The predicate keeps the
    // template safe regardless.
    custom: (seed, state) => {
      const ref = seed.primaryActor
      if (!ref || ref.kind !== 'staff') return false
      return state.staff[ref.id]?.castAttributes !== undefined
    },
  },
  priority: 60,
  voiceRegister: 'staff_quarters',
  slots: [
    // Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5. Title is a
    // composed slot with its own pool + 6-word budget. Template glue
    // prepends the staff display name without clamping; the
    // voice-bounds gate forbids trailing "…" so titles never truncate.
    {
      id: 'title',
      role: 'title',
      pool: staffAsideTitlePool,
      wordBudget: 6,
      claimMode: 'flavor',
    },
    // Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7. Sim-backed
    // establishing line that STATES the staff situation. Lands before
    // the voiced aside_line so the body reads "what happened" then
    // "what they feel about it" — the Phase-3 supplier_reliability
    // pattern, now for staff.
    {
      id: 'establishing_line',
      role: 'utterance',
      pool: staffAsideEstablishingLinePool,
      wordBudget: 14,
      claimMode: 'sim_backed',
    },
    // Per-slot budgets are the source of truth; the Phase D voice-bounds
    // gate enforces them from this data, not from prose comments.
    {
      id: 'aside_line',
      role: 'utterance',
      pool: asideLinePool,
      wordBudget: 12,
      claimMode: 'flavor',
    },
    {
      id: 'manner_note',
      role: 'aside',
      pool: mannerNotePool,
      optional: true,
      wordBudget: 10,
      claimMode: 'flavor',
    },
  ],
  toCardView: (filled, seed, state) => {
    return makeCardView({
      title: buildStaffAsideTitle(filled, seed, state),
      body: buildStaffAsideBody(filled),
      stakes: buildStakes(seed, 2),
      // Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6. Choice
      // labels and effect-preview lines are composed through the
      // snippet pipeline. Mechanical fields (verb/targetId/shape and
      // per-effect kind/target/amount/tags) stay sourced from the seed.
      choices: composeChoicesFromSeed(seed, state, {
        labelPool: staffAsideChoiceLabelPool,
        previewPool: staffAsideEffectPreviewPool,
        maxPreview: 2,
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}

function buildStaffAsideTitle(
  filled: FilledSlots,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = seed.primaryActor
  const staff =
    ref && ref.kind === 'staff' ? state.staff[ref.id] : undefined
  const display = staff?.name.display ?? seed.textIngredients.subject ?? 'A staff member'
  const snippet = filled['title'] ?? 'a word before opening'
  return `${display}: ${snippet}`
}

function buildStaffAsideBody(filled: FilledSlots): string[] {
  // Phase 133 / ISSUE-102 — Voiced Surface arc, Phase 7. Body is now
  // [establishing_line, aside_line, manner_note?] — three composed
  // slots, three voiced lines. The previous textIngredients
  // sensoryDetails grounding fallback is gone; the sim-backed
  // establishing_line carries the moment, the aside_line carries the
  // voice, and the optional manner_note carries the sensory beat.
  const lines: string[] = []
  const establishing = filled['establishing_line']
  if (establishing) lines.push(establishing)
  const aside = filled['aside_line']
  if (aside) lines.push(aside)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  return lines.slice(0, 3)
}

export const staffAsideCard: CardDefinition = defineCompositionalCard(
  staffAsideTemplate,
)
