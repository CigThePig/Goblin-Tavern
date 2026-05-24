// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
//
// Shared narrator-register snippet base for effect-preview slots. Every
// Movement II template's `effectPreview.ts` prepends this base to its
// own pool so the (targetKind × direction) grid has a baseline of
// readable specificity. Per the Phase-145 plan, each snippet:
//
//   - names what changed (contains a keyword in
//     `DEFAULT_TARGET_KIND_KEYWORDS` for its targetKind, so the
//     `preview_specificity_low` gate passes),
//   - stays at or under the 10-word effect_preview budget,
//   - avoids `your` / `the cook` / actor-role nouns (sim-coherence gate's
//     `role_claim` patterns stay quiet),
//   - is canonically distinct from every other snippet here (so the
//     within-template dedupe gate doesn't fire when templates layer
//     their own variants on top).
//
// Returns bare `Snippet[]` (not a `SnippetPool`) so each template
// composes its pool as `[...narratorEffectPreviewBase(), ...own]`. IDs
// prefixed `shared_preview_` to prevent per-template id collisions.
//
// The base is intentionally voice-neutral. Templates whose primaryActor
// carries a voiceProfile (drinkOrder, staffAside, etc.) layer
// voice-axis-gated specificity-3+ snippets on top.

import type { Snippet } from '../../types'

export function narratorEffectPreviewBase(): Snippet[] {
  return [
    // ---- coin ----
    {
      id: 'shared_preview_coin_neg_a',
      text: 'the till lightens by a hand',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_coin_neg_b',
      text: 'coin would leave the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_coin_pos_a',
      text: 'coin would land in the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_coin_pos_b',
      text: 'silver would settle into the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    // ---- stock ----
    {
      id: 'shared_preview_stock_neg_a',
      text: 'shelves would thin a measure',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_stock_neg_b',
      text: 'stores would draw down further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_stock_pos_a',
      text: 'the shelves would fill back up',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_stock_pos_b',
      text: 'stores would deepen by a barrel',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    // ---- area ----
    {
      id: 'shared_preview_area_pos_a',
      text: 'the room would read cleaner',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_area_pos_b',
      text: 'the floor would steady underfoot',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_area_neg_a',
      text: 'the corner would slip further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_area_neg_b',
      text: 'the room would mark the neglect',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    // ---- pressure ----
    {
      id: 'shared_preview_pressure_pos_a',
      text: 'the meter would climb a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_b',
      text: 'pressure would rise another reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_a',
      text: 'the meter would settle a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_b',
      text: 'pressure would ease its reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    // ---- customer (regulars + named) ----
    {
      id: 'shared_preview_customer_neg_a',
      text: 'the regular would lose patience',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_customer_neg_b',
      text: 'the patron would pull away by degrees',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_customer_pos_a',
      text: 'the patron would warm a measure',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_customer_pos_b',
      text: 'the regular would lean into the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    // ---- staff ----
    {
      id: 'shared_preview_staff_neg_a',
      text: 'the rota would wear thin tonight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_staff_neg_b',
      text: 'the crew would feel the weight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_staff_neg_c',
      text: 'the shift would lean harder on hands',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_staff_pos_a',
      text: 'the crew would steady through the shift',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_staff_pos_b',
      text: 'the rota would settle a measure lighter',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_staff_pos_c',
      text: 'a beat of relief would reach the kitchen staff',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    // ---- reputation ----
    {
      id: 'shared_preview_reputation_pos_a',
      text: "the tavern's name would carry further",
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_a',
      text: 'word would turn against the name',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    // ---- cohort (customer_group: refs) ----
    {
      id: 'shared_preview_cohort_neg_a',
      text: 'the group would harden against the choice',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_cohort_pos_a',
      text: 'the group would soften a measure',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_cohort_neu_a',
      text: 'the crowd would mark it on the record',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'neutral' },
      ],
    },
    // ---- supplier ----
    {
      id: 'shared_preview_supplier_neg_a',
      text: "the trader's deal would cool",
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_supplier_pos_a',
      text: 'the merchant would warm to the gesture',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_supplier_neu_a',
      text: 'the supplier would log the exchange',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'neutral' },
      ],
    },
    // ---- faction ----
    {
      id: 'shared_preview_faction_neg_a',
      text: 'the guild would mark the snub',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_faction_pos_a',
      text: 'the guild would warm to the move',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_faction_neu_a',
      text: 'the order would note the gesture',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'neutral' },
      ],
    },
    // ---- culture ----
    {
      id: 'shared_preview_culture_neg_a',
      text: 'the kin would feel the tension build',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    {
      id: 'shared_preview_culture_pos_a',
      text: 'the folk would settle into the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    // ---- memory + arc + attribution (typically neutral) ----
    {
      id: 'shared_preview_memory_neu_a',
      text: 'the memory would lodge for later recall',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['memory'] },
        { kind: 'effectDirection', sign: 'neutral' },
      ],
    },
    {
      id: 'shared_preview_memory_pos_a',
      text: 'the rumour would spread its whisper',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['memory'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_arc_neu_a',
      text: 'the storyline would thread it onward',
      conditions: [{ kind: 'effectTargetKind', anyOf: ['arc'] }],
    },
    {
      id: 'shared_preview_attribution_neu_a',
      text: 'a credit would settle onto the record',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['attribution'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_attribution_neg_a',
      text: 'the blame would land where it falls',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['attribution'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
    // ---- global / tavern-wide ----
    {
      id: 'shared_preview_global_pos_a',
      text: 'the tavern would feel the lift',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['global'] },
        { kind: 'effectDirection', sign: 'positive' },
      ],
    },
    {
      id: 'shared_preview_global_neg_a',
      text: 'the house would carry the weight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['global'] },
        { kind: 'effectDirection', sign: 'negative' },
      ],
    },
  ]
}
