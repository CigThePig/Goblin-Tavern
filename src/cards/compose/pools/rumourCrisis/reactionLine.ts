// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Flavor reaction line for the rumour_crisis template. The target
// (primaryActor) speaking in first-person voice via `voiceAxis` and
// `verbalTic` only. May show protest, weary acknowledgement, denial,
// cold contempt, ironic dismissal, plea, threat. Must not assert
// specific past events or invent named NPCs.

import type { SnippetPool } from '../../types'

export const reactionLinePool: SnippetPool = {
  slotId: 'reaction_line',
  snippets: [
    {
      id: 'rxn_fallback',
      text: 'Whoever started it can be the one to end it.',
      conditions: [],
    },

    {
      id: 'rxn_terse',
      text: 'Not true. Let it die.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_warm',
      text: 'Friend, would you put your hand to this if it were true?',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_cold',
      text: 'Whoever spoke first paid for the privilege.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_formal',
      text: 'A statement is required, and I will provide it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'rxn_informal',
      text: 'Look, this is daft and you know it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },
    {
      id: 'rxn_florid',
      text: 'The wind has carried the story further than my voice can.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    {
      id: 'rxn_terse_cold',
      text: 'No. Strike it.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'rxn_warm_informal',
      text: 'Mate, half of what they are saying is plain invention.',
      conditions: [
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atMost: 0 },
      ],
    },

    {
      id: 'rxn_tic_understates',
      text: 'A small misunderstanding, given enough room to grow.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'understates' },
      ],
    },
    {
      id: 'rxn_tic_interrupts',
      text: 'It is not what — well, not what they are claiming, anyway.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'interrupts_self' },
      ],
    },
    {
      id: 'rxn_tic_italicises',
      text: 'This matters. To my name. To my trade.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'italicises_stakes' },
      ],
    },
    {
      id: 'rxn_tic_repeats',
      text: 'Wrong. Wrong before the cup runs cold.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'repeats_for_emphasis' },
      ],
    },
    {
      id: 'rxn_tic_quotes',
      text: 'My grandmother said — a story is half who tells it.',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'quotes_someone_else' },
      ],
    },
    {
      id: 'rxn_tic_qualifies',
      text: "If you choose to believe it, that is your affair.",
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'qualifies_everything' },
      ],
    },
    {
      id: 'rxn_tic_trails',
      text: 'It started with someone who wished me ill...',
      conditions: [
        { kind: 'verbalTic', role: 'primaryActor', tic: 'trails_off' },
      ],
    },

    // Phase 155 / ISSUE-123 — Legible Surface arc, Phase 10. State-
    // keyed reaction snippets so the line varies with current
    // accuracy / target / pressure / memory reads as well as voice
    // axes. Sit at specificity 1+ (one condition each is the floor);
    // they reach across all six target kinds because they gate only
    // on rumour-state reads, not on voice axes that depend on each
    // target carrying castAttributes. First-person target voice.
    {
      id: 'rxn_state_false_denial',
      text: 'I denied this once already, and now it has grown teeth.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.false' },
        { kind: 'memoryPresent', tag: 'denial' },
      ],
    },
    {
      id: 'rxn_state_true_honesty',
      text: 'I gave you the truth last round; it has not stopped travelling.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.true' },
        { kind: 'memoryPresent', tag: 'honesty' },
      ],
    },
    {
      id: 'rxn_state_partial_pressure',
      text: 'The half they keep is not the half that helps me.',
      conditions: [
        { kind: 'hasTag', tag: 'rumour.partial' },
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
      ],
    },
    {
      id: 'rxn_state_pressure_repeat',
      text: 'Third closing this whisper has come back; I am tired of it.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'rumour_pressure' },
        { kind: 'repeatCount', subjectTag: 'rumour', atLeast: 3 },
      ],
    },
    {
      id: 'rxn_state_severity',
      text: 'There is no quiet word that will reach this now.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
      ],
    },
  ],
}
