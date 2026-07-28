import type { IssueSeed } from './issueSeedTypes'

// Phase 2 (teleology) — hand-composition budget.
// Phase 205 / audit Wave 6 (`P7-EXP-005`) — full-day attention budget.
//
// The daily hand count was originally emergent: every ranked seed that
// survived validation/fairness landed on `seedsToday`. Teleology added a
// per-generation cap with reserved slots so low-severity `opportunity`
// seeds could not be crowded out.
//
// Wave 6 turns that per-pass cap into a budget over the whole DAY.
// The audit measured a seven-card, 35-button day precisely because a
// pass-local cap of six cannot see that the morning already spent the
// player's attention: Morning and Service each bounded their own pass,
// and the union was whatever the two happened to add up to.
//
// The budget now selects against the day's *exposure ledger*
// (`surfacedToday`), on two axes approved as `DC-06`:
//
//   · cards   — `FULL_DAY_CARD_CEILING` (5), with one slot held back
//               during the Morning pass so Service always has room;
//   · choices — `FULL_DAY_CHOICE_CEILING` (24) rendered buttons, priced
//               per seed by `renderedChoiceCost`.
//
// Three properties fall out of the accounting and are worth stating,
// because the Wave 6 regression tests assert them separately:
//
//   1. A seed already exposed today costs nothing more to keep visible —
//      its card slot and buttons are already spent — so exposed seeds are
//      carried first and stop being displaced by later passes. (Before
//      Wave 6 a later pass could silently drop a card the player had
//      already read.)
//   2. The visible hand is therefore bounded by the card ceiling at every
//      pause, always.
//   3. An urgent seed that does not fit is still admitted, displacing the
//      lowest-ranked non-urgent member of the hand (which stays
//      resolvable through `surfacedToday`, as displaced seeds always
//      have). Displacement cannot un-show a card, so the day's ledger can
//      reach `ceiling + 1` — and every entry past the ceiling is urgent
//      by construction.
//
// Everything here is pure and sim-side, so replay stays deterministic.

// Teleology seeds are identified by family. The `opportunity` type alone is
// not sufficient (other families also use it), so we key off the teleology
// families directly.
const TELEOLOGY_FAMILIES: ReadonlySet<string> = new Set(['venture', 'opening'])

/** DC-06 — cards the player may face across one whole day (the union of
 *  the Morning hand and anything Service adds). */
export const FULL_DAY_CARD_CEILING = 5

/** DC-06 — rendered choice buttons across that same day. */
export const FULL_DAY_CHOICE_CEILING = 24

/** Card slots held back during the Morning pass so an emergent Service
 *  incident has somewhere to land without displacing anything. */
export const SERVICE_CARD_RESERVE = 1


/**
 * Ceiling on the choices ONE card renders. The card layer's
 * `applyLegibleChoiceCap` is the policy that enforces it;
 * `cards/cardHelpers.ts` re-exports this as
 * `DEFAULT_LEGIBLE_CHOICE_CAP` so the presentation cap and the sim's
 * budget arithmetic cannot drift apart.
 */
export const RENDERED_CHOICE_CAP_PER_CARD = 6

/**
 * Choice buttons held back with that card slot.
 *
 * Reserving the slot alone is not enough: a brawl breaking out during
 * service is a five-option card, and a Morning that had spent 20 of 24
 * buttons would leave it a slot it cannot afford. One card's worth of the
 * choice budget (the per-card cap plus the generic Ignore) makes the
 * reserve real — the Service pause can always seat one full incident.
 */
export const SERVICE_CHOICE_RESERVE = RENDERED_CHOICE_CAP_PER_CARD + 1

/** Urgency at or above which a seed is treated as urgent: never trimmed to
 *  a continuation's choice cap, and admitted at a full ceiling by
 *  displacing a non-urgent card rather than waiting for tomorrow.
 *  Deliberately NOT an exemption from the family cooldown — see
 *  `shouldRestFamily`. */
