// Phase 126 / ISSUE-095 — Living Cast arc, Phase F (first situation).
//
// The second live compositional card and the first scale-out beyond the
// `drink_order` spike. Wires a `staff_aside` template through
// `defineCompositionalCard` so a staff_identity / relationship_test /
// morning_prep seed renders a voiced staff aside instead of falling
// through to the generic fallback card. The Phase A cast attributes on
// staff (`createStaffCastAttributes`) drive the voice selection through
// the same `voiceAxis` / `verbalTic` conditions `drink_order` uses; no
// runtime change required.
//
// Why this template attaches to `staff_identity / relationship_test /
// morning_prep`:
//
//   - `staff_identity` is the seed family that puts an individual staff
//     member as `primaryActor` (see
//     `src/sim/modules/issues/expandedSeedGenerators.ts:810`). It carries
//     the loyalty-risk / publicly-blamed framing the aside speaks into.
//   - `relationship_test` is the seed type the generator emits for this
//     family (lines 798–799). The hand-written `staffRequest` card only
//     covers `staff_request` and `complaint`, so this type currently
//     falls through to the fallback.
//   - `morning_prep` is the timing the generator pins (line 800). It's
//     the natural beat for "a staff member surfacing themselves before
//     the day opens." A new voice register — `staff_quarters` — keeps
//     these exemplars cleanly separate from the customer-facing
//     `tavern_floor` register used by `drink_order`.
//
// The `custom` predicate insists the resolved staff member has Phase-A
// `castAttributes` populated. Without them the voice conditions have
// nothing to read, so the template steps aside and the fallback renders
// — graceful degradation per framework §5, identical to `drink_order`.

import {
  buildChoicesFromSeed,
  buildStakes,
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
      body: buildStaffAsideBody(filled, seed),
      stakes: buildStakes(seed, 2),
      choices: buildChoicesFromSeed(seed, {
        overrides: () => ({ maxPreview: 2 }),
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

function buildStaffAsideBody(filled: FilledSlots, seed: IssueSeed): string[] {
  const lines: string[] = []
  const aside = filled['aside_line']
  if (aside) lines.push(aside)
  const manner = filled['manner_note']
  if (manner) lines.push(manner)
  // Ground the voiced beat in a sim ingredient — sensoryDetails first,
  // then recentContext, then socialContext. Mirrors `drinkOrderCard`'s
  // grounding pattern: the voice line carries the actor; the ingredient
  // carries the moment.
  const grounding =
    seed.textIngredients.sensoryDetails[0] ??
    seed.textIngredients.recentContext[0] ??
    seed.textIngredients.socialContext?.[0]
  if (grounding) lines.push(grounding)
  return lines.slice(0, 3)
}

export const staffAsideCard: CardDefinition = defineCompositionalCard(
  staffAsideTemplate,
)
