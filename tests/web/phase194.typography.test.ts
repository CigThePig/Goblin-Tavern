// @vitest-environment jsdom
//
// Phase 194 / ISSUE-161 — Typography scan-speed pass.
//
// Guards the `.tag` split:
//   - global.css carries the four-class vocabulary, and only the section
//     header + true-meta classes keep decorative small-caps.
//   - Functional/tappable chrome (primary nav, screen sub-nav, picker
//     tabs) no longer uses small-caps.
//   - `.tag` survives ONLY on an allowlist of passive meta-context labels;
//     any new `class="…tag…"` in functional chrome fails this test.
//   - A key component (ActionPicker) emits the new classes at runtime and
//     no longer renders `.tag`.

import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/svelte'

const WEB_SRC = join(process.cwd(), 'web/src/')

function read(rel: string): string {
  return readFileSync(join(WEB_SRC, rel), 'utf8')
}

/** Extract the body of a `.selector { … }` rule (first match, non-nested). */
function cssRule(css: string, selector: string): string {
  const re = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`)
  const m = css.match(re)
  if (!m) throw new Error(`rule ${selector} not found`)
  return m[1]!
}

const GLOBAL_CSS = read('lib/design/global.css')

// ---------- global.css vocabulary ----------

describe('global.css four-class vocabulary (Phase 194)', () => {
  it('.section-label keeps small-caps and uses the dim colour', () => {
    const body = cssRule(GLOBAL_CSS, '.section-label')
    expect(body).toContain('small-caps')
    expect(body).toContain('--text-dim')
  })

  it('.chip drops small-caps (sentence-case functional chrome)', () => {
    expect(cssRule(GLOBAL_CSS, '.chip')).not.toContain('small-caps')
  })

  it('.badge drops small-caps and carries an emphasis box', () => {
    const body = cssRule(GLOBAL_CSS, '.badge')
    expect(body).not.toContain('small-caps')
    expect(body).toContain('border')
  })

  it('.tag survives, narrowed, still small-caps for true meta', () => {
    expect(cssRule(GLOBAL_CSS, '.tag')).toContain('small-caps')
  })
})

// ---------- tappable chrome no longer uses small-caps ----------

describe('functional/tappable chrome has no small-caps (Phase 194)', () => {
  const cases: Array<[string, string]> = [
    ['lib/components/BottomNav.svelte', '.label'],
    ['lib/screens/ReportsScreen.svelte', '.subtab'],
    ['lib/screens/TavernScreen.svelte', '.subtab'],
    ['lib/screens/WorldScreen.svelte', '.subtab'],
    ['lib/components/ActionPicker.svelte', '.tab'],
  ]
  for (const [file, sel] of cases) {
    it(`${file} ${sel} is sentence case`, () => {
      expect(cssRule(read(file), sel)).not.toContain('small-caps')
    })
  }
})

// ---------- key components emit the new classes ----------

describe('key components emit the new class names (Phase 194)', () => {
  it('DailyReport section headers use .section-label', () => {
    const src = read('lib/components/DailyReport.svelte')
    expect(src).toContain('block-label section-label')
    expect(src).not.toMatch(/class="[^"]*block-label tag/)
  })

  it('ActionPicker uses .chip for hints and .section-label for the Suggested head', () => {
    const src = read('lib/components/ActionPicker.svelte')
    expect(src).toContain('targeting-hint chip')
    expect(src).toContain('suggested-head section-label')
  })

  it('AccuracyBadge keeps the .badge box without a decorative tag', () => {
    const src = read('lib/components/world/AccuracyBadge.svelte')
    expect(src).toContain('class="badge {accuracy}"')
    expect(src).not.toContain('badge tag')
  })
})

// ---------- regression: `.tag` only on the meta allowlist ----------

/** Recursively collect every `.svelte` file under web/src. */
function svelteFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) svelteFiles(full, acc)
    else if (entry.name.endsWith('.svelte')) acc.push(full)
  }
  return acc
}

/** A class string carries the standalone `tag` token (not `tag-…`). */
function hasTagToken(classStr: string): boolean {
  return classStr.split(/\s+/).includes('tag')
}

describe('`.tag` is reserved for passive meta context (Phase 194)', () => {
  // The only `class="…tag…"` usages allowed after migration, keyed by
  // `<relpath> :: <class string>`. Each is passive, non-tappable meta:
  // closed-period notes, log day-coordinates, the seed-family corner, and
  // the About footnote (the last two via component-scoped `.tag`).
  const ALLOW = new Set([
    'lib/components/CauseDrilldown.svelte :: cause-meta tag',
    'lib/components/YesterdayDigest.svelte :: head tag',
    'lib/components/TavernLog.svelte :: entity-prefix tag',
    'lib/components/TavernLog.svelte :: meta mono tag dim',
    'lib/components/TavernLog.svelte :: day-coord tag dim',
    'lib/components/WeeklyOverview.svelte :: tag dim',
    'lib/components/MonthlyOverview.svelte :: tag dim',
    'lib/components/more/AboutSection.svelte :: line tag',
    'lib/cards/CardRenderer.svelte :: tag',
  ])

  it('no functional chrome carries `.tag`', () => {
    const found: string[] = []
    for (const file of svelteFiles(WEB_SRC)) {
      const src = readFileSync(file, 'utf8')
      const rel = file.slice(WEB_SRC.length)
      for (const m of src.matchAll(/class="([^"{}]*)"/g)) {
        const cls = m[1]!
        if (hasTagToken(cls)) found.push(`${rel} :: ${cls}`)
      }
    }
    const offenders = found.filter((f) => !ALLOW.has(f))
    expect(offenders).toEqual([])
    // And the allowlist stays small — `.tag` did not creep back.
    expect(found.length).toBeLessThanOrEqual(ALLOW.size)
  })
})

// ---------- ActionPicker renders new classes, never `.tag` ----------

const { gameStore } = await import('../../web/src/lib/sim/gameStore.svelte')
const { default: ActionPicker } = await import(
  '../../web/src/lib/components/ActionPicker.svelte'
)

describe('ActionPicker DOM (Phase 194)', () => {
  afterEach(() => cleanup())

  it('emits `.chip` chrome and renders no `.tag`', () => {
    gameStore.reset('phase194-seed')
    gameStore.setPicks([])
    const { container } = render(ActionPicker, { open: true, onclose: () => {} })
    // The empty-picks "unspent" line is now functional chip chrome.
    expect(container.querySelector('.chip')).not.toBeNull()
    // No decorative tag anywhere in the picker chrome.
    expect(container.querySelector('.tag')).toBeNull()
  })
})