export const URGENT_URGENCY_THRESHOLD = 70

/** DC-06 — consecutive days one family may surface before it must rest,
 *  absent material worsening. */
export const FAMILY_STREAK_LIMIT = 2

/** DC-06 — how many response slots a non-escalated continuation offers. */
export const CONTINUATION_CHOICE_CAP = 3

export type HandBudgetOptions = {
  totalBudget: number
  teleologyReserve: number
  triageReserve: number
  /** Rendered-choice budget for the whole day. */
  choiceBudget: number
}

export const DEFAULT_HAND_BUDGET: HandBudgetOptions = {
  totalBudget: FULL_DAY_CARD_CEILING,
  // One guaranteed teleology slot rather than the pre-Wave-6 two: with a
  // four-card Morning (5 − Service reserve) two reserved opportunity
  // slots would be half the hand.
  teleologyReserve: 1,
  triageReserve: 3,
  choiceBudget: FULL_DAY_CHOICE_CEILING,
}

function isTeleology(seed: IssueSeed): boolean {
  return TELEOLOGY_FAMILIES.has(seed.family as string)
}

export function isUrgentSeed(seed: IssueSeed): boolean {
  return seed.urgency >= URGENT_URGENCY_THRESHOLD
}

/**
 * Upper bound on the buttons the card layer will render for this seed.
 *
 * `applyLegibleChoiceCap` surfaces at most `RENDERED_CHOICE_CAP_PER_CARD`
 * slots, plus one when the inaction slot ranks outside the salience cut
 * and is appended past the cap. `CardRenderer` then adds a generic Ignore
 * when no rendered choice carries the `ignore` verb — and a slot that
 * does carry it is never dropped by the cap, so checking the seed's own
 * slots answers that question exactly.
 *
 * An upper bound is the right shape for a ceiling: the budget can never
 * admit a seed that then renders wider than it was priced at.
 */
export function renderedChoiceCost(seed: IssueSeed): number {
  const slots = seed.responseSlots.length
  const rendered =
    slots <= RENDERED_CHOICE_CAP_PER_CARD
      ? slots
      : RENDERED_CHOICE_CAP_PER_CARD + 1
  const modelsIgnore = seed.responseSlots.some((slot) =>
    slot.allowedVerbs.includes('ignore'),
  )
  return rendered + (modelsIgnore ? 0 : 1)
}

/** Bound a ranked seed list to the hand budget, preserving the input order
 *  (rank). Up to `teleologyReserve` teleology seeds and `triageReserve`
 *  triage seeds are guaranteed to survive even if lower-ranked than the
 *  seeds that would otherwise fill the budget; any remaining slots are
 *  filled by overall rank. Returns the kept seeds in their original ranked
 *  order.
 *
 *  Wave 6 note: this is the *card-count* half of the budget, kept as its
 *  own pure function because the teleology-vs-triage reserve policy is
 *  independent of the day ledger. `selectVisibleHand` is the entry point
 *  the module uses; it applies the ledger and the choice budget on top. */
export function applyHandBudget(
  ranked: readonly IssueSeed[],
  opts: HandBudgetOptions = DEFAULT_HAND_BUDGET,
): IssueSeed[] {
  if (ranked.length <= opts.totalBudget) return [...ranked]

  const keep = new Set<IssueSeed>()

  // Reserve the top-ranked teleology seeds. Wave 6 — the `keep.size`
  // guards matter now that the budget can be smaller than the reserves
  // (a Service pass with one slot left): without them the reserve loops
  // would fill `keep` past the budget and the closing `slice` would cut
  // by rank, silently voiding the guarantee the reserves exist for.
  let teleologyKept = 0
  for (const seed of ranked) {
    if (teleologyKept >= opts.teleologyReserve) break
    if (keep.size >= opts.totalBudget) break
    if (isTeleology(seed)) {
      keep.add(seed)
      teleologyKept += 1
    }
  }

  // Reserve the top-ranked triage (non-teleology) seeds.
  let triageKept = 0
  for (const seed of ranked) {
    if (triageKept >= opts.triageReserve) break
    if (keep.size >= opts.totalBudget) break
    if (!isTeleology(seed) && !keep.has(seed)) {
      keep.add(seed)
      triageKept += 1
    }
  }

  // Fill any remaining budget by overall rank.
  for (const seed of ranked) {
    if (keep.size >= opts.totalBudget) break
    keep.add(seed)
  }

  // Emit in original ranked order.
  return ranked.filter((seed) => keep.has(seed)).slice(0, opts.totalBudget)
}

