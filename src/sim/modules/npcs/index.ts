export { npcModule, NPCS_MODULE_ID } from './npcModule'
export { buildNpcReport } from './npcReport'
export {
  DEMOTION_IMPORTANCE_THRESHOLD,
  MAX_NPC_INTERACTIONS,
  MAX_NPC_MOVE_HISTORY,
  MAX_NPC_RELATIONSHIPS,
  MAX_PROMOTED_NPCS,
  NPC_MEMORY_DAYS,
  NpcModuleStateSchema,
  PROMOTION_GRACE_DAYS,
  PROMOTION_IMPORTANCE_THRESHOLD,
  PROMOTION_INTERACTION_THRESHOLD,
  bumpNpcTotal,
  createInitialNpcModuleState,
  createInitialNpcTotals,
  getNpcModuleState,
  getNpcRecord,
  interactionWeightToday,
  normalizeNpcSlice,
  openProposalFor,
  openProposals,
  promotedNpcs,
  pruneNpcRecords,
  recordNpcMove,
  writeNpcSlice,
} from './npcState'
export {
  emptyNpcRecord,
  isAboutToday,
  nextExpectedDay,
  noteDealing,
  noteNpcRelationship,
  observeAvailability,
  observeDealings,
} from './dealings'
export { computeImportance, recentDealings, reviewPromotions } from './importance'
export {
  NPC_ACTOR_ACTION_LIST,
  NPC_GOALS,
  NPC_INTENT_LEAD_DAYS,
  buildPerception,
  deriveGoals,
  listNpcIntents,
  runNpcActors,
  weeklyBudgetFor,
} from './npcActors'
export {
  NPC_PROPOSAL_DEADLINE_EVENT,
  NPC_SCHEDULED_EVENTS,
  NPC_SCHEDULED_EVENT_TYPES,
  closeProposal,
  ensureNpcScheduledEventsRegistered,
  openProposal,
} from './npcEvents'
export type {
  NpcAvailability,
  NpcAvailabilityPattern,
  NpcInteractionEntry,
  NpcInteractionKind,
  NpcModuleState,
  NpcMoveEntry,
  NpcProposal,
  NpcProposalKind,
  NpcRecord,
  NpcRelationship,
  NpcResources,
  NpcTotals,
} from './types'
