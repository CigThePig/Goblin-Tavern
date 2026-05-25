// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Flavor reaction line for the maintenance compositional template.
// Narrator-voiced — no first-person address, no character voice. Varies
// on `hasTag` against the seed's domain ∪ toneHints ∪ stake tags
// (`maintenance` / `risk` / `inspection_relevant` / `fire_risk` /
// `urgent`), `pressureRising`, `severityAtLeast`, and prior-choice
// memories. The reader is the owner walking the room first thing.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'The kind of wear that gets bigger if you let it.',
      conditions: [],
    },

    {
      id: 'rxn_risk',
      text: 'Someone will trip on it before the week is out.',
      conditions: [
        { kind: 'hasTag', tag: 'risk' },
      ],
    },
    {
      id: 'rxn_inspection_relevant',
      text: 'An inspector would mark this on the first sweep.',
      conditions: [
        { kind: 'hasTag', tag: 'inspection_relevant' },
      ],
    },
    {
      id: 'rxn_fire_risk',
      text: 'A stray spark would find this and not let it go.',
      conditions: [
        { kind: 'hasTag', tag: 'fire_risk' },
      ],
    },
    {
      id: 'rxn_urgent',
      text: 'This will not wait politely for the slow decision.',
      conditions: [
        { kind: 'hasTag', tag: 'urgent' },
      ],
    },

    {
      id: 'rxn_high_severity',
      text: 'There is no soft answer left; the choice has to be made.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'rxn_pressure_rising',
      text: 'The board has been creeping for days; here is the bill.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
      ],
    },

    {
      id: 'rxn_ignored_memory',
      text: 'Looking away the last time only fed what is here now.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'rxn_patch_memory',
      text: 'The cheap patch from before is no longer holding up its end.',
      conditions: [
        { kind: 'memoryPresent', tag: 'patch' },
      ],
    },
    {
      id: 'rxn_warning_memory',
      text: 'The warning from the last walk-through has finally come due.',
      conditions: [
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },

    {
      id: 'rxn_repeat_maintenance',
      text: 'A third visit means the room is asking, not whispering.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'maintenance', atLeast: 3 },
      ],
    },

    {
      id: 'rxn_severity_inspection',
      text: 'The next inspection will not be kind about this one.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'hasTag', tag: 'inspection_relevant' },
      ],
    },
    {
      id: 'rxn_pressure_ignored',
      text: 'The pressure keeps climbing because the room keeps being skipped.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },

    // Phase 153 / ISSUE-121 — Legible Surface arc, Phase 8.
    // State-keyed reaction snippets. Existing pool covers tone tags +
    // memories + severity + pressure + repeat; the gap is signalEquals
    // reads on the three area meters. Narrator-voiced throughout.
    {
      id: 'rxn_damage_high',
      text: 'The eye lands on a gouge the morning light cannot soften.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'rxn_condition_low',
      text: 'The room reads tired in the cool morning light.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'rxn_cleanliness_low',
      text: 'A scrub has not been near this corner in days.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.cleanliness', role: 'location', equals: 'low' },
      ],
    },
    {
      id: 'rxn_dmg_high_cond_high',
      text: 'A strong room with one bad surface; the contrast does the talking.',
      conditions: [
        { kind: 'signalEquals', signal: 'area.damage', role: 'location', equals: 'high' },
        { kind: 'signalEquals', signal: 'area.condition', role: 'location', equals: 'high' },
      ],
    },
    {
      id: 'rxn_pressure_warning',
      text: 'The earlier warning is cashing itself in this morning.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'maintenance' },
        { kind: 'memoryPresent', tag: 'warning' },
      ],
    },
    {
      id: 'rxn_repeat_ignored',
      text: 'Third visit, and looking past it has become a habit.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'maintenance', atLeast: 3 },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
  ],
}
