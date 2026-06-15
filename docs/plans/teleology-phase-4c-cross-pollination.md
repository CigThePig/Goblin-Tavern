# Teleology Phase 4c — Cross-pollination (arc ↔ venture / transformation)

> Standalone implementation record for `teleology-half-phase-plan.md` §"Phase 4c".
> Built on 4a (the `state.arcs` slice + diff/cause wiring), 4b (autonomous arc
> advancement + fork-on-state), Phase 1 (the venture spine + kernel) and Phase 3
> (the transformation seam). No new engine concept — only existing seams reused.

## Goal

Couple arcs to the rest of the teleology machine: an arc milestone unlocks a
venture stage, and a venture outcome reaches back into an arc. Both directions
ride the existing effect/condition vocabulary; neither targets a pressure.

## The two directions

**Arc → venture (an arc milestone unlocks a venture stage).** Every road to
`mastered` in the staff-mastery arc now writes a second effect: a
`master_on_staff` **transformation** alongside the `mastered` ratchet tag (the
arc payoff "behaves like a transformation", plan §4c). A new venture, *Brew a
signature ale* (`venture_signature_brew`), gates its `refining → signature`
milestone on that fact via the kernel's existing `transformation_active`
condition. Until the arc produces the transformation the milestone never
resolves, so the venture holds at `refining` — no churn, no looping. Once the
arc masters, the venture advances to `signature` (terminal) and writes its own
`signature_brew_served` ratchet (the venture → transformation direction).

**Venture → arc (a venture outcome wounds an arc).** The brew seed offers a
"lean on the staff to rush it" response whose consequence profile pushes the
venture's progress **and** writes a negative `state_change` to
`arcs.<id>.progress` — a venture outcome reaching back into the arc. It routes
through the existing `ResponseIntent → applyResponses` applier (which already
handles `arcs.<id>.progress`), targets the arc collection (never a pressure),
and resolves the woundable arc from `state.arcs` at generation (guardrail §10),
so it survives a second arc existing.

## Shared link (no module imports the other)

`ventureModule` and `arcModule` still import neither each other (plan §1). They
couple only through `src/sim/modules/teleologyCrossLinks.ts`, a tiny shared
constants file (`MASTER_ON_STAFF_TRANSFORMATION_ID` / tag) that both import — a
shared *fact id*, not a module dependency.

## Reachability (guardrail §10)

The brew venture is real shipping content, not a test fixture: it is registered
in `VENTURE_BLUEPRINTS`, so the openings module offers it once a staff arc
becomes `proven` (an arc-biased opening, keyed off `state.arcs`), and committing
spawns it through the same applier path the liquor licence uses. The arc gate is
an authored milestone *requirement*; the wound is an authored consequence-profile
effect resolving its arc from state — neither is injected only by a unit test.

## Card scope (no new families)

The venture card (`venture.current_stage`, shipped Phase 1) was generalised to
resolve its venture from the seed's `venture:<id>` target (it had hardcoded the
liquor licence id) and to read its progress denominator from the live milestone,
so a second venture renders its own state. It now also surfaces a
cross-pollination legibility line — "Stalled at refining until a master joins the
staff" — computed generically from the catalogued gate (`ventureGateBlockedNote`).
No new card family; 4d owns the arc card-authoring mass.

## Constraints honoured

- §1 layering: state/advancement in `src/sim/`; the card stays a pure function
  in `src/cards/`. §2 named RNG: no new rolls. §3/§4 effect routing & polarity:
  every cross-effect targets the arc/venture/transformation collections, never a
  pressure id; teleology progress stays plain stage/meter state, not a pressure.
- §2a §8 kernel purity: unchanged — the gate is milestone data
  (`transformation_active` requirement), the payoff is a `transformation` effect,
  the wound is a consequence-profile `state_change`; no `if (kind === …)` or
  domain literal entered the kernel. §9 real-content guard: the fast test scans
  the *actually generated* brew seed's effects, asserts ≥1 arc cross-effect, then
  asserts none target a pressure. §10: gate + wound resolve from the seed/entry
  and state, never a hardcoded id/threshold.
- 4a/4b loyalty-coexistence preserved: the wound hits arc progress, not loyalty
  (a fast test asserts loyalty is byte-identical between a wounded and a clean
  run of the same day).

## Tests

- Fast (`teleologyPhase4c.test.ts`): the arc→venture gate holds while
  `master_on_staff` is absent and releases once it is active; the gate is an
  authored milestone requirement; an arc reaching `mastered` writes the
  transformation; the venture→arc wound drops arc progress and never touches
  loyalty; the §9 real-content guard.
- Heavy (`teleologyPhase4c.heavy.test.ts`, `HEAVY_TEST_GLOBS`): over 40 days a
  brew venture held at `refining` unlocks to `signature` exactly when the
  autonomously-advancing arc reaches `mastered`; plus a replay/determinism check
  over ventures, arcs, and transformations.
