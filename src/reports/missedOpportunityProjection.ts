// Phase 97 — Missed-opportunity projection.
//
// "You could have done X" is a teaching surface that lives between the
// daily report's "What happened" and "What's building" blocks. It mines
// three signal sources the simulation already emits:
//
//   1. Pressure-remedy: a pressure rose today + the matching remedial
//      owner action was not applied → "Cleaning the kitchen would have
//      eased food safety."
//   2. Ignored-seed: an issue seed sat on `seedsToday` with no matching
//      response intent → the alternative slot the player did not pick
//      becomes the "what you could have done."
//   3. Diff-counterfactual: a significant negative diff whose causes
//      trace to a known remedial action that was not applied today →
//      "A repair yesterday would have softened today's cleanliness
//      slide."
//
// The projection is pure: same `(SimResult, TavernState)` ⇒ same output.
// No mutation, no `Math.random()`, no DOM. Per `cards-contract.md §1`,
// the simulation is the source of truth — we project, we do not invent.

import type { SimResult } from '../sim/core/result'
import type { EntityRef, TavernState } from '../sim/state/TavernState'
import type {
  PressureSnapshot,
} from '../sim/modules/pressures/pressureTypes'
import type { StateChange } from '../sim/core/diff'
import type {
  ConsequenceProfile,
  IssueSeed,
  ResponseSlot,
} from '../sim/modules/issues/issueSeedTypes'
import type {
  OwnerActionApplied,
} from '../sim/modules/ownerActions/types'
import type { ResolvedIntentRecord } from '../sim/modules/responses/types'
import { actionRegistry } from '../sim/registries/actionRegistry'
import { canApplyAction } from '../sim/modules/ownerActions/readonlyHelpers'
import { pathToCauseTarget } from './causeLookup'
import { resolveEntityLabel } from './entityLabels'
import {
  PRESSURE_REMEDIES,
  resolveRemedyTarget,
  type RemedyEntry,
} from './pressureRemedyMap'
import type { MissedOpportunityKind, MissedOpportunityLine } from './types'
import {
  composeDiffReadableVoiced,
  composeIgnoredReadableVoiced,
  composePressureReadableVoiced,
  composePressureSecondaryVoiced,
} from './compose/sections'

export type { MissedOpportunityKind, MissedOpportunityLine }

export type ProjectMissedOpportunitiesOptions = {
  /** Per-day dismissed ids — those opportunities are filtered out. */
  dismissedIds?: ReadonlySet<string>
  /** Max visible lines. Default 3. */
  cap?: number
  /** Absolute day that just closed (closedDayAbsolute(state)). Used in
   *  the stable id so per-day dismissals scope cleanly. */
  closedDay: number
}

const DEFAULT_CAP = 3
const PRESSURE_VALUE_THRESHOLD = 30
const PRESSURE_DELTA_THRESHOLD = 1
const READABLE_WORD_BUDGET = 14
const SECONDARY_WORD_BUDGET = 10
/** Diff paths the counterfactual scanner considers. */
const COUNTERFACTUAL_DOMAINS: readonly string[] = [
  'reputation.',
  'areas.',
  'stock.',
]

export function projectMissedOpportunities(
  result: SimResult,
  state: TavernState,
  options: ProjectMissedOpportunitiesOptions,
): MissedOpportunityLine[] {
  const { closedDay, dismissedIds, cap = DEFAULT_CAP } = options
  if (closedDay < 1) return []

  const appliedActions = readAppliedActions(result)
  const resolved = readResolvedToday(state)

  const candidates: MissedOpportunityLine[] = [
    ...projectPressureRemedies(state, appliedActions, closedDay),
    ...projectIgnoredSeeds(state, resolved, closedDay),
    ...projectDiffCounterfactuals(result, state, appliedActions, closedDay),
  ]

  const deduped = dedup(candidates)
  const sorted = sortByImpact(deduped)
  const filtered = dismissedIds
    ? sorted.filter((c) => !dismissedIds.has(c.id))
    : sorted
  return filtered.slice(0, cap)
}

