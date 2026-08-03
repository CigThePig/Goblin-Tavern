import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'
import { getEconomyModuleState } from '../economy/state'

import {
  getRegulatoryModuleState,
  nextEvidenceId,
  recordEvidence,
  writeRecords,
  writeRegulatoryState,
} from './state'
import {
  EVIDENCE_WINDOW_DAYS,
  evidenceWeight,
  type EvidenceEntry,
  type InspectionDimension,
} from './types'

// Expansion Phase 7 §7.3.1 — "suspicion and evidence accumulation".
//
// The monthly `resolveInspection` this replaces read almost the same inputs
// once a month and folded them into a single 0–100 meter. Two things change,
// and both are the point of the phase:
//
//   1. It runs DAILY, off the state as it actually was that day, so a
//      kitchen cleaned on the fourth day of a filthy week is a shorter
//      streak of evidence rather than the same monthly number.
//   2. It produces ITEMISED, ATTRIBUTED observations rather than a scalar.
//      A finding has to say what was wrong and where, and a player has to be
//      able to fix that specific thing — neither is possible from a meter.
//
// `pressure:inspection` still exists and still means what it meant: a
// forecast of risk. §7.3 is explicit that it must not BE the event, and
// nothing here writes it as a substitute for one.

/** Below this, a kitchen is a food-safety problem rather than a tidiness one. */
const KITCHEN_UNSAFE = 40
const AREA_FILTHY = 35
const AREA_SMELLY = 65
const AREA_DAMAGED = 45
const SPOILAGE_BAD = 55

export type EvidenceObservation = Omit<EvidenceEntry, 'observedOnDay'>

/**
 * Read the tavern and write down what an inspector would notice.
 *
 * PURE — it returns observations rather than writing them, so the daily hook
 * can record them and a test (or a future "what would they see?" preview)
 * can ask the same question without mutating anything.
 */
export function observeEvidence(state: TavernState): EvidenceObservation[] {
  const out: EvidenceObservation[] = []
  // Ids are DERIVED from what was seen, not minted from a counter: a kitchen
  // that has been filthy for a week must refresh one standing observation
  // rather than adding a seventh, which is what keeps the window bounded and
  // what lets a fix clear the exact thing it fixed.
  const id = (dimension: string, subject: string) => `ev-${dimension}-${subject}`

  // ---- Food safety: the kitchen, specifically ----
  const kitchen = state.areas['kitchen']
  if (kitchen && kitchen.cleanliness < KITCHEN_UNSAFE) {
    out.push({
      id: id('food_safety', 'kitchen'),
      dimension: 'food_safety',
      severity: Math.min(20, Math.round((KITCHEN_UNSAFE - kitchen.cleanliness) / 2)),
      readable: `The kitchen is being cooked in at cleanliness ${kitchen.cleanliness}.`,
      areaId: 'kitchen',
      tags: ['kitchen', 'food'],
    })
  }

  // ---- Cleanliness and smell, across every room the public sees ----
  for (const area of Object.values(state.areas)) {
    if (area.cleanliness < AREA_FILTHY) {
      out.push({
        id: id('cleanliness', area.id),
        dimension: 'cleanliness',
        severity: Math.min(20, Math.round((AREA_FILTHY - area.cleanliness) / 2)),
        readable: `${area.label} is filthy (cleanliness ${area.cleanliness}).`,
        areaId: area.id,
        tags: ['cleanliness'],
      })
    }
    if (area.smell >= AREA_SMELLY) {
      out.push({
        id: id('cleanliness', `${area.id}-smell`),
        dimension: 'cleanliness',
        severity: Math.min(20, Math.round((area.smell - AREA_SMELLY) / 2) + 3),
        readable: `${area.label} smells (${area.smell}).`,
        areaId: area.id,
        tags: ['smell'],
      })
    }
    if (area.damage >= AREA_DAMAGED) {
      out.push({
        id: id('damage', area.id),
        dimension: 'damage',
        severity: Math.min(20, Math.round((area.damage - AREA_DAMAGED) / 3) + 2),
        readable: `${area.label} is damaged (${area.damage}).`,
        areaId: area.id,
        tags: ['damage', 'structure'],
      })
    }
  }

  // ---- Spoilage: food actually in the cellar, not a tagged abstraction ----
  for (const item of Object.values(state.stock)) {
    if (!item.tags.includes('food')) continue
    if (item.quantity <= 0) continue
    if (item.spoilage < SPOILAGE_BAD) continue
    out.push({
      id: id('spoilage', item.id),
      dimension: 'spoilage',
      severity: Math.min(20, Math.round((item.spoilage - SPOILAGE_BAD) / 3) + 4),
      readable: `${item.label} is spoiling in store (${item.spoilage}%).`,
      tags: ['spoilage', 'food'],
    })
  }

  // ---- House rules: a policy the tavern declared and is not keeping ----
  const economy = getEconomyModuleState(state)
  for (const policy of Object.values(economy.policies)) {
    if (!policy.intendedEnabled) continue
    if (policy.status !== 'violated' && policy.status !== 'partial') continue
    out.push({
      id: id('house_rules', policy.policyId),
      dimension: 'house_rules',
      severity: policy.status === 'violated' ? 10 : 5,
      readable: `House rule '${policy.policyId}' is declared but ${policy.status} (compliance ${policy.compliance}).`,
      tags: ['policy', 'house_rules'],
    })
  }

  // ---- Records: the tavern's own paperwork ----
  const records = getRegulatoryModuleState(state).records
  if (records.readiness < 40) {
    out.push({
      id: id('records', 'books'),
      dimension: 'records',
      severity: Math.min(20, Math.round((40 - records.readiness) / 3) + 2),
      readable: `The books are not in a state anyone could inspect (${records.readiness}).`,
      tags: ['records'],
    })
  }

  return out
}

