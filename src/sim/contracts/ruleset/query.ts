import type { SimContext } from '../../core/context'
import type { TavernState } from '../../state/TavernState'

import { REFERENCE_RULESET_ID, RULESET_DEFINITIONS } from './definitions'
import {
  MAX_DECAY_CARRY_ENTRIES,
  RULESET_MODULE_ID,
  type RulesetDefinition,
  type RulesetId,
  type RulesetModuleState,
  type RulesetOngoingRules,
  type RulesetRuleKey,
} from './types'

// Expansion Phase 1 §1.3 — the query surface every difficulty-sensitive
// rule goes through.
//
// Domains never read `state.modules.ruleset` directly and never branch on
// the id. They ask for the one knob they care about:
//
//   const m = getRule(ctx.state, 'spoilageMultiplier')
//
// so the set of things difficulty actually changes stays enumerable
// (`RULESET_RULE_KEYS`) and Phase 12 can derive Help from it instead of
// maintaining a second prose copy of the timings.

export function createInitialRulesetModuleState(
  rulesetId: RulesetId = REFERENCE_RULESET_ID,
): RulesetModuleState {
  return {
    rulesetId,
    rulesetVersion: RULESET_DEFINITIONS[rulesetId].version,
    decayCarry: {},
  }
}

/**
 * Read the slice, tolerating a save written before this phase. A missing
 * or malformed slice resolves to the reference ruleset rather than
 * throwing: a pre-Phase-1 save was played under standard rules by
 * definition, so standard is the only honest answer (§5 "old saves must
 * not silently lose or fabricate material obligations" — inventing
 * `easy` here would fabricate a kinder history).
 */
export function readRulesetSlice(state: TavernState): RulesetModuleState {
  const raw = (state.modules as Record<string, unknown> | undefined)?.[
    RULESET_MODULE_ID
  ] as Partial<RulesetModuleState> | undefined
  const id =
    raw?.rulesetId && raw.rulesetId in RULESET_DEFINITIONS
      ? raw.rulesetId
      : REFERENCE_RULESET_ID
  return {
    rulesetId: id,
    rulesetVersion:
      typeof raw?.rulesetVersion === 'number'
        ? raw.rulesetVersion
        : RULESET_DEFINITIONS[id].version,
    decayCarry:
      raw?.decayCarry && typeof raw.decayCarry === 'object'
        ? { ...raw.decayCarry }
        : {},
  }
}

/** The full definition this state is playing under. */
export function getRuleset(state: TavernState): RulesetDefinition {
  return RULESET_DEFINITIONS[readRulesetSlice(state).rulesetId]
}

export function getRulesetId(state: TavernState): RulesetId {
  return readRulesetSlice(state).rulesetId
}

/** One named ongoing knob. The only sanctioned way to be difficulty-sensitive. */
export function getRule<K extends RulesetRuleKey>(
  state: TavernState,
  key: K,
): RulesetOngoingRules[K] {
  return getRuleset(state).ongoing[key]
}

export function writeRulesetSlice(
  ctx: SimContext,
  patch: (current: RulesetModuleState) => RulesetModuleState,
  reason: string,
): void {
  ctx.modifyModuleState<RulesetModuleState>(
    RULESET_MODULE_ID,
    (current) => {
      const base = current
        ? { ...createInitialRulesetModuleState(), ...current }
        : createInitialRulesetModuleState()
      return patch(base)
    },
    { source: `${RULESET_MODULE_ID}.${reason}`, reason },
  )
}

/**
 * Scale a whole-number ongoing decay by the ruleset, banking the
 * fractional remainder so a 0.6 multiplier really does apply 6 points
 * over 10 days.
 *
 * Returns the integer amount to apply TODAY (>= 0) and writes the new
 * remainder back to state. `carryKey` must identify the rule *and* the
 * target — `'area_decay:main_room:cleanliness'` — so two areas decaying
 * at the same rate do not share one bank.
 *
 * When the multiplier is exactly 1 this is a pure pass-through and NOTHING
 * is written: the reference route must stay bit-identical to its
 * pre-phase behaviour, including the absence of a `decayCarry` entry in
 * every standard save.
 */
export function scaleOngoingIntegerDecay(
  ctx: SimContext,
  carryKey: string,
  baseDelta: number,
  multiplier: number,
): number {
  if (multiplier === 1) return baseDelta
  if (baseDelta === 0) return 0

  const slice = readRulesetSlice(ctx.state)
  const banked = slice.decayCarry[carryKey] ?? 0
  const raw = baseDelta * multiplier + banked
  // `trunc`, not `floor`: a negative delta (a meter recovering) must bank
  // toward zero from the same side, or the remainder compounds the wrong
  // way and a "kinder" multiplier ends up harsher.
  const applied = Math.trunc(raw)
  const remainder = raw - applied

  writeRulesetSlice(
    ctx,
    (current) => {
      const next = { ...current.decayCarry }
      // Settle to zero rather than storing a float epsilon; keeps the map
      // small and the save diff readable.
      if (Math.abs(remainder) < 1e-9) delete next[carryKey]
      else next[carryKey] = remainder
      return { ...current, decayCarry: pruneCarry(next) }
    },
    'bank_decay_remainder',
  )

  return applied
}

/**
 * Scale a rule that is already continuous (spoilage deltas, decay rates).
 * No banking needed — the fraction survives in the value itself — so this
 * is a pure function and takes no context.
 */
export function scaleOngoingContinuous(
  baseDelta: number,
  multiplier: number,
): number {
  return baseDelta * multiplier
}

/**
 * Scale a DAY COUNT (a window, a grace period, a decay horizon). Rounds to
 * the nearest whole day and never returns less than 1, because a
 * zero-length window is a different rule, not a harsher one.
 */
export function scaleOngoingDays(baseDays: number, multiplier: number): number {
  if (multiplier === 1) return baseDays
  return Math.max(1, Math.round(baseDays * multiplier))
}

/**
 * §5.11 bounded growth. `decayCarry` should hold one entry per actively
 * carrying (rule, target) pair — a handful. The cap is a backstop against
 * a future rule that derives `carryKey` from an unbounded id space; when
 * it trips we drop the smallest remainders, which are the ones closest to
 * having been spent anyway.
 */
function pruneCarry(carry: Record<string, number>): Record<string, number> {
  const keys = Object.keys(carry)
  if (keys.length <= MAX_DECAY_CARRY_ENTRIES) return carry
  const ordered = keys.sort((a, b) => {
    const byMagnitude = Math.abs(carry[b]!) - Math.abs(carry[a]!)
    return byMagnitude !== 0 ? byMagnitude : a.localeCompare(b)
  })
  const kept: Record<string, number> = {}
  for (const key of ordered.slice(0, MAX_DECAY_CARRY_ENTRIES)) {
    kept[key] = carry[key]!
  }
  return kept
}
