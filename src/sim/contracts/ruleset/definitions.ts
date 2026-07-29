import type { RulesetDefinition, RulesetId } from './types'

// Expansion Phase 1 §1.3 — the three shipped rulesets.
//
// `standard` is the REFERENCE ruleset and every knob on it is exactly
// neutral. That is load-bearing, not cosmetic: the whole existing test
// suite, the frozen Phase 0 baseline probes, and the recorded balance
// matrix were all measured on the standard route, so a standard run after
// this phase must be bit-for-bit what it was before. The
// `standardIsExactlyNeutral` contract test enforces it.
//
// `easy` and `hard` diverge through ONGOING rules, which is the whole
// point of the change. Before this phase both differed from standard only
// in their opening values, so by day ~10 all three routes were the same
// game (`OBL-05`). The multipliers below are deliberately moderate: the
// requirement is genuine, measurable divergence under identical seeds,
// not a difficulty cliff. Phase 12 owns the player-facing difficulty
// surface and Phase 13 re-baselines the balance matrix across all three,
// so numbers here are expected to be re-tuned with evidence later.

export const RULESET_DEFINITION_VERSION = 1

export const RULESET_DEFINITIONS: Record<RulesetId, RulesetDefinition> = {
  easy: {
    id: 'easy',
    version: RULESET_DEFINITION_VERSION,
    label: 'Easy',
    description:
      'Rooms hold their state longer, stock keeps, staff bounce back, and debts wait before they bite.',
    ongoing: {
      // Rooms deteriorate at ~60% of the reference rate. The banked
      // remainder in `decayCarry` is what makes this exact rather than
      // rounded away — see `RulesetModuleState.decayCarry`.
      areaDeteriorationMultiplier: 0.6,
      spoilageMultiplier: 0.7,
      // Kinder: staff recover more of yesterday's fatigue overnight.
      staffRecoveryMultiplier: 1.5,
      // Kinder: a recorded adjustment (typically the player fixing
      // something) keeps its weight longer before decaying out.
      pressureAdjustmentDecayMultiplier: 1.4,
      // Kinder: bad rumours and bad memories fade faster.
      rumourDecayMultiplier: 1.3,
      memoryDecayMultiplier: 1.2,
      obligationGraceDays: 5,
      obligationLateChargeRate: 0.02,
      issueFairnessRotationBoost: 1.25,
      recoveryAssistanceMultiplier: 1.5,
    },
  },
  standard: {
    id: 'standard',
    version: RULESET_DEFINITION_VERSION,
    label: 'Standard',
    description: 'The Crooked Keg as designed — dirty, broke, and yours.',
    ongoing: {
      areaDeteriorationMultiplier: 1,
      spoilageMultiplier: 1,
      staffRecoveryMultiplier: 1,
      pressureAdjustmentDecayMultiplier: 1,
      rumourDecayMultiplier: 1,
      memoryDecayMultiplier: 1,
      obligationGraceDays: 3,
      obligationLateChargeRate: 0.05,
      issueFairnessRotationBoost: 1,
      recoveryAssistanceMultiplier: 1,
    },
  },
  hard: {
    id: 'hard',
    version: RULESET_DEFINITION_VERSION,
    label: 'Hard',
    description:
      'Everything slides faster than you can fix it, and nobody waits to be paid.',
    ongoing: {
      areaDeteriorationMultiplier: 1.4,
      spoilageMultiplier: 1.3,
      staffRecoveryMultiplier: 0.7,
      // Harsher: the credit the player earns for fixing something runs
      // out sooner, so keeping a pressure down needs sustained work.
      pressureAdjustmentDecayMultiplier: 0.7,
      // Harsher: bad news sticks.
      rumourDecayMultiplier: 0.75,
      memoryDecayMultiplier: 0.85,
      obligationGraceDays: 1,
      obligationLateChargeRate: 0.09,
      issueFairnessRotationBoost: 0.8,
      recoveryAssistanceMultiplier: 0.6,
    },
  },
}

export function getRulesetDefinition(id: RulesetId): RulesetDefinition {
  return RULESET_DEFINITIONS[id]
}

/** The reference ruleset. Used as the fallback for a save that predates this phase. */
export const REFERENCE_RULESET_ID: RulesetId = 'standard'
