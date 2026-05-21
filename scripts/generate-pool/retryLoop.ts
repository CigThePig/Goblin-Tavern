// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Per-slot retry orchestration. One call into here per slot:
//   build prompt → call model → parse → gate → dedupe within slot.
// On failure (parse, gate, or empty-after-dedupe), feed the violations
// and prior output back into the model and try again, up to a budget.
//
// The gate run uses ALL slots' current candidate set so cross-slot
// constraints (template-level determinism, voice register consistency)
// still apply. On gate success for the target slot, the loop returns
// the accepted snippets; whether *other* slots also passed is decided
// by their own loop iterations.

import { buildPrompt } from './buildPrompt'
import { parseModelOutput } from './parseModelOutput'
import {
  DEFAULT_DEDUPE_THRESHOLD,
  dedupeSlot,
  type SlotDedupeResult,
} from './dedupe'
import { runGatesOnCandidates, violationsForSlot } from './runGates'
import type {
  DedupeRejection,
  GenerationSpec,
  PerSlotResult,
  RetryContext,
} from './types'
import type { Snippet } from '../../src/cards/compose/types'
import type {
  AllGatesReport,
} from '../../src/cards/compose/gates'
import type { GenerateCompletion } from './callModel'

export type RetryLoopOptions = {
  spec: GenerationSpec
  slotId: string
  /** Other slots' currently-accepted snippets, so gates that look across
   *  the whole template (determinism, voice register) reflect reality. */
  acceptedBySlot: ReadonlyMap<string, Snippet[]>
  generate: GenerateCompletion
  maxAttempts?: number
  model?: string
  targetCount?: number
  dedupeThreshold?: number
}

export async function runRetryLoop(
  opts: RetryLoopOptions,
): Promise<PerSlotResult> {
  const {
    spec,
    slotId,
    acceptedBySlot,
    generate,
    maxAttempts = 3,
    model,
    targetCount = 12,
    dedupeThreshold = DEFAULT_DEDUPE_THRESHOLD,
  } = opts

  const history: RetryContext[] = []
  let lastReport: AllGatesReport | null = null
  let lastParseError: string | undefined
  let dedupeRejections: DedupeRejection[] = []
  let previousSnippets: Snippet[] = []

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let retryContext: RetryContext | undefined
    if (attempt > 1) {
      retryContext = {
        attempt,
        previousSnippets,
        gateViolations:
          lastReport == null ? [] : violationsForSlot(lastReport, slotId),
        dedupeRejections,
        ...(lastParseError !== undefined && { parseError: lastParseError }),
      }
    }

    const prompt = buildPrompt(spec, slotId, retryContext, targetCount)
    const raw = await generate({
      system: prompt.system,
      cachedUserPrefix: prompt.cachedUserPrefix,
      retryTail: prompt.retryTail,
      ...(model !== undefined && { model }),
    })

    const parsed = parseModelOutput(raw)
    if (!parsed.ok) {
      lastParseError = parsed.error
      previousSnippets = []
      dedupeRejections = []
      lastReport = null
      if (retryContext) history.push(retryContext)
      continue
    }
    lastParseError = undefined
    previousSnippets = parsed.snippets

    const dedupedSelf: SlotDedupeResult = dedupeSlot(
      slotId,
      parsed.snippets,
      dedupeThreshold,
    )
    dedupeRejections = dedupedSelf.rejections

    if (dedupedSelf.kept.length === 0) {
      if (retryContext) history.push(retryContext)
      continue
    }

    const merged = new Map<string, Snippet[]>(acceptedBySlot)
    merged.set(slotId, dedupedSelf.kept)
    const { report } = runGatesOnCandidates(spec, merged)
    lastReport = report

    const slotViolations = violationsForSlot(report, slotId)
    if (slotViolations.length === 0) {
      return {
        status: 'accepted',
        slotId,
        snippets: dedupedSelf.kept,
        attempts: attempt,
        finalReport: report,
        dedupeRejections,
      }
    }

    if (retryContext) history.push(retryContext)
  }

  return {
    status: 'failed',
    slotId,
    attempts: maxAttempts,
    lastReport,
    ...(lastParseError !== undefined && { lastParseError }),
    history,
  }
}
