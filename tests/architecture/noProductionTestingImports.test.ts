import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const ROOTS = ['src', 'web/src'] as const
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.svelte'])
const TESTING_DIR = resolve('src', 'sim', 'testing')

// Static `from '…'`, dynamic `import('…')`, and `require('…')` specifiers.
const IMPORT_SPECIFIER_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

function importSpecifiers(source: string): string[] {
  const out: string[] = []
  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) out.push(match[1]!)
  }
  return out
}

// A file imports the sim testing wrappers if any specifier resolves into
// `src/sim/testing/`. Relative specifiers are resolved against the file's
// own directory so every shape (`../testing/…`, `./sim/testing/…`,
// `…/src/sim/testing/…`) is caught, not just the literal `src/sim/testing/`.
// Non-relative specifiers (path aliases, etc.) fall back to a segment match.
function importsSimTesting(file: string, source: string): boolean {
  const fileDir = dirname(resolve(file))
  return importSpecifiers(source).some((specifier) => {
    if (specifier.startsWith('.')) {
      const resolved = resolve(fileDir, specifier)
      return resolved === TESTING_DIR || resolved.startsWith(TESTING_DIR + sep)
    }
    return /(?:^|\/)sim\/testing\//.test(specifier)
  })
}

function extension(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot)
}

function isExemptProductionCompatibilityFile(path: string): boolean {
  const normalized = path.replaceAll('\\', '/')
  const basename = normalized.split('/').at(-1) ?? normalized
  return (
    normalized.includes('/testing/') ||
    normalized.includes('/fixtures/') ||
    /(?:^|[.-])test\./.test(basename) ||
    /(?:^|[.-])spec\./.test(basename) ||
    /compat(?:ibility)?/i.test(basename)
  )
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.svelte-kit') continue
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      out.push(...walk(full))
    } else if (stats.isFile() && SOURCE_EXTENSIONS.has(extension(full))) {
      out.push(full)
    }
  }
  return out
}

describe('architecture guard — production source does not import sim testing wrappers', () => {
  it('keeps src/ and web/src/ runtime code independent from src/sim/testing', () => {
    const offenders = ROOTS.flatMap((root) => walk(root))
      .filter((file) => !isExemptProductionCompatibilityFile(file))
      .filter((file) => importsSimTesting(file, readFileSync(file, 'utf8')))
      .map((file) => relative(process.cwd(), file))

    expect(offenders).toEqual([])
  })
})
