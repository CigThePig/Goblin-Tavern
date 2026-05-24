// Phase 142 / ISSUE-111 — Voiced Surface arc, Phase 16 (Ambient Surface).
//
// Retirement guard: scans the project for any import of the legacy
// `src/cards/voice/` slice and fails if one remains. The slice
// (`composer.ts`, `tonePools.ts`, `index.ts`) is deleted in this same
// phase; this test makes accidental re-introduction visible.
//
// This file deliberately spells the watched path as a split literal
// (`'/cards' + '/voice/'`) so its own grep needle does not match the
// file scanning itself.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const SCAN_ROOTS = ['src', 'web/src', 'tests']
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.svelte', '.js', '.mjs'])
// Split needle so the scanner itself isn't matched by its own probe.
const LEGACY_NEEDLE = '/cards' + '/voice/'
const SELF_FILENAME = 'noLegacyImports.test.ts'

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, out)
    } else if (
      stat.isFile() &&
      SCAN_EXTENSIONS.has(extOf(entry)) &&
      !entry.endsWith(SELF_FILENAME)
    ) {
      out.push(full)
    }
  }
  return out
}

function extOf(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx < 0 ? '' : name.slice(idx)
}

describe('legacy voice/ slice retirement', () => {
  it('no source or test file imports from the retired src/cards/voice path', () => {
    const offenders: string[] = []
    for (const root of SCAN_ROOTS) {
      const fullRoot = join(REPO_ROOT, root)
      for (const file of walk(fullRoot)) {
        const contents = readFileSync(file, 'utf8')
        if (contents.includes(LEGACY_NEEDLE)) {
          offenders.push(file.slice(REPO_ROOT.length + 1))
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})
