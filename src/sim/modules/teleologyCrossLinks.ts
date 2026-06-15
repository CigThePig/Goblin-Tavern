// Phase 4c (teleology) — cross-pollination links shared between the arc
// and venture modules.
//
// The master phase plan §1 binds `ventureModule` and `arcModule` to import
// neither each other; they couple only through the shared kernel type and
// through *global facts* (transformations, opening-keying meters). This
// file holds the small set of shared fact ids/tags that wire the two
// halves together, so both sides reference one constant instead of drifting
// magic strings — and neither module imports the other's folder.

/** Transformation written by a staff arc when it reaches `mastered`. The
 *  arc payoff "behaves like a transformation" (plan §"Phase 4c"): a
 *  permanent fact that other teleology systems can gate on. */
export const MASTER_ON_STAFF_TRANSFORMATION_ID = 'master_on_staff'

/** Tag carried by the `master_on_staff` transformation. */
export const MASTER_ON_STAFF_TAG = 'master_on_staff'
