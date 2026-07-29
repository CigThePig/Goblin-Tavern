import { z } from 'zod'

// Expansion Phase 1 §1.3 — Persistent ruleset and difficulty.
//
// Before this phase, difficulty was a START-TIME modification only
// (`src/sim/state/difficulty.ts`): it moved day-zero coin, area
// cleanliness and a few pressure baselines, then vanished. Nothing in the
// simulation could ask "which ruleset am I running under?", so `easy`
// could not make ongoing decay slower and `hard` could not make it
// worse — the only difference between the three was the opening
// position, which a week of play erases. That is obligation `OBL-05`.
//
// A ruleset is therefore a VERSIONED, PERSISTED definition, not a bag of
// `if (easy)` checks scattered through the domains. Every ongoing rule
// that the plan lists as difficulty-sensitive reads one named knob from
// this definition, so:
//
//   - adding a knob is a schema change with one owner, not a grep;
//   - `standard` is the reference ruleset and every knob on it is
//     EXACTLY neutral (1.0 multipliers, baseline day counts), so the
//     shipped behaviour of the reference route is unchanged by this
//     phase;
//   - a save records which ruleset it is playing, so a reload cannot
//     silently promote an easy run to standard.
//
// `version` is the definition version, bumped whenever the numbers move.
// It is persisted alongside the id so a later phase can migrate a save
// that was played under an older tuning without guessing.

export type RulesetId = 'easy' | 'standard' | 'hard'

export const RULESET_IDS: ReadonlyArray<RulesetId> = [
  'easy',
  'standard',
  'hard',
] as const

/**
 * The named ongoing knobs — the complete list the plan's §1.3 requires the
 * ruleset to be queryable by.
 *
 * Four are consumed today, by the rules that already exist:
 * `areaDeteriorationMultiplier` (areas module), `spoilageMultiplier` (stock),
 * `staffRecoveryMultiplier` (staff), and
 * `pressureAdjustmentDecayMultiplier` (pressures). The other six are
 * declared here and consumed by the phase that owns their rule — rumour and
 * memory decay by Phase 8, obligation grace by Phases 6/7 (already read at
 * obligation-open time), issue fairness by Phase 11, recovery assistance by
 * Phase 5. Declaring the whole list now is the point: it is what stops the
 * seventh domain inventing an `if (easy)` check of its own.
 *
 * Multipliers are relative to `standard`, which is 1.0 across the board.
 * "Higher is harder" is NOT a universal convention here (faster fatigue
 * recovery is easier, faster decay is harder), so each field documents
 * its own direction.
 */
export type RulesetOngoingRules = {
  /** Multiplies daily passive area decay (condition/cleanliness/smell/risk drift). Higher = harsher. */
  areaDeteriorationMultiplier: number
  /** Multiplies the daily spoilage delta on perishable stock. Higher = harsher. */
  spoilageMultiplier: number
  /** Multiplies overnight staff fatigue/stress recovery. Higher = kinder. */
  staffRecoveryMultiplier: number
  /** Multiplies the window a recorded pressure adjustment keeps its weight. Higher = adjustments (good or bad) linger longer. */
  pressureAdjustmentDecayMultiplier: number
  /** Multiplies documented rumour strength decay per day. Higher = rumours fade faster (kinder for bad rumours). */
  rumourDecayMultiplier: number
  /** Multiplies documented memory strength decay per day. Higher = memories fade faster. */
  memoryDecayMultiplier: number
  /** Days of grace an overdue obligation gets before it defaults. Higher = kinder. */
  obligationGraceDays: number
  /** Fraction of principal added per overdue day once grace has run out. Higher = harsher. */
  obligationLateChargeRate: number
  /** Extra rotation pressure applied to issue fairness so a neglected family resurfaces sooner. Higher = fairer. */
  issueFairnessRotationBoost: number
  /** Multiplies help offered by recovery/assistance systems once the tavern is failing. Higher = kinder. */
  recoveryAssistanceMultiplier: number
}

export type RulesetDefinition = {
  id: RulesetId
  /** Definition version. Bumped whenever any number below changes. */
  version: number
  label: string
  description: string
  ongoing: RulesetOngoingRules
}

/** Every knob name, for the coverage test and for Help derivation. */
export type RulesetRuleKey = keyof RulesetOngoingRules

export const RULESET_RULE_KEYS: ReadonlyArray<RulesetRuleKey> = [
  'areaDeteriorationMultiplier',
  'spoilageMultiplier',
  'staffRecoveryMultiplier',
  'pressureAdjustmentDecayMultiplier',
  'rumourDecayMultiplier',
  'memoryDecayMultiplier',
  'obligationGraceDays',
  'obligationLateChargeRate',
  'issueFairnessRotationBoost',
  'recoveryAssistanceMultiplier',
] as const

export const RULESET_MODULE_ID = 'ruleset'

/**
 * The persisted slice.
 *
 * `decayCarry` is what makes a fractional multiplier honest on an
 * integer meter. Area decay moves cleanliness by 1 or 2 a day; naively
 * multiplying by 0.6 and rounding either throws the difference away
 * (`round(1 * 0.6) === 1`, easy is not easier) or doubles it
 * (`floor` → 0, easy never decays at all). Instead the fractional
 * remainder is BANKED per rule+target and spent as soon as it reaches a
 * whole point, so over ten days a 0.6 multiplier applies exactly six
 * points. This is the §1.5 "stop discarding information at clamps"
 * principle applied to rounding rather than to clamping.
 *
 * Bounded growth (§5.11): one entry per (rule, target) pair that has
 * actually carried a remainder, and `standard` never writes any because
 * its multipliers are exactly 1. The map is pruned of settled (zero)
 * entries on every write, and `MAX_DECAY_CARRY_ENTRIES` caps it against
 * a future rule that mints unbounded target ids.
 */
export type RulesetModuleState = {
  rulesetId: RulesetId
  /** The `version` of the definition this run was started under. */
  rulesetVersion: number
  /** Banked fractional decay per `<ruleKey>:<targetId>` key. */
  decayCarry: Record<string, number>
}

export const MAX_DECAY_CARRY_ENTRIES = 256

export const RulesetOngoingRulesSchema = z.object({
  areaDeteriorationMultiplier: z.number().min(0),
  spoilageMultiplier: z.number().min(0),
  staffRecoveryMultiplier: z.number().min(0),
  pressureAdjustmentDecayMultiplier: z.number().min(0),
  rumourDecayMultiplier: z.number().min(0),
  memoryDecayMultiplier: z.number().min(0),
  obligationGraceDays: z.number().int().min(0),
  obligationLateChargeRate: z.number().min(0),
  issueFairnessRotationBoost: z.number().min(0),
  recoveryAssistanceMultiplier: z.number().min(0),
})

export const RulesetModuleStateSchema = z.object({
  rulesetId: z.enum(['easy', 'standard', 'hard']),
  rulesetVersion: z.number().int().min(1),
  decayCarry: z.record(z.string(), z.number()),
})
