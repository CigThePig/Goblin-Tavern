# Phase 204 — Gameplay audit, Wave 5: repair secondary surfaces and identity

Wave doc for `ISSUE-166` / Wave 5 of
`docs/audits/2026-07-26-gameplay-audit/REMEDIATION_QUEUE.md`. Depends on
Waves 0–4 (phases 199–203), all closed.

**Findings:** `P2-RT-002` (Med/P2), `P2-RT-003` (Med/P2), `P3-BHV-003`
(Low/P3), `P4-SEAM-005` (Low/P3), `P6-COMP-007` (Low/P3).

**Gate (Phase 8 §7):**

- R15 crosses every relevant root/detail/support surface without error;
- entity names and historical labels survive removal, close, next day and
  reload.

Wave 4's findings were one payload losing a field. Wave 5's are one step
further out: **surfaces asserting things the data does not guarantee.** A
keyed list assumed its keys were unique. A report assumed its target still
existed. Two projections assumed the same word meant the same thing. A
detail sheet assumed a stored id was English. In each case the surface was
right to want the guarantee and wrong to assume it — so the fix is to make
the guarantee real at the source, not to defend at the leaf.

---

## 1. Unique keys, guaranteed rather than assumed (`P2-RT-002`, `P2-RT-003`)

Two `each … (key)` blocks aborted their render on `each_key_duplicate`,
taking the whole glossary and the whole populated Tavern Log with them.
Both keys were reasonable; neither was enforced.

**The glossary had two `atmosphere` terms.** They are genuinely different
concepts — one is the tonal tags an *area* gives off (read by
`AreaDetailSheet`), the other is what the *tavern* feels like today (read
by `TavernIdentityStrip`) — and the two components each linked
`term="atmosphere"`, so one of them was already pointing at the wrong
definition before the duplicate crashed anything. The tavern-wide term
becomes `tavern_atmosphere` and its consumer follows it.

**The Tavern Log had rows with repeated tags.** `serviceModule` built
`['service', 'scene', scene.sceneType, ...scene.tags]` and `scene.tags`
already began with the scene type, so every service-scene row carried its
own type twice. The scenes deduplicate their own tag lists
(`dedupeStrings`); the composition around them did not.

Three layers, because each answers a different question:

- **`ctx.addHistory` deduplicates tags on write.** Every history entry in
  new state now has unique tags no matter which caller composed them —
  this is the actual guarantee the Log wanted.
- **`buildTavernLog` deduplicates on projection.** Saves written before
  this wave already hold duplicate tags; without this they would still
  crash on load, and Wave 0 made those saves survive.
- **Both `each` blocks key on something unique by construction.** The
  glossary keys on `category|id`, the Log's tag chips on `row.id|index`.
  A future duplicate becomes a cosmetic repeat rather than a dead screen.

The structural guard is a test that fails on a duplicate glossary id
directly, so the next collision is caught in CI rather than by a player.

## 2. Removal actions keep the name they acted on (`P3-BHV-003`)

`Fire Staff on Caravanmaster Willem Threepence` reported as
`Fired Staff · Hire kitchen hand 4 0 (2h)`, because
`resolveActionTargetLabel` resolves `targetId` against **post-action**
`state.staff` — and the whole point of the action is that the record is no
longer there. `humanizeId('hire_kitchen_hand_4_0')` is what a dead lookup
looks like.

The fix is general rather than per-action: `applyOwnerActionsHook` captures
the target's label from the definition's own `getValidTargets` **before**
calling `apply`, and stores it on `OwnerActionApplied.targetLabel`. That is
the same label the picker showed the player, it is captured while the
entity still exists, and it is immutable state from then on — so it
survives the removal, the day close, the next morning and a reload. The
report prefers it and falls back to live resolution for older saves.

This answers the audit's open question ("whether applied action records
should carry immutable display labels for other destructive/removal actions
too") with **yes, and for every action** — the capture costs one lookup and
removes the whole class of defect rather than the one instance found.

## 3. One age, one presence, for a local arc (`P4-SEAM-005`)

At month close a newly seeded arc read three ways: canonical state said
`seeded, ageDays 0`; the monthly overview said `seeded, ageDays 1`; the
Local Arcs report section said it did not exist.

- **Age.** The sim maintains `ageDays` on the record. The monthly overview
  ignored it and recomputed `totalDaysElapsed - startedDay`, which is one
  higher the moment the calendar advances past the creating day. The
  projection now reads the stored value — the sim is the source of truth
  (Core Design Rule), and a projection that re-derives a fact the sim
  already owns is how the two come to disagree.
- **Presence.** `listActiveArcs` means "counts against the arc cap"
  (`ACTIVE_ARC_STAGES` = rising/active/climax) — a mechanical predicate the
  engine uses for seeding decisions, which must not change. What the two
  player surfaces wanted is a different question: *is this arc in play?*
  `isPresentedArcStage` / `listPresentedArcs` answer it (anything
  non-terminal, so `seeded` included), and both the report section and the
  monthly overview use it. The engine's cap semantics are untouched.

**Worth knowing about the age now that it is shared:** `ageDays` advances
on the monthly tick, not daily — the arc engine's design is that "existing
arcs age by 28 days" at each tick — so a seeded arc reads `0d` for the
whole month it was created in and then jumps. That is coarse, and it is
now coarse *consistently*: the alternative on offer was the projection's
own daily count, which is what disagreed with everything else. If a finer
age is wanted it belongs in the arc engine, where both surfaces would pick
it up for free. No finding asks for one.

## 4. One vocabulary layer for player surfaces (`P6-COMP-007`)

The audit found `staff_arc`, `fumigate_cellar`, `cleanliness_negative`,
`risk_positive`, `merchant_sensitive`, `ogres_dismissed` and the phrase
"engine fallback" on default surfaces. All of them are real sim data; none
of them is English. The fix is a display-boundary vocabulary, never a
change to what the sim stores:

- `src/reports/labels/idLabel.ts` gains `seedFamily` and `mechanicalTag`
  categories, so the mapping lives beside every other id→label table
  rather than in whichever component happened to render it.
- The card corner tag renders the family's player label; the raw family id
  appears only under the new **`showDiagnostics`** preference (default
  off), which is also what the audit means by "keep raw IDs available only
  in a debug preference". `familyTag()` still returns `seed.family` — the
  sim's data is unchanged, only its rendering is.
- Area trait mechanical tags render as phrases ("makes the room dirtier")
  instead of hook names; unmapped tags fall back to `humanizeId` rather
  than the raw string.
- A memory with no authored label falls back to `humanizeId(id)`, so
  `ogres_dismissed` reads as "Ogres dismissed".
- The staff-priority hint no longer describes the engine to the player.

**Deliberately not done:** renaming any stored id, tag or family. Every
change here is at the render boundary, so the sim, the saves and the
card-composition conditions are untouched.

## 5. Regression coverage

Per Phase 8 §8, each finding is reproduced on its audit route before the
fix and asserted after:

- `tests/sim/phase204.wave5.identityAndSurfaces.test.ts` — unique glossary
  ids, history tag deduplication at write and projection, the immutable
  owner-action target label surviving a fire across close and reload, and
  the shared arc age/presence predicate across canonical state, the
  engine report and the monthly overview.
- `tests/web/phase204.wave5.vocabulary.test.ts` — the R15 surface sweep
  (every root/detail/support projection renders without throwing on a
  populated day), and a vocabulary scan asserting no default player
  surface emits a raw snake_case identifier.
