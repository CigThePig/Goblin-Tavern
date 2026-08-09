/**
 * The world-conditions module id, in its own file.
 *
 * Same reason as `expeditions/moduleId.ts`: the owner actions and the
 * content catalogue both need the id, and importing the module for it would
 * pull the whole day pass into the action registry's import graph.
 */
export const CONDITIONS_MODULE_ID = 'conditions'
