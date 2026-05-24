// Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2.
//
// Unit coverage for the calibrated magnitude vocabulary. The lexicon is
// shared data between authors and the `requireMagnitude` rule on
// `checkPreviewVariety`; if a (direction, band) cell goes empty or the
// `lineCarriesMagnitude` substring check regresses, every authored line
// for that cell silently fails the gate.

import { describe, expect, it } from 'vitest'

import {
  MAGNITUDE_LEXICON,
  lineCarriesMagnitude,
} from '../../../src/cards/compose/magnitudeLexicon'
import type {
  EffectDirection,
  EffectMagnitudeBand,
} from '../../../src/sim/core/effect'

const DIRECTIONS: readonly EffectDirection[] = [
  'positive',
  'negative',
  'neutral',
]
const BANDS: readonly EffectMagnitudeBand[] = [
  'tiny',
  'small',
  'medium',
  'large',
]

describe('MAGNITUDE_LEXICON — shape', () => {
  it('covers every (direction × band) cell', () => {
    for (const direction of DIRECTIONS) {
      const row = MAGNITUDE_LEXICON[direction]
      expect(row, `direction ${direction}`).toBeDefined()
      for (const band of BANDS) {
        const tokens = row[band]
        expect(
          tokens,
          `direction ${direction} band ${band} tokens`,
        ).toBeDefined()
        expect(
          tokens.length,
          `direction ${direction} band ${band} non-empty`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('shares vocabulary across positive/negative for tiny+small (verb carries direction)', () => {
    expect(MAGNITUDE_LEXICON.positive.tiny).toEqual(
      MAGNITUDE_LEXICON.negative.tiny,
    )
    expect(MAGNITUDE_LEXICON.positive.small).toEqual(
      MAGNITUDE_LEXICON.negative.small,
    )
  })

  it('diverges vocabulary across positive/negative for medium+large (magnitude itself reads directional)', () => {
    expect(MAGNITUDE_LEXICON.positive.medium).not.toEqual(
      MAGNITUDE_LEXICON.negative.medium,
    )
    expect(MAGNITUDE_LEXICON.positive.large).not.toEqual(
      MAGNITUDE_LEXICON.negative.large,
    )
  })

  it('tokens are short ≤ 4-word phrases (used as substring matches)', () => {
    for (const direction of DIRECTIONS) {
      for (const band of BANDS) {
        for (const token of MAGNITUDE_LEXICON[direction][band]) {
          const wordCount = token.trim().split(/\s+/).length
          expect(
            wordCount,
            `"${token}" in ${direction}/${band}`,
          ).toBeLessThanOrEqual(4)
        }
      }
    }
  })
})

describe('lineCarriesMagnitude', () => {
  it('returns true when the line contains any token for the cell', () => {
    expect(
      lineCarriesMagnitude(
        'coin would leave the till by a step',
        'negative',
        'small',
      ),
    ).toBe(true)
    expect(
      lineCarriesMagnitude(
        'the meter would climb a hair',
        'positive',
        'tiny',
      ),
    ).toBe(true)
    expect(
      lineCarriesMagnitude(
        'a heavy fall of silver would empty the purse',
        'negative',
        'large',
      ),
    ).toBe(true)
  })

  it('is case-insensitive (matches "A Step" in mid-sentence "A Step Back")', () => {
    expect(
      lineCarriesMagnitude('A Step Back from the till', 'negative', 'small'),
    ).toBe(true)
  })

  it('returns false when no token for the cell appears', () => {
    expect(
      lineCarriesMagnitude(
        'the room steadies its footing',
        'positive',
        'small',
      ),
    ).toBe(false)
    expect(
      lineCarriesMagnitude(
        'coin would land in the till',
        'positive',
        'medium',
      ),
    ).toBe(false)
  })

  it('does not cross direction × band cells (positive.tiny token does not satisfy negative.large)', () => {
    // "a hair" is in positive.tiny + negative.tiny only.
    expect(
      lineCarriesMagnitude('a hair of coin', 'positive', 'tiny'),
    ).toBe(true)
    expect(
      lineCarriesMagnitude('a hair of coin', 'negative', 'large'),
    ).toBe(false)
  })

  it('accepts an override lexicon for test isolation', () => {
    const custom = {
      positive: {
        tiny: ['CUSTOM_TINY'] as const,
        small: ['CUSTOM_SMALL'] as const,
        medium: ['CUSTOM_MEDIUM'] as const,
        large: ['CUSTOM_LARGE'] as const,
      },
      negative: {
        tiny: ['CUSTOM_TINY'] as const,
        small: ['CUSTOM_SMALL'] as const,
        medium: ['CUSTOM_MEDIUM'] as const,
        large: ['CUSTOM_LARGE'] as const,
      },
      neutral: {
        tiny: ['CUSTOM_TINY'] as const,
        small: ['CUSTOM_SMALL'] as const,
        medium: ['CUSTOM_MEDIUM'] as const,
        large: ['CUSTOM_LARGE'] as const,
      },
    }
    expect(
      lineCarriesMagnitude('the meter custom_medium climbs', 'positive', 'medium', custom),
    ).toBe(true)
    expect(
      lineCarriesMagnitude('a hair of coin', 'positive', 'tiny', custom),
    ).toBe(false)
  })
})
