// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
// Phase 157 / ISSUE-125 — Legible Surface arc, Phase 12 (Economic Previews).
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
//
// Phase 157 — economic-meter recalibration. The coin and stock blocks
// below are authored against the Phase-147 preview legibility contract:
// every banded snippet contains a `MAGNITUDE_LEXICON[direction][band]`
// token (passes `requireMagnitude`), every negative-coin snippet names
// a `DEFAULT_TARGET_KIND_KEYWORDS.coin` token (passes
// `requireCostSurfacing`), and the production direction × band cells
// (`coin neg tiny/small/medium`, `coin pos small/medium`, `stock` cells
// from `tiny` salePrice through `large` restock) carry multiple
// snippets so the FNV tie-break on `effect_preview::${slotId}::${idx}`
// spreads across multi-effect renders. Per-template specificity-3+
// snippets (e.g. supplierReliability's `pre_leg_supplier_*` rung) still
// out-rank these via the FNV tie-break on identical condition shapes.
// Two additional debt-tag variants at the bottom of the coin block
// substitute the cost noun ("the till" → "the rent" / "wages") when
// the effect tag carries `rent` / `wages`. All other targetKinds in
// the base (area, pressure, customer, staff, reputation, cohort,
// supplier, faction, culture, memory, arc, attribution, global) are
// untouched in this phase — they belong to Phases 13–14.

import type { Snippet } from '../../types'

export function narratorEffectPreviewBase(): Snippet[] {
  return [
    // ---- coin (Phase 157 / ISSUE-125 recalibration) ----
    //
    // Production emits: tiny (-3 rare), small (-5 through -15 + 6/12/15
    // common), medium (-20 through -40 + 20/30/40 common), no large
    // cells. Negative cells dominate — they're the cost-bearing path.
    // Every banded snippet names a coin keyword and a magnitude token.
    {
      id: 'shared_preview_coin_neg_tiny_a',
      text: 'a hair of coin would slip from the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_tiny_b',
      text: 'a whisper of silver would leave the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_small_a',
      text: 'coin would leave the till by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_small_b',
      text: 'a notch of silver would slip from the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_small_c',
      text: 'a measure of coppers would leave the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_small_d',
      text: 'the till would lighten by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_medium_a',
      text: 'a clear drop of silver would leave the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_medium_b',
      text: 'a real slip of coin would leave the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_medium_c',
      text: 'a marked fall of silver would empty the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_medium_d',
      text: 'silver would slip the till by a clear drop',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_coin_neg_large_a',
      text: 'a heavy fall of coin would drain the purse bare',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_coin_pos_tiny_a',
      text: 'a hair of silver would land in the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_coin_pos_small_a',
      text: 'a step of coin would settle into the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_coin_pos_small_b',
      text: 'a notch of silver would land in the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_coin_pos_medium_a',
      text: 'a real step of silver would land in the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_coin_pos_medium_b',
      text: 'a marked rise of coin would settle into the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_coin_pos_large_a',
      text: 'a surge of silver would fill the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // Debt-flavoured coin variants. `effectTag rent | wages` at
    // specificity 4 (one more condition than the plain coin band cell)
    // substitutes the cost noun without changing the magnitude word.
    // Cells covered are the ones the `debt_rent` and `staff_burnout`
    // families actually emit (small/medium negatives).
    {
      id: 'shared_preview_coin_rent_small_a',
      text: 'a step of rent would draw from the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'effectTag', tag: 'rent' },
      ],
    },
    {
      id: 'shared_preview_coin_rent_medium_a',
      text: 'the rent would carve a clear drop from the till',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'effectTag', tag: 'rent' },
      ],
    },
    {
      id: 'shared_preview_coin_wages_small_a',
      text: 'wages would slip a step from the purse',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['coin'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'effectTag', tag: 'wages' },
      ],
    },
    // ---- stock (Phase 157 / ISSUE-125 recalibration) ----
    //
    // Production emits: tiny (salePrice ±1), small (quantity ±10/-15/
    // -20/+20), medium (quantity +30/+40 + quality +10), large
    // (quantity +60 — restock response only). Every banded snippet
    // names a stock keyword (shelf/shelves/stock/stores/barrel/pantry/
    // cellar) and a magnitude token.
    {
      id: 'shared_preview_stock_neg_tiny_a',
      text: 'a hair of stock would slip from the pantry',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_stock_neg_small_a',
      text: 'shelves would thin by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_stock_neg_small_b',
      text: 'a notch would draw from the cellar stores',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_stock_neg_medium_a',
      text: 'a clear drop would empty the barrel by half',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_stock_neg_large_a',
      text: 'a heavy fall would empty the cellar shelves',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_stock_pos_tiny_a',
      text: 'a hair would lift the shelf count',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_stock_pos_small_a',
      text: 'a step would deepen the pantry stores',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_stock_pos_small_b',
      text: 'a notch would fill the shelves further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_stock_pos_medium_a',
      text: 'a real step would deepen the cellar stores',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_stock_pos_medium_b',
      text: 'a marked rise would fill the barrel further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_stock_pos_large_a',
      text: 'a wide leap would refill the cellar shelves',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['stock'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
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
