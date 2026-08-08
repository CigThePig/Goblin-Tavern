// The module id, split out so `runState.ts` and `expeditionsModule.ts` can
// both reach it without a cycle (the module imports the run state, and the
// run state needs the slice key).
export const EXPEDITIONS_MODULE_ID = 'expeditions'
