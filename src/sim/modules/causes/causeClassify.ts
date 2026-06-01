// Phase 188 / ISSUE-155 — Causal Establishing Line.
//
// Two pure helpers that answer "what was the dominant cause, and what
// class of event was it?" off a seed's `causes: CauseEntry[]`. They live
// here, beside the other cause utilities, so the seed generator
// (`issueSeedGenerators.ts`) and the card condition
// (`compose/conditions.ts`) import the SAME source of truth — the seed's
// stated cause and the card's cause line can never disagree.
//
// Both functions are pure (no RNG, no state writes, no calendar reads),
// so cause selection is a deterministic function of the deterministic
// `seed.causes` and the determinism gate holds.

import type { CauseEntry } from '../../state/TavernState'

/** The closed set of event classes a cause line can name. Each maps from
 *  the tags the cause writers across `src/sim/modules/` actually emit
 *  (surveyed: `shortage`, `cleanliness`/`mess`/`filth`/`filthy`,
 *  `price`, `violence`/`brawl`/`brawl_night`/`warn_rowdy_group`,
 *  `rumour`/`bad_reputation`, `service_capacity`). Anything outside this
 *  set classifies to `undefined` — the card then omits the cause line. */
export type CauseClass =
  | 'shortage'
  | 'cleanliness'
  | 'price'
  | 'danger'
  | 'rumour'
  | 'wait'

/** Priority-ordered tag map. A cause commonly carries several tags (the
 *  default Day-1 complaint cause is `['service','satisfaction',
 *  'merchants','shortage']`), so the FIRST class whose trigger tags
 *  intersect the cause's tags wins. `shortage` leads so the broad
 *  `service` tag a shortage cause also carries never mis-routes it to
 *  `wait`. */
const CAUSE_CLASS_TAGS: ReadonlyArray<readonly [CauseClass, readonly string[]]> =
  [
    ['shortage', ['shortage']],
    ['cleanliness', ['cleanliness', 'mess', 'filth', 'filthy']],
    ['price', ['price', 'expensive']],
    [
      'danger',
      [
        'danger',
        'dangerous',
        'violence',
        'brawl',
        'brawl_night',
        'rowdy',
        'warn_rowdy_group',
      ],
    ],
    ['rumour', ['rumour', 'bad_reputation']],
    ['wait', ['wait', 'slow', 'queue', 'service_capacity']],
  ]

/** Map a cause's tags onto the closed `CauseClass` union. Returns
 *  `undefined` when no class applies (the unclassifiable case) and when
 *  the cause itself is `undefined` (so callers can write
 *  `classifyCause(pickDominantCause(seed.causes))` without a guard). */
export function classifyCause(
  cause: CauseEntry | undefined,
): CauseClass | undefined {
  if (!cause) return undefined
  for (const [cls, triggers] of CAUSE_CLASS_TAGS) {
    if (triggers.some((t) => cause.tags.includes(t))) return cls
  }
  return undefined
}

/** Select the dominant NEGATIVE cause — the event that pushed a value
 *  down. Considers only entries with `direction === 'decrease'`
 *  (equivalently `amount < 0`); a positive / `increase` cause is never
 *  the dominant negative cause. Ranks by `Math.abs(amount) * weight` and
 *  tie-breaks by lowest `ageDays` (most recent). Returns `undefined` when
 *  no negative cause exists. Stable: when score AND ageDays tie, the
 *  first-encountered entry wins, so the pick is deterministic. */
export function pickDominantCause(
  causes: readonly CauseEntry[] | undefined,
): CauseEntry | undefined {
  if (!causes || causes.length === 0) return undefined
  let best: CauseEntry | undefined
  let bestScore = -Infinity
  for (const c of causes) {
    if (c.direction !== 'decrease' && c.amount >= 0) continue
    const score = Math.abs(c.amount) * c.weight
    if (score > bestScore) {
      best = c
      bestScore = score
    } else if (score === bestScore && best && c.ageDays < best.ageDays) {
      best = c
    }
  }
  return best
}
