import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOTS = ['src', 'web/src'] as const
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.svelte'])

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
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        return /from\s+['"][^'"]*src\/sim\/testing\//.test(source)
      })
      .map((file) => relative(process.cwd(), file))

    expect(offenders).toEqual([])
  })
})
