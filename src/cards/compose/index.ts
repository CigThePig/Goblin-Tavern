// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// Public surface of the compose slice. Templates author against these
// types; the assembler and factory power the runtime.

export type {
  CompositionalCardTemplate,
  EntityRefKind,
  FilledSlots,
  Snippet,
  SnippetCondition,
  SnippetPool,
  SlotClaimMode,
  SlotSpec,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
  VoiceRegisterId,
} from './types'

export { evalCondition } from './conditions'
export { assembleSlots, pickSnippet, specificityOf } from './assemble'
export { defineCompositionalCard } from './defineCompositionalCard'

// Phase 124 / ISSUE-093 — structural gate harness (framework §6).
export * from './gates'
