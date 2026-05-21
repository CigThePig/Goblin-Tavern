// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Coverage gate (framework §6 #1): every REQUIRED slot's pool has an
// unconditional fallback. Optional slots are exempt.

import { describe, expect, it } from 'vitest'

import { checkCoverage } from '../../../../src/cards/compose/gates'
import {
  drinkOrderCard,
  drinkOrderTemplate,
} from '../../../../src/cards/templates/drinkOrder'
import {
  buildTemplate,
  noFallbackSlot,
} from './fixtures'

describe('coverage gate', () => {
  it('the real drinkOrder template passes — order_line has order_fallback_plain', () => {
    const report = checkCoverage(drinkOrderTemplate)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
    // Sanity belt: the live card is the same template object via the
    // factory, so a one-line guard against accidental skew.
    expect(drinkOrderCard.id).toBe(drinkOrderTemplate.id)
  })

  it('a template missing the order_line fallback fails with missing_unconditional_fallback', () => {
    const bad = buildTemplate('bad_no_fallback', [noFallbackSlot()])
    const report = checkCoverage(bad)
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.slotId).toBe('order_line')
    expect(report.violations[0]!.reason).toBe('missing_unconditional_fallback')
  })

  it('an optional slot with no fallback passes (silence is the safety net)', () => {
    const optionalNoFallback = buildTemplate('optional_only', [
      {
        id: 'aside',
        role: 'aside',
        optional: true,
        pool: {
          slotId: 'aside',
          snippets: [
            {
              id: 'rare',
              text: 'They flick a coin.',
              conditions: [
                { kind: 'voiceAxis', role: 'primaryActor', axis: 'warmth', atLeast: 2 },
              ],
            },
          ],
        },
      },
    ])
    const report = checkCoverage(optionalNoFallback)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })
})