// ─── Sub-projector: pressure remedy ─────────────────────────────────

function projectPressureRemedies(
  state: TavernState,
  appliedActions: readonly OwnerActionApplied[],
  closedDay: number,
): MissedOpportunityLine[] {
  const snapshots = readPressureSnapshots(state)
  const out: MissedOpportunityLine[] = []
  for (const snap of snapshots) {
    if (snap.delta < PRESSURE_DELTA_THRESHOLD) continue
    if (snap.value < PRESSURE_VALUE_THRESHOLD) continue
    const remedies = PRESSURE_REMEDIES[snap.id]
    if (!remedies || remedies.length === 0) continue
    for (const remedy of remedies) {
      if (!actionRegistry.has(remedy.actionId)) continue
      const target = resolveRemedyTarget(state, snap, remedy)
      if (wasApplied(appliedActions, remedy.actionId, target?.id)) continue
      const line = composePressureLine(state, snap, remedy, target, closedDay)
      out.push(line)
    }
  }
  return out
}

function composePressureLine(
  state: TavernState,
  snap: PressureSnapshot,
  remedy: RemedyEntry,
  target: EntityRef | undefined,
  closedDay: number,
): MissedOpportunityLine {
  const def = actionRegistry.get(remedy.actionId)
  const actionLabel = def.label
  const targetLabel = target ? resolveEntityLabel(state, target) : undefined
  const readable = clampWords(
    composePressureReadableVoiced({
      state,
      closedDay,
      actionId: remedy.actionId,
      actionLabel,
      targetLabel,
      pressureLabel: snap.label,
      pressureDelta: snap.delta,
    }),
    READABLE_WORD_BUDGET,
  )
  const secondary = clampWords(
    composePressureSecondaryVoiced({
      state,
      closedDay,
      actionId: remedy.actionId,
      targetId: target?.id,
      pressureLabel: snap.label,
      pressureDelta: snap.delta,
      pressureValue: snap.value,
    }),
    SECONDARY_WORD_BUDGET,
  )
  const impact = (snap.delta * snap.severity) / 100 * (remedy.impactWeight ?? 1)
  // Phase 96 / ISSUE-056 — Annotate if the suggested remedy wouldn't
  // have actually passed canApply against today's state.
  const validityNote = remedyValidityNote(state, remedy.actionId, target?.id)
  return {
    id: makeId(closedDay, 'pressure_remedy', remedy.actionId, target?.id),
    kind: 'pressure_remedy',
    readable,
    secondary,
    actionId: remedy.actionId,
    actionLabel,
    ...(target ? { targetRef: target } : {}),
    ...(targetLabel ? { targetLabel } : {}),
    pressureId: snap.id,
    impact,
    ...(validityNote ? { validityNote } : {}),
  }
}

// Phase 96 / ISSUE-056 — Returns a short note if the (action, target)
// pair would not pass `canApply` against today's state. Undefined when
// the remedy is applicable. The note is short enough to append to the
// `readable` line without breaking the word budget.
function remedyValidityNote(
  state: TavernState,
  actionId: string,
  targetId: string | undefined,
): string | undefined {
  if (!actionRegistry.has(actionId)) return undefined
  const def = actionRegistry.get(actionId)
  const verdict = canApplyAction(def, state, {
    actionId,
    ...(targetId ? { targetId } : {}),
  })
  if (verdict.ok) return undefined
  return clampWords(`would have needed: ${verdict.reason}`, 8)
}

// ─── Sub-projector: ignored seeds ───────────────────────────────────

function projectIgnoredSeeds(
  state: TavernState,
  resolved: readonly ResolvedIntentRecord[],
  closedDay: number,
): MissedOpportunityLine[] {
  const seeds = readSeedsToday(state)
  if (seeds.length === 0) return []
  const resolvedSeedIds = new Set(resolved.map((r) => r.seedId))
  const out: MissedOpportunityLine[] = []
  for (const seed of seeds) {
    if (seed.validation.valid === false) continue
    if (resolvedSeedIds.has(seed.id)) continue
    if (seed.responseSlots.length === 0) continue
    const best = bestNonIgnoreSlot(seed)
    if (!best) continue
    out.push(composeIgnoredSeedLine(state, seed, best, closedDay))
  }
  return out
}

