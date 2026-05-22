# Phase 2 — Universal Cast (Voiced Surface arc, ISSUE-097 / phase 128)

## Context

Phase 1 (`docs/plans/phase-127-signal-surface.md`) made the sim's truth
*reachable* by the snippet layer through `src/sim/signals/`. The next
blocker for the arc's scale-out is that **most actors a card voices
cannot be voiced** — they have no `voiceProfile` to select snippets
against. Today only staff and regulars carry `castAttributes`
(`StaffState.castAttributes`, `RegularWorldState.castAttributes`, both
wired in Phase 121 / ISSUE-090); `resolveActorCastAttributes` at
`src/cards/compose/conditions.ts:42-44` explicitly returned `undefined`
for every other entity kind and the comment named the gap ("e.g.
supplier, faction"). Three of the four broken-card screenshots the arc
cites voice a supplier, a faction, and a culture cohort — none of which
today carried voice. Phase 7–14 migrations cannot author snippets keyed
on `voiceAxis` / `verbalTic` for those actors until this is fixed.

This phase generalises the Phase-A shape to **four** new actor kinds —
supplier, faction, customer group (cohort), notable NPC — using the
same bounded vocabulary, the same `CULTURE_VOICE_DEFAULTS` flow, the
same named-RNG deterministic seeding, the same optional-field-plus-
additive-migration pattern. No prose, no module rewrites, no new axes.
The deliverable is purely the data surface migrations need to start
authoring against.

## What landed

### 1. Per-actor cast attribute shapes (`src/sim/content/cast/castTypes.ts`)

Four new exported type aliases alongside the existing `CastAttributes`:

```ts
export type SupplierCastAttributes = CastAttributes
export type FactionCastAttributes = CastAttributes
export type NotableNpcCastAttributes = CastAttributes

// Voice-only — cohorts aren't individuals.
export type CustomerGroupCastAttributes = { voice: VoiceProfile }
```

Aliases (not a single shared type) keep room for per-kind divergence
later without touching staff/regular call sites.

### 2. Specialty domains

Three new files under `src/sim/content/cast/`:

- **`supplierSpecialties.ts`** — `getSupplierSpecialtyDomain(supplierType)`
  with 6-entry domains for `food_cart`, `brewer`, `caravan`,
  `butcher_or_salvage_food`, `specialty_goods`. Unknown types fall back
  to `SUPPLIER_FALLBACK_DOMAIN`.
- **`factionSpecialties.ts`** — single shared `FACTION_SOCIAL_SPECIALTIES`
  array (7 entries: `ceremony`, `hard_bargain`, `quiet_diplomacy`,
  `public_display`, `intelligence`, `patronage`, `intimidation`) —
  factions don't partition by kind, so one shared domain mirrors the
  `REGULAR_SOCIAL_SPECIALTIES` pattern.
- **`notableNpcSpecialties.ts`** — `getNotableNpcSpecialtyDomain(profileKind)`
  with 6-entry domains for `authority`, `moneylender`, `gossip`,
  `fence`, `priest`, `merchant_prince`, `labour_lead`, `smuggler`,
  `creditor`, `rival`. Unknown kinds fall through to
  `NOTABLE_NPC_FALLBACK_DOMAIN`.

Each domain enforces the `≥ 2 entries` invariant `rollAttributes` relies
on (`createCastAttributes.ts:99-103`).

### 3. Factories (`src/sim/content/cast/createCastAttributes.ts`)

Five new exported factories that reuse the existing private
`rollAttributes` and `rollVoiceProfile` helpers unchanged. The
committed roll order at the top of the file stays the source of truth.

```ts
createSupplierCastAttributes({ supplierType, cultureId?, rng })
createFactionCastAttributes({ cultureId?, rng })  // domain = FACTION_SOCIAL_SPECIALTIES
createNotableNpcCastAttributes({ profileKind, cultureId?, rng })
createCustomerGroupCastAttributes({ cultureId?, rng })  // voice-only
```

`createCustomerGroupCastAttributes` calls only `rollVoiceProfile` —
bytewise identical to the tail of `rollAttributes` so a future widening
would not shift state. All five are re-exported through `index.ts`.

### 4. Storage — state types and Zod schemas

- `src/sim/state/TavernState.ts` — optional `castAttributes?` added to
  `SupplierWorldState`, `FactionWorldState`, `CustomerGroupState`,
  `NotableNpcWorldState`, with Phase-121-style JSDoc.
- `src/sim/state/schemas.ts` — new `CustomerGroupCastAttributesSchema`
  (voice-only); the three full-shape kinds reuse `CastAttributesSchema`.
  All four schema fields are `.optional()` during the migration window,
  matching the Phase-121 pattern.

### 5. Named RNG streams (`src/sim/core/rng.ts`)

Three new entries on `RngStreamId` —
`supplier_identity`, `faction_identity`, `customer_group_identity` —
and three new entries in `ALL_STREAM_IDS` so `snapshot()` exposes them.
The Phase-63 prune comment already anticipated `supplier_identity`
returning when real random behaviour landed in that subsystem.

### 6. Day-zero seeding (`src/sim/state/defaults.ts`)

Three creation sites — `createInitialSuppliers`, `createInitialFactions`,
`createInitialCustomerGroups` — extended to roll cast attributes via a
dedicated seed (`'initial-supplier-identity'` etc.) and the matching
named stream. Iteration is `id.localeCompare`-sorted so a future
registry-order refactor doesn't shift assignments.

### 7. Dynamic creation — notable NPCs (`src/sim/content/npc/npcFactory.ts`)

`createNotableNpc` extended to roll `castAttributes` from the same
caller-supplied `rng` **after** the name roll — preserves every
canonical pre-Phase-2 NPC name byte-identical. Both day-zero seeding
(via `createInitialNotableNpcs`) and runtime creation (via
`adventurersModule` etc.) pick up the new field through the same factory.

### 8. Migration (`src/sim/state/migrations.ts`)

`ensureCastAttributes` extended with four new sweeps following the
Phase-121 pattern. Same `'initial-cast-attributes'` seed namespace —
one entry point handles every Phase-A + Phase-2 backfill. Idempotent;
structural no-op when every entity already carries the field.

Four new helper predicates (`suppliersNeedingCastAttributes`,
`factionsNeedingCastAttributes`, `customerGroupsNeedingCastAttributes`,
`notableNpcsNeedingCastAttributes`) — kept per-kind for readability
rather than refactored into a generic.

### 9. Compose-layer resolver (`src/cards/compose/conditions.ts`)

`resolveActorCastAttributes` widened to cover the four new ref kinds:

```ts
if (ref.kind === 'supplier') return state.world.suppliers[ref.id]?.castAttributes
if (ref.kind === 'faction') return state.world.factions[ref.id]?.castAttributes
if (ref.kind === 'notable_npc') return state.world.notableNpcs[ref.id]?.castAttributes
if (ref.kind === 'customer_group') {
  const group = state.customerGroups[ref.id]
  if (!group?.castAttributes) return undefined
  return { specialty: '', blindspot: '', affinities: [], voice: group.castAttributes.voice }
}
```

The customer-group adapter shape keeps the return type uniform so the
`CastAttribute` condition primitives (`voiceAxis`, `verbalTic`)
evaluate identically across kinds. Snippet conditions that read
specialty/blindspot/affinities against a group ref silently miss —
that's the intended behaviour: groups don't carry those fields by
design.

## Decisions

- **Notable NPCs in scope.** The doc's parenthetical "(and notable NPCs
  where they front a card)" was honoured: the migration / test harness
  is built once and every card-voicing entity is covered before
  Movement II begins. User-confirmed scope choice.
