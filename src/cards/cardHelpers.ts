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
import { buildCardContext } from './contextProjection'
import type {
  IssueSeed,
  IssueSeedFamilyId,
  ResponseSlot,
  ConsequenceProfile,
  ResponseIntentVerb,
} from '../sim/modules/issues/issueSeedTypes'
import type { EffectPreview } from '../sim/core/effect'
import type { EntityRef, TavernState } from '../sim/state/TavernState'
import { displayNameForRef } from '../sim/modules/issues/generatorHelpers'
import { pickSnippet } from './compose/assemble'
import { canonicaliseText } from './compose/gates/dedupe'
import {
  selectPreviewEffects,
  selectDelayedPreviewEffects,
  LATER_PREVIEW_PREFIX,
} from './compose/previewSelect'
import { SALIENCE_TABLES, type SalienceRead } from './compose/salience'
import { formatEffectPreview } from './compose/formatEffectPreview'
import { guardCardViewWording } from './compose/fairnessWording'
import type { SlotSpec, SnippetPool } from './compose/types'

const MAX_TITLE_WORDS = 6
const MAX_STAKES = 3
// Phase 182 / ISSUE-150 — Choice-Preview Legibility arc, Phase 2. The
// single source of truth for the choice-preview cap. Three is the small,
// phone-scannable ceiling that always fits the three decision-relevance
// categories `selectPreviewEffects` guarantees (headline meter + coin
// cost + headline risk). Templates no longer pass their own `maxPreview`
// — they all converge on this default. The `maxPreview` override remains
// on `ComposeChoicesOptions` for genuine future exceptions.
const MAX_PREVIEW = 3
const MAX_BODY = 3

/** Actor kinds a previewed effect can name as the spilled-onto party. Areas /
 *  systems / global markers are state, not actors, so they stay unattributed.
 *  Mirrors the `EntityRef.kind` union, narrowed to the people/cohort kinds a
 *  consequence profile actually moves. */
const ATTRIBUTABLE_ACTOR_KINDS: ReadonlyArray<EntityRef['kind']> = [
  'staff',
  'customer_group',
  'regular',
  'supplier',
  'faction',
  'culture',
  'notable_npc',
]

/**
 * Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3. Default cap on
 * the rendered choice set when a template doesn't override it via
 * `ComposeChoicesOptions.maxChoices`. Six chosen to leave the
 * eleven-slot supplier seed at a tractable size (six surfaced, five
 * mechanically present in the sim but not rendered) without affecting
 * the other nineteen migrated templates, whose seeds emit ≤ six
 * response slots. The cap is a *presentation* policy over what
 * `composeChoicesFromSeed` renders — `seed.responseSlots` is unchanged
 * and every dropped slot's `consequenceProfile` is still in `seed`.
 */
export const DEFAULT_LEGIBLE_CHOICE_CAP = 6