function bestNonIgnoreSlot(
  seed: IssueSeed,
): { slot: ResponseSlot; profile: ConsequenceProfile } | undefined {
  const profilesBySlot = new Map<string, ConsequenceProfile[]>()
  for (const profile of seed.consequenceProfiles) {
    const list = profilesBySlot.get(profile.responseSlotId) ?? []
    list.push(profile)
    profilesBySlot.set(profile.responseSlotId, list)
  }
  let bestSlot: ResponseSlot | undefined
  let bestProfile: ConsequenceProfile | undefined
  let bestScore = -Infinity
  for (const slot of seed.responseSlots) {
    if (slot.shape === 'ignore') continue
    if (slot.allowedVerbs.length === 0) continue
    if (slot.allowedVerbs[0] === 'ignore') continue
    const profiles = profilesBySlot.get(slot.id) ?? []
    const top = profiles.reduce<ConsequenceProfile | undefined>(
      (acc, p) => (acc === undefined || p.impactScore > acc.impactScore ? p : acc),
      undefined,
    )
    const score = top?.impactScore ?? 0
    if (score > bestScore) {
      bestScore = score
      bestSlot = slot
      bestProfile = top
    }
  }
  if (!bestSlot) return undefined
  // bestProfile may still be undefined for slots with no profiles — in
  // that case we still surface the slot with a 0-impact rationale.
  return {
    slot: bestSlot,
    profile:
      bestProfile ?? {
        id: 'synthetic',
        responseSlotId: bestSlot.id,
        immediateEffects: [],
        delayedEffects: [],
        memories: [],
        futureHooks: [],
        impactScore: 0,
      },
  }
}

function composeIgnoredSeedLine(
  state: TavernState,
  seed: IssueSeed,
  best: { slot: ResponseSlot; profile: ConsequenceProfile },
  closedDay: number,
): MissedOpportunityLine {
  const { slot } = best
  const verb = slot.allowedVerbs[0] ?? 'act'
  const subject = seed.textIngredients.subject || seed.family
  const targetRef = slot.targetOptions[0]
  const targetLabel = targetRef
    ? resolveEntityLabel(state, targetRef)
    : undefined
  const slotLabel = slot.labelHint.trim() || `${verb} ${subject}`
  const readable = clampWords(
    composeIgnoredReadableVoiced({
      state,
      closedDay,
      slotLabel,
      subject,
      seedId: seed.id,
      severity: seed.severity,
    }),
    READABLE_WORD_BUDGET,
  )
  const secondary = clampWords(
    `Ignored ${subject} (severity ${seed.severity}).`,
    SECONDARY_WORD_BUDGET,
  )
  const impact = (seed.severity * seed.novelty) / 100
  return {
    id: makeId(closedDay, 'ignored_seed', verb, seed.id),
    kind: 'ignored_seed',
    readable,
    secondary,
    actionId: verb,
    actionLabel: slotLabel,
    ...(targetRef ? { targetRef } : {}),
    ...(targetLabel ? { targetLabel } : {}),
    seedId: seed.id,
    impact,
  }
}

// ─── Sub-projector: diff counterfactual ─────────────────────────────

function projectDiffCounterfactuals(
  result: SimResult,
  state: TavernState,
  appliedActions: readonly OwnerActionApplied[],
  closedDay: number,
): MissedOpportunityLine[] {
  const dayDiff = result.diffs.find((d) => d.boundary === 'day')
  const significant = dayDiff?.significantChanges ?? []
  const out: MissedOpportunityLine[] = []
  for (const change of significant) {
    if ((change.delta ?? 0) >= 0) continue
    if (!isTrackedDomain(change.path)) continue
    const causeTarget = pathToCauseTarget(change.path)
    const causes = state.causes
      .filter((c) => c.target === causeTarget && c.timestamp.absoluteDay === closedDay)
      .sort((a, b) => b.weight - a.weight)
    if (causes.length === 0) continue
    const topCause = causes[0]!
    const remedy = remedyForCauseTags(topCause.tags)
    if (!remedy) continue
    if (!actionRegistry.has(remedy.actionId)) continue
    const target = resolveDiffTarget(state, change, remedy)
    if (wasApplied(appliedActions, remedy.actionId, target?.id)) continue
    out.push(composeDiffLine(state, change, remedy, target, closedDay))
  }
  return out
}

