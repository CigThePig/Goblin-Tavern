// Staff request template — a personnel ask. Names the staff member via
// state lookup (not the ingredient), surfaces a morale/stress meter line
// so the player sees why the ask is happening. Mirrors cards-contract §7
// Template 5.

import {
  buildBody,
  buildChoicesFromSeed,
  buildStakes,
  familyTag,
  formatTitle,
  makeCardView,
} from '../cardHelpers'
import type { CardDefinition } from '../types'

export const staffRequestCard: CardDefinition = {
  id: 'staff_burnout.request.closing',
  appliesTo: {
    seedFamilies: ['staff_burnout', 'staff_identity'],
    seedTypes: ['staff_request', 'complaint'],
    timings: ['closing'],
  },
  priority: 65,
  toneHints: ['internal', 'personal'],
  render: (seed, state) => {
    const ti = seed.textIngredients
    const staffRef = seed.primaryActor?.kind === 'staff' ? seed.primaryActor : undefined
    const staff = staffRef ? state.staff[staffRef.id] : undefined
    const display = staff?.name.display ?? 'A staff member'
    const meterLine = staff
      ? `morale ${staff.morale}, stress ${staff.stress}`
      : undefined
    const opinion = staff ? ti.actorOpinions[staff.id] : undefined

    return makeCardView({
      title: formatTitle([`${display}:`, ti.subject]),
      body: buildBody([meterLine, opinion ?? ti.sensoryDetails[0], ti.recentContext[0]]),
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
