import type { SimContext } from '../../core/context'
import type { EntityRef, TavernState } from '../../state/TavernState'

import { inSchemaOrder } from '../../state/schemaOrder'
import {
  EVIDENCE_WINDOW_DAYS,
  MAX_ARCHIVED_CASES,
  MAX_EVIDENCE_ENTRIES,
  REGULATORY_MODULE_ID,
  WATCH_ID,
  RegulatoryModuleStateSchema,
  type EvidenceEntry,
  type InspectionFinding,
  type RegulatoryModuleState,
  type RegulatoryTotals,
  type TavernRegulatoryCase,
} from './types'

// Expansion Phase 7 §7.3 — the regulatory slice.

export { REGULATORY_MODULE_ID }

export function watchRef(): EntityRef {
  return { kind: 'other', id: `watch:${WATCH_ID}` }
}

export function emptyRegulatoryTotals(): RegulatoryTotals {
  return {
    casesOpened: 0,
    visitsCompleted: 0,
    findingsRaised: 0,
    findingsCleared: 0,
    finesRaised: 0,
    fineValue: 0,
    appealsUpheld: 0,
    appealsQuashed: 0,
    closuresOrdered: 0,
  }
}

export function createInitialRegulatoryModuleState(): RegulatoryModuleState {
  return {
    evidence: [],
    cases: {},
    caseArchive: [],
    findings: {},
    records: {
      // The Crooked Keg's books start honestly shabby, which is what makes
      // `put_the_books_in_order` a thing worth doing on day one.
      readiness: 40,
      lastUpdatedOnDay: 0,
      timesUpdated: 0,
    },
    watch: {
      standing: 50,
      visitsPassed: 0,
      visitsFailed: 0,
      finesIssued: 0,
      finesPaid: 0,
      closuresOrdered: 0,
      bribesOffered: 0,
      bribesAccepted: 0,
      bribesExposed: 0,
    },
    nextCaseSuffix: 0,
    nextFindingSuffix: 0,
    nextEvidenceSuffix: 0,
    totals: emptyRegulatoryTotals(),
  }
}

export function getRegulatoryModuleState(
  state: TavernState,
): RegulatoryModuleState {
  const slice = state.modules[REGULATORY_MODULE_ID] as
    | Partial<RegulatoryModuleState>
    | undefined
  const defaults = createInitialRegulatoryModuleState()
  if (!slice) return defaults
  return {
    ...defaults,
    ...slice,
    records: { ...defaults.records, ...(slice.records ?? {}) },
    watch: { ...defaults.watch, ...(slice.watch ?? {}) },
    totals: { ...defaults.totals, ...(slice.totals ?? {}) },
  }
}

export function writeRegulatoryState(
  ctx: SimContext,
  patch: (current: RegulatoryModuleState) => RegulatoryModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<RegulatoryModuleState>(
    REGULATORY_MODULE_ID,
    (current) => {
      const defaults = createInitialRegulatoryModuleState()
      const base: RegulatoryModuleState = current
        ? {
            ...defaults,
            ...current,
            records: { ...defaults.records, ...(current.records ?? {}) },
            watch: { ...defaults.watch, ...(current.watch ?? {}) },
            totals: { ...defaults.totals, ...(current.totals ?? {}) },
          }
        : defaults
      // §5.10 — normalise through the schema so an in-memory slice takes
      // exactly the key order a reloaded one takes. See `schemaOrder.ts`.
      return inSchemaOrder(RegulatoryModuleStateSchema, patch(base))
    },
    { source: `${REGULATORY_MODULE_ID}.${reason}`, reason },
  )
}

// ---------- Evidence ----------

/**
 * Record an observation, or refresh one already standing.
 *
 * Keyed by `id`, so a kitchen that has been filthy for a week is one
 * standing observation the watch keeps noticing rather than seven — which
 * is both the honest reading and what keeps the collection bounded.
 */
export function recordEvidence(
  ctx: SimContext,
  entry: Omit<EvidenceEntry, 'observedOnDay'>,
): void {
  const today = ctx.state.calendar.totalDaysElapsed
  writeRegulatoryState(
    ctx,
    (current) => {
      const built: EvidenceEntry = { ...entry, observedOnDay: today }
      const existing = current.evidence.some((item) => item.id === entry.id)
      const evidence = existing
        ? current.evidence.map((item) => (item.id === entry.id ? built : item))
        : [...current.evidence, built]
      return { ...current, evidence: capEvidence(evidence, today) }
    },
    'evidence',
  )
}

/** Drop observations that have aged out of the window (§5.11). */
export function pruneEvidence(ctx: SimContext): void {
  const today = ctx.state.calendar.totalDaysElapsed
  const slice = getRegulatoryModuleState(ctx.state)
  const surviving = slice.evidence.filter(
    (entry) => today - entry.observedOnDay <= EVIDENCE_WINDOW_DAYS,
  )
  if (surviving.length === slice.evidence.length) return
  writeRegulatoryState(
    ctx,
    (current) => ({ ...current, evidence: capEvidence(surviving, today) }),
    'evidence_pruned',
  )
}

/** Clear an observation the tavern has actually fixed. */
export function clearEvidence(ctx: SimContext, predicate: (entry: EvidenceEntry) => boolean): number {
  const slice = getRegulatoryModuleState(ctx.state)
  const surviving = slice.evidence.filter((entry) => !predicate(entry))
  const dropped = slice.evidence.length - surviving.length
  if (dropped === 0) return 0
  writeRegulatoryState(
    ctx,
    (current) => ({ ...current, evidence: surviving }),
    'evidence_cleared',
  )
  return dropped
}