function isTrackedDomain(path: string): boolean {
  return COUNTERFACTUAL_DOMAINS.some((prefix) => path.startsWith(prefix))
}

/** Map cause tags onto a remedy action. The tags emitted by owner-action
 *  causes (`['owner_action', actionId, ...]`) and by service-driven
 *  causes (`['cleanliness']`, `['damage']`, `['food_quality']`) tell us
 *  which immediate action would have addressed the change. */
function remedyForCauseTags(tags: readonly string[]): RemedyEntry | undefined {
  const lower = tags.map((t) => t.toLowerCase())
  if (lower.includes('cleanliness') || lower.includes('smell') || lower.includes('mess')) {
    return { actionId: 'clean_area', targetKind: 'area', impactWeight: 1 }
  }
  if (lower.includes('damage') || lower.includes('condition') || lower.includes('maintenance')) {
    return { actionId: 'repair_area', targetKind: 'area', impactWeight: 1 }
  }
  if (lower.includes('pests') || lower.includes('cellar')) {
    return { actionId: 'fumigate_cellar', targetKind: 'area', impactWeight: 1 }
  }
  if (lower.includes('roof') || lower.includes('weather')) {
    return { actionId: 'patch_roof', targetKind: 'area', impactWeight: 1 }
  }
  if (lower.includes('stock') || lower.includes('shortage') || lower.includes('quantity')) {
    return { actionId: 'restock_item', targetKind: 'stock', impactWeight: 1 }
  }
  if (lower.includes('staff') || lower.includes('morale') || lower.includes('stress')) {
    return { actionId: 'pay_staff_bonus', targetKind: 'staff', impactWeight: 1 }
  }
  return undefined
}

function resolveDiffTarget(
  state: TavernState,
  change: StateChange,
  remedy: RemedyEntry,
): EntityRef | undefined {
  // Extract the target id from the diff path:
  //   areas.kitchen.damage  → { kind: 'area', id: 'kitchen' }
  //   stock.ale.quantity    → { kind: 'stock', id: 'ale' }
  //   staff.alice.morale    → { kind: 'staff', id: 'alice' }
  //   reputation.tasty      → no specific target
  if (change.path.startsWith('areas.')) {
    const id = change.path.slice('areas.'.length).split('.')[0]
    if (id && state.areas[id]) return { kind: 'area', id }
  }
  if (change.path.startsWith('stock.')) {
    const id = change.path.slice('stock.'.length).split('.')[0]
    if (id && state.stock[id]) return { kind: 'stock', id }
  }
  if (change.path.startsWith('staff.')) {
    const id = change.path.slice('staff.'.length).split('.')[0]
    if (id && state.staff[id]) return { kind: 'staff', id }
  }
  // Fall back to the remedy's target-kind hints by walking state.
  return resolveRemedyTarget(
    state,
    { relatedLocations: [], relatedActors: [] },
    remedy,
  )
}

function composeDiffLine(
  state: TavernState,
  change: StateChange,
  remedy: RemedyEntry,
  target: EntityRef | undefined,
  closedDay: number,
): MissedOpportunityLine {
  const def = actionRegistry.get(remedy.actionId)
  const actionLabel = def.label
  const targetLabel = target ? resolveEntityLabel(state, target) : undefined
  const subjectNoun = diffSubject(change.path)
  const readable = clampWords(
    composeDiffReadableVoiced({
      state,
      closedDay,
      actionId: remedy.actionId,
      actionLabel,
      targetLabel,
      subjectNoun,
      diffPath: change.path,
    }),
    READABLE_WORD_BUDGET,
  )
  const secondary = clampWords(
    `${subjectNoun} fell ${change.delta ?? 0}.`,
    SECONDARY_WORD_BUDGET,
  )
  const impact = Math.abs(change.delta ?? 0) * 2
  return {
    id: makeId(closedDay, 'diff_counterfactual', remedy.actionId, target?.id),
    kind: 'diff_counterfactual',
    readable,
    secondary,
    actionId: remedy.actionId,
    actionLabel,
    ...(target ? { targetRef: target } : {}),
    ...(targetLabel ? { targetLabel } : {}),
    diffPath: change.path,
    impact,
  }
}

