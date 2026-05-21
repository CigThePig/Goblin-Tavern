// Phase 123 / ISSUE-092 — Living Cast arc, Phase C.
//
// The compositional card-layer types. Implements the framework spec at
// `docs/plans/card-composition-framework.md §2`. Sits below the existing
// `CardDefinition` / `CardView` shapes — a `CompositionalCardTemplate` is
// turned into a regular `CardDefinition` by `defineCompositionalCard`, so
// the registry, selection, and renderer never learn this layer exists.
//
// Two structural rules carried over from the framework doc:
//
//   1. SnippetCondition values are DATA, not closures. Inspectable by the
//      generation pipeline, enumerable by coverage tests, sampleable by
//      diversity tests. A closure `(seed, state) => boolean` would defeat
//      all three.
//   2. The condition primitives are deliberately small. The framework
//      ships eleven; Phase B settled that voice — stored as 0|1|2 scalars
//      on `CastAttributes.voice.axes[axis]` plus an optional verbal-tic
//      id — needs comparison-aware reads, so two additional leaf forms
//      land here (`voiceAxis` and `verbalTic`). They satisfy framework
//      §6's "flat, inspectable, generatable, enumerable" constraints.
//      Anything OR / NOT / nested stays out until concrete gaps demand it.

import type {
  IssueSeed,
  IssueSeedFamilyId,
  IssueSeedTiming,
  IssueSeedType,
} from '../../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../../sim/state/TavernState'
import type { EntityRef } from '../../sim/state/TavernState'
import type {
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
} from '../../sim/content/cast'
import type { CardView, CardAppliesTo } from '../types'

/**
 * The voice register a template renders in. One register per template
 * (framework §2.4). Phase C ships with `'tavern_floor'` as the only
 * value in use; the v1 representation is a plain string alias — the
 * register list is content discovered by authoring (framework §9).
 */
export type VoiceRegisterId = string

/** Filled-slot map produced by the assembler. `undefined` means the
 *  optional slot resolved to no matching snippet — the template's
 *  `toCardView` omits it. */
export type FilledSlots = Record<string, string | undefined>

// ---------- SnippetCondition (11 framework primitives + 2 voice forms) ----

/** Read-only kind for matching against a seed's domain ∪ toneHints ∪
 *  stake tags. */
export type EntityRefKind = EntityRef['kind']

export type SnippetCondition =
  // — seed shape (framework §2.3) —
  | { kind: 'seedFamily'; anyOf: IssueSeedFamilyId[] }
  | { kind: 'seedType'; anyOf: IssueSeedType[] }
  | { kind: 'timing'; anyOf: IssueSeedTiming[] }
  | { kind: 'severityAtLeast'; value: number }
  | { kind: 'severityBelow'; value: number }
  | { kind: 'hasTag'; tag: string }
  // — entities present in the seed (framework §2.3) —
  | { kind: 'hasNamedEntity'; role?: string; entityKind?: EntityRefKind }
  // — state lookups (framework §2.3) —
  | { kind: 'pressureRising'; pressureId: string }
  | { kind: 'memoryPresent'; tag?: string }
  | { kind: 'repeatCount'; subjectTag: string; atLeast: number }
  // — Character Depth seam (framework §2.3, §5) —
  //   Forward seam: today no actor carries a `trait: string` field, so
  //   `actorTrait` conditions never match. Kept declared because the
  //   shape is part of the framework contract; Phase D will be the next
  //   place to revisit if a real string-trait field lands on actors.
  | { kind: 'actorTrait'; role: string; trait: string }
  // — Phase-B voice bridge (living-cast-arc-phase-b.md §"actorTrait bridge") —
  //   Voice is structured scalars + an optional verbal-tic id on
  //   `CastAttributes`. Exact-string equality via `actorTrait` would
  //   make two-extreme snippets unreachably rare under Phase A's
  //   `[-1,0,0,1]` perturbation. These two forms keep conditions flat,
  //   inspectable data while honouring the gradient.
  | {
      kind: 'voiceAxis'
      role: string
      axis: VoiceAxisId
      atLeast: VoiceAxisValue
    }
  | {
      kind: 'voiceAxis'
      role: string
      axis: VoiceAxisId
      atMost: VoiceAxisValue
    }
  | { kind: 'verbalTic'; role: string; tic: VerbalTicId }

// ---------- Snippet / SnippetPool / SlotSpec ----------

export type Snippet = {
  /** Stable id, unique within its pool. Used in the FNV tie-break key. */
  id: string
  /** The authored prose. THIS IS THE ONLY PLACE CARD PROSE LIVES. */
  text: string
  /** Conditions combined by implicit AND. Empty array = unconditional
   *  fallback (specificity 0). */
  conditions: SnippetCondition[]
  /** Optional explicit specificity override (framework §2.1). Omit
   *  unless a single condition is genuinely more specific than its
   *  count implies. */
  specificity?: number
}

export type SnippetPool = {
  slotId: string
  /** A pool feeding a required slot must contain at least one snippet
   *  with `conditions: []`. The Phase-D coverage gate enforces this;
   *  the runtime tolerates a missing fallback by returning `undefined`. */
  snippets: Snippet[]
}

export type SlotSpec = {
  /** Unique within the template. */
  id: string
  /** Advisory label only (framework §2.4) — different templates declare
   *  different slots. */
  role: string
  pool: SnippetPool
  /** When true, an empty result omits the slot rather than forcing a
   *  fallback. Silence beats weak copy. */
  optional?: boolean
}

// ---------- Template + factory shape ----------

export type CompositionalCardTemplate = {
  id: string
  appliesTo: CardAppliesTo
  priority?: number
  /** Exactly ONE voice register per template (framework §2.4). */
  voiceRegister: VoiceRegisterId
  slots: SlotSpec[]
  /** Small mechanical projection from filled slots + seed + state to a
   *  CardView. No prose here — prose came from the snippets; this just
   *  places it and projects stakes/choices. */
  toCardView: (
    filled: FilledSlots,
    seed: IssueSeed,
    state: TavernState,
  ) => CardView
}

// ---------- Re-exports so consumers import one place ----------

export type { VerbalTicId, VoiceAxisId, VoiceAxisValue }
