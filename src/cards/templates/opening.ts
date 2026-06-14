import type { CardDefinition } from '../types'
import { buildStakes, familyTag } from '../cardHelpers'
import { getVentureBlueprint } from '../../sim/modules/ventures/ventureCatalog'
import {
  OPENINGS_MODULE_ID,
  type OpeningsModuleState,
} from '../../sim/modules/openings/types'

// Phase 2 (teleology) — opening card.
//
// A plain-render card (like the venture card) exempted from the compose
// gates via `NON_COMPOSITIONAL_CARD_IDS`. It resolves its entity from the
// seed's target (`opening:<recordId>`) and reads the blueprint from the
// openings store — never a hardcoded venture/opening id (guardrail §10).
export const openingCard: CardDefinition = {
  id: 'opening.opportunity',
  appliesTo: { seedFamilies: ['opening'], seedTypes: ['opportunity'], timings: ['morning_prep'] },
  priority: 75,
  render(seed, state) {
    const recordId = (seed.primaryActor?.id ?? '').replace(/^opening:/, '')
    const slice = state.modules[OPENINGS_MODULE_ID] as OpeningsModuleState | undefined
    const record = slice?.openings[recordId]
    const blueprint = record ? getVentureBlueprint(record.blueprintId) : undefined
    const returned = record?.origin === 'return'

    return {
      title: blueprint ? `Opening: ${blueprint.label}` : 'A new opening',
      body: [
        blueprint?.opening.establishingLine ?? 'The world offers an opportunity worth weighing.',
        returned
          ? 'This opportunity has come back around — conditions shifted.'
          : 'Commit now to start the work, or leave it and let it lapse.',
      ],
      stakes: buildStakes(seed, 3),
      choices: seed.responseSlots.slice(0, 2).map((slot) => {
        const choice = { slotId: slot.id, label: slot.labelHint, verb: slot.allowedVerbs[0]!, shape: slot.shape, previewEffects: slot.expectedEffects }
        const targetId = slot.targetOptions[0]?.id
        return targetId ? { ...choice, targetId } : choice
      }),
      severity: seed.severity,
      tag: familyTag(seed),
      meta: { templateId: 'opening.opportunity' },
    }
  },
}
