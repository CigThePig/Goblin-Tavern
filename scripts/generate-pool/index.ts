// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Top-level pipeline orchestration. One function — `runPipeline` — runs
// the full spec → tested pool flow and emits files via the writer. The
// CLI calls this with `callAnthropic`; tests call it with a mock
// `generate` function so no network is touched in CI.

import { emitPoolFile } from './emitPool'
import { runRetryLoop } from './retryLoop'
import { runGatesOnCandidates } from './runGates'
import { writePoolFiles, type WritePoolFile } from './writePoolFiles'
import type { GenerateCompletion } from './callModel'
import type { Snippet } from '../../src/cards/compose/types'
import type {
  GenerationSpec,
  PerSlotResult,
  PipelineResult,
} from './types'

export type RunPipelineOptions = {
  spec: GenerationSpec
  generate: GenerateCompletion
  maxAttempts?: number
  model?: string
  targetCount?: number
  /** When true, the pipeline runs the loop but does not write files.
   *  Tests use this when they only care about the in-memory result. */
  dryRun?: boolean
  /** Override the repo-root cwd. Tests use a tmpdir. */
  cwd?: string
  /** Override the pools root. Defaults to `src/cards/compose/pools`. */
  poolsRoot?: string
}

function basenameFor(slotId: string): string {
  const camel = slotId.replace(/_([a-z])/g, (_m, c: string) =>
    c.toUpperCase(),
  )
  return `${camel}.ts`
}

export async function runPipeline(
  opts: RunPipelineOptions,
): Promise<PipelineResult> {
  const { spec, generate } = opts
  // Phase 127 / ISSUE-096 — both `DISABLED_FOR_SPIKE` and
  // `SIGNAL_AVAILABLE` mark a slot as "no pool authored yet"; the
  // pipeline skips both. The reason string preserves which status was
  // set so logs stay informative.
  const isSkipped = (s: string | undefined): boolean =>
    s === 'DISABLED_FOR_SPIKE' || s === 'SIGNAL_AVAILABLE'

  const activeSlots = spec.slots.filter((s) => !isSkipped(s.status))
  const acceptedBySlot = new Map<string, Snippet[]>()
  const perSlot: PerSlotResult[] = []

  for (const slot of spec.slots) {
    if (isSkipped(slot.status)) {
      perSlot.push({
        status: 'skipped',
        slotId: slot.id,
        reason: slot.status ?? 'DISABLED_FOR_SPIKE',
      })
      continue
    }
    const result = await runRetryLoop({
      spec,
      slotId: slot.id,
      acceptedBySlot,
      generate,
      ...(opts.maxAttempts !== undefined && { maxAttempts: opts.maxAttempts }),
      ...(opts.model !== undefined && { model: opts.model }),
      ...(opts.targetCount !== undefined && { targetCount: opts.targetCount }),
    })
    perSlot.push(result)
    if (result.status === 'accepted') {
      acceptedBySlot.set(slot.id, result.snippets)
    } else if (result.status === 'failed') {
      // Stop early — partial pools should not land.
      return {
        templateId: spec.templateId,
        perSlot,
        overallStatus: 'failure',
      }
    }
  }

  // Final all-slot gate sweep so the workflow reports the aggregate.
  const finalRun = runGatesOnCandidates(spec, acceptedBySlot)
  if (!finalRun.report.pass) {
    return {
      templateId: spec.templateId,
      perSlot,
      overallStatus: 'failure',
    }
  }

  if (!opts.dryRun) {
    const files: WritePoolFile[] = activeSlots.map((slot) => {
      const snippets = acceptedBySlot.get(slot.id) ?? []
      return {
        basename: basenameFor(slot.id),
        contents: emitPoolFile(snippets, {
          templateId: spec.templateId,
          slotId: slot.id,
          header: `Pool for the \`${slot.id}\` slot of \`${spec.templateId}\`.\nRegenerated from \`specs/cards/${spec.templateId}.spec.yaml\`.`,
        }),
      }
    })
    await writePoolFiles({
      templateId: spec.templateId,
      files,
      ...(opts.cwd !== undefined && { cwd: opts.cwd }),
      ...(opts.poolsRoot !== undefined && { poolsRoot: opts.poolsRoot }),
    })
  }

  return {
    templateId: spec.templateId,
    perSlot,
    overallStatus: 'success',
  }
}

export { emitPoolFile } from './emitPool'
export { loadSpecFromFile, loadSpecFromString } from './loadSpec'
export { parseModelOutput } from './parseModelOutput'
export { buildPrompt, assemblePromptUserMessage } from './buildPrompt'
export {
  dedupeSlot,
  dedupePools,
  canonicaliseText,
  DEFAULT_DEDUPE_THRESHOLD,
} from './dedupe'
export {
  runGatesOnCandidates,
  buildTemplateFromCandidates,
  buildGatesConfig,
  violationsForSlot,
} from './runGates'
export { runRetryLoop } from './retryLoop'
export {
  callAnthropic,
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  type GenerateCompletion,
} from './callModel'
export type {
  GenerationSpec,
  PerSlotResult,
  PipelineResult,
  RetryContext,
  DedupeRejection,
} from './types'
