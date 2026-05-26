// Phase 137 / ISSUE-106 — Voiced Surface arc, Phase 11 (Premises & Atmosphere).
//
// Voiced effect-preview lines for the area_atmosphere template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by
// construction (`composeChoicesFromSeed` iterates `profile.immediateEffects`
// per choice); the snippet replaces only the readable string, never the
// kind / target / amount / tags. Narrator-voiced — gated on `effectKind`
// / `effectTag` / situational tags, never on actor voice.
//
// The area_atmosphere consequence surface at `expandedSeedGenerators.ts:2574-2712`:
//   - repair_area_profile: area.condition +15, area.damage -15, coin -15
//   - clean_area_profile: area.cleanliness +20, area.smell -12, area.mess -10
//   - start_project_profile: coin -25, area.condition +10 (+ delayed)
//   - close_area_temporarily_profile: area.damage -8, area.cleanliness +10 (+ delayed pressure)
//   - rebrand_area_profile: reputation -8, area.condition +5 (+ delayed future_hook)
//   - ignore_area_problem_profile: only delayed pressure + decay
//
// Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2. Pilot pool for the
// preview legibility contract. Two new blocks at the bottom:
//
//   1. `pre_leg_*` — magnitude-bearing snippets gated on (effectTargetKind
//      × effectDirection × effectMagnitudeBand) at specificity 3, carrying
//      both the targetKind keyword and a `MAGNITUDE_LEXICON` token for
//      their cell. Beats the shared narrator base for matching effects.
//   2. `pre_inact_*` — inaction-specific snippets that fire when
//      `composeChoicesFromSeed` routes through `delayedEffects` because
//      `immediateEffects` was empty (the `ignore_area_problem` profile at
//      `expandedSeedGenerators.ts:2692`). Pulled from the delayed-effect
//      shape: pressure:maintenance rising, area.condition decaying,
//      area.damage accruing.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
    {
      id: 'pre_area_state',
      text: 'The room would steady its footing',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    // Phase 18 — additional state_change+area variants so multiple
    // area-tagged effects on one card resolve to different snippets via
    // the FNV tie-break.
    {
      id: 'pre_area_state_b',
      text: 'The walls would read cleaner by service',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_area_state_c',
      text: 'The room would carry the work',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_area_state_d',
      text: 'The floor would hold the change through the night',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'effectTag', tag: 'area' },
      ],
    },
    {
      id: 'pre_coin_cost',
      text: 'Coin would leave the till for the work',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
      ],
    },
    {
      id: 'pre_pressure_ease',
      text: 'Maintenance pressure would settle a notch',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
      ],
    },
    {
      id: 'pre_reputation',
      text: 'Reputation would tilt with the gamble',
      conditions: [
        { kind: 'effectTag', tag: 'reputation' },
      ],
    },
    {
      id: 'pre_future_hook',
      text: 'A risk would remain on the slate for later',
      conditions: [
        { kind: 'effectKind', anyOf: ['future_hook'] },
      ],
    },
    {
      id: 'pre_severity_state',
      text: 'The worst of the rot would be turned back',
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'severityAtLeast', value: 70 },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_floor',
      text: 'The floor would feel the change',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_wear',
      text: 'The wear would walk back a step',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_breath',
      text: 'The room would breathe a bit easier',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_meter',
      text: 'The reading would shift a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_lean',
      text: 'The drift would lean back a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_thread',
      text: 'Another thread would join the slate',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_future_thread',
      text: 'A reminder would sit on the slate',
      conditions: [{ kind: 'effectKind', anyOf: ['future_hook'] }],
    },

    // — Phase 147 / ISSUE-115 — legibility-contract snippets.
    //
    // Specificity 3 on (effectTargetKind × effectDirection ×
    // effectMagnitudeBand) — beats the shared narrator base and the
    // 2-condition area variants above for the cells the area_atmosphere
    // seeds actually emit (area cleanliness ±10/20/25; area condition
    // ±5/8/10/15; area damage ±6/8/15; coin -10/-15/-25; pressure +10;
    // reputation -8).

    // Area: positive cells (cleanup / repair lines).
    {
      id: 'pre_leg_area_pos_tiny',
      text: 'the corner would lift a hair',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'pre_leg_area_pos_small',
      text: 'the floor would lift a notch by service',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_area_pos_medium',
      text: 'the room would gain a real step by morning',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    // Area: negative cells (decay / damage / wear).
    {
      id: 'pre_leg_area_neg_tiny',
      text: 'the floor would dip a hair further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'pre_leg_area_neg_small',
      text: 'the room would slip a notch through the night',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_area_neg_medium',
      text: 'the corner would slide a clear drop overnight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },

    // Coin cells are owned by the shared narrator base after Phase 157
    // — the per-template coin snippets that used to sit here collided
    // with `canonical_equality` against `shared_preview_coin_neg_*`
    // once the base recalibrated against the legibility contract.

    // Pressure: maintenance rising / settling.
    {
      id: 'pre_leg_pressure_pos_small',
      text: 'maintenance pressure would climb a notch on the reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_pressure_pos_medium',
      text: 'pressure would lift a real step on the reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'pre_leg_pressure_neg_small',
      text: 'the maintenance reading would step back a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },

    // Reputation: rebrand path drops it.
    {
      id: 'pre_leg_reputation_neg_small',
      text: 'the tavern name would step back a notch in talk',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },

    // — Phase 147 / ISSUE-115 — inaction-path snippets.
    //
    // The `ignore_area_problem_profile` (expandedSeedGenerators.ts:2692)
    // has `immediateEffects: []` plus delayed pressure:maintenance +10,
    // area.condition -8, area.damage +6. Phase 147's inaction wiring in
    // `composeChoicesFromSeed` routes preview composition through those
    // delayed effects with `inactionPreview: true`. These snippets
    // (specificity 4 with inactionPreview + targetKind + direction +
    // band) out-rank everything else on that path. Body of "what not
    // acting costs" — sourced from the seed's delayedEffects, never
    // invented.
    {
      id: 'pre_inact_pressure_pos_medium',
      text: 'maintenance pressure would keep climbing a real step',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'pre_inact_area_neg_tiny',
      text: 'the room would keep slipping a hair through the night',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'pre_inact_area_pos_tiny',
      text: 'damage would creep a hair across the floor',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
  ],
}
