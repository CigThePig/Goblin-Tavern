import type { CardDefinition } from '../types'
import { buildStakes, familyTag } from '../cardHelpers'
import { LIQUOR_LICENSE_VENTURE_ID } from '../../sim/modules/ventures/liquorLicense'

export const ventureCard: CardDefinition = {
  id: 'venture.current_stage',
  appliesTo: { seedFamilies: ['venture'], seedTypes: ['opportunity'], timings: ['morning_prep'] },
  priority: 75,
  render(seed, state) {
    const venture = state.ventures[LIQUOR_LICENSE_VENTURE_ID]
    return {
      title: venture ? `${venture.label}: ${venture.stage}` : 'Venture: next step',
      body: [
        venture ? `The licence file is at ${venture.progress}/2 progress.` : 'A long project is waiting for owner attention.',
        'Owner time invested here ratchets toward a permanent tavern change.',
      ],
      stakes: buildStakes(seed, 3),
      choices: seed.responseSlots.slice(0, 2).map((slot) => {
        const choice = { slotId: slot.id, label: slot.labelHint, verb: slot.allowedVerbs[0]!, shape: slot.shape, previewEffects: slot.expectedEffects }
        const targetId = slot.targetOptions[0]?.id
        return targetId ? { ...choice, targetId } : choice
      }),
      severity: seed.severity,
      tag: familyTag(seed),
      meta: { templateId: 'venture.current_stage' },
    }
  },
}
