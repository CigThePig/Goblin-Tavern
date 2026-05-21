# Phase 121 — Character Depth (Living Cast arc, Phase A)

> Implements Phase A of [`living-cast-arc.md`](./living-cast-arc.md).
> Tracker entry: `ISSUE-090` in [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md).
> Locked contracts honoured: `CLAUDE.md` (architectural rules),
> [`cards-contract.md §3`](./cards-contract.md) (state shapes,
> `EntityRef`, GeneratedName precedent), and
> [`card-composition-framework.md §2.3, §5`](./card-composition-framework.md)
> (the `actorTrait` forward seam these attributes satisfy).

## Context — why this change

The Living Cast arc's payoff is "hundreds of in-voice lines per
character in an evening" via generation against a tested spec. Phase A
is the **vocabulary** every later phase selects against. The 20-line
demo failed for the sim because it minted fresh ad-hoc tags per line
(`fae_touched_wanderer`, `anti_mage`); at scale that is unselectable
noise. Phase A baseline-prevents that by giving staff and regulars a
small, *bounded* attribute set generated once at creation and stored as
serializable state. No prose is authored here. The `actorTrait`
SnippetCondition Phase C will introduce reads these fields; today, we
fill the dictionary the seam will eventually consume.

Scope confirmed with the user before implementation:
- **Regulars carry the full attribute set**, with their
  specialty/blindspot drawn from a social-interaction domain (gossip,
  war_story, dealmaking, …) rather than a role domain. Uniform shape
  avoids assembler branching downstream.
- **Voice defaults are culture-aware.** Each culture declares a
  baseline `Partial<VoiceProfile>`; the factory perturbs it via the
  named identity RNG stream. Day-one cast lands with plausible voices
  instead of uniform random.

## Locked decisions

| Question | Decision |
|---|---|
| Where does `CastAttributes` live? | New content slice at `src/sim/content/cast/`. Types, registries, factories, and culture/role tables all under one folder. |
| State surface | Optional `castAttributes?` on `StaffState` and `RegularWorldState` only — matches the `identity?` migration-window pattern from Phase 31. NPCs and suppliers are out of scope. |
| RNG streams | Reuse the existing `staff_identity` and `regular_identity` named streams (`src/sim/core/rng.ts:132–148`). Cast-attribute rolls land **after** the existing identity rolls in the factory, so all previously-generated names + identity fields stay byte-identical. |
| Voice axes | Hard TypeScript union `'terseness' \| 'warmth' \| 'formality' \| 'floridity'`. The union IS the v1 registry — one line to add or rename in `voiceAxes.ts`. |
| Verbal tics | `verbalTicRegistry` with 7 starter ids. Probability per character: 0.4. |
| Specialty/blindspot domains | Per-role (staff) or shared social (regulars) const lists. Blindspot is picked from the same domain, distinct from specialty. |
| Affinities | Coarse tag-shaped targets (`miners`, `merchants`, `house_regulars`, …), NOT `EntityRef`s — survive entity churn. 1–2 per character, each with `polarity` + `strength`. |
| Migration | `ensureCastAttributes` mirrors `ensureStaffIdentityFields`. Idempotent. Wired into the additive chain at `web/src/lib/sim/persistence.ts`. |
| Card layer changes | None. No compose slice, no `actorTrait` evaluator, no card prose. Phase C builds those. |

## Files

### New — cast content slice

- `src/sim/content/cast/castTypes.ts` — `CastAttributes`,
  `VoiceProfile`, `AffinityAxis`, voice-axis + polarity + strength
  union types.
- `src/sim/content/cast/voiceAxes.ts` — `VOICE_AXIS_IDS`,
  `VOICE_AXIS_DEFINITIONS` (label + authoring hint per axis).
- `src/sim/content/cast/verbalTics.ts` — `verbalTicRegistry`,
  `ensureRequiredVerbalTicsRegistered()`. 7 starter tics.
- `src/sim/content/cast/staffSpecialties.ts` —
  `STAFF_SPECIALTY_DOMAIN: Record<StaffRoleId, readonly string[]>` +
  `getStaffSpecialtyDomain(roleId)`. Covers cook, server,
  cleaner_bouncer, kitchen_hand, seasoned_cook, master_chef.
- `src/sim/content/cast/regularSpecialties.ts` —
  `REGULAR_SOCIAL_SPECIALTIES` (7 social-domain entries).
- `src/sim/content/cast/affinityTargets.ts` — `AFFINITY_TARGETS` (13
  coarse entity-kind tags) + `AFFINITY_TARGET_SET` +
  `isKnownAffinityTarget()`.
