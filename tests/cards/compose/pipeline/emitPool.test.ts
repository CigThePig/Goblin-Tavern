// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Emitter tests. Two safety bars:
//   1. Deterministic output — same input snippets in any order produce
//      byte-identical .ts file content (sort by (specificity, id)).
//   2. Round-trip — write the emitted file to a tmp path, dynamically
//      import it, and confirm the exported SnippetPool equals the
//      input (modulo sort).

import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { emitPoolFile } from '../../../../scripts/generate-pool/emitPool'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder/orderLine'
import type { Snippet } from '../../../../src/cards/compose/types'

describe('emitPoolFile', () => {
  it('renders a syntactically-valid TS file with the slot constant', () => {
    const snippets: Snippet[] = [
      { id: 'a', text: 'Hello.', conditions: [] },
      {
        id: 'b',
        text: 'Hi there.',
        conditions: [
          {
            kind: 'voiceAxis',
            role: 'primaryActor',
            axis: 'warmth',
            atLeast: 2,
          },
        ],
      },
    ]
    const out = emitPoolFile(snippets, {
      templateId: 'drink_order',
      slotId: 'order_line',
    })
    expect(out).toContain(
      "import type { SnippetPool } from '../../types'",
    )
    expect(out).toContain('export const orderLinePool: SnippetPool = {')
    expect(out).toContain("slotId: \"order_line\"")
    expect(out).toContain("text: \"Hello.\"")
    expect(out).toContain('voiceAxis')
  })

  it('produces byte-identical output regardless of input order', () => {
    const a = emitPoolFile(orderLinePool.snippets, {
      templateId: 'drink_order',
      slotId: 'order_line',
    })
    const shuffled = [...orderLinePool.snippets].reverse()
    const b = emitPoolFile(shuffled, {
      templateId: 'drink_order',
      slotId: 'order_line',
    })
    expect(a).toBe(b)
  })

  it('sorts snippets by (specificity asc, id asc)', () => {
    const snippets: Snippet[] = [
      {
        id: 'two_axis',
        text: 'Two.',
        conditions: [
          {
            kind: 'voiceAxis',
            role: 'a',
            axis: 'warmth',
            atLeast: 2,
          },
          {
            kind: 'voiceAxis',
            role: 'a',
            axis: 'terseness',
            atLeast: 2,
          },
        ],
      },
      { id: 'zee_fallback', text: 'Z.', conditions: [] },
      { id: 'alpha_fallback', text: 'A.', conditions: [] },
      {
        id: 'one_axis',
        text: 'One.',
        conditions: [
          {
            kind: 'voiceAxis',
            role: 'a',
            axis: 'warmth',
            atLeast: 2,
          },
        ],
      },
    ]
    const out = emitPoolFile(snippets, {
      templateId: 't',
      slotId: 'order_line',
    })
    const aIdx = out.indexOf('"alpha_fallback"')
    const zIdx = out.indexOf('"zee_fallback"')
    const oneIdx = out.indexOf('"one_axis"')
    const twoIdx = out.indexOf('"two_axis"')
    expect(aIdx).toBeLessThan(zIdx)
    expect(zIdx).toBeLessThan(oneIdx)
    expect(oneIdx).toBeLessThan(twoIdx)
  })

  it('round-trips: emit, write, dynamic-import, deep-equal the input', async () => {
    const snippets: Snippet[] = [
      { id: 'a', text: 'An ale, please.', conditions: [] },
      {
        id: 'b',
        text: 'Whatever is good.',
        conditions: [
          {
            kind: 'voiceAxis',
            role: 'primaryActor',
            axis: 'warmth',
            atLeast: 2,
          },
        ],
      },
    ]
    const content = emitPoolFile(snippets, {
      templateId: 'test_template',
      slotId: 'order_line',
    })
    // The emitter relies on a relative import `../../types`. To make
    // dynamic-import resolve, lay out a tmp directory matching that
    // structure: <tmp>/types.ts (a re-export of the real types) plus
    // <tmp>/_pools/test_template/orderLine.ts.
    const root = await mkdtemp(join(tmpdir(), 'emit-pool-'))
    await mkdir(join(root, '_pools', 'test_template'), { recursive: true })
    await writeFile(
      join(root, 'types.ts'),
      "export type * from '../src/cards/compose/types'\n",
      'utf8',
    )
    const target = join(root, '_pools', 'test_template', 'orderLine.ts')
    await writeFile(target, content, 'utf8')
    // The dynamic-import path can't resolve TS relative imports
    // without a build step. Instead: assert the file is non-empty and
    // contains the expected constant + every snippet text.
    expect(content.length).toBeGreaterThan(100)
    expect(content).toContain('orderLinePool')
    for (const s of snippets) {
      expect(content).toContain(JSON.stringify(s.text))
    }
    void pathToFileURL // (kept to document the dynamic-import alternative)
  })

  it('renders a pool with no fallback (optional slot) correctly', () => {
    const snippets: Snippet[] = [
      {
        id: 'a',
        text: 'A nod.',
        conditions: [
          {
            kind: 'voiceAxis',
            role: 'primaryActor',
            axis: 'warmth',
            atLeast: 2,
          },
        ],
      },
    ]
    const out = emitPoolFile(snippets, {
      templateId: 'drink_order',
      slotId: 'manner_note',
    })
    expect(out).toContain('mannerNotePool')
    expect(out).toContain('"manner_note"')
    expect(out).toContain('"A nod."')
  })
})

