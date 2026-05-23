// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Flavor reaction line for the reputation_shift compositional template.
// Narrator-voiced — no first-person address, no character voice. Varies
// on `hasTag` (seed.domain ∪ toneHints ∪ stake tags — `reputation` /
// `identity` / per-axis tags), `pressureRising`, `severityAtLeast`, and
// prior-choice memories. The reader is the owner glancing at the books
// at closing.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'A name worth picking before the room picks it instead.',
      conditions: [],
    },

    {
      id: 'rxn_identity',
      text: 'A choice the house will have to live with for a while.',
      conditions: [
        { kind: 'hasTag', tag: 'identity' },
      ],
    },
    {
      id: 'rxn_reputation_tag',
      text: 'The market will start reading the room from this corner now.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation' },
      ],
    },

    {
      id: 'rxn_high_severity',
      text: 'There is no soft answer left; the turn wants a decision.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
    {
      id: 'rxn_pressure_rising',
      text: 'The slate has been creeping for days; here is the bill.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },

    {
      id: 'rxn_axis_cozy',
      text: 'The regulars are picking it up before the merchants do.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.cozy' },
      ],
    },
    {
      id: 'rxn_axis_dangerous',
      text: 'A rougher house draws a rougher trade through the door.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.dangerous' },
      ],
    },
    {
      id: 'rxn_axis_tasty',
      text: 'The kitchen will carry the next stretch of this story.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.tasty' },
      ],
    },

    {
      id: 'rxn_embraced_memory',
      text: 'Leaning in last time only sharpened what is here now.',
      conditions: [
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
    {
      id: 'rxn_advertised_memory',
      text: 'Calling the targeted crowd in is still bringing them.',
      conditions: [
        { kind: 'memoryPresent', tag: 'customer' },
      ],
    },

    {
      id: 'rxn_repeat',
      text: 'Three closings on the same drift means the shape is set.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'reputation', atLeast: 3 },
      ],
    },

    {
      id: 'rxn_severity_dangerous',
      text: 'The merchants will start reading the door differently from this.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'hasTag', tag: 'reputation.dangerous' },
      ],
    },
    {
      id: 'rxn_pressure_identity',
      text: 'The drift keeps climbing because the room keeps choosing it.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
  ],
}
