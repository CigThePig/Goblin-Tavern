import type {
  StaffCareerGoal,
  StaffIdentityState,
  StaffShiftId,
  StaffState,
} from '../../state/TavernState'

// Expansion Phase 3 §3.1–§3.3 — the workforce fields a staff member starts with.
//
// Deliberately DERIVED, not rolled. `createInitialTavernState`, the hiring
// action, and the save migration all call the same helpers, and none of them
// touches the RNG, so:
//
//   * a save written before this phase gains exactly the fields it would have
//     had on day zero, rather than a fresh random draw — which would fabricate
//     a history the player never played (the §5 rule that
//     `ensureExpansionContractSlices` already applies to the ruleset);
//   * adding the fields shifted no RNG cursor, so every existing identity name
//     and cast attribute is byte-identical (architecture rule 7).
//
// The career goal comes off identity because identity is where "what kind of
// person is this" already lives: a `mastery` cook wants training and a ladder,
// a `coin` one wants the wage, and the actor scoring in `staffActors.ts` reads
// nothing else to decide which of those it asks for.

/** The starting shift for a fresh hire and for a migrated save. */
export const DEFAULT_SHIFT: StaffShiftId = 'early'

/**
 * §3.3 — read a career goal off identity.
 *
 * Order matters and is checked most-specific-first: an explicit personality tag
 * wins over the work style, which wins over the fallback. Same identity ⇒ same
 * goal, on a reload and on a migration alike.
 */
export function deriveCareerGoal(
  identity: StaffIdentityState | undefined,
  roleId: string,
): StaffCareerGoal {
  const tags = new Set(identity?.personalityTags ?? [])
  if (tags.has('ambitious') || tags.has('proud')) return 'standing'
  if (tags.has('greedy') || tags.has('practical')) return 'coin'
  if (tags.has('anxious') || tags.has('loyal') || tags.has('cautious')) {
    return 'security'
  }
  switch (identity?.workStyle) {
    case 'careful':
    case 'methodical':
      return 'mastery'
    case 'social':
      return 'standing'
    case 'fast':
    case 'improviser':
      return 'coin'
    case 'rough':
      return 'standing'
    case 'steady':
      return 'security'
    default:
      break
  }
  // A cook with no other signal wants to get good at cooking; anyone else
  // wants the job to stay a job.
  return roleId.includes('cook') || roleId === 'kitchen_hand'
    ? 'mastery'
    : 'security'
}

/**
 * Fill the workforce fields on a staff member that has none.
 *
 * Returns the same object when nothing is missing, so callers can use identity
 * comparison to decide whether anything changed — the pattern the other
 * `ensure*` migration helpers already use.
 */
export function withWorkforceDefaults<T extends StaffState>(
  member: T,
  args: { daysEmployed?: number } = {},
): T {
  const needs =
    member.shift === undefined ||
    member.experience === undefined ||
    member.crossTraining === undefined ||
    member.careerGoal === undefined ||
    member.daysEmployed === undefined ||
    member.consecutiveDaysWorked === undefined
  if (!needs) return member
  return {
    ...member,
    shift: member.shift ?? DEFAULT_SHIFT,
    experience: member.experience ?? 0,
    crossTraining: member.crossTraining ?? {},
    careerGoal: member.careerGoal ?? deriveCareerGoal(member.identity, member.role),
    daysEmployed: member.daysEmployed ?? args.daysEmployed ?? 0,
    consecutiveDaysWorked: member.consecutiveDaysWorked ?? 0,
  }
}
