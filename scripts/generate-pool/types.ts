// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Pipeline-local types. The runtime types live in
// `src/cards/compose/types.ts`; this file only describes the build-time
// shapes the pipeline passes between stages.

import type { z } from 'zod'
import type {
  AllGatesReport,
  GateViolation,
} from '../../src/cards/compose/gates'
import type { Snippet } from '../../src/cards/compose/types'
import type { GenerationSpecSchema } from './specSchema'

export type GenerationSpec = z.infer<typeof GenerationSpecSchema>

/** Context attached to a retry — previous attempt's parsed snippets,
 *  any gate violations, and dedupe rejections — so the model can
 *  correct course on its next try. */
export type RetryContext = {
  attempt: number
  previousSnippets: Snippet[]
  gateViolations: GateViolation[]
  dedupeRejections: DedupeRejection[]
  parseError?: string
}

export type DedupeRejection = {
  keptId: string
  rejectedId: string
  similarity: number
  reason: 'near_duplicate' | 'canonical_equality'
}

/** Per-slot pipeline result. Either `accepted` (with the final pool)
 *  or `failed` (with the trail of attempts so the workflow can post
 *  them). */
export type PerSlotResult =
  | {
      status: 'accepted'
      slotId: string
      snippets: Snippet[]
      attempts: number
      finalReport: AllGatesReport | null
      dedupeRejections: DedupeRejection[]
    }
  | {
      status: 'failed'
      slotId: string
      attempts: number
      lastReport: AllGatesReport | null
      lastParseError?: string
      history: RetryContext[]
    }
  | {
      status: 'skipped'
      slotId: string
      reason: string
    }

export type PipelineResult = {
  templateId: string
  perSlot: PerSlotResult[]
  overallStatus: 'success' | 'failure'
}

export type PromptMessage = {
  role: 'user'
  content: string
}

export type BuiltPrompt = {
  system: string
  cachedUserPrefix: string
  retryTail: string
  /** The complete user message sent to the model = cachedUserPrefix +
   *  '\n\n' + retryTail when retryTail is non-empty, otherwise just
   *  cachedUserPrefix. The two halves are kept separate so the SDK
   *  layer can mark the prefix with `cache_control` while the tail
   *  varies per retry. */
}
