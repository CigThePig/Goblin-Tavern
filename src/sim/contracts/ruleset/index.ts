// Expansion Phase 1 §1.3 — public surface of the ruleset contract.
//
// Domains import from here, never from the individual files, so §1.7's
// "identify compatibility barrels and prevent them from becoming alternate
// implementations" applies: this barrel re-exports and defines nothing.

export {
  RULESET_MODULE_ID,
  RULESET_RULE_KEYS,
  MAX_DECAY_CARRY_ENTRIES,
  RulesetModuleStateSchema,
  RulesetOngoingRulesSchema,
  RULESET_IDS,
  type RulesetId,
  type RulesetDefinition,
  type RulesetModuleState,
  type RulesetOngoingRules,
  type RulesetRuleKey,
} from './types'

export {
  RULESET_DEFINITIONS,
  RULESET_DEFINITION_VERSION,
  REFERENCE_RULESET_ID,
  getRulesetDefinition,
} from './definitions'

export {
  createInitialRulesetModuleState,
  getRule,
  getRuleset,
  getRulesetId,
  readRulesetSlice,
  scaleOngoingContinuous,
  scaleOngoingDays,
  scaleOngoingIntegerDecay,
  writeRulesetSlice,
} from './query'

export { rulesetModule } from './rulesetModule'
