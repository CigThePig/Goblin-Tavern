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
  SlotSpec,
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
  VoiceRegisterId,
} from './types'

export { evalCondition } from './conditions'
export { assembleSlots, pickSnippet, specificityOf } from './assemble'
export { defineCompositionalCard } from './defineCompositionalCard'