// Phase 181 / ISSUE-149 — Choice-Preview Legibility arc, Phase 1. The
// within-choice de-dup key for a preview cell. Two effects sharing a key reuse
// one rendered line; distinct keys render independently. Carrying the meter
// leaf (`meterId`) between targetKind and direction stops two DISTINCT meters
// in the same coarse bucket and band (loyalty +10 and stress −8, both
// `staff|positive|medium`) from collapsing into one cell. Returns `undefined`
// for effects that can't be banded (cause / zero-amount), which never collapse.
// Exported so the de-dup behaviour is testable without re-deriving the format.
export function previewCellKey(effect: EffectPreview): string | undefined {
  if (
    effect.targetKind === undefined ||
    effect.meterId === undefined ||
    effect.direction === undefined ||
    effect.magnitudeBand === undefined
  ) {
    return undefined
  }
  return `${effect.targetKind}|${effect.meterId}|${effect.direction}|${effect.magnitudeBand}`
}

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
  mechanicalEffects?: string[]
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
  const immediateEffects = profile?.immediateEffects ?? []
  const delayedEffects = overrides.includeDelayed ? (profile?.delayedEffects ?? []) : []
  const immediate = immediateEffects.map((e) => e.readable)
  const delayed = delayedEffects.map((e) => `later: ${e.readable}`)
  const defaultPreview = [...immediate, ...delayed].slice(0, previewMax)
  const defaultMechanical = [
    ...immediateEffects.map((e) => formatEffectPreview(e)),
    ...delayedEffects.map((e) => `later: ${formatEffectPreview(e)}`),
  ].slice(0, previewMax)
  const previewEffects = overrides.previewEffects ?? defaultPreview
  const mechanicalEffects = overrides.mechanicalEffects ?? defaultMechanical
  const choice: CardChoice = {
    slotId: slot.id,
    label: overrides.label ?? slot.labelHint,
    verb: verb as ResponseIntentVerb,
    shape: slot.shape,
    previewEffects,
  }
  if (mechanicalEffects !== undefined) choice.mechanicalEffects = mechanicalEffects
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
  /**
   * Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3. Cap on the
   * rendered choice set. Defaults to `DEFAULT_LEGIBLE_CHOICE_CAP` (6).
   * Slots are ordered by salience of the meter their effects move
   * (against `SALIENCE_TABLES[seed.family]`), ties broken by
   * seed-author order, then the top `maxChoices` slots are surfaced.
   * The inaction slot (verb `'ignore'` or empty `immediateEffects`) is
   * always preserved — appended past the cap if salience would
   * otherwise drop it. Set this only when a template genuinely needs a
   * different cap; otherwise leave the default and let
   * `applyLegibleChoiceCap` decide.
   */
  maxChoices?: number
  /** Optional extra producer-side overrides (e.g. `disabledReason`).
   *  Mechanical fields (`verb`, `targetId`) remain settable here; the
   *  helper sets `label` and `previewEffects` from the pools and any
   *  caller-supplied values for those two are overridden. */
  overrides?: (slot: ResponseSlot) => Omit<
    ChoiceOverrides,
    'maxPreview' | 'label' | 'previewEffects'
  >
}

/**
 * Phase 148 / ISSUE-116 — Legible Surface arc, Phase 3. Pure helper —
 * the legible choice-set cap policy. Pure function over `(seed, slots,
 * profiles, maxChoices) → ResponseSlot[]`; same inputs ⇒ same output,
 * no `Math.random`. Inspectable by tests and the `choiceDistinctness`
 * gate's sampler authors.
 *
 * Three steps:
 *   1. Score every slot by salience against `SALIENCE_TABLES[seed.family]`
 *      — the minimum salience-table index that any of the slot's
 *      consequence effects matches. Lower = more decision-relevant.
 *      Slots whose effects touch none of the table's reads score
 *      `Infinity`. Families without a salience table all score 0
 *      (cap degenerates to first-N in seed order).
 *   2. Sort by `(score ascending, originalIndex ascending)` so ties
 *      preserve seed-author order — the eleven supplier slots are
 *      curated in `expandedSeedGenerators.ts:1189-1280` from most-
 *      common (pay / negotiate) to most-strategic (split / exclusivity
 *      / investigate); seed order is the right secondary key.
 *   3. Take the first `maxChoices`. If the inaction slot would be
 *      dropped, append it past the cap (effective cap N+1 in the rare
 *      case the inaction option ranks outside the salience cut — never
 *      drop the option that needs the most legibility per the Phase-2
 *      preview legibility contract).
 *
 * A slot is "inaction" when its first allowed verb is `'ignore'` OR
 * its consequence profile has `immediateEffects: []` with at least one
 * `delayedEffects` entry (the Phase-147 inaction carve-out).
 */
export function applyLegibleChoiceCap(
  seed: IssueSeed,
  slots: readonly ResponseSlot[],
  profileFor: (slotId: string) => ConsequenceProfile | undefined,
  maxChoices: number,
): ResponseSlot[] {
  if (slots.length <= maxChoices) return slots.slice()
  const table = SALIENCE_TABLES[seed.family as IssueSeedFamilyId]
  const scored = slots.map((slot, originalIndex) => {
    const profile = profileFor(slot.id)
    const score = scoreSlotBySalience(slot, profile, table?.reads)
    return { slot, profile, originalIndex, score }
  })
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.originalIndex - b.originalIndex
  })
  const capped = scored.slice(0, maxChoices)
  for (const entry of scored) {
    if (!isInactionSlot(entry.slot, entry.profile)) continue
    if (capped.some((c) => c.slot.id === entry.slot.id)) continue
    capped.push(entry)
  }
  return capped.map((c) => c.slot)
}

