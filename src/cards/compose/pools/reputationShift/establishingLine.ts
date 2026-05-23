// Phase 139 / ISSUE-108 — Voiced Surface arc, Phase 13 (Reputation, Rumour & Rivals).
//
// Sim-backed establishing line for the reputation_shift compositional
// template. Narrator-voiced; the seed carries no primaryActor so gates
// on state-lookup primitives only (no voiceAxis / verbalTic).
//
// State surfaces leaned on:
//   - hasTag `reputation.<axis>` — Phase-13 additive seed.domain tag
//   - pressureRising `reputation_drift`
//   - memoryPresent on prior owner choices (embraced / corrected /
//     advertised / diversified)
//   - repeatCount `reputation` ≥ 3
//   - severityAtLeast 50 (mid) and 70 (hard turn)
//
// Design record at `specs/cards/reputation_shift.spec.yaml`.

import type { SnippetPool } from '../../types'

export const establishingLinePool: SnippetPool = {
  slotId: 'establishing_line',
  snippets: [
    {
      id: 'est_fallback',
      text: "The tavern's public face has tilted this week.",
      conditions: [],
    },

    // Axis-specific snippets pair the `hasTag reputation.<axis>` tag
    // (Phase-13 additive seed.domain) with `pressureRising
    // reputation_drift` so the sim-backed slot's coherence gate sees a
    // state-lookup primitive. When the drift isn't currently trending
    // positive, the fallback / memory rungs take over.
    {
      id: 'est_axis_cozy',
      text: 'The room is gaining a cozier name with the regulars.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.cozy' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_axis_tasty',
      text: 'Word of the kitchen is travelling beyond the usual tables.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.tasty' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_axis_reputable',
      text: 'The tavern is reading respectable to a steadier crowd.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.reputable' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_axis_reliable',
      text: 'The room is settling into a reliable rhythm at the door.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.reliable' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_axis_dangerous',
      text: 'A rougher name is gathering around the place.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.dangerous' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_axis_respectable',
      text: 'A respectable register is colouring how newcomers read the room.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.respectable' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_axis_scholarly',
      text: 'A scholarly air is starting to stick to the place.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.scholarly' },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },

    {
      id: 'est_pressure_rising',
      text: 'Reputation_drift has been climbing onto the slate for days.',
      conditions: [
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },

    {
      id: 'est_embraced_memory',
      text: 'The identity embraced last time keeps writing itself deeper.',
      conditions: [
        { kind: 'memoryPresent', tag: 'identity' },
      ],
    },
    {
      id: 'est_advertised_memory',
      text: 'Targeted regulars are showing up where the advert pointed.',
      conditions: [
        { kind: 'memoryPresent', tag: 'customer' },
      ],
    },
    {
      id: 'est_repeat_reputation',
      text: 'Third closing running, the same drift writes itself onto the books.',
      conditions: [
        { kind: 'repeatCount', subjectTag: 'reputation', atLeast: 3 },
      ],
    },

    {
      id: 'est_dangerous_high_severity',
      text: 'A rougher name is past softening; the drift keeps rising on it.',
      conditions: [
        { kind: 'hasTag', tag: 'reputation.dangerous' },
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'pressureRising', pressureId: 'reputation_drift' },
      ],
    },
    {
      id: 'est_high_severity_repeat',
      text: 'A hard turn the books have caught twice before, sharper today.',
      conditions: [
        { kind: 'severityAtLeast', value: 70 },
        { kind: 'repeatCount', subjectTag: 'reputation', atLeast: 3 },
      ],
    },
  ],
}
