// Phase 141 / ISSUE-110 — Voiced Surface arc, Phase 15 (Reports Prose).
// Phase 160 / ISSUE-128 — Legible Surface arc, Phase 15 (Report-Prose
// Legibility): magnitude-banded variants added so a `+10` coin gain
// reads distinct from a `+150` one. Each banded snippet's text contains
// a token from `MAGNITUDE_LEXICON[direction][band]`.
//
// Voiced verb for the Yesterday Digest coin line, optional addition to
// the existing structured "Coin BEFORE → AFTER (DELTA)" line. The
// projection currently renders the structured form; this pool gives it
// a small voiced *direction × magnitude* prefix when desired.
//
// Routing via seed.domain (see `yesterdayDigest.ts:coinTags`):
//   - coin_gain (direction-only fallback) + coin_gain_small / _mid / _large.
//   - coin_loss (fallback) + coin_loss_small / _mid / _large.
//   - coin_flat (no magnitude movement).
//
// Banded snippets carry an explicit `specificity: 2` so they out-rank
// the direction-only fallback snippets (specificity 1) on the per-pool
// pick. See the parallel note in `secondaryVerb.ts`.
//
// Body cap 4 words (Phase 160 bump from 1 — lexicon tokens like
// "earned a clear lift" need the headroom).

import type { SnippetPool } from '../../../../cards/compose/types'

export const coinVerbPool: SnippetPool = {
  slotId: 'verb',
  snippets: [
    // — Unconditional fallback —
    {
      id: 'coin_fallback',
      text: 'shifted',
      conditions: [],
    },

    // — Coin gain (direction-only fallback) —
    {
      id: 'coin_gain_fallback_climbed',
      text: 'climbed',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain' }],
    },
    {
      id: 'coin_gain_fallback_gathered',
      text: 'gathered',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain' }],
    },

    // — Coin gain × magnitude (lexicon-bound, specificity 2) —
    {
      id: 'coin_gain_small_notch',
      text: 'earned a notch',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain_small' }],
      specificity: 2,
    },
    {
      id: 'coin_gain_small_measure',
      text: 'gathered a measure',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain_small' }],
      specificity: 2,
    },
    {
      id: 'coin_gain_mid_clear_lift',
      text: 'banked a clear lift',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain_mid' }],
      specificity: 2,
    },
    {
      id: 'coin_gain_mid_real_step',
      text: 'earned a real step',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain_mid' }],
      specificity: 2,
    },
    {
      id: 'coin_gain_large_surge',
      text: 'brought a surge',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain_large' }],
      specificity: 2,
    },
    {
      id: 'coin_gain_large_wide_leap',
      text: 'banked a wide leap',
      conditions: [{ kind: 'hasTag', tag: 'coin_gain_large' }],
      specificity: 2,
    },

    // — Coin loss (direction-only fallback) —
    {
      id: 'coin_loss_fallback_dropped',
      text: 'dropped',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss' }],
    },
    {
      id: 'coin_loss_fallback_thinned',
      text: 'thinned',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss' }],
    },

    // — Coin loss × magnitude (lexicon-bound, specificity 2) —
    {
      id: 'coin_loss_small_notch',
      text: 'spent a notch',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss_small' }],
      specificity: 2,
    },
    {
      id: 'coin_loss_small_measure',
      text: 'lost a measure',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss_small' }],
      specificity: 2,
    },
    {
      id: 'coin_loss_mid_real_slip',
      text: 'dropped a real slip',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss_mid' }],
      specificity: 2,
    },
    {
      id: 'coin_loss_mid_clear_drop',
      text: 'lost a clear drop',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss_mid' }],
      specificity: 2,
    },
    {
      id: 'coin_loss_large_heavy_fall',
      text: 'took a heavy fall',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss_large' }],
      specificity: 2,
    },
    {
      id: 'coin_loss_large_wide_slide',
      text: 'lost a wide slide',
      conditions: [{ kind: 'hasTag', tag: 'coin_loss_large' }],
      specificity: 2,
    },

    // — Coin hold —
    {
      id: 'coin_held',
      text: 'held',
      conditions: [{ kind: 'hasTag', tag: 'coin_flat' }],
    },
  ],
}
