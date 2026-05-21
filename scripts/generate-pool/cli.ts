#!/usr/bin/env node
// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Command-line entry. Loads a spec, runs the pipeline against the real
// Anthropic SDK, prints a per-slot summary, exits non-zero on failure.
//
// Usage:
//   npm run generate-pool -- --spec specs/cards/drink_order.spec.yaml
//   npm run generate-pool -- --spec ... --model claude-sonnet-4-6 --max-retries 3 --dry-run

import { loadSpecFromFile } from './loadSpec'
import { runPipeline } from './index'
import { callAnthropic, DEFAULT_MODEL } from './callModel'
import type { PipelineResult } from './types'

type CliArgs = {
  spec: string
  model: string
  maxRetries: number
  targetCount: number
  dryRun: boolean
}

function parseArgs(argv: readonly string[]): CliArgs {
  const out: CliArgs = {
    spec: '',
    model: DEFAULT_MODEL,
    maxRetries: 3,
    targetCount: 12,
    dryRun: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    switch (arg) {
      case '--spec':
        out.spec = argv[++i] ?? ''
        break
      case '--model':
        out.model = argv[++i] ?? DEFAULT_MODEL
        break
      case '--max-retries':
        out.maxRetries = Number(argv[++i] ?? 3)
        break
      case '--target-count':
        out.targetCount = Number(argv[++i] ?? 12)
        break
      case '--dry-run':
        out.dryRun = true
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
      default:
        if (arg.startsWith('--')) {
          console.error(`unknown flag: ${arg}`)
          process.exit(2)
        }
    }
  }
  if (!out.spec) {
    console.error('missing required --spec <path>')
    printUsage()
    process.exit(2)
  }
  return out
}

function printUsage(): void {
  console.error(
    [
      'Usage: npm run generate-pool -- --spec <path> [options]',
      '',
      'Options:',
      '  --spec <path>            Path to a spec YAML (required)',
      `  --model <id>             Model id (default: ${DEFAULT_MODEL})`,
      '  --max-retries <n>        Retries per slot (default: 3)',
      '  --target-count <n>       Snippets to request per slot (default: 12)',
      '  --dry-run                Run gates and emit files in memory; do not write',
      '  -h, --help               Show this help',
    ].join('\n'),
  )
}

function printResult(result: PipelineResult): void {
  console.log(`template: ${result.templateId}`)
  console.log(`status:   ${result.overallStatus}`)
  for (const slot of result.perSlot) {
    if (slot.status === 'skipped') {
      console.log(`  - ${slot.slotId}: skipped (${slot.reason})`)
      continue
    }
    if (slot.status === 'accepted') {
      console.log(
        `  - ${slot.slotId}: accepted ${slot.snippets.length} snippets in ${slot.attempts} attempt(s)`,
      )
      continue
    }
    console.log(
      `  - ${slot.slotId}: FAILED after ${slot.attempts} attempt(s)` +
        (slot.lastParseError ? ` (last parse error: ${slot.lastParseError})` : ''),
    )
    if (slot.lastReport) {
      for (const sub of ['coverage', 'specificity', 'voiceBounds', 'simCoherence'] as const) {
        const r = slot.lastReport[sub]
        for (const v of r.violations) {
          if (v.slotId === slot.slotId) {
            console.log(
              `      ${sub}: ${v.reason}${v.detail ? ` (${v.detail})` : ''}`,
            )
          }
        }
      }
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const spec = await loadSpecFromFile(args.spec)
  const result = await runPipeline({
    spec,
    generate: callAnthropic,
    maxAttempts: args.maxRetries,
    model: args.model,
    targetCount: args.targetCount,
    dryRun: args.dryRun,
  })
  printResult(result)
  process.exit(result.overallStatus === 'success' ? 0 : 1)
}

main().catch((err) => {
  console.error('generate-pool: fatal')
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
