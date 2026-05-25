// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Flavor reaction line for the area_atmosphere compositional template.
// Narrator-voiced — no first-person address, no character voice. Varies
// on `hasTag` against the seed's domain ∪ toneHints ∪ stake tags
// (`atmosphere` / `reputation` / `cleanliness_positive` / `urgent` /
// `merchant_sensitive` / `inspection_negative`), `pressureRising`,
// `severityAtLeast`, and prior-choice memories. The reader is the owner
// surveying the room in the morning.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'Whatever the room is selling, it is not the welcome you want.',
      conditions: [],
    },

    {
      id: 'rxn_reputation',
      text: 'Word about a sour corner spreads faster than coin.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation' },
      ],
    },
    {
      id: 'rxn_inspection',
      text: 'An inspector would write up the smell first.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_negative' },
      ],
    },
    {
      id: 'rxn_merchant',
      text: 'A travelling buyer would not take a second drink here.',
      conditions: [
        { kind: 'hasTag', tag: 'merchant_sensitive' },
      ],
    },
    {
      id: 'rxn_urgent',
      text: 'This will turn off the evening crowd if you let it.',
      conditions: [
        { kind: 'hasTag', tag: 'urgent' },
      ],
    },

    {
      id: 'rxn_high_severity',
      text: 'There is no quick scrub left to make this go away.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'rxn_pressure_rising',
      text: 'The board has climbed for days; here is the room saying so.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },

    {
      id: 'rxn_neglected_memory',
      text: 'The last pass skipped it; the room kept the score.',
      conditions: [
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
    {
      id: 'rxn_cleaning_memory',
      text: 'The recent scrub is fading fast; the room remembers.',
      conditions: [
        { kind: 'memoryPresent', tag: 'cleaning' },
      ],
    },
    {
      id: 'rxn_repair_memory',
      text: 'The bones got mended; the mood was not.',
      conditions: [
        { kind: 'memoryPresent', tag: 'repair' },
      ],
    },

    {
      id: 'rxn_repeat',
      text: 'A third visit means the room is asking, not whispering.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'atmosphere', atLeast: 3 },
      ],
    },

    {
      id: 'rxn_reputation_high_severity',
      text: 'The reputation hit would land harder than the cleaning bill.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation' },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'rxn_neglected_pressure',
      text: 'The pressure keeps rising because the room keeps being skipped.',
      conditions: [
        { kind: 'memoryPresent', tag: 'neglected' },
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },

    // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8.
    // State-keyed reaction snippets. Existing pool covers reputation +
    // inspection + merchant + urgent + severity + pressure + 3
    // memories + repeat; the gap is signalEquals reads on the three
    // area meters.
    {
      id: 'rxn_cleanliness_low',
      text: 'A smear the owner would not wipe with customers watching.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'rxn_damage_high',
      text: 'A broken slat the regulars already know to step around.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'rxn_condition_low',
      text: 'A slow read of a room showing its age.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'rxn_clean_low_dmg_high',
      text: 'Grime over real wear; the read carries both at once.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'rxn_pressure_atmosphere',
      text: 'The atmosphere we let happen, now the atmosphere we wear.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
        { kind: 'memoryPresent', tag: 'atmosphere' },
      ],
    },
    {
      id: 'rxn_repeat_neglected',
      text: 'Third week reading, and the same corner has slipped further.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'atmosphere', atLeast: 3 },
        { kind: 'memoryPresent', tag: 'neglected' },
      ],
    },
  ],
}
