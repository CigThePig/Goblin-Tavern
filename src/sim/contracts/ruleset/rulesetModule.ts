import type { SimContext } from '../../core/context'
import type { SimulationModule } from '../../core/module'
import type { ReportSection } from '../../core/reports'
import type { ValidationIssue } from '../../state/types'

import { RULESET_DEFINITIONS } from './definitions'
import { readRulesetSlice } from './query'
import {
  MAX_DECAY_CARRY_ENTRIES,
  RULESET_MODULE_ID,
  RULESET_RULE_KEYS,
  RulesetModuleStateSchema,
} from './types'

// Expansion Phase 1 §1.3 — the module that OWNS the ruleset slice.
//
// It deliberately has no phase hooks. The ruleset is chosen once at
// new-game time and is then read-only for the rest of the run; the only
// writes are the fractional decay remainders banked by
// `scaleOngoingIntegerDecay`, and those belong to whichever rule is
// decaying, not to a hook here. Giving the module a `stateSchema` is what
// matters: it makes `ensureModuleSlices` synthesise the slice for every
// save written before this phase, and it makes the slice validate.
//
// Difficulty is no longer allowed to be a start-time-only concept, so this
// module is also where the report says which rules the run is actually
// playing under — the player-facing surface lands in Phase 12, but the
// truth has to be reportable from the day it exists.

const SOURCE = RULESET_MODULE_ID

function validate(ctx: SimContext): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const slice = readRulesetSlice(ctx.state)

  const definition = RULESET_DEFINITIONS[slice.rulesetId]
  if (!definition) {
    issues.push({
      path: `modules.${RULESET_MODULE_ID}.rulesetId`,
      message: `Unknown ruleset '${slice.rulesetId}'`,
      code: 'ruleset_unknown_id',
    })
  }

  const carryKeys = Object.keys(slice.decayCarry)
  if (carryKeys.length > MAX_DECAY_CARRY_ENTRIES) {
    issues.push({
      path: `modules.${RULESET_MODULE_ID}.decayCarry`,
      message: `Decay carry map holds ${carryKeys.length} entries, above the ${MAX_DECAY_CARRY_ENTRIES} cap`,
      code: 'ruleset_carry_unbounded',
    })
  }
  for (const key of carryKeys) {
    const value = slice.decayCarry[key]!
    // A banked remainder is by construction strictly inside one whole
    // point — anything else means a producer wrote to the map directly
    // instead of going through `scaleOngoingIntegerDecay`.
    if (!Number.isFinite(value) || Math.abs(value) >= 1) {
      issues.push({
        path: `modules.${RULESET_MODULE_ID}.decayCarry.${key}`,
        message: `Banked decay remainder ${value} is not a fraction of one point`,
        code: 'ruleset_carry_out_of_range',
      })
    }
  }

  return issues
}

function buildReport(ctx: SimContext): ReportSection | null {
  const slice = readRulesetSlice(ctx.state)
  const definition = RULESET_DEFINITIONS[slice.rulesetId]

  // The reference ruleset changes nothing ongoing, so it has nothing to
  // report. Staying silent keeps the standard route's report shape
  // untouched by this phase.
  if (slice.rulesetId === 'standard') return null

  const lines: string[] = [`Ruleset: ${definition.label}`]
  for (const key of RULESET_RULE_KEYS) {
    const value = definition.ongoing[key]
    const reference = RULESET_DEFINITIONS.standard.ongoing[key]
    if (value === reference) continue
    lines.push(`  ${key}: ${value} (standard ${reference})`)
  }

  return {
    id: 'ruleset',
    source: SOURCE,
    title: 'RULESET',
    lines,
    data: {
      rulesetId: slice.rulesetId,
      rulesetVersion: slice.rulesetVersion,
      ongoing: definition.ongoing,
      bankedDecayKeys: Object.keys(slice.decayCarry).length,
    },
  }
}

export const rulesetModule: SimulationModule = {
  id: RULESET_MODULE_ID,
  version: '0.1.0',
  buildReport,
  validate,
  stateSchema: RulesetModuleStateSchema,
}
