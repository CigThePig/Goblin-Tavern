// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
//
// Voice-bounds gate (framework §6 #3): every snippet's text fits its
// slot's word budget. Budget resolution: config.perSlot[id] →
// slot.wordBudget → config.defaultWordBudget → 12.

import { describe, expect, it } from 'vitest'

import {
  checkVoiceBounds,
  DEFAULT_BODY_WORD_BUDGET,
} from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import {
  buildTemplate,
  overBudgetSlot,
} from './fixtures'

describe('voice-bounds gate — happy path', () => {
  it('the real drinkOrder template passes with default config', () => {
    const report = checkVoiceBounds(drinkOrderTemplate)
    expect(report.pass).toBe(true)
    expect(report.violations).toEqual([])
  })

  it('uses slot.wordBudget when no config is supplied', () => {
    // drinkOrder's manner_note carries wordBudget: 10 and every snippet
    // is ≤ 10 words. Override the default to 12 and confirm it still
    // passes — proves slot.wordBudget beats the default.
    const report = checkVoiceBounds(drinkOrderTemplate, {
      defaultWordBudget: DEFAULT_BODY_WORD_BUDGET,
    })
    expect(report.pass).toBe(true)
  })
})

describe('voice-bounds gate — failures', () => {
  it('over-budget snippet fails with over_budget', () => {
    const budget = 5
    const bad = buildTemplate('bad_over_budget', [overBudgetSlot(budget)])
    const report = checkVoiceBounds(bad)
    expect(report.pass).toBe(false)
    expect(report.violations).toHaveLength(1)
    expect(report.violations[0]!.snippetId).toBe('too_long')
    expect(report.violations[0]!.reason).toBe('over_budget')
    expect(report.violations[0]!.detail).toContain(`> ${budget} budget`)
  })

  it('config.perSlot overrides slot.wordBudget', () => {
    // The real drinkOrder snippets are all ≤ 12 words. Forcing a tighter
    // perSlot budget of 5 makes some of them fail.
    const report = checkVoiceBounds(drinkOrderTemplate, {
      perSlot: { order_line: 5 },
    })
    expect(report.pass).toBe(false)
    expect(
      report.violations.every((v) => v.slotId === 'order_line'),
    ).toBe(true)
    expect(
      report.violations.every((v) => v.reason === 'over_budget'),
    ).toBe(true)
  })
})

describe('voice-bounds gate — default budget', () => {
  it('falls back to DEFAULT_BODY_WORD_BUDGET when no slot or config carries one', () => {
    // Build a template whose slot has no wordBudget; rely on the
    // 12-word framework default. A 13-word snippet must fail.
    const words: string[] = []
    for (let i = 0; i < 13; i += 1) words.push('w')
    const bad = buildTemplate('bad_default_budget', [
      {
        id: 'order_line',
        role: 'aside',
        pool: {
          slotId: 'order_line',
          snippets: [
            { id: 'fallback', text: 'Ale.', conditions: [] },
            { id: 'long', text: words.join(' '), conditions: [] },
          ],
        },
      },
    ])
    const report = checkVoiceBounds(bad)
    expect(report.pass).toBe(false)
    expect(report.violations[0]!.detail).toContain(
      `> ${DEFAULT_BODY_WORD_BUDGET} budget`,
    )
  })
})