/** Daily rate the books slip when nobody keeps them. */
const RECORDS_DECAY_PER_DAY = 2

/**
 * The daily evidence pass.
 *
 * Records the observations, lets the books slip a little, and clears
 * observations whose underlying condition the tavern has actually fixed —
 * which is what makes cleaning a room a real way to reduce inspection risk
 * rather than a meter nudge.
 */
export function accumulateEvidence(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const observations = observeEvidence(ctx.state)
  const observedIds = new Set(observations.map((entry) => entry.id))

  for (const observation of observations) recordEvidence(ctx, observation)

  // Anything the watch noted that is no longer true stops counting the day
  // it stops being true. `EVIDENCE_WINDOW_DAYS` handles the rest.
  const slice = getRegulatoryModuleState(ctx.state)
  const stale = slice.evidence.filter(
    (entry) =>
      !observedIds.has(entry.id) &&
      entry.dimension !== 'recent_evidence' &&
      entry.observedOnDay < today,
  )
  if (stale.length > 0) {
    const staleIds = new Set(stale.map((entry) => entry.id))
    writeRegulatoryState(
      ctx,
      (current) => ({
        ...current,
        evidence: current.evidence.filter((entry) => !staleIds.has(entry.id)),
      }),
      'evidence_resolved',
    )
  }

  const records = getRegulatoryModuleState(ctx.state).records
  if (records.readiness > 0 && records.lastUpdatedOnDay < today) {
    writeRecords(
      ctx,
      (current) => ({
        ...current,
        readiness: Math.max(0, current.readiness - RECORDS_DECAY_PER_DAY),
      }),
      'records_decay',
    )
  }
}

/**
 * Add an observation from somewhere other than the daily read — a service
 * incident, a supplier's bad delivery, a rumour the watch heard.
 *
 * These are the `recent_evidence` dimension: things that happened rather
 * than things that are true, so they age out of the window rather than being
 * cleared by fixing a room.
 */
export function noteIncidentEvidence(
  ctx: SimContext,
  input: { subject: string; severity: number; readable: string; tags?: string[] },
): void {
  recordEvidence(ctx, {
    id: nextEvidenceId(ctx.state, `recent-${input.subject}`),
    dimension: 'recent_evidence',
    severity: Math.max(1, Math.min(20, Math.round(input.severity))),
    readable: input.readable,
    tags: ['incident', ...(input.tags ?? [])],
  })
  writeRegulatoryState(
    ctx,
    (current) => ({
      ...current,
      nextEvidenceSuffix: current.nextEvidenceSuffix + 1,
    }),
    'evidence_suffix',
  )
}

/**
 * How interested the watch is, on a 0–100 scale comparable with the old
 * `monthly.inspection.suspicion` — so the pressure calculator, the report
 * and the migration all speak the same language.
 */
export function suspicionFromEvidence(
  state: TavernState,
  today: number,
): number {
  const slice = getRegulatoryModuleState(state)
  const weight = evidenceWeight(slice, today)
  // 120 points of live, undecayed evidence saturates the scale. That is
  // roughly six standing problems at severity 20 — a tavern nobody could
  // defend.
  const raw = Math.round((weight / 120) * 100)
  // A watch that already distrusts the tavern needs less to get curious.
  const standingPull = Math.round((50 - slice.watch.standing) / 5)
  return Math.max(0, Math.min(100, raw + standingPull))
}

export { EVIDENCE_WINDOW_DAYS }
export type { InspectionDimension }