function diffSubject(path: string): string {
  if (path.startsWith('reputation.')) return path.slice('reputation.'.length)
  if (path.startsWith('areas.')) {
    const rest = path.slice('areas.'.length).split('.')
    const meter = rest[1] ?? 'condition'
    return meter
  }
  if (path.startsWith('stock.')) {
    const rest = path.slice('stock.'.length).split('.')
    const item = rest[0] ?? ''
    const meter = rest[1] ?? ''
    return `${item} ${meter}`.trim()
  }
  return path
}

// ─── Dedup / sort ───────────────────────────────────────────────────

function dedup(
  candidates: readonly MissedOpportunityLine[],
): MissedOpportunityLine[] {
  // Group by (actionId, targetRef.id ?? '*'). Within each group, keep
  // the highest-impact line.
  const groups = new Map<string, MissedOpportunityLine>()
  for (const c of candidates) {
    const key = `${c.actionId}:${c.targetRef?.id ?? '*'}`
    const prev = groups.get(key)
    if (!prev || c.impact > prev.impact) {
      groups.set(key, c)
    }
  }
  return Array.from(groups.values())
}

function sortByImpact(
  list: readonly MissedOpportunityLine[],
): MissedOpportunityLine[] {
  return [...list].sort((a, b) => {
    if (b.impact !== a.impact) return b.impact - a.impact
    if (a.actionId !== b.actionId) return a.actionId < b.actionId ? -1 : 1
    const at = a.targetRef?.id ?? ''
    const bt = b.targetRef?.id ?? ''
    if (at !== bt) return at < bt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
}

// ─── State / result accessors ───────────────────────────────────────

function readAppliedActions(result: SimResult): OwnerActionApplied[] {
  const section = result.reports.find((r) => r.id === 'ownerActions')
  const applied = (section?.data?.['applied'] as OwnerActionApplied[] | undefined) ?? []
  return applied
}

function readResolvedToday(state: TavernState): ResolvedIntentRecord[] {
  const slice = state.modules['responses'] as
    | { resolvedToday?: ResolvedIntentRecord[] }
    | undefined
  return slice?.resolvedToday ?? []
}

function readSeedsToday(state: TavernState): IssueSeed[] {
  const slice = state.modules['issueSeeds'] as
    | { seedsToday?: IssueSeed[] }
    | undefined
  return slice?.seedsToday ?? []
}

function readPressureSnapshots(state: TavernState): PressureSnapshot[] {
  const slice = state.modules['pressures'] as
    | { snapshots?: Record<string, PressureSnapshot> }
    | undefined
  if (!slice?.snapshots) return []
  return Object.values(slice.snapshots)
}

function wasApplied(
  applied: readonly OwnerActionApplied[],
  actionId: string,
  targetId: string | undefined,
): boolean {
  return applied.some((a) => {
    if (a.actionId !== actionId) return false
    if (targetId === undefined) return true
    return a.targetId === targetId
  })
}

// ─── Misc helpers ───────────────────────────────────────────────────

function makeId(
  closedDay: number,
  kind: MissedOpportunityKind,
  actionOrVerb: string,
  targetOrSeed: string | undefined,
): string {
  const tail = targetOrSeed ?? 'none'
  return `missed_opp:${closedDay}:${kind}:${actionOrVerb}:${tail}`
}

function clampWords(s: string, max: number): string {
  const words = s.trim().split(/\s+/).filter(Boolean)
  if (words.length <= max) return words.join(' ')
  return words.slice(0, max).join(' ') + '…'
}

function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '·'
}
