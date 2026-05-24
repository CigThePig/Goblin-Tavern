// Phase 135 / ISSUE-104 — Voiced Surface arc, Phase 9 (Suppliers, Stock & Debt).
//
// Voiced effect-preview lines for the supplier_reliability template. Each
// composed line corresponds 1-to-1 to a real EffectPreview by construction
// (composeChoicesFromSeed iterates profile.immediateEffects per choice);
// the snippet replaces only the readable string, never the kind / target
// / amount / tags. Synthetic slot is optional; unmatched effects fall
// back to the sim's verbatim `effect.readable`.
//
// Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2. Pilot pool for the
// preview legibility contract. The block of `pre_leg_*` snippets at the
// bottom carries calibrated magnitude vocabulary from `MAGNITUDE_LEXICON`
// alongside the existing targetKind keyword (passes `requireMagnitude`)
// and the coin keyword on every negative-coin cell (passes
// `requireCostSurfacing`). Specificity 3 — `(effectTargetKind,
// effectDirection, effectMagnitudeBand)` — so these snippets out-rank
// the shared narrator base and the older 2-condition voice-axis variants
// for the actual emitted bands. Bands the supplier seeds never emit are
// deliberately left to the shared base / sim fallthrough.

import type { SnippetPool } from '../../types'
import { narratorEffectPreviewBase } from '../_shared/effectPreviewBase'

export const effectPreviewPool: SnippetPool = {
  slotId: 'effect_preview',
  snippets: [
    ...narratorEffectPreviewBase(),
    {
      id: 'pre_state_warm',
      text: "They'd run the line with care after",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_state_cold',
      text: "They'd keep their distance from then on",
      conditions: [
        { kind: 'effectKind', anyOf: ['state_change'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atMost: 0 },
      ],
    },
    {
      id: 'pre_supplier_warm',
      text: 'The partnership would hold steady',
      conditions: [
        { kind: 'effectTag', tag: 'supplier' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
      ],
    },
    {
      id: 'pre_coin_terse',
      text: 'Coin out, the route stays open',
      conditions: [
        { kind: 'effectTag', tag: 'coin' },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'terseness', atLeast: 2 },
      ],
    },
    {
      id: 'pre_pressure_formal',
      text: 'The market pressure would ease accordingly',
      conditions: [
        { kind: 'effectKind', anyOf: ['pressure'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'formality', atLeast: 2 },
      ],
    },
    {
      id: 'pre_cause_florid',
      text: 'Trust would settle like dust on the road',
      conditions: [
        { kind: 'effectKind', anyOf: ['cause'] },
        { kind: 'voiceAxis', role: 'primaryActor', axis: 'floridity', atLeast: 2 },
      ],
    },

    // — Phase 18 repair: base rung of unconditional kind-only snippets —
    {
      id: 'pre_state_change_a',
      text: 'the trade meter would shift a notch',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_b',
      text: 'the cellar count would carry the move',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_c',
      text: 'the route would tilt a measure either way',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_state_change_d',
      text: 'the partnership would feel the choice',
      conditions: [{ kind: 'effectKind', anyOf: ['state_change'] }],
    },
    {
      id: 'pre_pressure_a',
      text: 'a meter would lean back a touch',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_pressure_b',
      text: 'the trade drift would carry into next week',
      conditions: [{ kind: 'effectKind', anyOf: ['pressure'] }],
    },
    {
      id: 'pre_cause_mark',
      text: 'the reason would be marked in the books',
      conditions: [{ kind: 'effectKind', anyOf: ['cause'] }],
    },

    // — Phase 147 / ISSUE-115 — legibility-contract snippets.
    //
    // Each carries the targetKind keyword AND a magnitude-lexicon
    // token for its (direction, band) cell. Specificity 3 beats the
    // shared narrator base and the legacy voice-axis variants for
    // matching effects. Cells the supplier seeds actually emit per
    // `expandedSeedGenerators.ts` (lines 1290-1773): coin -15 (small)
    // through -30 (medium); supplier ±3 (tiny) through ±20 (large);
    // pressure ±5 (small) through ±12 (medium); reputation -8 (small).

    // Coin: cost surfacing (the till / purse / silver carry the keyword).
    {
      id: 'pre_leg_coin_neg_tiny',
      text: 'a hair of coin would slip from the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'pre_leg_coin_neg_small',
      text: 'coin would leave the till by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_coin_neg_medium',
      text: 'a clear drop of silver would leave the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'pre_leg_coin_neg_large',
      text: 'a heavy fall of silver would empty the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'pre_leg_coin_pos_small',
      text: 'coin would settle into the till by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },

    // Supplier: relationship / reliability meters.
    {
      id: 'pre_leg_supplier_pos_tiny',
      text: 'the merchant would warm a hair',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'pre_leg_supplier_pos_small',
      text: 'the trader would step closer by a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_supplier_pos_medium',
      text: 'the supplier would lift a real step closer',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'pre_leg_supplier_neg_tiny',
      text: 'trust would dip a hair with the supplier',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'pre_leg_supplier_neg_small',
      text: 'the trader would step back a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_supplier_neg_medium',
      text: 'the deal would slip a clear drop with the supplier',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },

    // Pressure: rising / settling market & distrust pressures.
    {
      id: 'pre_leg_pressure_neg_small',
      text: 'the pressure reading would settle a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_pressure_neg_medium',
      text: 'the meter would ease by a clear drop',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'pre_leg_pressure_pos_small',
      text: 'the meter would climb a notch on the reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_pressure_pos_medium',
      text: 'the pressure would climb a real step on the reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },

    // Reputation: dangerous / respectable axis movements.
    {
      id: 'pre_leg_reputation_neg_small',
      text: 'the tavern reputation would step back a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'pre_leg_reputation_neg_medium',
      text: 'word would slide a clear drop against the name',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
  ],
}
