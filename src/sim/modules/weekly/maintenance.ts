import type { TavernState } from '../../state/TavernState'
import type { MaintenanceBacklogEntry } from './types'

// Phase 14 §14.5 — Maintenance backlog.
//
// Survey every area and surface those with high damage, low condition,
// low cleanliness, high smell, or high risk. The result is a per-area
// list of human-readable reasons plus a coarse severity (0..100) so the
// report can sort the most-pressing items to the top. This is *not* an
// issue seed — Phase 19 handles that. Phase 14 emits a plain summary.

const DAMAGE_THRESHOLD = 50
const CONDITION_THRESHOLD = 45
const CLEANLINESS_THRESHOLD = 35
const SMELL_THRESHOLD = 60
const RISK_THRESHOLD = 55

export function computeMaintenanceBacklog(
  state: TavernState,
): MaintenanceBacklogEntry[] {
  const entries: MaintenanceBacklogEntry[] = []
  for (const area of Object.values(state.areas)) {
    const reasons: string[] = []
    let severity = 0

    if (area.damage >= DAMAGE_THRESHOLD) {
      reasons.push(`damage ${area.damage}`)
      severity = Math.max(severity, area.damage)
    }
    if (area.condition <= CONDITION_THRESHOLD) {
      reasons.push(`condition ${area.condition}`)
      severity = Math.max(severity, 100 - area.condition)
    }
    if (area.cleanliness <= CLEANLINESS_THRESHOLD) {
      reasons.push(`cleanliness ${area.cleanliness}`)
      severity = Math.max(severity, 100 - area.cleanliness)
    }
    if (area.smell >= SMELL_THRESHOLD) {
      reasons.push(`smell ${area.smell}`)
      severity = Math.max(severity, area.smell)
    }
    if (area.risk >= RISK_THRESHOLD) {
      reasons.push(`risk ${area.risk}`)
      severity = Math.max(severity, area.risk)
    }

    if (reasons.length === 0) continue
    entries.push({ areaId: area.id, reasons, severity })
  }
  entries.sort((a, b) => b.severity - a.severity)
  return entries
}