- **Customer groups are voice-only.** Cohorts aren't individuals.
  Collective likes/dislikes already live mechanically on
  `preferredStockTags` / `dislikedTags` /
  `relationshipToOtherGroups`. Specialty/blindspot don't fit a crowd.
  User-confirmed scope choice.
- **No new voice axes.** Phase 3's spike is the loop-back point if
  axis surface needs widening.
- **No widening of `CULTURE_VOICE_DEFAULTS`.** The existing eight
  cultures flow through automatically.
- **No new condition primitives.** The four `CastAttribute` primitives
  (`voiceAxis` atLeast/atMost, `verbalTic`, `actorTrait`) reach the new
  ref kinds purely through the resolver widening.

## Critical files

**New (6 files):**
- `src/sim/content/cast/supplierSpecialties.ts`
- `src/sim/content/cast/factionSpecialties.ts`
- `src/sim/content/cast/notableNpcSpecialties.ts`
- `tests/sim/phase128.universalCast.test.ts` (23 tests)
- `tests/sim/phase128.migration.test.ts` (8 tests)
- `tests/cards/compose/phase128.resolveActor.test.ts` (8 tests)

**Edited:**
- `src/sim/content/cast/castTypes.ts` — four new type aliases.
- `src/sim/content/cast/createCastAttributes.ts` — five new factories.
- `src/sim/content/cast/index.ts` — re-exports.
- `src/sim/state/TavernState.ts` — optional `castAttributes?` on four
  state types.
- `src/sim/state/schemas.ts` — `CustomerGroupCastAttributesSchema`
  plus four schema field additions.
- `src/sim/state/defaults.ts` — three day-zero seeding sites extended.
- `src/sim/state/migrations.ts` — four new sweeps + helpers in
  `ensureCastAttributes`.
- `src/sim/core/rng.ts` — three new `RngStreamId` literals + entries
  in `ALL_STREAM_IDS`.
- `src/sim/content/npc/npcFactory.ts` — `createNotableNpc` rolls
  `castAttributes` after the name roll.
- `src/cards/compose/conditions.ts` —
  `resolveActorCastAttributes` widened to five new ref kinds; comment
  refreshed.
- `docs/ISSUE_TRACKER.md` — ISSUE-097 registered in the index and
  full entry added; `done` at phase 128.

## Verification

- `npm test -- phase128` — 39 passing (23 + 8 + 8) across the three
  Phase-128 files.
- `npm test -- phase121` — 13 passing; staff + regular
  `castAttributes` byte-identical to pre-Phase-2.
- `npm test` — full suite green (verified ahead of commit).
- `npm run typecheck` — clean.

## Out of scope (did not do)

- No snippets authored. Phase 2 enables Phase 3's establishing-line
  spike (supplier-led); it does not write prose.
- No new voice axes.
- No widening of `CULTURE_VOICE_DEFAULTS`.
- No specialty/blindspot/affinities on customer groups (voice-only
  by design).
- No rewrite of supplier / faction / customer / NPC modules.
- No `Math.random()` anywhere; all new identity rolls go through named
  RNG streams.
- No changes to existing Phase-A factories or call sites.
- No `EntityRef` union widening (the four new ref kinds already
  existed).
- No migration version bump or version-keyed migration framework;
  Phase 2 follows Phase A's optional-field + `ensure*` helper pattern.