- `src/sim/content/cast/cultureVoiceDefaults.ts` —
  `CULTURE_VOICE_DEFAULTS` covering all 8 registered cultures +
  `getCultureVoiceDefault(cultureId)`.
- `src/sim/content/cast/createCastAttributes.ts` —
  `createStaffCastAttributes(args)` and
  `createRegularCastAttributes(args)`. Roll order is committed forever
  (see file header).
- `src/sim/content/cast/index.ts` — re-exports.
- `tests/sim/phase121.castAttributes.test.ts` — 13 gates covering
  schema round-trip, determinism, stream isolation, no regression,
  culture bias, migration round-trip, migration determinism, bounded
  outputs, no-prose check, and registry-coverage sanity checks.

### Edits — state + factories + migration

- `src/sim/state/TavernState.ts` — `castAttributes?: CastAttributes`
  on `StaffState` (line 161) and `RegularWorldState` (line 481).
- `src/sim/state/schemas.ts` — new `CastAttributesSchema`,
  `VoiceProfileSchema`, `AffinityAxisSchema`, `VoiceAxisIdSchema`,
  `VoiceAxisValueSchema`. Appended `castAttributes` to
  `StaffStateSchema` and `RegularWorldStateSchema`.
- `src/sim/state/defaults.ts` — `createInitialStaff` and
  `createInitialRegulars` both call the corresponding cast-attribute
  factory after their existing identity rolls.
- `src/sim/state/migrations.ts` — `ensureCastAttributes` helper.
- `src/sim/modules/regulars/regularModule.ts` —
  `createRegular` calls `createRegularCastAttributes` after the name +
  favouriteStock rolls.
- `src/sim/modules/ownerActions/staffManagementActions.ts` — hire-staff
  path calls `createStaffCastAttributes` for new hires.
- `web/src/lib/sim/persistence.ts` — `ensureCastAttributes` appended
  to the additive migration chain (after `ensureMonthlyHistoryField`,
  before `ensureModuleSlices`).

### Tracker

- `docs/ISSUE_TRACKER.md` — new entry `ISSUE-090` (status `done`,
  phase 121), tracker index row added, "Current work" callout updated
  to point at the Living Cast arc as the next active arc.

## The roll order (committed forever)

Per character, in this exact order:

1. `specialty` — `rng.pick(domain)`
2. `blindspot` — `rng.pick(domain \ {specialty})`
3. affinity count — `rng.pick([1, 2])`
4. for each affinity: `rng.pick(targets) → rng.pick(polarities) → rng.pick(strengths)`
5. voice axes in `VOICE_AXIS_IDS` order: `base + rng.pick([-1, 0, 0, 1])` clamped to `[0, 2]`
6. verbal-tic chance roll, then (on hit) `rng.pick(registry.all())`

Re-ordering, inserting, or removing a roll shifts every canonical
attribute previously produced for the same seed. Changes to the roll
order MUST land as a new phase with a migration story, not a silent
edit.

## Verification

| Check | How | Result |
|---|---|---|
| Types | `npm run typecheck` | Clean. |
| Unit | `npm test -- --run tests/sim/phase121.castAttributes.test.ts` | 13/13 pass. |
| Regression | `npm test -- --run` | 1719/1719 pass; persistence round-trip and Phase 31 / Phase 24 / Phase 81 suites all green. |
| Migration round-trip | `tests/sim/phase121.castAttributes.test.ts` gate 6 + persistence tests | A pre-Phase-A fixture gains attributes; a second pass is a deep-equal no-op. |
| Culture bias | gate 5 | Mean `terseness` for miner_workcrew (default 2) > merchant_roadfolk (default 0) by ≥ 0.8 across 80 samples. |

## Do not do (per arc Phase A `Do not do`)

- No dialogue or prose authored anywhere — `CastAttributes` only
  carries ids and bounded scalars.
- No open-ended invented tags — every string in state is backed by a
  registry entry or a const list.
- No card-layer code, no compose slice, no `actorTrait` evaluator.
  Phase C builds those; Phase A only fills the dictionary the seam
  will read.
- No new `SimulationModule` — `castAttributes` lives on existing state
  slices, not under `state.modules.cast`.

## Expected loop (per arc doc)

Phase B will likely come back with one of: rename a voice axis, drop
one, add one, or rename a verbal-tic id. The data layout is built for
that single feedback round — every change of that shape is one line in
`voiceAxes.ts` or `verbalTics.ts` plus a Zod regen, no factory rewrite.
If Phase B asks for a structural change (e.g. specialty becomes
multi-valued, or a new attribute joins the set), that is a real
follow-up phase, not Phase A rework.
