// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// End-to-end convergence proof. Loads the real
// `specs/cards/drink_order.spec.yaml`, threads a fixture model response
// as `generateCompletion`, runs the full pipeline against a tmp output
// directory, and asserts the emitted pool files pass `runAllGates`.
//
// No network is touched: `generateCompletion` is a closure over the
// committed Phase-C pool data formatted as a fenced YAML block.

import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { loadSpecFromFile } from '../../../../scripts/generate-pool/loadSpec'
import { runPipeline } from '../../../../scripts/generate-pool/index'
import { runGatesOnCandidates } from '../../../../scripts/generate-pool/runGates'
import { orderLinePool } from '../../../../src/cards/compose/pools/drinkOrder/orderLine'
import { mannerNotePool } from '../../../../src/cards/compose/pools/drinkOrder/mannerNote'
import type { Snippet } from '../../../../src/cards/compose/types'
import type { GenerateCompletion } from '../../../../scripts/generate-pool/callModel'

const REAL_SPEC_PATH = join(
  process.cwd(),
  'specs/cards/drink_order.spec.yaml',
)

function poolToYamlBlock(snippets: readonly Snippet[]): string {
  const lines: string[] = ['```yaml', 'snippets:']
  for (const s of snippets) {
    lines.push(`  - id: ${JSON.stringify(s.id)}`)
    lines.push(`    text: ${JSON.stringify(s.text)}`)
    if (s.conditions.length === 0) {
      lines.push('    conditions: []')
    } else {
      lines.push('    conditions:')
      for (const c of s.conditions) {
        const entries = Object.entries(c)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ')
        lines.push(`      - { ${entries} }`)
      }
    }
  }
  lines.push('```')
  return lines.join('\n')
}

describe('pipeline integration (convergence proof)', () => {
  it('runs spec → mocked model → gates → emit, end to end', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const responses: Record<string, string> = {
      order_line: poolToYamlBlock(orderLinePool.snippets),
      manner_note: poolToYamlBlock(mannerNotePool.snippets),
    }
    let lastSlotIdAsked: string | undefined
    const generate: GenerateCompletion = async ({ cachedUserPrefix }) => {
      // Look at the prompt prefix to figure out which slot is being
      // requested. The prompt builder writes `SLOT: <id>` near the top.
      const match = cachedUserPrefix.match(/SLOT:\s*([a-z_]+)/)
      if (!match) throw new Error('test mock: no SLOT in prefix')
      lastSlotIdAsked = match[1]
      const response = responses[lastSlotIdAsked!]
      if (!response) throw new Error(`no fixture for slot ${lastSlotIdAsked}`)
      return response
    }

    const cwd = await mkdtemp(join(tmpdir(), 'pipeline-int-'))
    const result = await runPipeline({ spec, generate, cwd })
    expect(result.overallStatus).toBe('success')
    expect(result.templateId).toBe('drink_order')

    const perSlotByName = Object.fromEntries(
      result.perSlot.map((p) => [p.slotId, p]),
    )
    expect(perSlotByName.order_line!.status).toBe('accepted')
    expect(perSlotByName.manner_note!.status).toBe('accepted')
    expect(perSlotByName.sim_backed_hook!.status).toBe('skipped')

    // Confirm the emitted file lands at the expected path.
    const emittedOrderLine = await readFile(
      join(cwd, 'src/cards/compose/pools/drink_order/orderLine.ts'),
      'utf8',
    )
    expect(emittedOrderLine).toContain('export const orderLinePool')
    expect(emittedOrderLine).toContain('order_fallback_plain')
    const emittedManner = await readFile(
      join(cwd, 'src/cards/compose/pools/drink_order/mannerNote.ts'),
      'utf8',
    )
    expect(emittedManner).toContain('export const mannerNotePool')

    // Reconfirm the in-memory candidates clear gates (the proof Phase E
    // promises: any pool the pipeline emits has already cleared
    // runAllGates).
    const candidates = new Map<string, Snippet[]>()
    if (perSlotByName.order_line!.status === 'accepted') {
      candidates.set('order_line', perSlotByName.order_line!.snippets)
    }
    if (perSlotByName.manner_note!.status === 'accepted') {
      candidates.set('manner_note', perSlotByName.manner_note!.snippets)
    }
    const gateCheck = runGatesOnCandidates(spec, candidates)
    expect(gateCheck.report.pass).toBe(true)
  })

  it('exits with failure status when the model never produces parseable output', async () => {
    const spec = await loadSpecFromFile(REAL_SPEC_PATH)
    const generate: GenerateCompletion = async () => 'no fence, no yaml'
    const result = await runPipeline({
      spec,
      generate,
      maxAttempts: 2,
      dryRun: true,
    })
    expect(result.overallStatus).toBe('failure')
    const firstActive = result.perSlot.find((p) => p.status !== 'skipped')
    expect(firstActive?.status).toBe('failed')
  })
})