/**
 * The order new seeds are offered to the budget: the top-ranked teleology
 * seeds up to `teleologyReserve`, then the top-ranked triage seeds up to
 * `triageReserve`, then everything else by rank.
 *
 * Same reserve policy as `applyHandBudget` — a busy reactive day must not
 * crowd out every opportunity — expressed as an ORDER rather than a
 * selection, so the budget can skip an unaffordable seed and keep going.
 */
function admissionOrder(
  ranked: readonly IssueSeed[],
  opts: HandBudgetOptions,
): IssueSeed[] {
  const out: IssueSeed[] = []
  const taken = new Set<string>()
  const take = (seed: IssueSeed): void => {
    if (taken.has(seed.id)) return
    taken.add(seed.id)
    out.push(seed)
  }
  let teleologyTaken = 0
  for (const seed of ranked) {
    if (teleologyTaken >= opts.teleologyReserve) break
    if (!isTeleology(seed)) continue
    take(seed)
    teleologyTaken += 1
  }
  let triageTaken = 0
  for (const seed of ranked) {
    if (triageTaken >= opts.triageReserve) break
    if (isTeleology(seed) || taken.has(seed.id)) continue
    take(seed)
    triageTaken += 1
  }
  for (const seed of ranked) take(seed)
  return out
}

export type VisibleHandInput = {
  /** The pass's ranked union of the current hand and today's new seeds. */
  ranked: readonly IssueSeed[]
  /** Every seed already exposed today, in exposure order. */
  exposed: readonly IssueSeed[]
  /** True for the Morning pass, which holds the Service reserve back. */
  holdServiceReserve: boolean
  opts?: HandBudgetOptions
}

export type VisibleHandResult = {
  /** The visible hand, in ranked order. */
  hand: IssueSeed[]
  /** New seeds the budget could not admit today, with a reason. */
  withheld: Array<{ seed: IssueSeed; reason: string }>
}

/**
 * Phase 205 / Wave 6 — select the visible hand against the day's
 * attention ledger. See the header for the accounting; the shape is:
 *
 *   1. price the exposures that cannot be reclaimed (seeds shown earlier
 *      today that this pass's ranked set no longer contains);
 *   2. carry every already-exposed seed that is still ranked;
 *   3. admit NEW seeds — reserves first, then by rank — while both the
 *      card and choice budgets hold;
 *   4. rescue any unadmitted urgent seed by displacing the lowest-ranked
 *      non-urgent member of the hand.
 */
