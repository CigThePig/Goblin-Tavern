import type { TeleologyEntry } from '../../state/TavernState'
import type { LifecycleDefinition, LifecycleEffect } from '../kernel'
import {
  MASTER_ON_STAFF_TAG,
  MASTER_ON_STAFF_TRANSFORMATION_ID,
} from '../teleologyCrossLinks'

// Phase 4b (teleology) — the hardcoded staff-mastery arc now MOVES on its
// own and FORKS on character state. 4a declared the entry shape with an
// empty milestone list (dormant data); 4b fills in the branching
// milestones and the autonomous trigger that drives them (see
// `arcModule.ts`).
export const STAFF_MASTERY_ARC_ID = 'arc_staff_mastery'

// The starter cast member the arc attaches to. `server` is seeded on day
// zero (see `staffRegistry` `defaultStaffId`), so this resolves on a fresh
// game. The arc reaches its subject through this id; the cast member
// reaches the arc through `castAttributes.arcId`.
export const STAFF_MASTERY_ARC_SUBJECT_ID = 'server'

// `subject:<id>` tag prefix — the arc carries its subject id as a tag so a
// generic tick can recover the cast member without a hardcoded id.
export const STAFF_MASTERY_SUBJECT_TAG_PREFIX = 'subject:'

// The fork tag. Present iff the subject's loyalty driving meter is at or
// above `PROVEN_LOYALTY`. Written by the autonomous tick (the producer for
// guardrail §10 — the branch is reachable because loyalty genuinely moves
// via the weekly trends), read by the branching milestone below.
export const PROVEN_TAG = 'proven'

// Loyalty thresholds (0–100). The growth floor gates *whether* the arc
// accrues progress at all on a given day; the proven threshold gates
// *which branch* the apprentice milestone forks down. `server` starts at
// loyalty 45 — above the growth floor (so it advances) and below the
// proven threshold (so a fresh game takes the `steady` branch). A
// well-treated staffer whose loyalty climbs past 55 takes the `journeyman`
// branch instead.
export const GROWTH_FLOOR_LOYALTY = 30
export const PROVEN_LOYALTY = 55

// The ratchet tag a completed arc writes onto itself. Persists across days
// and a save/load cycle (the 4b "ratchet survives" guarantee).
export const MASTERED_TAG = 'mastered'

// Per-stage progress requirements. The autonomous tick accrues 1–2 per day
// (loyalty-driven, `'arc'`-stream rolled), so an arc reaches each milestone
// in a handful of days.
const APPRENTICE_REQUIREMENT = 3
const JOURNEYMAN_REQUIREMENT = 4
const STEADY_REQUIREMENT = 4

// Phase 4c (teleology) — the cross-pollination payoff. Every road to
// `mastered` writes TWO effects: the `mastered` ratchet tag onto the arc
// itself (4b behaviour, unchanged) AND a `master_on_staff` transformation —
// a permanent global fact that "behaves like a transformation" (plan
// §"Phase 4c"). That fact is what reaches back across the teleology machine:
// a venture stage can gate on it via the kernel's existing
// `transformation_active` condition, so an arc milestone unlocks a venture
// stage with no new engine concept. Authored once and reused on both
// terminal branches so every reachable mastery path produces the fact.
const MASTERED_EFFECTS: LifecycleEffect[] = [
  {
    kind: 'entry_patch',
    target: 'self',
    changes: {
      tags: ['staff_arc', `${STAFF_MASTERY_SUBJECT_TAG_PREFIX}${STAFF_MASTERY_ARC_SUBJECT_ID}`, MASTERED_TAG],
    },
  },
  {
    kind: 'transformation',
    id: MASTER_ON_STAFF_TRANSFORMATION_ID,
    label: 'A master on the staff',
    tags: [MASTER_ON_STAFF_TAG, 'staff_mastery', 'ratchet'],
  },
]

export const staffMasteryArcDefinition: LifecycleDefinition = {
  id: STAFF_MASTERY_ARC_ID,
  milestones: [
    {
      // Fork-on-state: the apprentice either proves themselves (loyalty
      // high → `proven` tag set by the tick) and steps up to journeyman,
      // or settles into a steady role. Both branches are reachable in
      // shipping content because loyalty moves (guardrail §10).
      id: 'prove_apprenticeship',
      fromStage: 'apprentice',
      requirements: [{ kind: 'progress_at_least', value: APPRENTICE_REQUIREMENT }],
      outcomes: [
        {
          when: [{ kind: 'tag_present', tag: PROVEN_TAG }],
          nextStage: 'journeyman',
          effects: [{ kind: 'entry_patch', target: 'self', changes: { tags: ['staff_arc', `${STAFF_MASTERY_SUBJECT_TAG_PREFIX}${STAFF_MASTERY_ARC_SUBJECT_ID}`, PROVEN_TAG, 'thriving'] } }],
        },
      ],
      fallback: {
        nextStage: 'steady',
        effects: [{ kind: 'entry_patch', target: 'self', changes: { tags: ['staff_arc', `${STAFF_MASTERY_SUBJECT_TAG_PREFIX}${STAFF_MASTERY_ARC_SUBJECT_ID}`, 'steady'] } }],
      },
    },
    {
      // The journeyman attains mastery — terminal. Reached directly from a
      // proven apprenticeship.
      id: 'attain_mastery',
      fromStage: 'journeyman',
      requirements: [{ kind: 'progress_at_least', value: JOURNEYMAN_REQUIREMENT }],
      outcomes: [],
      fallback: {
        nextStage: 'mastered',
        terminal: true,
        effects: MASTERED_EFFECTS,
      },
    },
    {
      // The steady branch rejoins the path: a steady hand who later proves
      // themselves steps up to journeyman; otherwise they hold steady and
      // try again. Keeps the `steady` branch from being a dead end.
      id: 'find_footing',
      fromStage: 'steady',
      requirements: [{ kind: 'progress_at_least', value: STEADY_REQUIREMENT }],
      outcomes: [
        {
          when: [{ kind: 'tag_present', tag: PROVEN_TAG }],
          nextStage: 'journeyman',
          effects: [{ kind: 'entry_patch', target: 'self', changes: { tags: ['staff_arc', `${STAFF_MASTERY_SUBJECT_TAG_PREFIX}${STAFF_MASTERY_ARC_SUBJECT_ID}`, PROVEN_TAG, 'thriving'] } }],
        },
      ],
      fallback: {
        // A steady hand who never proves themselves still masters their
        // role in time — just by the quieter road. Terminal, so every
        // path reaches `mastered` and the arc never loops forever.
        nextStage: 'mastered',
        terminal: true,
        effects: MASTERED_EFFECTS,
      },
    },
  ],
}

/** Recover the subject cast-member id from the entry's `subject:<id>` tag.
 *  Generic — never a hardcoded id, so a second staff arc resolves too. */
export function readArcSubjectId(entry: TeleologyEntry): string | undefined {
  const tag = entry.tags.find((t) => t.startsWith(STAFF_MASTERY_SUBJECT_TAG_PREFIX))
  return tag?.slice(STAFF_MASTERY_SUBJECT_TAG_PREFIX.length)
}

export function createStaffMasteryArc(label: string, day: number): TeleologyEntry {
  return {
    id: STAFF_MASTERY_ARC_ID,
    kind: 'arc',
    label,
    stage: 'apprentice',
    progress: 0,
    status: 'active',
    tags: ['staff_arc', `${STAFF_MASTERY_SUBJECT_TAG_PREFIX}${STAFF_MASTERY_ARC_SUBJECT_ID}`],
    createdAtDay: day,
    updatedAtDay: day,
  }
}
