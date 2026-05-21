// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Model-output parser unit tests. Confirms a clean fenced YAML block
// round-trips into typed `Snippet[]`, and that bad outputs surface a
// structured ParseError.

import { describe, expect, it } from 'vitest'
import { parseModelOutput } from '../../../../scripts/generate-pool/parseModelOutput'

describe('parseModelOutput', () => {
  it('parses a well-formed yaml block', () => {
    const raw = `Here is the output:

\`\`\`yaml
snippets:
  - id: a_terse
    text: "Ale. Now."
    conditions:
      - { kind: voiceAxis, role: primaryActor, axis: terseness, atLeast: 2 }
  - id: a_fallback
    text: "A drink, please."
    conditions: []
\`\`\``
    const result = parseModelOutput(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok')
    expect(result.snippets).toHaveLength(2)
    expect(result.snippets[0]!.text).toBe('Ale. Now.')
    expect(result.snippets[1]!.conditions).toEqual([])
  })

  it('parses an unfenced "yaml" tag', () => {
    const raw = `\`\`\`yml
snippets:
  - id: a
    text: hi
    conditions: []
\`\`\``
    const result = parseModelOutput(raw)
    expect(result.ok).toBe(true)
  })

  it('parses a fenced block without a language tag', () => {
    const raw = `\`\`\`
snippets:
  - id: a
    text: hi
    conditions: []
\`\`\``
    const result = parseModelOutput(raw)
    expect(result.ok).toBe(true)
  })

  it('rejects raw output with no fence', () => {
    const result = parseModelOutput('snippets:\n  - id: a\n')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected fail')
    expect(result.error).toContain('no fenced')
  })

  it('rejects malformed yaml inside the fence', () => {
    const result = parseModelOutput(`\`\`\`yaml\nsnippets: [unterminated\n\`\`\``)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected fail')
    expect(result.error).toContain('YAML parse failed')
  })

  it('rejects missing snippets field', () => {
    const raw = `\`\`\`yaml\nfoo: bar\n\`\`\``
    const result = parseModelOutput(raw)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected fail')
    expect(result.error).toContain('snippets')
  })

  it('rejects an unknown condition kind', () => {
    const raw = `\`\`\`yaml
snippets:
  - id: a
    text: hi
    conditions:
      - { kind: madeUp, foo: bar }
\`\`\``
    const result = parseModelOutput(raw)
    expect(result.ok).toBe(false)
  })

  it('rejects snippets missing the text field', () => {
    const raw = `\`\`\`yaml
snippets:
  - id: a
    conditions: []
\`\`\``
    const result = parseModelOutput(raw)
    expect(result.ok).toBe(false)
  })
})
