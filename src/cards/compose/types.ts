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
  ResponseIntentShape,
  ResponseIntentVerb,
  ResponseSlot,
} from '../../sim/modules/issues/issueSeedTypes'
import type {
  EffectDirection,
  EffectKind,
  EffectMagnitudeBand,
  EffectPreview,
  EffectTargetKind,
} from '../../sim/core/effect'
import type { TavernState } from '../../sim/state/TavernState'
import type { EntityRef } from '../../sim/state/TavernState'
import type {
  VerbalTicId,
  VoiceAxisId,
  VoiceAxisValue,
} from '../../sim/content/cast'
import type { BandId, SignalId } from '../../sim/signals'
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
  // — Phase 127 / ISSUE-096 — Voiced Surface arc, Phase 1. State-lookup
  //   over the read-only signal surface at `src/sim/signals/`. `signal`
  //   names a band query (e.g. `'supplier.reliability'`); `equals`
  //   matches against the resolved `BandId`. The condition resolves the
  //   actor via the same `resolveActorRef` rules as `voiceAxis` and
  //   returns false when the actor doesn't resolve, the ref kind
  //   doesn't match the signal, or the underlying field is missing.
  //   Stays data and stays inspectable — the gates enumerate
  //   `(SignalId, BandId)` to walk the reachable space.
  | { kind: 'signalEquals'; role: string; signal: SignalId; equals: BandId }
  // — Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6. Choice &
  //   consequence voice. Four primitives that read the iteration context
  //   the choice helper threads in (`currentResponseSlot`,
  //   `currentEffect`). Outside that helper — i.e. for body / title slot
  //   evaluation — the corresponding context field is undefined and the
  //   condition returns false (graceful degradation per framework §5).
  //   Stay flat data, no closures, no OR/NOT/nesting.
  | { kind: 'responseVerb'; anyOf: readonly ResponseIntentVerb[] }
  | { kind: 'responseShape'; anyOf: readonly ResponseIntentShape[] }
  | { kind: 'effectKind'; anyOf: readonly EffectKind[] }
  | { kind: 'effectTag'; tag: string }
  // — Phase 145 / ISSUE-113 — Voiced Surface arc, Phase 18 (iteration 2).
  //   Per-effect structural meter facts derived sim-side by `effect()`
  //   in `generatorHelpers.ts`. Read `ctx.currentEffect.targetKind` /
  //   `.direction` / `.magnitudeBand`. Return false when the field is
  //   missing — same graceful-degradation pattern as the Phase-6
  //   effectKind/effectTag arms.
  | { kind: 'effectTargetKind'; anyOf: readonly EffectTargetKind[] }
  | { kind: 'effectDirection'; sign: EffectDirection }
  | { kind: 'effectMagnitudeBand'; anyOf: readonly EffectMagnitudeBand[] }
  // — Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2. Reads
  //   `ctx.inactionPreview`, set by `composeChoicesFromSeed` when the
  //   choice has no immediate effects and the preview is being sourced
  //   from `delayedEffects` instead. Lets authors write "what not
  //   acting costs" variants ("the rot would keep spreading") that
  //   out-rank the generic shared base for ignore choices without
  //   bleeding into other slots. Returns false when the ctx field is
  //   absent — same graceful-degradation pattern.
  | { kind: 'inactionPreview'; value: boolean }
  // — Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3. Reads
  //   `ctx.currentResponseSlot?.id`. Slot-discriminating gate so a label
  //   pool can author distinct text for distinct response slots that
  //   happen to share a verb. Without this primitive a pool keying only
  //   on `responseVerb` collapses same-verb slots to the same label
  //   (the supplier `negotiate_supplier` / `supplier_exclusivity_deal`
  //   collision the Phase-3 distinctness gate fails on). Returns false
  //   when the ctx field is absent — body / title evaluation unaffected.
  | { kind: 'responseSlot'; anyOf: readonly string[] }

/**
 * Phase 132 / ISSUE-101 — optional iteration context the choice helper
 * (`composeChoicesFromSeed`) threads into `pickSnippet` so the four
 * Phase-6 condition primitives can read the current response slot and
 * effect preview without leaving the data DSL. Body and title slots are
 * evaluated with an empty context; the four new condition arms return
 * false when their required field is missing.
 */
export type ConditionContext = {
  currentResponseSlot?: ResponseSlot
  currentEffect?: EffectPreview
  /** Phase 147 / ISSUE-115 — Legible Surface arc, Phase 2. True when
   *  `composeChoicesFromSeed` is rendering preview lines sourced from
   *  `delayedEffects` because `immediateEffects` was empty (the inaction
   *  path). False / absent otherwise. Read by the `inactionPreview`
   *  condition arm. */
  inactionPreview?: boolean
}

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

/** Sim-coherence policy for a slot. `'flavor'` (the default) means the
 *  slot makes no checkable sim claims — the Phase-D sim-coherence gate
 *  scans for invented entity names and unbacked history language.
 *  `'sim_backed'` means every non-fallback snippet must carry at least
 *  one state-lookup condition (`pressureRising`, `memoryPresent`,
 *  `repeatCount`, `hasNamedEntity`). Set on the slot, read by gates. */
export type SlotClaimMode = 'flavor' | 'sim_backed'

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
  /** Per-slot word-budget cap on every snippet's `text`. Defaults to the
   *  framework body cap (12 words, framework §4) when omitted. The
   *  Phase-D `voice-bounds` gate enforces this. */
  wordBudget?: number
  /** Sim-coherence policy. Defaults to `'flavor'` — slots that make no
   *  checkable sim claims. Phase-D `sim-coherence` gate reads this. */
  claimMode?: SlotClaimMode
  /** Phase 146 / ISSUE-114 — Legible Surface arc, Phase 1. Salience
   *  policy for this slot. Omitted ⇒ today's behaviour (pure specificity
   *  + FNV tie-break). `'top'` ⇒ when multiple snippets tie on top
   *  specificity, prefer the one covering the most-salient resolved read
   *  for the seed's family. `'multi'` ⇒ same primary pick as `'top'`,
   *  AND attempt to append a secondary snippet from the same pool that
   *  covers the next orthogonal salient fact, joined into one line
   *  within `multiFactBudget`. Layered OVER the gradient, not replacing
   *  it. See `src/cards/compose/salience.ts`. */
  saliencePolicy?: 'top' | 'multi'
  /** Phase 146. Joining string between primary and secondary snippets
   *  when `saliencePolicy === 'multi'`. Defaults to `' '` (a space).
   *  Authors set `' — '` for em-dash separation when the prose reads
   *  more cleanly with a break. */
  multiFactJoin?: string
  /** Phase 146. Combined-line word budget for the joined primary +
   *  secondary output when `saliencePolicy === 'multi'`. Independent
   *  from `wordBudget` (which the voice-bounds gate checks against each
   *  snippet's text). Defaults to `wordBudget * 2` — room for two
   *  snippets each at their individual cap plus a join token. If the
   *  joined string would exceed this budget, the secondary is dropped
   *  and only the primary renders ("silence beats stapling" per the
   *  arc plan). */
  multiFactBudget?: number
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
