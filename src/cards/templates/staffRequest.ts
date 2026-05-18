// Staff request template — a personnel ask. Names the staff member via
// state lookup (not the ingredient), surfaces a morale/stress meter line
// so the player sees why the ask is happening. Mirrors cards-contract §7
// Template 5.
//
// Phase 95 — Voice pass.

import {
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  makeCardView,
} from '../cardHelpers'
import { composeBody, composeTitle, type ComposeOpts } from '../voice/index'
import type { CardDefinition } from '../types'

const DEFINITION_TONES = ['internal', 'personal', 'staff'] as const

export const staffRequestCard: CardDefinition = {
  id: 'staff_burnout.request.closing',
  appliesTo: {
    seedFamilies: ['staff_burnout', 'staff_identity'],
    seedTypes: ['staff_request', 'complaint'],
    timings: ['closing'],
  },
  priority: 65,
  toneHints: [...DEFINITION_TONES],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const staffRef = seed.primaryActor?.kind === 'staff' ? seed.primaryActor : undefined
    const staff = staffRef ? state.staff[staffRef.id] : undefined
    const display = staff?.name.display ?? 'A staff member'
    const meterLine = staff
      ? `morale ${staff.morale}, stress ${staff.stress}`
      : undefined
    const opinion = staff ? ti.actorOpinions[staff.id] : undefined

    const opts: ComposeOpts = {
      toneHints: [...DEFINITION_TONES, ...seed.toneHints],
      key: seed.id,
    }

    return makeCardView({
      title: composeTitle([`${display}:`, ti.subject], opts),
      body: composeBody(
        [meterLine, opinion ?? ti.sensoryDetails[0], ti.recentContext[0]],
        opts,
      ),
      stakes: buildStakes(seed, 2),
      choices: buildChoicesFromSeed(seed, {
        // Internal cards prefer personnel verbs when present; otherwise
        // expose whatever the slot allows.
        filter: (slot) =>
          slot.allowedVerbs.some(
            (v) => v === 'promote' || v === 'delegate' || v === 'pay' || v === 'ignore',
          )
          || seed.responseSlots.every(
            (s) =>
              !s.allowedVerbs.some(
                (v) => v === 'promote' || v === 'delegate' || v === 'pay' || v === 'ignore',
              ),
          ),
        overrides: () => ({
          ...(staffRef?.id ? { targetId: staffRef.id } : {}),
          maxPreview: 2,
        }),
      }),
      severity: seed.severity,
      tag: familyTag(seed),
    })
  },
}
