// Phase 125 / ISSUE-094 — Living Cast arc, Phase E.
//
// Build the prompt sent to the model for one slot. Pure function over
// (spec, slotId, retryContext?). The output is split into two halves:
//
//   cachedUserPrefix — the spec block + exemplars + negative examples,
//                      stable across retries (gets the SDK cache_control
//                      breakpoint).
//   retryTail        — the per-retry feedback (previous output + gate
//                      violations + dedupe rejections + parse error,
//                      whichever applies). Empty on the first attempt.
//
// The system prompt describes the role and output format; the user
// message is `cachedUserPrefix` + (`\n\n` + `retryTail` if non-empty).

import type {
  GenerationSpec,
  RetryContext,
  BuiltPrompt,
} from './types'

export function buildSystemPrompt(): string {
  return [
    'You are a tavern-card snippet author. You output authored prose',
    'lines for a specific slot of a specific compositional card template.',
    '',
    'Output FORMAT — return exactly one fenced YAML code block whose',
    'content is a top-level `snippets` array. Each entry has `id`,',
    '`text`, and `conditions` (array). `conditions` uses ONLY the',
    'condition kinds listed in the spec (the eleven framework primitives',
    'plus voiceAxis/verbalTic). Empty conditions array = unconditional',
    'fallback (specificity 0).',
    '',
    'HARD RULES:',
    '- No prose outside the fenced YAML block.',
    '- No DSL extensions; reject the temptation to invent new condition',
    '  kinds. If a slot demands one, leave the slot under-served instead.',
    '- No claims the seed/state does not guarantee. Flavor slots may',
    '  imply attitude, mood, or personality; they may NOT claim a specific',
    '  past event, named NPC, named faction, debt history, injury, or',
    '  tavern incident.',
    '- Each snippet `text` fits the slot word budget.',
    '- One snippet per line of authored prose. Snippets are complete',
    '  lines, never fragments to be concatenated.',
  ].join('\n')
}

function indent(lines: readonly string[], prefix = '  '): string {
  return lines.map((l) => `${prefix}${l}`).join('\n')
}

function describeSlot(
  spec: GenerationSpec,
  slotId: string,
): string {
  const slot = spec.slots.find((s) => s.id === slotId)
  if (!slot) {
    throw new Error(`buildPrompt: slot "${slotId}" not in spec`)
  }
  const lines: string[] = []
  lines.push(`SLOT: ${slot.id}`)
  lines.push(`required: ${slot.required}`)
  lines.push(`claims: ${slot.claims}`)
  lines.push(`maxWords: ${slot.maxWords}`)
  lines.push(`description: ${slot.description.trim()}`)
  return lines.join('\n')
}

function describeVoiceAxes(spec: GenerationSpec): string {
  const lines = ['VOICE AXES IN PLAY:']
  for (const axis of [
    'terseness',
    'warmth',
    'formality',
    'floridity',
  ] as const) {
    const levels = spec.voiceAxesInPlay[axis]
    if (!levels) continue
    const entries = Object.entries(levels).map(
      ([level, label]) => `${level}=${label}`,
    )
    lines.push(`- ${axis}: ${entries.join(', ')}`)
  }
  return lines.join('\n')
}

function describeExemplars(
  spec: GenerationSpec,
  slotId: string,
): string {
  const lines: string[] = ['POSITIVE EXEMPLARS:']
  for (const ex of spec.positiveExemplars) {
    // Phase 126 / ISSUE-095: exemplar text is keyed by slot id under
    // `slotLines`, not hardcoded `order_line` / `manner_note` fields.
    const text = ex.slotLines[slotId]
    if (!text) continue
    const voicePairs = Object.entries(ex.voice).map(
      ([k, v]) => `${k}=${v}`,
    )
    lines.push(`- ${ex.id} [voice: ${voicePairs.join(', ')}]`)
    lines.push(`    text: ${JSON.stringify(text)}`)
    lines.push(`    why: ${ex.why_it_works}`)
  }
  return lines.join('\n')
}

function describeNegativeExamples(spec: GenerationSpec): string {
  const lines: string[] = ['NEGATIVE EXAMPLES (do not produce these):']
  for (const neg of spec.negativeExamples) {
    lines.push(`- ${neg.id}: ${JSON.stringify(neg.line)}`)
    lines.push(`    fails: ${neg.fails.join(', ')}`)
    lines.push(`    why: ${neg.reason.trim()}`)
  }
  return lines.join('\n')
}

function describeGradient(spec: GenerationSpec): string {
  return [
    'GRADIENT POLICY:',
    `- base: ${spec.gradientPolicy.base}`,
    `- middle: ${spec.gradientPolicy.middle}`,
    `- top: ${spec.gradientPolicy.top}`,
    `- tic: ${spec.gradientPolicy.tic}`,
  ].join('\n')
}

