// Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
// Phase 157 / ISSUE-125 — Legible Surface arc, Phase 12 (Economic Previews).
// Phase 158 / ISSUE-126 — Legible Surface arc, Phase 13 (Social Previews).
// Phase 159 / ISSUE-127 — Legible Surface arc, Phase 14 (Operational
//   Previews + Pressure & Delayed/Uncertain framing).
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
// the effect tag carries `rent` / `wages`.
//
// Phase 158 — social-meter recalibration. The customer / cohort /
// reputation / supplier / faction / culture blocks now carry the same
// `direction × magnitudeBand` matrix at the same 3-condition specificity
// as the economic blocks. Production-emitted cells (per the audit in
// `docs/plans/phase-158-social-previews.md`) carry multiple snippets for
// FNV spread; cells the sim doesn't emit today get a single optimistic
// snippet so a future emission stays legible. Cohort cells are fully
// optimistic — cohort effects today are `cause` writes, not
// `state_change`. The narrator-register memory / arc / attribution /
// global blocks stay at kind+direction specificity — they emit too
// rarely to justify a per-meter pass.
//
// Phase 159 — operational-meter recalibration. The staff / area /
// pressure blocks now carry the same `direction × magnitudeBand` matrix
// at the same 3-condition specificity as the economic and social blocks.
// A new specificity-4 inaction-gated block at the end of the pressure
// section authors the "what *not* acting costs" framing for delayed
// pressure rises — every inaction profile in production emits delayed
// positive pressure as its consequence, so a single shared block
// inherits to every family. Pressure direction semantics: positive =
// rising (bad), negative = relief (good); the surrounding verb palette
// ("build / mount / climb / creep" for rising; "settle / ease / loosen
// / fall back" for relief) carries the threat-vs-relief tone. Axis-
// neutral across the 20 pressure families — Phase 13's reputation axis
// precedent. Per-family specificity is a future loopback if play
// surfaces it.

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
    // ---- area (Phase 159 / ISSUE-127 recalibration) ----
    //
    // Production emits: condition -8 (small), -25 (medium repair via
    // damage), damage +6 (tiny accrual on inaction), damage -10/-20/-25
    // (small/medium repair), cleanliness +10/+12/+15/+20/+25 (small/
    // medium), smell -10/-12 (small clean), condition +5/+10/+12/+20.
    // Axis-neutral on the condition/cleanliness vs damage split — verbs
    // ("slip" / "lift" / "settle") carry the meaning regardless of which
    // sub-meter moved. No `large` emissions today; single optimistic
    // snippet apiece. Direction = the raw sign of the amount: positive
    // direction can mean "cleaner room" (cleanliness +10) or "more
    // damage" (damage +6), so snippets stay neutral on the change and
    // let the verb carry weight.
    {
      id: 'shared_preview_area_neg_tiny_a',
      text: 'a hair of wear would creep across the floor',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_area_neg_small_a',
      text: 'the room would slip by a step tonight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_area_neg_small_b',
      text: 'a notch of grime would mark the corner',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_area_neg_medium_a',
      text: 'a clear drop would mark the room by morning',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_area_neg_large_a',
      text: 'a heavy fall would scar the floor through',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_tiny_a',
      text: 'a hair of order would touch the kitchen',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_small_a',
      text: 'the floor would read by a step cleaner',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_small_b',
      text: 'a notch of polish would steady the corner',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3. Split same-band
    // area slots (repair / patch / close) onto distinct lines by shape.
    {
      id: 'shared_preview_area_pos_small_long',
      text: 'a measure of repair would steady the floor',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    // Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5. Sibling
    // long_term variants so the within-card distinctness pass can spread
    // several long-term repair choices (an inspection card carries up to
    // four) onto distinct magnitude-bearing lines instead of repeating one.
    {
      id: 'shared_preview_area_pos_small_long_b',
      text: 'fresh joinery would firm the floor a notch',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_small_long_c',
      text: 'a measure of new timber would brace the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_small_long_d',
      text: 'a step of real work would settle the kitchen',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_small_patch',
      text: 'a quick patch would lift the corner a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
        { kind: 'responseShape', anyOf: ['short_term_patch'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_medium_a',
      text: 'a clear lift would brighten the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_medium_b',
      text: 'the floor would gain a real step of polish',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_area_pos_large_a',
      text: 'a strong climb would scrub the kitchen through',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['area'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // ---- pressure (Phase 159 / ISSUE-127 recalibration) ----
    //
    // Most-emitted preview target in the sim — every major family writes
    // pressure deltas through `delayedEffects`. Positive direction = rising
    // (bad); negative direction = relief (good). Lexicon tokens still apply
    // ("a step" / "a clear lift" / "a marked rise") — the surrounding verb
    // ("build" / "mount" / "climb" / "creep" for rising; "settle" / "ease" /
    // "loosen" / "fall back" for relief) carries the threat-vs-relief tone.
    // Axis-neutral across the 20 pressure families (`landlord`, `debt`,
    // `staff_burnout`, `food_safety`, etc.) — Phase 13's reputation axis
    // precedent. Family-specific snippets are a future loopback candidate
    // if play surfaces it.
    {
      id: 'shared_preview_pressure_neg_tiny_a',
      text: 'a hair of pressure would lift off the meter',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_small_a',
      text: 'the meter would settle a step lower',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_small_b',
      text: 'a notch of pressure would ease off the reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_small_c',
      text: 'a measure of risk would loosen its grip',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_medium_a',
      text: 'pressure would fall back a clear drop',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_medium_b',
      text: 'the reading would quiet by a real slip',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3. Several slots on
    // one card relieve the same pressure in the same band (inspection,
    // rumour_crisis, seasonal_arc all hit 3-way collapse here). Split by shape.
    {
      id: 'shared_preview_pressure_neg_medium_risky',
      text: 'a marked fall would ease the risk taken',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['risky_profitable'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_medium_compromise',
      text: 'a marked fall would settle the meter for now',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['compromise'] },
      ],
    },
    {
      id: 'shared_preview_pressure_neg_large_a',
      text: 'a heavy fall would lift the worst pressure off',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_tiny_a',
      text: 'a hair of pressure would press onto the reading',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_small_a',
      text: 'the meter would climb by a step further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_small_b',
      text: 'a notch of pressure would mount through the night',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_small_c',
      text: 'a measure of risk would thicken on the meter',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_medium_a',
      text: 'a clear lift would build pressure onto the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_medium_b',
      text: 'the reading would creep up by a real step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_medium_c',
      text: 'a marked rise would press onto the meter',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_pressure_pos_large_a',
      text: 'a strong climb would mount risk to a peak',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // ---- pressure inaction block (Phase 159 / ISSUE-127) ----
    //
    // Specificity 4: `inactionPreview: true` + `effectTargetKind: pressure`
    // + `effectDirection: positive` + `effectMagnitudeBand`. Every inaction
    // profile across the sim (14 `immediateEffects: []` profiles in
    // `issueSeedGenerators.ts` + `expandedSeedGenerators.ts`) emits delayed
    // positive pressure as its consequence — stock_shortage, maintenance,
    // staff_burnout, debt, inspection, food_safety, customer_complaint,
    // regular_loss, rival, rumour. These snippets out-rank the active-
    // choice pressure base on the inaction path; the leading "would keep" /
    // "would mount unchecked" frames the "what *not* acting costs" temporal
    // claim Phase 147 wired through the `inactionPreview` ctx. Active-
    // choice renders never receive `inactionPreview: true`, so these stay
    // out of "treat now" preview text.
    {
      id: 'shared_preview_pressure_inact_pos_small_a',
      text: 'pressure would keep climbing a step unchecked',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_inact_pos_small_b',
      text: 'the meter would mount a notch with every hour',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_inact_pos_small_c',
      text: 'a measure of risk would build with no answer',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_pressure_inact_pos_medium_a',
      text: 'pressure would mount unchecked by a clear lift',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_pressure_inact_pos_medium_b',
      text: 'the reading would press harder by a marked rise',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_pressure_inact_pos_large_a',
      text: 'a strong climb of risk would mount without check',
      conditions: [
        { kind: 'inactionPreview', value: true },
        { kind: 'effectTargetKind', anyOf: ['pressure'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // ---- customer (Phase 158 / ISSUE-126 recalibration) ----
    //
    // Production emits: satisfaction -5/-6 (small) through -8 (medium);
    // patronage +4 (small) through +12 (medium); patronage -25 (large
    // bans). `tiny` and `pos large` get optimistic single snippets.
    {
      id: 'shared_preview_customer_neg_tiny_a',
      text: 'a hair of patience would slip from the patron',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_customer_neg_small_a',
      text: 'the regular would cool by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_customer_neg_small_b',
      text: 'a notch of patience would leave the customer',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_customer_neg_medium_a',
      text: 'a clear drop would set the patron grumbling',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_customer_neg_medium_b',
      text: 'a real slip of trust would chill the guest',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_customer_neg_large_a',
      text: 'a heavy fall would empty the regular tables',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_customer_pos_tiny_a',
      text: 'a hair of warmth would reach the patron',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_customer_pos_small_a',
      text: 'the regular would lean in by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_customer_pos_medium_a',
      text: 'a real step would draw the customer closer',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_customer_pos_medium_b',
      text: 'a clear lift would settle the guest into the bench',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    // Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5. A complaint
    // card carries up to three customer-positive-medium choices; a third
    // sibling lets the distinctness pass keep all three distinct.
    {
      id: 'shared_preview_customer_pos_medium_c',
      text: 'a marked rise would warm the regular to the bar',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_customer_pos_large_a',
      text: 'a surge of patronage would fill every regular seat',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['customer'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // ---- staff (Phase 159 / ISSUE-127 recalibration) ----
    //
    // Production emits: stress -8/-10/-12 (small/medium); fatigue
    // -3/-15 + +4/+6/+8 (tiny → medium); morale -6/-12/-15 + +6/+8/+12/+15;
    // loyalty -3/-4/-20 + +6/+8/+10/+14/+15/+20. Axis-neutral on the
    // stress/fatigue/morale/loyalty split — verbs ("wear" / "steady" /
    // "weigh") carry the meaning regardless of which sub-meter moved.
    // Direction = the raw sign of the amount: positive direction can
    // mean "rising stress" (bad) or "rising morale" (good); the
    // surrounding state-change verbs stay neutral on the value direction
    // and let the consequence-profile context steer interpretation. No
    // `tiny` cells emitted; single optimistic snippet apiece.
    {
      id: 'shared_preview_staff_neg_tiny_a',
      text: 'a hair of the rota would slip tonight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_staff_neg_small_a',
      text: 'the crew would lean harder by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_staff_neg_small_b',
      text: 'a notch of weight would land on the shift',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_staff_neg_medium_a',
      text: 'a clear drop would weigh on the kitchen crew',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_staff_neg_medium_b',
      text: 'the rota would wear thin by a real slip',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_staff_neg_large_a',
      text: 'a heavy fall would hollow the kitchen crew',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_staff_neg_large_b',
      text: 'a sharp drop would empty the rota by half',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_tiny_a',
      text: 'a hair of ease would touch the rota tonight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_small_a',
      text: 'the crew would steady by a step tonight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_small_b',
      text: 'the rota would settle a notch lighter',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_small_c',
      text: 'a measure of relief would reach the shift',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_medium_a',
      text: 'a clear lift would buoy the kitchen tonight',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_medium_b',
      text: 'the crew would gain a real step of grit',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3 (Distinguishable
    // Choices). Several response slots on one staff card carry a same-band
    // staff effect and so collapsed to one of the medium lines above. These
    // `responseShape`-gated variants (4 conditions ⇒ specificity 4, out-ranking
    // the 3-condition base) split distinct-shape slots onto distinct lines.
    {
      id: 'shared_preview_staff_pos_medium_relsac',
      text: "the crew would feel a marked rise in trust",
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['relationship_sacrifice'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_medium_repplay',
      text: 'a marked rise would back the rota in public',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['reputation_play'] },
      ],
    },
    {
      id: 'shared_preview_staff_pos_large_a',
      text: 'a strong climb of loyalty would bind the crew',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5. Sibling so two
    // staff-lifting choices on one card read distinctly.
    {
      id: 'shared_preview_staff_pos_large_b',
      text: 'a wide leap of morale would lift the whole crew',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['staff'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // ---- reputation (Phase 158 / ISSUE-126 recalibration) ----
    //
    // Production emits: tiny -3/-4 + pos +2/+4 (`respectable`,
    // `dangerous`, `goblinAuthentic`); small dominant on both sides;
    // medium -10 (`cheap`, `reliable`) + +10/+12 (`reliable`,
    // `respectable`, `tasty`). No `large` cells today. Axis-neutral by
    // design (reputation effects encode axis in the target string, not in
    // tags — per-axis specificity is a future loopback per the Phase 158
    // plan). Three snippets at each high-traffic small cell so the FNV
    // tie-break spreads them across a multi-effect render.
    {
      id: 'shared_preview_reputation_neg_tiny_a',
      text: 'a hair of standing would slip from the name',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_tiny_b',
      text: 'talk would dim a touch around the tavern',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_small_a',
      text: 'the name would lose a step of standing',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_small_b',
      text: 'a notch of repute would slip into the word',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_small_c',
      text: 'the tavern talk would dim by a measure',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_medium_a',
      text: 'a clear drop would mark the tavern name',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_medium_b',
      text: 'talk would carry a marked fall against the house',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_reputation_neg_large_a',
      text: 'a heavy fall would crush the tavern name in talk',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_tiny_a',
      text: 'a hair of repute would settle on the name',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_small_a',
      text: 'the name would gain a step in the talk',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_small_b',
      text: 'a notch of standing would warm the word',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_small_c',
      text: 'the tavern name would carry a measure further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_medium_a',
      text: 'a clear lift would carry the name further',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_medium_b',
      text: 'a real step would settle the word across the city',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_reputation_pos_large_a',
      text: 'a surge would carry the tavern name across the city',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['reputation'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // ---- cohort (Phase 158 / ISSUE-126 recalibration) ----
    //
    // No `state_change` cohort emissions in production today — every
    // customer_group: effect is a `cause` write. Each cell gets a single
    // optimistic snippet so a future emission stays legible. The
    // direction-neutral kind+direction snippet stays for the cause-write
    // path (direction === 'neutral' / undefined band).
    {
      id: 'shared_preview_cohort_neg_tiny_a',
      text: 'a touch of unease would settle on the crowd',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_cohort_neg_small_a',
      text: 'the table would harden by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_cohort_neg_medium_a',
      text: 'a clear drop would turn the crowd grumbling',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_cohort_neg_large_a',
      text: 'a heavy fall would empty the cohort table',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_cohort_pos_tiny_a',
      text: 'a hair of warmth would settle on the crowd',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_cohort_pos_small_a',
      text: 'a step of goodwill would draw the table in',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_cohort_pos_medium_a',
      text: 'a marked rise would warm the crowd through the night',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_cohort_pos_large_a',
      text: 'a surge would fill the cohort table for the night',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['cohort'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
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
    // ---- supplier (Phase 158 / ISSUE-126 recalibration) ----
    //
    // Production emits: relationship/reliability -5 (small) / -10 (medium)
    // / +3 / +5. No production large or pos-medium cells. supplierReliability
    // template carries 6 `pre_leg_supplier_*` snippets at the same
    // 3-condition specificity; the base authors here use distinct vocabulary
    // so dedupe stays below 0.85 and FNV tie-break spreads renders between
    // base and template variants.
    {
      id: 'shared_preview_supplier_neg_tiny_a',
      text: 'a touch would cool the supplier line',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_supplier_neg_small_a',
      text: 'a notch would loosen the supplier deal',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_supplier_neg_medium_a',
      text: 'a marked fall would chill the merchant route',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_supplier_neg_large_a',
      text: 'a heavy fall would sever the supplier lane',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_supplier_pos_tiny_a',
      text: 'a touch of goodwill would reach the trader',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_supplier_pos_small_a',
      text: 'a measure of goodwill would settle on the deal',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_supplier_pos_medium_a',
      text: 'a marked rise would steady the merchant route',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_supplier_pos_large_a',
      text: 'a wide leap would bind the supplier deal closer',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['supplier'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
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
    // ---- faction (Phase 158 / ISSUE-126 recalibration) ----
    //
    // Production emits: trust -8 (small), trust -12 / relationship -15
    // (medium), relationship -20/-25 (large) on betrayal paths; +5/+8
    // small / +10/+15 medium on alliance & hosting paths; +15 fear large.
    {
      id: 'shared_preview_faction_neg_tiny_a',
      text: 'a hair of grace would slip from the guild',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_faction_neg_small_a',
      text: 'the order would cool by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_faction_neg_medium_a',
      text: 'a clear drop would harden the guild stance',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_faction_neg_medium_b',
      text: 'the guild would shutter a real slip behind it',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_faction_neg_large_a',
      text: 'a heavy fall would sever ties with the faction',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    // Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5. Sibling so two
    // faction-souring choices on one card read distinctly.
    {
      id: 'shared_preview_faction_neg_large_b',
      text: 'a sharp drop would freeze the guild against the bar',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_tiny_a',
      text: 'a hair of warmth would reach the guild',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_small_a',
      text: 'a step of goodwill would reach the order',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_small_b',
      text: 'a notch of trust would settle with the guild',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_medium_a',
      text: 'a clear lift would draw the faction closer',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_medium_b',
      text: 'the house would warm by a real step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3. Split same-band
    // faction slots (appease / negotiate / host) onto distinct lines by shape.
    {
      id: 'shared_preview_faction_pos_medium_safe',
      text: "a marked rise would settle the guild's favour",
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['safe_costly'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_medium_compromise',
      text: 'the order would warm a marked rise on terms',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['compromise'] },
      ],
    },
    {
      id: 'shared_preview_faction_pos_large_a',
      text: 'a surge would reshape standing with the faction',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['faction'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
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
    // ---- culture (Phase 158 / ISSUE-126 recalibration) ----
    //
    // Production emits: comfort -8 small, tension +12 / comfort -8 medium,
    // tension -10..-15 / comfort -8..-15 medium; +8..+9 small, +10..+15
    // medium across familiarity / comfort / tension-relief. No tiny or
    // large emissions today.
    {
      id: 'shared_preview_culture_neg_tiny_a',
      text: 'a hair of ease would slip from the folk',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_culture_neg_small_a',
      text: 'the kin would cool by a step',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_culture_neg_medium_a',
      text: 'a clear drop would mark the culture standing',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_culture_neg_medium_b',
      text: 'kin lines would harden by a real slip',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_culture_neg_large_a',
      text: 'a heavy fall would set the culture against the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'negative' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_tiny_a',
      text: 'a hair of ease would settle on the folk',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['tiny'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_small_a',
      text: 'the kin would warm by a step into the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    // Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5. Sibling
    // candidates so several culture choices on one card render distinctly.
    {
      id: 'shared_preview_culture_pos_small_b',
      text: 'the folk would settle a notch into the night',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_small_c',
      text: 'a measure of ease would reach the gathered kin',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['small'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_medium_a',
      text: 'a clear lift would warm the people gathered',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_medium_b',
      text: 'a real step would knit the kin into the night',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_medium_c',
      text: 'a marked rise would steady the folk in the room',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
      ],
    },
    // Phase 165 / ISSUE-133 — Faithful Surface arc, Phase 3. Split same-band
    // culture slots (honour / offer_discount) onto distinct lines by shape.
    {
      id: 'shared_preview_culture_pos_medium_long',
      text: 'the kin would warm a marked rise for good',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['long_term_investment'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_medium_safe',
      text: 'a marked rise would ease the gathered folk',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['medium'] },
        { kind: 'responseShape', anyOf: ['safe_costly'] },
      ],
    },
    {
      id: 'shared_preview_culture_pos_large_a',
      text: 'a surge would bind the people to the tavern',
      conditions: [
        { kind: 'effectTargetKind', anyOf: ['culture'] },
        { kind: 'effectDirection', sign: 'positive' },
        { kind: 'effectMagnitudeBand', anyOf: ['large'] },
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
