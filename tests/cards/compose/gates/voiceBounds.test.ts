// Phase 124 / ISSUE-093 — Living Cast arc, Phase D.
// Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5: trailing-"…" and
// immediate-duplicate-token checks added to the gate. Both gate against
// the symptoms the old `clampWords` / `formatTitle` path produced.
//
// Voice-bounds gate (framework §6 #3): every snippet's text fits its
// slot's word budget. Budget resolution: config.perSlot[id] →
// slot.wordBudget → config.defaultWordBudget → 12.

import { describe, expect, it } from 'vitest'

import {
  checkVoiceBounds,
  DEFAULT_BODY_WORD_BUDGET,
  VOICE_BOUNDS_REASONS,
} from '../../../../src/cards/compose/gates'
import { drinkOrderTemplate } from '../../../../src/cards/templates/drinkOrder'
import { staffAsideTemplate } from '../../../../src/cards/templates/staffAside'
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

  // Phase 126 / ISSUE-095 — staffAside's per-slot budgets mirror drinkOrder's
  // (aside_line ≤ 12, manner_note ≤ 10). Every committed snippet must respect them.
  it('the real staffAside template passes with default config', () => {
    const report = checkVoiceBounds(staffAsideTemplate)
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
    expect(report.violations[0]!.reason).toBe(VOICE_BOUNDS_REASONS.overBudget)
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
      report.violations.every((v) => v.reason === VOICE_BOUNDS_REASONS.overBudget),
    ).toBe(true)
  })

  // Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5. The gate now
  // forbids the two symptoms the legacy `clampWords` / `formatTitle`
  // path produced: a trailing "…" (mid-phrase truncation) and an
  // immediate duplicate token (the structural half of the
  // "Main Room: Main Room" / "the the" class of frame breakage).
  it('trailing "…" fails with trailing_ellipsis', () => {
    const bad = buildTemplate('bad_trailing_ellipsis', [
      {
        id: 'title',
        role: 'title',
        wordBudget: 6,
        claimMode: 'flavor',
        pool: {
          slotId: 'title',
          snippets: [
            { id: 'fallback', text: 'orders a drink', conditions: [] },
            {
              id: 'clamped',
              text: 'a word before opening…',
              conditions: [],
            },
          ],
        },
      },
    ])
    const report = checkVoiceBounds(bad)
    expect(report.pass).toBe(false)
    const violation = report.violations.find((v) => v.snippetId === 'clamped')
    expect(violation).toBeDefined()
    expect(violation!.reason).toBe(VOICE_BOUNDS_REASONS.trailingEllipsis)
  })

  it('trailing "..." (three ASCII dots) also fails with trailing_ellipsis', () => {
    const bad = buildTemplate('bad_ascii_ellipsis', [
      {
        id: 'title',
        role: 'title',
        wordBudget: 6,
        claimMode: 'flavor',
        pool: {
          slotId: 'title',
          snippets: [
            { id: 'fallback', text: 'orders a drink', conditions: [] },
            { id: 'ascii_clamped', text: 'a thought trailing off...', conditions: [] },
          ],
        },
      },
    ])
    const report = checkVoiceBounds(bad)
    expect(report.pass).toBe(false)
    expect(
      report.violations.find((v) => v.snippetId === 'ascii_clamped')!.reason,
    ).toBe(VOICE_BOUNDS_REASONS.trailingEllipsis)
  })

  it('immediate duplicate token fails with duplicate_token', () => {
    const bad = buildTemplate('bad_duplicate_token', [
      {
        id: 'title',
        role: 'title',
        wordBudget: 6,
        claimMode: 'flavor',
        pool: {
          slotId: 'title',
          snippets: [
            { id: 'fallback', text: 'orders a drink', conditions: [] },
            { id: 'doubled', text: 'the the bar', conditions: [] },
          ],
        },
      },
    ])
    const report = checkVoiceBounds(bad)
    expect(report.pass).toBe(false)
    const violation = report.violations.find((v) => v.snippetId === 'doubled')
    expect(violation).toBeDefined()
    expect(violation!.reason).toBe(VOICE_BOUNDS_REASONS.duplicateToken)
    expect(violation!.detail).toContain('"the"')
  })

  it('duplicate token check is case-insensitive', () => {
    const bad = buildTemplate('bad_caps_duplicate', [
      {
        id: 'title',
        role: 'title',
        wordBudget: 6,
        claimMode: 'flavor',
        pool: {
          slotId: 'title',
          snippets: [
            { id: 'fallback', text: 'orders a drink', conditions: [] },
            { id: 'caps_doubled', text: 'Main Main Room', conditions: [] },
          ],
        },
      },
    ])
    const report = checkVoiceBounds(bad)
    expect(report.pass).toBe(false)
    expect(
      report.violations.find((v) => v.snippetId === 'caps_doubled')!.reason,
    ).toBe(VOICE_BOUNDS_REASONS.duplicateToken)
  })
})

describe('voice-bounds gate — clean text', () => {
  // Phase 131 / ISSUE-100 — Voiced Surface arc, Phase 5. Make sure the
  // happy path covers all three checks against the real templates: no
  // over-budget snippets, no trailing "…", no immediate duplicate
  // tokens anywhere in any pool.
  it('the real templates have no trailing-ellipsis or duplicate-token violations', () => {
    for (const tmpl of [drinkOrderTemplate, staffAsideTemplate]) {
      const report = checkVoiceBounds(tmpl)
      expect(report.pass).toBe(true)
      const offenders = report.violations.filter(
        (v) =>
          v.reason === VOICE_BOUNDS_REASONS.trailingEllipsis ||
          v.reason === VOICE_BOUNDS_REASONS.duplicateToken,
      )
      expect(offenders).toEqual([])
    }
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
