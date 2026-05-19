// Phase 118 / ISSUE-079 — Glossary coverage check.
//
// Walks every Svelte component in `web/src/lib/components/` looking
// for `<TermLabel term="…">` (and the dynamic `term={…}` template
// variant we have to skip). Asserts that every static literal term
// resolves to an entry in `GLOSSARY_TERMS`.
//
// TermLabel gracefully falls back to plain text when a term is
// missing, so this is a soft contract — but the point of the
// comprehension pass is that every player-facing term IS in the
// glossary. Treating missing entries as a test failure prevents
// regressions on that contract.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { getTerm } from '../../src/reports/glossary'

const COMPONENTS_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  'web',
  'src',
  'lib',
  'components',
)

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) {
      out.push(...walk(full))
    } else if (full.endsWith('.svelte')) {
      out.push(full)
    }
  }
  return out
}

const STATIC_TERM_RE = /<TermLabel\s+[^>]*\bterm="([^"]+)"/g

describe('Phase 118 — glossary coverage', () => {
  it('every static TermLabel term in components has a glossary entry', () => {
    const files = walk(COMPONENTS_ROOT)
    const missing: { file: string; term: string }[] = []

    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const match of src.matchAll(STATIC_TERM_RE)) {
        const term = match[1]!
        if (!getTerm(term)) {
          missing.push({ file: path.relative(COMPONENTS_ROOT, file), term })
        }
      }
    }

    if (missing.length > 0) {
      const summary = missing
        .map((m) => `  - ${m.term} (used in ${m.file})`)
        .join('\n')
      throw new Error(
        `TermLabel terms without glossary entries:\n${summary}`,
      )
    }
    expect(missing).toEqual([])
  })

  it('Phase 118 newly-added terms resolve', () => {
    const expected = [
      'upkeep',
      'action_points',
      'queued_action',
      'shortage',
      'outcome_success',
      'outcome_partial_success',
      'outcome_failure',
      'outcome_runner_lost',
      'dayType_quiet_day',
      'dayType_supplier_day',
      'dayType_payday',
      'dayType_market_day',
      'dayType_festival_eve',
      'dayType_festival_day',
      'dayType_rent_day',
      'dayType_inspection_day',
    ]
    for (const id of expected) {
      const entry = getTerm(id)
      expect(entry, `missing glossary term ${id}`).toBeDefined()
      expect(entry!.oneLine.length).toBeGreaterThan(0)
    }
  })
})
