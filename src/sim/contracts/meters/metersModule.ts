import type { SimContext } from '../../core/context'
import type { SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import {
  createInitialMetersModuleState,
  readMetersSlice,
  troubledMeters,
} from './detail'
import {
  MAX_METER_DETAILS,
  METERS_MODULE_ID,
  MetersModuleStateSchema,
} from './types'

// Expansion Phase 1 §1.5 — the module that owns meter detail and latches.
//
// Like the ruleset module it has no hooks: the records are written by
// whichever domain clamped the meter, at the moment it clamped it. What the
// module contributes is the slice, its schema, and the report — which is
// where §1.5's "reports expose why recovery is slow or why a capped pressure
// is still worsening" actually happens.

const SOURCE = METERS_MODULE_ID

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = readMetersSlice(ctx.state)
  const details = Object.entries(slice.details)

  if (details.length > MAX_METER_DETAILS) {
    issues.push({
      path: `modules.${METERS_MODULE_ID}.details`,
      message: `${details.length} meter details, above the ${MAX_METER_DETAILS} cap`,
      code: 'meters_details_over_cap',
    })
  }
  for (const [target, detail] of details) {
    // Debt and excess are opposite residues of the same clamp. Carrying both
    // at once means a meter was recorded as pinned at its floor and its
    // ceiling in the same run, which is a producer bug.
    if (detail.debt > 0 && detail.excess > 0) {
      issues.push({
        path: `modules.${METERS_MODULE_ID}.details.${target}`,
        message: `Meter '${target}' carries both floor debt and ceiling excess`,
        code: 'meters_debt_and_excess',
      })
    }
    if (detail.target !== target) {
      issues.push({
        path: `modules.${METERS_MODULE_ID}.details.${target}`,
        message: `Meter detail keyed '${target}' but records target '${detail.target}'`,
        code: 'meters_target_key_mismatch',
      })
    }
  }
  for (const [key, latch] of Object.entries(slice.latches)) {
    if (latch.candidate !== undefined && latch.candidateSinceDay === undefined) {
      issues.push({
        path: `modules.${METERS_MODULE_ID}.latches.${key}`,
        message: `Latch '${key}' has a candidate with no start day`,
        code: 'meters_latch_candidate_undated',
      })
    }
  }
  return issues
}

function buildReport(ctx: SimContext): ReportSection | null {
  const troubled = troubledMeters(ctx.state)
  const slice = readMetersSlice(ctx.state)
  if (troubled.length === 0) return null

  const lines: string[] = []
  for (const detail of troubled.slice(0, 8)) {
    if (detail.debt > 0) {
      lines.push(
        `  - ${detail.target}: showing ${detail.visible}, but ${detail.debt} of neglect is banked ` +
          `below it (${detail.daysAtFloor}d at the floor). That has to be worked off first.`,
      )
    } else {
      lines.push(
        `  - ${detail.target}: capped at ${detail.visible}, and ${detail.excess} over the cap ` +
          `(${detail.daysAtCeiling}d pinned). Progress here will not show yet.`,
      )
    }
    if (detail.recoveryMomentum > 0) {
      lines.push(`      recovery momentum ${detail.recoveryMomentum}`)
    }
  }

  return {
    id: 'meters',
    source: SOURCE,
    title: 'HIDDEN METER STATE',
    lines,
    data: {
      troubled: troubled.length,
      totalDebt: troubled.reduce((sum, d) => sum + d.debt, 0),
      totalExcess: troubled.reduce((sum, d) => sum + d.excess, 0),
      latches: Object.keys(slice.latches).length,
      details: troubled.map((d) => ({
        target: d.target,
        visible: d.visible,
        debt: d.debt,
        excess: d.excess,
        velocity: d.velocity,
        daysAtFloor: d.daysAtFloor,
        daysAtCeiling: d.daysAtCeiling,
      })),
    },
  }
}

export const metersModule: SimulationModule = {
  id: METERS_MODULE_ID,
  version: '0.1.0',
  buildReport,
  validate,
  stateSchema: MetersModuleStateSchema,
}

export { createInitialMetersModuleState }