function scoreSlotBySalience(
  slot: ResponseSlot,
  profile: ConsequenceProfile | undefined,
  reads: readonly SalienceRead[] | undefined,
): number {
  if (!reads || reads.length === 0) return 0
  // Inaction carve-out: when immediate is empty, score against delayed
  // so an "ignore" slot that triggers delayed consequences doesn't
  // get Infinity by default. Same source the Phase-147 inaction
  // preview path uses (`composeChoicesFromSeed:222-225`).
  const immediate = profile?.immediateEffects ?? []
  const delayed = profile?.delayedEffects ?? []
  const effects = immediate.length > 0 ? immediate : delayed
  if (effects.length === 0) {
    // Slot with no effects at all (a curated UI-only fallback) — let
    // it preserve seed order rather than rank last; score 0 means it
    // sits at the front of the tie. In practice no real seed emits
    // this, but the guard keeps the helper robust against fixtures.
    return 0
  }
  let min = Infinity
  for (const effect of effects) {
    for (let i = 0; i < reads.length; i += 1) {
      if (effectMatchesSalienceRead(effect, reads[i]!)) {
        if (i < min) min = i
      }
    }
  }
  return min
}

function effectMatchesSalienceRead(
  effect: EffectPreview,
  read: SalienceRead,
): boolean {
  switch (read.kind) {
    case 'signal': {
      // SignalId is `<kind>.<field>` (e.g. `supplier.reliability`);
      // an effect targets a salient meter when its targetKind matches
      // the SignalId's prefix kind. Mirrors the precedent in
      // `salience.ts:evaluateRead` which uses `querySignal` to resolve
      // the same prefix-kind mapping at sim time.
      const prefix = read.signal.split('.')[0]
      if (!effect.targetKind) return false
      return effect.targetKind === prefix
    }
    case 'pressure': {
      return (
        effect.targetKind === 'pressure' &&
        effect.target === `pressure:${read.pressureId}`
      )
    }
    case 'memory':
      return effect.tags.includes(read.tag)
    case 'repeat':
      return effect.tags.includes(read.subjectTag)
    case 'hasTag':
      // Phase 149 / ISSUE-117 — calendar / domain / toneHint tags live
      // on the seed, not on individual effects, so effects don't map to
      // `hasTag` reads through `effect.tags` cleanly. Treat as no match;
      // the cap ranks slots whose effects DO move a salient meter first,
      // and slots tied to calendar facts (rent_due_soon) fall through to
      // seed-order tie-break, which is the intended presentation order
      // anyway (no salient meter ⇒ original-index sort).
      return false
    case 'severity':
      // Phase 149 / ISSUE-117 — seed-level fact, no per-effect analogue.
      // Same rationale as `hasTag` above.
      return false
  }
}

function isInactionSlot(
  slot: ResponseSlot,
  profile: ConsequenceProfile | undefined,
): boolean {
  if (slot.allowedVerbs[0] === 'ignore') return true
  const immediate = profile?.immediateEffects ?? []
  const delayed = profile?.delayedEffects ?? []
  if (immediate.length === 0 && delayed.length > 0) return true
  return false
}

// Phase 189 / ISSUE-156 — recover the entity a previewed effect moves from its
// `target` string. State paths (`customers.miners.satisfaction`,
// `staff.server.loyalty`, `world.regulars.id.loyalty`) and the colon-prefixed
// cause refs (`customer_group:miners`, `staff:server`) both encode an actor;
// pure meters (`coin`, `reputation.respectable`, `pressure:rumour_pressure`)
// encode none. Returns `undefined` for the latter and for any shape it can't
// confidently map — naming the wrong actor is worse than naming none.
function entityRefFromEffectTarget(target: string): EntityRef | undefined {
  const colon = target.indexOf(':')
  if (colon >= 0) {
    const prefix = target.slice(0, colon)
    const id = target.slice(colon + 1)
    if (!id) return undefined
    switch (prefix) {
      case 'customer_group':
      case 'customer':
        return { kind: 'customer_group', id }
      case 'staff':
        return { kind: 'staff', id }
      case 'regular':
        return { kind: 'regular', id }
      case 'supplier':
        return { kind: 'supplier', id }
      case 'faction':
        return { kind: 'faction', id }
      case 'culture':
        return { kind: 'culture', id }
      default:
        return undefined
    }
  }
  const parts = target.split('.')
  if (parts[0] === 'customers' && parts[1]) {
    return { kind: 'customer_group', id: parts[1] }
  }
  if (parts[0] === 'staff' && parts[1] && parts.length >= 3) {
    return { kind: 'staff', id: parts[1] }
  }
  if (parts[0] === 'world' && parts[1] === 'regulars' && parts[2]) {
    return { kind: 'regular', id: parts[2] }
  }
  if (parts[0] === 'world' && parts[1] === 'suppliers' && parts[2]) {
    return { kind: 'supplier', id: parts[2] }
  }
  if (parts[0] === 'world' && parts[1] === 'factions' && parts[2]) {
    return { kind: 'faction', id: parts[2] }
  }
  if (parts[0] === 'world' && parts[1] === 'cultures' && parts[2]) {
    return { kind: 'culture', id: parts[2] }
  }
  return undefined
}

