// Phase 88 — Shared helpers for the eight starter card templates.
//
// Every template builds a `CardView` from `seed.textIngredients`,
// `seed.responseSlots`, and `seed.consequenceProfiles`. The mechanics of
// "pick the first allowed verb on a slot, pull preview lines from the
// matching consequence profile, format stakes" are identical across
// archetypes. Centralising them here keeps each template focused on the
// archetype-specific composition (which lookups, which prose mix, which
// preferred verb filter) rather than the boilerplate.

import type { CardChoice, CardView, StakeView } from './types'
import type {
  IssueSeed,
  ResponseSlot,
  ConsequenceProfile,
  ResponseIntentVerb,
} from '../sim/modules/issues/issueSeedTypes'
import type { TavernState } from '../sim/state/TavernState'
import { pickSnippet } from './compose/assemble'
import type { SlotSpec, SnippetPool } from './compose/types'

const MAX_TITLE_WORDS = 6
const MAX_STAKES = 3
const MAX_PREVIEW = 3
const MAX_BODY = 3

export function clampWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ') + '…'
}

export function formatTitle(parts: ReadonlyArray<string | undefined>): string {
  const joined = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return clampWords(joined, MAX_TITLE_WORDS)
}

export function buildBody(
  lines: ReadonlyArray<string | undefined>,
): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (!line) continue
    const trimmed = line.trim()
    if (!trimmed) continue
    out.push(trimmed)
    if (out.length >= MAX_BODY) break
  }
  return out
}

export function buildStakes(seed: IssueSeed, limit = MAX_STAKES): StakeView[] {
  return seed.stakes.slice(0, limit).map((s) => ({
    readable: s.readable,
    direction: s.direction,
  }))
}

export type ChoiceOverrides = {
  /** Override the preferred target id for the choice (e.g. the named
   *  actor the card already centres on). Falls back to the slot's first
   *  target option. */
  targetId?: string
  /** Override which slot.allowedVerbs entry to surface. Defaults to the
   *  first. The verb must already exist in `slot.allowedVerbs` — the
   *  helper does not silently accept arbitrary verbs. */
  verb?: ResponseIntentVerb
  /** Include delayed effects in the preview, prefixed with "later:". */
  includeDelayed?: boolean
  /** Cap the preview at fewer than 3 lines (e.g. complaint = 2). */
  maxPreview?: number
  /**
   * Phase 96 / ISSUE-056 — Optional reason string that makes the choice
   * appear disabled in the renderer. `CardChoice.disabledReason` is
   * already read by the UI; this is the producer-side hook so future
   * card templates can declare preconditions without touching the
   * renderer. Existing helpers pass it through unchanged.
   */
  disabledReason?: string
  /**
   * Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6. Voiced label
   * composed from the choice-label snippet pool. When present, replaces
   * `slot.labelHint` as the rendered label. The mechanical verb / target
   * / shape stay sourced from the response slot — only the wording is
   * composed.
   */
  label?: string
  /**
   * Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6. Voiced preview
   * lines composed from the effect-preview snippet pool, one per
   * `EffectPreview` in `profile.immediateEffects` (in order, capped at
   * `maxPreview`). The backing `EffectPreview { kind, target, amount,
   * tags }` is unchanged by Phase 6; only the readable text is rewritten.
   */
  previewEffects?: string[]
}

export function buildChoice(
  slot: ResponseSlot,
  profile: ConsequenceProfile | undefined,
  overrides: ChoiceOverrides = {},
): CardChoice {
  const verb =
    overrides.verb && slot.allowedVerbs.includes(overrides.verb)
      ? overrides.verb
      : slot.allowedVerbs[0] ?? 'ignore'
  const fallbackTargetId = slot.targetOptions[0]?.id
  const targetId = overrides.targetId ?? fallbackTargetId
  const previewMax = overrides.maxPreview ?? MAX_PREVIEW
  const immediate = (profile?.immediateEffects ?? []).map((e) => e.readable)
  const delayed = overrides.includeDelayed
    ? (profile?.delayedEffects ?? []).map((e) => `later: ${e.readable}`)
    : []
  const defaultPreview = [...immediate, ...delayed].slice(0, previewMax)
  const previewEffects = overrides.previewEffects ?? defaultPreview
  const choice: CardChoice = {
    slotId: slot.id,
    label: overrides.label ?? slot.labelHint,
    verb: verb as ResponseIntentVerb,
    shape: slot.shape,
    previewEffects,
  }
  if (targetId !== undefined) choice.targetId = targetId
  if (overrides.disabledReason !== undefined) {
    choice.disabledReason = overrides.disabledReason
  }
  return choice
}

export function buildChoicesFromSeed(
  seed: IssueSeed,
  options: {
    filter?: (slot: ResponseSlot) => boolean
    overrides?: (slot: ResponseSlot) => ChoiceOverrides
  } = {},
): CardChoice[] {
  const slots = options.filter ? seed.responseSlots.filter(options.filter) : seed.responseSlots
  return slots.map((slot) => {
    const profile = seed.consequenceProfiles.find(
      (p) => p.responseSlotId === slot.id,
    )
    return buildChoice(slot, profile, options.overrides?.(slot) ?? {})
  })
}

