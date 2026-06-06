import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...filesUnder(path))
    else if (/\.(ts|svelte)$/.test(name)) out.push(path)
  }
  return out
}

describe('surface layer boundaries', () => {
  it('src/sim does not import src/surface', () => {
    const offenders = filesUnder(join(ROOT, 'src/sim')).filter((file) => {
      const text = readFileSync(file, 'utf8')
      return /from ['\"](?:\.\.\/)+surface(?:\/|['\"])/.test(text)
    })

    expect(offenders.map((file) => relative(ROOT, file))).toEqual([])
  })

  it('surface projections stay deterministic and evidence-backed', () => {
    const offenders = filesUnder(join(ROOT, 'src/surface')).filter((file) => {
      const text = readFileSync(file, 'utf8')
      return /Math\.random|Date\.now|new Date\(/.test(text)
    })

    expect(offenders.map((file) => relative(ROOT, file))).toEqual([])
  })

  it('createSurfaceFact refuses readable facts without evidence', async () => {
    const { createSurfaceFact } = await import('../../src/surface/evidence')
    expect(
      createSurfaceFact({
        id: 'bad-fact',
        kind: 'trigger',
        readable: 'Looks meaningful.',
        evidence: [],
        salience: 50,
      }),
    ).toBeUndefined()
  })
})