function capEvidence(evidence: EvidenceEntry[], today: number): EvidenceEntry[] {
  const live = evidence.filter(
    (entry) => today - entry.observedOnDay <= EVIDENCE_WINDOW_DAYS,
  )
  if (live.length <= MAX_EVIDENCE_ENTRIES) return live
  // Keep what an inspector would actually turn up about: the worst, then
  // the freshest.
  return [...live]
    .sort((a, b) => b.severity - a.severity || b.observedOnDay - a.observedOnDay)
    .slice(0, MAX_EVIDENCE_ENTRIES)
    .sort((a, b) => a.observedOnDay - b.observedOnDay || a.id.localeCompare(b.id))
}

// ---------- Cases ----------

export function getCase(
  state: TavernState,
  id: string,
): TavernRegulatoryCase | undefined {
  return getRegulatoryModuleState(state).cases[id]
}

export function findCase(
  state: TavernState,
  id: string,
): TavernRegulatoryCase | undefined {
  const slice = getRegulatoryModuleState(state)
  return slice.cases[id] ?? slice.caseArchive.find((entry) => entry.id === id)
}

export function nextCaseId(state: TavernState): string {
  return `case-${getRegulatoryModuleState(state).nextCaseSuffix}`
}

export function nextFindingId(state: TavernState): string {
  return `finding-${getRegulatoryModuleState(state).nextFindingSuffix}`
}

export function nextEvidenceId(state: TavernState, dimension: string): string {
  return `ev-${dimension}-${getRegulatoryModuleState(state).nextEvidenceSuffix}`
}

/**
 * Put a case into (or back into) the slice.
 *
 * A closed case goes to the bounded archive rather than being deleted, so
 * "what did the watch decide, and when?" always has an answer.
 */
export function upsertCase(
  ctx: SimContext,
  record: TavernRegulatoryCase,
  reason: string,
): void {
  const terminal = record.caseStatus === 'closed'
  writeRegulatoryState(
    ctx,
    (current) => {
      const cases = { ...current.cases }
      const isNew = !(record.id in cases)
      if (terminal) delete cases[record.id]
      else cases[record.id] = record
      const archive = terminal
        ? capArchive([
            ...current.caseArchive.filter((entry) => entry.id !== record.id),
            record,
          ])
        : current.caseArchive
      return {
        ...current,
        cases,
        caseArchive: archive,
        nextCaseSuffix: isNew ? current.nextCaseSuffix + 1 : current.nextCaseSuffix,
        totals: {
          ...current.totals,
          casesOpened: isNew ? current.totals.casesOpened + 1 : current.totals.casesOpened,
        },
      }
    },
    reason,
  )
}

export function getFinding(
  state: TavernState,
  id: string,
): InspectionFinding | undefined {
  return getRegulatoryModuleState(state).findings[id]
}

export function listFindings(
  state: TavernState,
  filter?: { caseId?: string; status?: InspectionFinding['status'] },
): InspectionFinding[] {
  return Object.values(getRegulatoryModuleState(state).findings)
    .filter((finding) => {
      if (filter?.caseId && finding.caseId !== filter.caseId) return false
      if (filter?.status && finding.status !== filter.status) return false
      return true
    })
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
}

export function upsertFinding(
  ctx: SimContext,
  finding: InspectionFinding,
  reason: string,
): void {
  writeRegulatoryState(
    ctx,
    (current) => {
      const isNew = !(finding.id in current.findings)
      return {
        ...current,
        findings: { ...current.findings, [finding.id]: finding },
        nextFindingSuffix: isNew
          ? current.nextFindingSuffix + 1
          : current.nextFindingSuffix,
        totals: {
          ...current.totals,
          findingsRaised: isNew
            ? current.totals.findingsRaised + 1
            : current.totals.findingsRaised,
        },
      }
    },
    reason,
  )
}

/** Drop findings whose case has closed. Keeps the map bounded by the cases. */
export function pruneFindings(ctx: SimContext): void {
  const slice = getRegulatoryModuleState(ctx.state)
  const liveCaseIds = new Set(Object.keys(slice.cases))
  const entries = Object.entries(slice.findings).filter(([, finding]) =>
    liveCaseIds.has(finding.caseId),
  )
  if (entries.length === Object.keys(slice.findings).length) return
  writeRegulatoryState(
    ctx,
    (current) => ({ ...current, findings: Object.fromEntries(entries) }),
    'findings_pruned',
  )
}

export function bumpRegulatoryTotals(
  ctx: SimContext,
  changes: Partial<RegulatoryTotals>,
  reason: string,
): void {
  writeRegulatoryState(
    ctx,
    (current) => {
      const totals = { ...current.totals }
      for (const [key, delta] of Object.entries(changes)) {
        if (typeof delta !== 'number') continue
        totals[key as keyof RegulatoryTotals] += delta
      }
      return { ...current, totals }
    },
    reason,
  )
}

export function writeWatchStanding(
  ctx: SimContext,
  patch: (current: RegulatoryModuleState['watch']) => RegulatoryModuleState['watch'],
  reason: string,
): void {
  writeRegulatoryState(
    ctx,
    (current) => ({ ...current, watch: patch(current.watch) }),
    reason,
  )
}

export function writeRecords(
  ctx: SimContext,
  patch: (current: RegulatoryModuleState['records']) => RegulatoryModuleState['records'],
  reason: string,
): void {
  writeRegulatoryState(
    ctx,
    (current) => ({ ...current, records: patch(current.records) }),
    reason,
  )
}

function capArchive(archive: TavernRegulatoryCase[]): TavernRegulatoryCase[] {
  if (archive.length <= MAX_ARCHIVED_CASES) return archive
  return archive.slice(archive.length - MAX_ARCHIVED_CASES)
}