function refKey(ref: EntityRef | undefined): string | undefined {
  return ref ? `${ref.kind}:${ref.id}` : undefined
}

/** Phase 189 / ISSUE-156 — Plan B: when a previewed effect moves an actor OTHER
 *  than `seed.primaryActor`, name that actor in the line so the blast radius is
 *  visible ("…loyalty would deepen (Mira the Resolute)") instead of an
 *  unattributed meter move. Best-effort and conservative:
 *    - only ACTOR kinds are named (areas / systems / coin / pressure are not);
 *    - the actor must resolve to a real display name (not its raw id);
 *    - the primary actor is never re-named (the card already centres on it);
 *    - a line that already contains the name is left alone.
 *  Returns the line unchanged when none of these hold. Pure: `displayNameForRef`
 *  reads frozen state deterministically. */
function attributeNonPrimaryActor(
  line: string,
  effect: EffectPreview,
  seed: IssueSeed,
  state: TavernState,
): string {
  const ref = entityRefFromEffectTarget(effect.target)
  if (!ref) return line
  if (!ATTRIBUTABLE_ACTOR_KINDS.includes(ref.kind)) return line
  if (refKey(ref) === refKey(seed.primaryActor)) return line
  const name = displayNameForRef(state, ref)
  // Unresolved refs fall back to the raw id in `displayNameForRef`; naming a
  // bare id reads worse than naming nothing.
  if (!name || name === ref.id) return line
  if (line.toLowerCase().includes(name.toLowerCase())) return line
  return `${line} (${name})`
}