function describeMustNotInvent(spec: GenerationSpec): string {
  return [
    'MUST NOT INVENT (any of these fails the sim-coherence gate):',
    ...spec.mustNotInvent.map((s) => `- ${s}`),
  ].join('\n')
}

function describeAllowedConditions(): string {
  return [
    'CONDITION KINDS YOU MAY USE (data — no closures, no nesting):',
    '- seedFamily { anyOf: string[] }',
    '- seedType { anyOf: string[] }',
    '- timing { anyOf: string[] }',
    '- severityAtLeast { value: number }',
    '- severityBelow { value: number }',
    '- hasTag { tag: string }',
    '- hasNamedEntity { role?: string, entityKind?: string }',
    '- pressureRising { pressureId: string }',
    '- memoryPresent { tag?: string }',
    '- repeatCount { subjectTag: string, atLeast: number }',
    '- actorTrait { role: string, trait: string }',
    '- voiceAxis { role, axis, atLeast } OR { role, axis, atMost }',
    '- verbalTic { role: string, tic: string }',
  ].join('\n')
}

export function buildPrompt(
  spec: GenerationSpec,
  slotId: string,
  retryContext?: RetryContext,
  targetCount: number = 12,
): BuiltPrompt {
  const slot = spec.slots.find((s) => s.id === slotId)
  if (!slot) throw new Error(`buildPrompt: slot "${slotId}" not in spec`)

  const cachedUserPrefix = [
    `TEMPLATE: ${spec.templateId}`,
    `VOICE REGISTER: ${spec.voiceRegister}`,
    `PURPOSE: ${spec.purpose.trim()}`,
    '',
    describeSlot(spec, slotId),
    '',
    describeVoiceAxes(spec),
    `VERBAL TICS COVERED: ${spec.verbalTicsCovered.join(', ')}`,
    `ALLOWED TARGETS: ${spec.allowedTargets.join(', ')}`,
    '',
    describeMustNotInvent(spec),
    '',
    describeGradient(spec),
    '',
    describeAllowedConditions(),
    '',
    describeExemplars(spec, slotId),
    '',
    describeNegativeExamples(spec),
    '',
    `TASK: produce ~${targetCount} candidate snippets for slot "${slotId}".`,
    `Include at least one unconditional fallback (conditions: [])${
      slot.required ? ' — REQUIRED for this slot.' : '.'
    }`,
    'Cover the gradient: middle rung (single-axis), top rung (two-axis),',
    'and tic rung (per verbal tic). Skip tic snippets that do not fit the',
    'voice register.',
    '',
    'Return one fenced YAML block, nothing else.',
  ].join('\n')

  const retryTail = retryContext ? buildRetryTail(retryContext) : ''

  return {
    system: buildSystemPrompt(),
    cachedUserPrefix,
    retryTail,
  }
}

function buildRetryTail(ctx: RetryContext): string {
  const lines: string[] = [
    `RETRY ${ctx.attempt}. Your previous attempt did not pass. Fix the issues below`,
    'and produce a corrected, complete YAML block (do not return a delta).',
    '',
  ]
  if (ctx.parseError) {
    lines.push('PARSE FAILURE:')
    lines.push(indent([ctx.parseError]))
    lines.push('')
  }
  if (ctx.gateViolations.length > 0) {
    lines.push('GATE VIOLATIONS:')
    for (const v of ctx.gateViolations) {
      const where = v.snippetId ? `${v.slotId}/${v.snippetId}` : v.slotId
      const detail = v.detail ? ` — ${v.detail}` : ''
      lines.push(`- ${where}: ${v.reason}${detail}`)
    }
    lines.push('')
  }
  if (ctx.dedupeRejections.length > 0) {
    lines.push('DEDUPED (these were too close to other snippets):')
    for (const d of ctx.dedupeRejections) {
      lines.push(
        `- ${d.rejectedId} ~= ${d.keptId} (sim=${d.similarity.toFixed(2)}, ${d.reason})`,
      )
    }
    lines.push('')
  }
  if (ctx.previousSnippets.length > 0) {
    lines.push('PREVIOUS ATTEMPT (for reference, do not just resend):')
    for (const s of ctx.previousSnippets) {
      lines.push(`- ${s.id}: ${JSON.stringify(s.text)}`)
    }
  }
  return lines.join('\n')
}

export function assemblePromptUserMessage(prompt: BuiltPrompt): string {
  if (prompt.retryTail.length === 0) return prompt.cachedUserPrefix
  return `${prompt.cachedUserPrefix}\n\n${prompt.retryTail}`
}
