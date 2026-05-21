// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Read a generation spec YAML file from disk and validate it against
// the Zod schema. Returns a typed `GenerationSpec`; throws on parse or
// validation failure with a message that names the offending key.

import { readFile } from 'node:fs/promises'
import { parse as parseYaml } from 'yaml'
import { GenerationSpecSchema } from './specSchema'
import type { GenerationSpec } from './types'

export async function loadSpecFromFile(
  path: string,
): Promise<GenerationSpec> {
  const raw = await readFile(path, 'utf8')
  return loadSpecFromString(raw)
}

export function loadSpecFromString(raw: string): GenerationSpec {
  let parsed: unknown
  try {
    parsed = parseYaml(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`spec YAML parse failed: ${msg}`)
  }
  const result = GenerationSpecSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    throw new Error(`spec validation failed: ${issues}`)
  }
  return result.data
}
