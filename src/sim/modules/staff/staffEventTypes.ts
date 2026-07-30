// Expansion Phase 3 — the staff module's mechanical event type ids.
//
// A LEAF file on purpose. `employment.ts` schedules the separation event and
// `staffEvents.ts` defines and resolves it, so if either owned the constant the
// two would import each other. A cycle would technically resolve at runtime, but
// a top-level constant read across one is exactly the kind of `undefined` that
// shows up as a mysteriously unregistered event three phases later.

export const STAFF_QUIT_RISK_EVENT = 'staff_quit_risk'
export const STAFF_SEPARATION_EVENT = 'staff_separation'
export const STAFF_RAISE_DEMAND_EVENT = 'staff_raise_demand'
export const WAGE_EXPECTATION_EVENT = 'wage_expectation'
export const RAISE_PROMISED_EVENT = 'raise_promised'
export const COVERAGE_GAP_EVENT = 'coverage_gap'
export const TRAINING_HELPER_EVENT = 'training_helper'
export const AUTHORITY_TEST_EVENT = 'authority_test'
export const STAFF_BONUS_EXPECTED_EVENT = 'staff_bonus_expected'
export const CROSS_STAFF_GRUMBLE_EVENT = 'cross_staff_grumble'
export const STAFF_LOYALTY_MEMORY_EVENT = 'staff_loyalty_memory'
