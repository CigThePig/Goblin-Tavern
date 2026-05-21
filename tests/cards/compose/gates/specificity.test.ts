// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Specificity-gradient gate (framework §6 #2): required pools need both
// (a) ≥ 1 unconditional fallback and (b) ≥ 1 conditioned snippet.

import { describe, expect, it } from 'vitest'

import { checkSpecificityGradient } from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
import {
  allFallbackSlot,
  buildTemplate,
  noFallbackSlot,
} from './fixtures'

describe('specificity gradient gate', () => {
  it('the real drinkOrder template passes — order_line has fallback + 15 conditioned', () => {
    const report = checkSpecificityGradient(drinkOrderTemplate)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  // Phase 126 / ISSUE-095 — Phase F's second template carries the same gradient.
  it('the real staffAside template passes — aside_line has fallback + 17 conditioned', () => {
    const report = checkSpecificityGradient(staffAsideTemplate)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('an all-fallback pool fails with no_conditioned_snippet', () => {
    const bad = buildTemplate('bad_all_fallback', [allFallbackSlot()])
    const report = checkSpecificityGradient(bad)
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.reason).toBe('no_conditioned_snippet')
    expect(report.violations[0]!.slotId).toBe('order_line')
  })

  it('a no-fallback pool fails with no_fallback', () => {
    const bad = buildTemplate('bad_no_fallback', [noFallbackSlot()])
    const report = checkSpecificityGradient(bad)
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.reason).toBe('no_fallback')
  })

  it('optional slots are exempt from both halves', () => {
    const optionalOnly = buildTemplate('optional_only', [
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
    const report = checkSpecificityGradient(optionalOnly)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })
})
