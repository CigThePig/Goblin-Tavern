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
  const previewEffects = [...immediate, ...delayed].slice(0, previewMax)
  const choice: CardChoice = {
    slotId: slot.id,
    label: slot.labelHint,
    verb: verb as ResponseIntentVerb,
    shape: slot.shape,
    previewEffects,
  }
  if (targetId !== undefined) choice.targetId = targetId
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
