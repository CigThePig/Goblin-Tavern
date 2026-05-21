// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Parse a model response back into `Snippet[]`. The model returns a
// single fenced YAML block whose top-level `snippets` array carries
// our shape. Structural validation reuses the spec's snippet schema so
// unknown condition kinds reject — the DSL stays frozen at the eleven
// + two voice forms.

import { parse as parseYaml } from 'yaml'
import { z } from 'zod'
import { SnippetSeedSchema } from './specSchema'
import type { Snippet } from '../../src/cards/compose/types'

const SnippetsBlockSchema = z
  .object({
    snippets: z.array(SnippetSeedSchema),
  })
  .strict()

export type ParseSuccess = { ok: true; snippets: Snippet[] }
export type ParseFailure = { ok: false; error: string }
export type ParseResult = ParseSuccess | ParseFailure

const FENCE_RE = /```(?:ya?ml)?\s*([\s\S]*?)```/

export function parseModelOutput(raw: string): ParseResult {
  const match = raw.match(FENCE_RE)
  if (!match) {
    return { ok: false, error: 'no fenced YAML block found in model output' }
  }
  const yamlBody = match[1]!.trim()
  let parsed: unknown
  try {
    parsed = parseYaml(yamlBody)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `YAML parse failed: ${msg}` }
  }
  const result = SnippetsBlockSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    return { ok: false, error: `snippets block invalid: ${issues}` }
  }
  return { ok: true, snippets: result.data.snippets as Snippet[] }
}
