// Expansion Phase 1 §1.6 — public surface of the actor contract.
// Re-exports only; see `../ruleset/index.ts` for why.
//
// There is no `actorsModule` and no actor state slice. That is deliberate:
// an actor's record belongs to the domain that owns the entity — a faction's
// actor state lives in the factions slice, a supplier's in the suppliers
// slice — because the actor IS the faction, not a parallel copy of it. What
// is shared is the decision procedure, not the storage.

export {
  MAX_ACTOR_HISTORY,
  ActorActionRecordSchema,
  ActorGoalSchema,
  ActorStateSchema,
  type ActorActionDefinition,
  type ActorActionOutcome,
  type ActorActionRecord,
  type ActorCandidate,
  type ActorDecision,
  type ActorGoal,
  type ActorPerception,
  type ActorState,
} from './types'

export {
  createActorState,
  decideActorAction,
  declareActorIntent,
  performActorAction,
  type DecideInput,
} from './decide'