export function composeChoicesFromSeed(
  seed: IssueSeed,
  state: TavernState,
  options: ComposeChoicesOptions,
): CardChoice[] {
  const previewMax = options.maxPreview ?? MAX_PREVIEW
  const maxChoices = options.maxChoices ?? DEFAULT_LEGIBLE_CHOICE_CAP
  const profileFor = (slotId: string) =>
    seed.consequenceProfiles.find((p) => p.responseSlotId === slotId)
  const cappedSlots = applyLegibleChoiceCap(
    seed,
    seed.responseSlots,
    profileFor,
    maxChoices,
  )
  // Phase 167 / ISSUE-135 — within-card distinctness. Track the canonical
  // form of every label and every preview line already emitted on this
  // card, and feed them to `pickSnippet` so a later choice prefers an
  // unused candidate over FNV-pigeonholing onto a line an earlier choice
  // already used. The mechanical fields (verb / target / effects) are
  // untouched; only WHICH equal-specificity snippet renders changes. When
  // a pool genuinely lacks an unused candidate the pick falls back to the
  // FNV choice (a coverage gap the faithfulness gate then flags).
  const usedLabels = new Set<string>()
  const usedPreviews = new Set<string>()
  // Phase 182 / ISSUE-150 — Choice-Preview Legibility arc, Phase 2. Card-wide
  // preview-line uniqueness. `usedPreviews` STEERS `pickSnippet` toward unused
  // candidates; this set is the guarantee for when the pool runs out of them.
  // It tracks the canonical form of every FINAL preview line already emitted
  // ANYWHERE on this card. A composed line that would repeat one already shown
  // — within a choice via the coarse-cell reuse below, or on an earlier choice
  // once the candidate pool is exhausted — falls back to the effect's distinct
  // sim `readable`, so no choice ever renders a literal duplicate and no line
  // collides across choices. Cost lines are exempt: their coin keyword must
  // survive for the cost-surfacing gate, and the rich coin pool keeps them
  // distinct without this fallback. Phase 3 retires the readable stopgaps by
  // authoring meter-named composed prose that is distinct by construction.
  const emittedLines = new Set<string>()
  return cappedSlots.map((slot) => {
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
    const composedLabel = pickSnippet(
      labelSlot,
      seed,
      state,
      { currentResponseSlot: slot },
      usedLabels,
    )
    if (composedLabel !== undefined) usedLabels.add(canonicaliseText(composedLabel))
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
    const source = useDelayed ? delayed : immediate
    // Phase 166 / ISSUE-134 — cost-surfacing policy. A choice that spends
    // coin must show it: if a negative-direction coin effect would be
    // dropped by the `previewMax` cap, pull it into the last previewed
    // slot (keeping the leading, most-salient effects ahead of it).
    // Mechanical order in the profile is untouched — this only reorders
    // which effects the preview RENDERS. Shared with the legibility gate
    // via `selectPreviewEffects` so the two never drift.
    const effects = selectPreviewEffects(source, previewMax)
    // Phase 167 / ISSUE-135 — within a single choice, two effects landing
    // in the SAME preview cell (e.g. customer satisfaction + loyalty, both
    // positive/medium) reuse ONE line rather than each consuming a distinct
    // candidate from the card's avoid budget. Repeating the same line
    // within one choice is not a cross-choice lie (the gate only flags
    // lines shared across DISTINCT choices); reusing it leaves more
    // candidates for the cross-choice distinctness the gate enforces.
    //
    // Phase 181 / ISSUE-149 — Choice-Preview Legibility arc, Phase 1. The
    // within-choice de-dup map (`cellLineThisChoice`) is keyed meter-aware via
    // `previewCellKey` (`targetKind|meterId|direction|magnitudeBand`), so two
    // DISTINCT meters in the same coarse bucket and band (loyalty +10 and
    // stress −8, both `staff|positive|medium`) no longer share a cell. The
    // `coarseCellLine` map below still reuses one coarse line for two distinct
    // meters when the pool has no meter-specific candidate (kept on purpose so
    // distinct meters don't each drain the cross-choice candidate budget before
    // Phase 3's meter-named prose exists). That reuse can repeat a line — which
    // Phase 182's card-wide `emittedLines` de-dup then resolves by falling the
    // repeat back to the effect's distinct sim `readable`, so the candidate
    // budget is preserved AND no literal duplicate survives.
    const cellLineThisChoice = new Map<string, string>()
    const coarseCellLine = new Map<string, string>()
    // Phase 181 made the de-dup cell key meter-aware, but the `coarseCellLine`
    // reuse below still hands one coarse line to two distinct meters (kept on
    // purpose so distinct meters don't each drain the candidate budget). The
    // card-wide `emittedLines` set (above) turns any such repeat — within this
    // choice or across choices — into the effect's distinct sim `readable`.
    // Falling back to `readable` rather than dropping the entry keeps
    // `previewEffects` 1:1 with the selected effects, so the legibility /
    // faithfulness gates' line→effect re-derivation stays aligned and the
    // readable already counts as legible under their `line === effect.readable`
    // sim-authority carve-out.
    const mechanicalPreview = effects.map((effect) => formatEffectPreview(effect, state))
    const composedPreview = effects.map((effect, idx) => {
      const cellKey = previewCellKey(effect)
      // Compose (or cell-reuse) the line exactly as before — this still
      // populates the cross-choice `usedPreviews` avoid-set and the cell
      // maps, so the candidate budget is untouched.
      let composedLine: string
      const coarseKey =
        effect.targetKind !== undefined &&
        effect.direction !== undefined &&
        effect.magnitudeBand !== undefined
          ? `${effect.targetKind}|${effect.direction}|${effect.magnitudeBand}`
          : undefined
      if (cellKey !== undefined && cellLineThisChoice.has(cellKey)) {
        composedLine = cellLineThisChoice.get(cellKey)!
      } else if (coarseKey !== undefined && coarseCellLine.has(coarseKey)) {
        composedLine = coarseCellLine.get(coarseKey)!
        if (cellKey !== undefined) cellLineThisChoice.set(cellKey, composedLine)
      } else {
        const previewSlot: SlotSpec = {
          id: `effect_preview::${slot.id}::${idx}`,
          role: 'effect_preview',
          pool: options.previewPool,
          optional: true,
          wordBudget: 10,
          claimMode: 'flavor',
        }
        const composed = pickSnippet(
          previewSlot,
          seed,
          state,
          {
            currentResponseSlot: slot,
            currentEffect: effect,
            inactionPreview: useDelayed,
          },
          usedPreviews,
        )
        composedLine = composed ?? effect.readable
        usedPreviews.add(canonicaliseText(composedLine))
        if (cellKey !== undefined) cellLineThisChoice.set(cellKey, composedLine)
        if (coarseKey !== undefined) coarseCellLine.set(coarseKey, composedLine)
      }
      // Phase 189 / ISSUE-156 — Plan B: name the other actor when this effect
      // moves someone other than the primary one. Applied BEFORE the card-wide
      // de-dup so the emitted-line key reflects the final attributed text (two
      // cell-reused lines for distinct actors then read distinctly, and two for
      // the SAME actor collapse correctly). Never applied to a sim `readable`
      // line: the legibility / faithfulness gates treat `line ===
      // effect.readable` as authoritative and skip it, and appending to it
      // would defeat that carve-out.
      let line = composedLine
      if (line !== effect.readable) {
        line = attributeNonPrimaryActor(line, effect, seed, state)
      }
      // De-dup: a line that exactly repeats one already emitted anywhere on
      // this card falls back to the effect's distinct sim `readable`. Coin
      // cost lines are exempt so their coin keyword survives for the gate;
      // non-coin burden lines may fall back so staff stress/fatigue tradeoffs
      // do not inherit another staff meter's wording.
      if (
        emittedLines.has(canonicaliseText(line)) &&
        !(effect.targetKind === 'coin' && effect.direction === 'negative')
      ) {
        line = effect.readable
      }
      emittedLines.add(canonicaliseText(line))
      return line
    })
    // Phase 189 / ISSUE-156 — Plan A: an ACTIVE choice (one with immediate
    // effects) surfaces its role-selected delayed consequences
    // as trailing `later:` lines — what the choice sets up for later. Additive
    // to the immediate `previewMax` (never counted against it, so a delayed
    // line can never displace a surfaced cost). The zero-immediate inaction
    // carve-out (`useDelayed`) is unchanged: it already previews its delayed
    // effects directly, with no `later:` prefix.
    if (!useDelayed) {
      const delayedEffectsToPreview = selectDelayedPreviewEffects(
        delayed,
        slot.choiceContract,
      )
      for (let idx = 0; idx < delayedEffectsToPreview.length; idx += 1) {
        const delayedEffect = delayedEffectsToPreview[idx]!
        const laterSlot: SlotSpec = {
          id: `effect_preview::${slot.id}::later::${idx}`,
          role: 'effect_preview',
          pool: options.previewPool,
          optional: true,
          wordBudget: 10,
          claimMode: 'flavor',
        }
        const composedLater = pickSnippet(
          laterSlot,
          seed,
          state,
          { currentResponseSlot: slot, currentEffect: delayedEffect },
          usedPreviews,
        )
        let laterBody = composedLater ?? delayedEffect.readable
        usedPreviews.add(canonicaliseText(laterBody))
        if (laterBody !== delayedEffect.readable) {
          laterBody = attributeNonPrimaryActor(laterBody, delayedEffect, seed, state)
        }
        let laterLine = `${LATER_PREVIEW_PREFIX}${laterBody}`
        // Two choices' `later:` lines could compose identically; fall a repeat
        // back to the delayed effect's distinct sim `readable` so no two
        // choices render the same `later:` line (the cross-choice duplicate the
        // faithfulness / legibility gates flag).
        if (emittedLines.has(canonicaliseText(laterLine))) {
          laterLine = `${LATER_PREVIEW_PREFIX}${delayedEffect.readable}`
        }
        emittedLines.add(canonicaliseText(laterLine))
        composedPreview.push(laterLine)
        mechanicalPreview.push(`${LATER_PREVIEW_PREFIX}${formatEffectPreview(delayedEffect, state)}`)
      }
    }
    const extra = options.overrides?.(slot) ?? {}
    const overrides: ChoiceOverrides = {
      ...extra,
      maxPreview: previewMax,
      previewEffects: composedPreview,
      mechanicalEffects: mechanicalPreview,
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

export function withCardContext(
  card: CardView,
  seed: IssueSeed,
  state: TavernState,
): CardView {
  const guarded = guardCardViewWording(card, seed, state)
  if (guarded.context) return guarded
  return {
    ...guarded,
    context: buildCardContext(seed, state),
  }
}
