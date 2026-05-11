import type { TavernState } from '../state/TavernState'
import type { IssueSeed } from '../modules/issues/issueSeedTypes'
import type { CardlessRunResult } from './simRunner'
import { collectAllSeeds } from './cardlessPlaytest'
import { getAllSeedsToday } from '../modules/issues/index'

// Phase 20 §20.7 — Contradiction audit.
//
// The audit re-evaluates every generated seed against the state at the
// moment it was generated, and flags any seed whose claim contradicts
// the visible world: a stock-shortage seed while ale is plentiful, an
// inspection warning while inspection pressure is calm, etc.
//
// Contradictions are bugs. The simulation must never claim a thing the
// state would not back up. The audit is the readiness-gate's evidence
// that the contradiction guards in Phase 19 §19.6 actually held.

export type ContradictionEvidence = {
  seedId: string
  family: string
  templateId?: string
  reason: string
  /** Snapshot of state values the audit consulted. */
  evidence: Record<string, number | string | boolean>
}

export type ContradictionAuditResult = {
  totalSeedsAudited: number
  contradictionsFound: ContradictionEvidence[]
  /** Distinct seed families that had at least one contradiction. */
  familiesWithContradictions: string[]
}

const ALE_HIGH = 50
const STEW_HIGH = 50
const INSPECTION_LOW = 30
const MAINT_CLEAN = 25

function maxDamage(state: TavernState): number {
  let m = 0
  for (const a of Object.values(state.areas)) if (a.damage > m) m = a.damage
  return m
}

function minCondition(state: TavernState): number {
  let m = 100
  for (const a of Object.values(state.areas)) if (a.condition < m) m = a.condition
  return m
}

function staffHappy(state: TavernState): boolean {
  for (const s of Object.values(state.staff)) {
    if (!s.paidThisWeek) return false
    if (s.morale <= 60) return false
    if (s.stress >= 40) return false
    if (s.fatigue >= 40) return false
  }
  return true
}

function rowdyTraffic(state: TavernState): number {
  return (
    (state.customerGroups.ogres?.patronage ?? 0) +
    (state.customerGroups.adventurers?.patronage ?? 0)
  )
}

/** Audit a single seed against the state that was current when it was
 *  generated. Returns an evidence record when contradictory, or null. */
export function auditSeedAgainstState(
  seed: IssueSeed,
  state: TavernState,
): ContradictionEvidence | null {
  switch (seed.family) {
    case 'stock_shortage': {
      const ale = state.stock.ale?.quantity ?? 0
      const stew = state.stock.stew?.quantity ?? 0
      if (ale >= ALE_HIGH && stew >= STEW_HIGH) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: 'Stock shortage seed generated while ale and stew are plentiful',
          evidence: { ale, stew, threshold: ALE_HIGH },
        }
      }
      return null
    }
    case 'inspection': {
      const pressure = state.pressures.inspection?.value ?? 0
      if (pressure < INSPECTION_LOW) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: 'Inspection warning generated while inspection pressure is low',
          evidence: { inspectionPressure: pressure, threshold: INSPECTION_LOW },
        }
      }
      return null
    }
    case 'maintenance': {
      const damage = maxDamage(state)
      const condition = minCondition(state)
      if (damage < MAINT_CLEAN && condition > 70) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: 'Maintenance seed generated while all areas are in good repair',
          evidence: { maxDamage: damage, minCondition: condition },
        }
      }
      return null
    }
    case 'staff_burnout': {
      if (staffHappy(state)) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: 'Staff burnout seed generated while staff are happy and paid',
          evidence: {
            staffHappy: true,
            staffCount: Object.keys(state.staff).length,
          },
        }
      }
      return null
    }
    case 'violence': {
      const rowdy = rowdyTraffic(state)
      const danger = state.reputation.dangerous
      if (rowdy < 10 && danger < 20) {
        return {
          seedId: seed.id,
          family: seed.family,
          reason: 'Violence seed generated with no rowdy traffic and low danger',
          evidence: { rowdyPatronage: rowdy, danger },
        }
      }
      return null
    }
    case 'customer_complaint': {
      // If the seed claims a specific customer group, check that group
      // has both visited recently and has low satisfaction.
      const groupRef = seed.affectedActors.find((a) => a.kind === 'customer_group')
      if (groupRef) {
        const g = state.customerGroups[groupRef.id]
        if (g && g.patronage <= 5 && g.satisfaction >= 70) {
          return {
            seedId: seed.id,
            family: seed.family,
            reason: `Customer complaint from ${groupRef.id} with no recent visits and high satisfaction`,
            evidence: {
              groupId: groupRef.id,
              patronage: g.patronage,
              satisfaction: g.satisfaction,
            },
          }
        }
      }
      return null
    }
    default:
      return null
  }
}

/** Audit every seed in a run. Each day's seeds are checked against the
 *  state AFTER that day (the state generators saw when emitting). */
export function auditRunForContradictions(
  run: CardlessRunResult,
): ContradictionAuditResult {
  const all: ContradictionEvidence[] = []
  let total = 0
  for (const day of run.days) {
    const seeds = getAllSeedsToday(day.result.state)
    for (const seed of seeds) {
      total += 1
      const ev = auditSeedAgainstState(seed, day.result.state)
      if (ev) all.push(ev)
    }
  }
  const families = Array.from(new Set(all.map((e) => e.family))).sort()
  return {
    totalSeedsAudited: total,
    contradictionsFound: all,
    familiesWithContradictions: families,
  }
}

/** Audit a single state + its currently-generated seeds. Handy in tests. */
export function auditStateForContradictions(
  state: TavernState,
): ContradictionAuditResult {
  const seeds = getAllSeedsToday(state)
  const all: ContradictionEvidence[] = []
  for (const seed of seeds) {
    const ev = auditSeedAgainstState(seed, state)
    if (ev) all.push(ev)
  }
  return {
    totalSeedsAudited: seeds.length,
    contradictionsFound: all,
    familiesWithContradictions: Array.from(
      new Set(all.map((e) => e.family)),
    ).sort(),
  }
}

export function audited(
  run: CardlessRunResult,
): { totalSeeds: number; contradictions: number } {
  const r = auditRunForContradictions(run)
  return {
    totalSeeds: r.totalSeedsAudited,
    contradictions: r.contradictionsFound.length,
  }
}

void collectAllSeeds
