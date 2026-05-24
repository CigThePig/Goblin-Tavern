// Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2.
//
// Calibrated magnitude vocabulary for effect-preview composition. Authors
// reach for these tokens whenever a preview line voices a banded effect,
// so "small" reads consistently whether it's `coin`, `stock`, `staff`,
// `pressure`, or `area`. The Phase-147 `requireMagnitude` rule on
// `checkPreviewVariety` reads the same table — if a rendered line whose
// effect carries a defined `magnitudeBand` contains no token from
// `MAGNITUDE_LEXICON[direction][band]`, the gate fires
// `preview_magnitude_missing`.
//
// Structural rules carried over from Phase 145's `DEFAULT_TARGET_KIND_KEYWORDS`:
//   - Plain data, no closures. Inspectable + enumerable by the gate.
//   - `as const` so callers can `.includes`-check the readonly arrays.
//   - Tokens are matched as case-insensitive substrings on the rendered
//     line; "a step" matches "would slip a step further".
//
// `tiny` and `small` share vocabulary across `positive` and `negative`
// because the surrounding verb already carries the direction ("rise a
// notch" vs "fall a notch"). `medium` and `large` diverge because at
// those scales the magnitude word itself reads as directional ("a clear
// lift" vs "a clear drop", "a surge" vs "a heavy fall").
//
// `neutral` covers effects whose `direction` resolves to `'neutral'`
// (zero or absent amount) — typically `memory` / `arc` / `attribution`
// markers. They get their own minimal vocabulary so a snippet that
// fires for a memory write doesn't accidentally borrow positive-band
// words.

import type {
  EffectDirection,
  EffectMagnitudeBand,
} from '../../sim/core/effect'

export const MAGNITUDE_LEXICON: Record<
  EffectDirection,
  Record<EffectMagnitudeBand, readonly string[]>
> = {
  positive: {
    tiny: ['a hair', 'a touch', 'a whisper'],
    small: ['a step', 'a notch', 'a measure'],
    medium: ['a clear lift', 'a real step', 'a marked rise'],
    large: ['a surge', 'a strong climb', 'a wide leap'],
  },
  negative: {
    tiny: ['a hair', 'a touch', 'a whisper'],
    small: ['a step', 'a notch', 'a measure'],
    medium: ['a clear drop', 'a real slip', 'a marked fall'],
    large: ['a heavy fall', 'a sharp drop', 'a wide slide'],
  },
  neutral: {
    tiny: ['a flicker', 'a shimmer'],
    small: ['a shift', 'a turn'],
    medium: ['a clear shift', 'a real turn'],
    large: ['a wide shift', 'a full turn'],
  },
} as const

/** Test for membership without re-implementing the case-insensitive
 *  substring search per call site. Used by the gate and by the
 *  legibility-check pieces that need to ask "does this line carry an
 *  appropriate magnitude word for its (direction, band)?" */
export function lineCarriesMagnitude(
  line: string,
  direction: EffectDirection,
  band: EffectMagnitudeBand,
  lexicon: Record<
    EffectDirection,
    Record<EffectMagnitudeBand, readonly string[]>
  > = MAGNITUDE_LEXICON,
): boolean {
  const tokens = lexicon[direction]?.[band] ?? []
  if (tokens.length === 0) return false
  const haystack = line.toLowerCase()
  return tokens.some((tok) => haystack.includes(tok.toLowerCase()))
}