/**
 * Phase 132 / ISSUE-101 — Voiced Surface arc, Phase 6.
 *
 * Compose voiced choice labels and effect-preview lines through the
 * snippet pipeline while keeping the sim mechanically authoritative.
 *
 * Per response slot:
 *   1. Pick a `choice_label` snippet using `pickSnippet` with
 *      `currentResponseSlot = slot` as context. The synthetic SlotSpec
 *      is marked `optional: true`, so a pool with no matching snippet
 *      returns `undefined` and the helper falls through to the sim's
 *      verbatim `slot.labelHint`.
 *   2. For each `EffectPreview` in `profile.immediateEffects` (capped
 *      at `maxPreview`), pick an `effect_preview` snippet with
 *      `currentResponseSlot = slot, currentEffect = effect`. Falls
 *      through to the sim's verbatim `effect.readable` when the pool
 *      has no match.
 *   3. Hand the composed `label` and `previewEffects` to `buildChoice`
 *      via the Phase-6 `ChoiceOverrides` fields. `verb`, `targetId`,
 *      `shape`, and the per-effect `(kind, target, amount, tags)` data
 *      stay sourced from the seed — only strings are composed.
 *
 * The synthetic-slot id namespacing (`choice_label::${slot.id}`,
 * `effect_preview::${slot.id}::${idx}`) ensures the FNV tie-break in
 * `pickSnippet` discriminates between response slots and between effect
 * indices on the same slot.
 *
 * Sim-coherence guarantee for previews holds structurally: each composed
 * line is produced only when a backing `EffectPreview` exists, and the
 * snippet replaces only the string — never the kind / target / amount /
 * tags the effect carries to the simulation.
 */
export type ComposeChoicesOptions = {
  labelPool: SnippetPool
  previewPool: SnippetPool
  maxPreview?: number
  /** Optional extra producer-side overrides (e.g. `disabledReason`).
   *  Mechanical fields (`verb`, `targetId`) remain settable here; the
   *  helper sets `label` and `previewEffects` from the pools and any
   *  caller-supplied values for those two are overridden. */
  overrides?: (slot: ResponseSlot) => Omit<
    ChoiceOverrides,
    'maxPreview' | 'label' | 'previewEffects'
  >
}

export function composeChoicesFromSeed(
  seed: IssueSeed,
  state: TavernState,
  options: ComposeChoicesOptions,
): CardChoice[] {
  const previewMax = options.maxPreview ?? MAX_PREVIEW
  return seed.responseSlots.map((slot) => {
    const profile = seed.consequenceProfiles.find(
      (p) => p.responseSlotId === slot.id,
    )
    const labelSlot: SlotSpec = {
      id: `choice_label::${slot.id}`,
      role: 'choice_label',
      pool: options.labelPool,
      optional: true,
      wordBudget: 6,
      claimMode: 'flavor',
    }
    const composedLabel = pickSnippet(labelSlot, seed, state, {
      currentResponseSlot: slot,
    })
    // Phase 147 / ISSUE-115 — when a response slot has no immediate
    // effects (e.g. the `ignore_area_problem` profile at
    // `expandedSeedGenerators.ts:2692`), the previous path rendered the
    // choice with zero preview lines — exactly the option a player
    // needs the most information about. Source from `delayedEffects`
    // instead, threading `inactionPreview: true` so pools can author
    // "what not acting costs" variants. The snippet replaces only the
    // text; the underlying `EffectPreview { kind, target, amount,
    // tags, … }` is unchanged.
    const immediate = profile?.immediateEffects ?? []
    const delayed = profile?.delayedEffects ?? []
    const useDelayed = immediate.length === 0 && delayed.length > 0
    const effects = (useDelayed ? delayed : immediate).slice(0, previewMax)
    const composedPreview = effects.map((effect, idx) => {
      const previewSlot: SlotSpec = {
        id: `effect_preview::${slot.id}::${idx}`,
        role: 'effect_preview',
        pool: options.previewPool,
        optional: true,
        wordBudget: 10,
        claimMode: 'flavor',
      }
      const composed = pickSnippet(previewSlot, seed, state, {
        currentResponseSlot: slot,
        currentEffect: effect,
        inactionPreview: useDelayed,
      })
      return composed ?? effect.readable
    })
    const extra = options.overrides?.(slot) ?? {}
    const overrides: ChoiceOverrides = {
      ...extra,
      maxPreview: previewMax,
      previewEffects: composedPreview,
    }
    if (composedLabel !== undefined) overrides.label = composedLabel
    return buildChoice(slot, profile, overrides)
  })
}

export function familyTag(seed: IssueSeed): string {
  return seed.family
}

/**
 * Build a complete CardView from already-prepared pieces. Centralises
 * the conditional severity/tag handling so templates stay focused on
 * composition.
 */
export function makeCardView(parts: {
  title: string
  body: string[]
  stakes: StakeView[]
  choices: CardChoice[]
  severity?: number
  tag?: string
  meta?: Record<string, unknown>
}): CardView {
  const view: CardView = {
    title: parts.title,
    body: parts.body,
    stakes: parts.stakes,
    choices: parts.choices,
  }
  if (parts.severity !== undefined) view.severity = parts.severity
  if (parts.tag) view.tag = parts.tag
  if (parts.meta) view.meta = parts.meta
  return view
}
