import type { TeleologyEntry } from '../../state/TavernState'
import type { LifecycleDefinition } from '../kernel'

export const LIQUOR_LICENSE_VENTURE_ID = 'venture_liquor_license'
export const LIQUOR_LICENSE_TRANSFORMATION_ID = 'licensed_liquor_service'

export const liquorLicenseDefinition: LifecycleDefinition = {
  id: LIQUOR_LICENSE_VENTURE_ID,
  milestones: [
    {
      id: 'file_with_magistrate',
      fromStage: 'paperwork',
      requirements: [{ kind: 'progress_at_least', value: 2 }],
      outcomes: [
        {
          when: [{ kind: 'tag_present', tag: 'expedited' }],
          nextStage: 'licensed',
          effects: [{ kind: 'transformation', id: LIQUOR_LICENSE_TRANSFORMATION_ID, label: 'Licensed liquor service', tags: ['liquor_license', 'ratchet'] }],
        },
      ],
      fallback: {
        nextStage: 'licensed',
        effects: [{ kind: 'transformation', id: LIQUOR_LICENSE_TRANSFORMATION_ID, label: 'Licensed liquor service', tags: ['liquor_license', 'ratchet'] }],
      },
    },
  ],
}

export function createLiquorLicenseVenture(day: number): TeleologyEntry {
  return { id: LIQUOR_LICENSE_VENTURE_ID, kind: 'venture', label: 'Acquire a liquor licence', stage: 'paperwork', progress: 0, status: 'active', tags: ['liquor_license'], createdAtDay: day, updatedAtDay: day }
}