export function selectVisibleHand(input: VisibleHandInput): VisibleHandResult {
  const opts = input.opts ?? DEFAULT_HAND_BUDGET
  const cardBudget = input.holdServiceReserve
    ? Math.max(1, opts.totalBudget - SERVICE_CARD_RESERVE)
    : opts.totalBudget
  const choiceBudget = input.holdServiceReserve
    ? Math.max(RENDERED_CHOICE_CAP_PER_CARD, opts.choiceBudget - SERVICE_CHOICE_RESERVE)
    : opts.choiceBudget

  const rankedIds = new Set(input.ranked.map((seed) => seed.id))
  const exposedIds = new Set(input.exposed.map((seed) => seed.id))

  // 1. Sunk exposures: shown to the player earlier today but no longer in
  //    the ranked set. Their cost is spent whatever this pass decides.
  //
  //    `ledgerCards` counts everything the player has been or will be
  //    shown today; `kept.size` is the visible hand. They differ once a
  //    card has been displaced, and both need bounding: the ledger is the
  //    day's attention load, the hand is what one pause presents.
  let ledgerCards = 0
  let choices = 0
  for (const seed of input.exposed) {
    if (rankedIds.has(seed.id)) continue
    ledgerCards += 1
    choices += renderedChoiceCost(seed)
  }

  // 2. Carry the already-exposed seeds this pass still knows about.
  const kept = new Set<string>()
  for (const seed of input.ranked) {
    if (!exposedIds.has(seed.id)) continue
    kept.add(seed.id)
    ledgerCards += 1
    choices += renderedChoiceCost(seed)
  }

  // 3. Admit new seeds, in reserve-then-rank order, testing both budgets
  //    per seed.
  //
  //    Reserves and budgets are resolved in ONE pass on purpose. Picking
  //    the winners by card count first and then testing affordability
  //    lets a high-ranked seed that cannot fit the choice budget occupy
  //    the slot and block a cheaper one behind it: a five-button brawl
  //    was withheld because an eight-button complaint had claimed the
  //    day's last card slot and then failed to pay for it.
  const fresh = input.ranked.filter((seed) => !exposedIds.has(seed.id))
  const withheld: Array<{ seed: IssueSeed; reason: string }> = []

  for (const seed of admissionOrder(fresh, opts)) {
    const cost = renderedChoiceCost(seed)
    if (ledgerCards + 1 > cardBudget) {
      withheld.push({
        seed,
        reason: `withheld by the full-day card ceiling (${cardBudget})`,
      })
      continue
    }
    if (choices + cost > choiceBudget) {
      // A cheaper lower-ranked seed may still fit, so keep scanning.
      withheld.push({
        seed,
        reason: `withheld by the full-day choice ceiling (${choiceBudget})`,
      })
      continue
    }
    kept.add(seed.id)
    ledgerCards += 1
    choices += cost
  }

  // 4. Urgency rescue. An urgent incident must always be reachable, so it
  //    takes the place of the weakest non-urgent card rather than waiting
  //    for tomorrow.
  //
  //    Displacement only reclaims budget when the victim has NOT been
  //    exposed yet — a card the player has already read cost its buttons
  //    the moment it was rendered, and removing it from the hand cannot
  //    un-spend them. So the loop displaces the weakest unexposed cards
  //    first and re-tests the budget; when only exposed victims are left,
  //    the urgent seed is admitted anyway and the day's ledger runs one
  //    card over. That overage is the approved cost of never starving an
  //    urgent incident, and it is bounded: only urgent seeds take it.
  const stillWithheld: Array<{ seed: IssueSeed; reason: string }> = []
  const byWeakestFirst = [...input.ranked].reverse()
  for (const entry of withheld) {
    if (!isUrgentSeed(entry.seed)) {
      stillWithheld.push(entry)
      continue
    }
    const cost = renderedChoiceCost(entry.seed)
    const fits = (): boolean =>
      ledgerCards + 1 <= cardBudget && choices + cost <= choiceBudget
    while (!fits()) {
      const victim = byWeakestFirst.find(
        (seed) =>
          kept.has(seed.id) && !isUrgentSeed(seed) && !exposedIds.has(seed.id),
      )
      if (!victim) break
      kept.delete(victim.id)
      ledgerCards -= 1
      choices -= renderedChoiceCost(victim)
    }
    if (!fits()) {
      // Nothing reclaimable left. Take the weakest hand slot so the
      // VISIBLE hand still honours the card ceiling, and accept the
      // ledger overage.
      const victim = byWeakestFirst.find(
        (seed) => kept.has(seed.id) && !isUrgentSeed(seed),
      )
      if (victim) kept.delete(victim.id)
    }
    kept.add(entry.seed.id)
    ledgerCards += 1
    choices += cost
  }

  return {
    hand: input.ranked.filter((seed) => kept.has(seed.id)),
    withheld: stillWithheld,
  }
}
