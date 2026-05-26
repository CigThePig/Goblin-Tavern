// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Flavor reaction line for the rival_tavern compositional template.
// Narrator-voiced — no first-person address, no character voice.
// Varies on `hasTag` against the seed's domain ∪ toneHints ∪ stake
// tags (rival / market / rival.arc / rival.system),
// `pressureRising`, `severityAtLeast`, and prior-choice memories. The
// reader is the owner reviewing the books at closing.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'A pull on the trade that wants an answer this week.',
      conditions: [],
    },

    {
      id: 'rxn_arc',
      text: 'A named house can be answered with a strategy of its own.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
      ],
    },
    {
      id: 'rxn_system',
      text: 'An unnamed pull is harder to aim a strategy at.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
      ],
    },
    {
      id: 'rxn_market_tag',
      text: 'The market will keep choosing whichever house leans into it.',
      conditions: [
        { kind: 'hasTag', tag: 'market' },
      ],
    },

    {
      id: 'rxn_pressure_rising',
      text: 'The books have been creeping for days; here is the bill.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'rxn_regulars_loss',
      text: 'Empty stools at the bar say what the books only suggest.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },

    {
      id: 'rxn_compete_memory',
      text: 'The price war from before is no longer holding the line.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
      ],
    },
    {
      id: 'rxn_event_memory',
      text: 'The crowd from the counter-event has moved on already.',
      conditions: [
        { kind: 'memoryPresent', tag: 'event' },
      ],
    },
    {
      id: 'rxn_deception_memory',
      text: 'The counter-rumour from before is showing diminishing returns.',
      conditions: [
        { kind: 'memoryPresent', tag: 'deception' },
      ],
    },
    {
      id: 'rxn_ignored_memory',
      text: 'Looking past them only fed what is here now.',
      conditions: [
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },

    {
      id: 'rxn_high_severity',
      text: 'There is no soft answer left; the pull has to be addressed.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },

    {
      id: 'rxn_repeat',
      text: 'Three closings on the same rival means a pattern has set.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'rival', atLeast: 3 },
      ],
    },

    {
      id: 'rxn_pressure_ignored',
      text: 'The pull keeps climbing because the rival keeps being skipped.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
        { kind: 'memoryPresent', tag: 'ignored' },
      ],
    },
    {
      id: 'rxn_severity_arc',
      text: 'A named house at this weight will not stop on its own.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'hasTag', tag: 'rival.arc' },
      ],
    },

    // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10. State-
    // keyed reaction snippets so the line varies with current rival-
    // type / pressure / memory reads. Narrator-voiced; no
    // `voiceAxis` / `verbalTic` because the seed's primaryActor
    // carries no castAttributes.
    {
      id: 'rxn_state_arc_customer_loss',
      text: 'The named house takes regulars by name and by trade.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.arc' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
    {
      id: 'rxn_state_system_pressure',
      text: 'The anonymous pull will keep climbing while the source is unseen.',
      conditions: [
        { kind: 'hasTag', tag: 'rival.system' },
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'rxn_state_price_pressure',
      text: 'The price war from before is not holding the pull back.',
      conditions: [
        { kind: 'memoryPresent', tag: 'price' },
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'rxn_state_event_pressure',
      text: 'The counter-event has lost its grip on the crowd already.',
      conditions: [
        { kind: 'memoryPresent', tag: 'event' },
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
      ],
    },
    {
      id: 'rxn_state_dual_pressure',
      text: 'Both the rival pull and the regulars drift want answering this week.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rival_tavern_pressure' },
        { kind: 'pressureRising', pressureId: 'regular_customer_loss' },
      ],
    },
  ],
}
