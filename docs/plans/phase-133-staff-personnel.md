# Phase 133 — Voiced Surface arc, Phase 7: Staff & Personnel cluster

**ISSUE-102.** First Movement II migration of the [Voiced Surface arc](voiced-surface-arc.md). Reads the arc's per-cluster standing prompt; runs the Phase-4 ([ISSUE-099](../ISSUE_TRACKER.md#issue-099--voiced-surface-phase-4-retire-the-build-time-api-pipeline-document-the-claude-code-authoring-loop)) authoring loop end-to-end on the staff card surface.

---

## Context

The staff card layer carried two problems the arc was built to kill:

1. **`staffAside`** (compositional since [ISSUE-095](../ISSUE_TRACKER.md#issue-095--living-cast-arc-phase-f-first-situation-staff_aside), Phase 126) was flavor-only. Its body composed the staff member's pre-shift mood through `aside_line` and `manner_note`, then **appended a raw `seed.textIngredients.sensoryDetails[0]` fragment as "grounding"** (`staffAside.ts:151-155` pre-Phase-7) — the "dangling fragment" the arc names as a symptom. The card voiced *how* the staff member felt, but said nothing about *what was going on with them* (stress, fatigue, rising burnout, prior owner slight).
2. **`staffRequest`** (hand-written, `src/cards/templates/staffRequest.ts`) was the closing-time staff burnout card. It hand-glued a meter line (`morale ${m}, stress ${s}`), an opinion, and a context fragment through the legacy `composeBody` — no voice, no sim-backed claims, no specificity gradient. **And its `timings: ['closing']` declaration never matched the real seed** — `issueSeedGenerators.ts:1153` emits `staff_burnout / staff_request` at `morning_prep`. The template was dead code in production; staff_burnout seeds were falling through to the fallback card.

Phase 7 finishes both — the staffAside body becomes `[establishing_line (sim-backed), aside_line (flavor), manner_note? (flavor)]`, and a new `staffBurnoutCard` compositional template handles the staff_burnout family with the correct timing.

The two compositional templates partition the staff seed surface cleanly:

| Template | Family | Type | Timing |
|---|---|---|---|
| `staffAsideCard` | `staff_identity` | `relationship_test` | `morning_prep` |
| `staffBurnoutCard` | `staff_burnout` | `staff_request` | `morning_prep` |

No overlap, no priority race.

---

## Scope delivered

### Spec changes (design records)

- **New** `specs/cards/staff_burnout.spec.yaml` — full Phase-7 spec including establishing-line pattern, voiceAxesInPlay, verbalTicsCovered, simSignalsInUse, hardBounds, positive exemplars, negative examples (including the legacy template's meter-line shape as a negative), snippet pools convergence record, mustPass criteria, loopback section.
- **Modified** `specs/cards/staff_aside.spec.yaml` — added `simSignalsInUse` block, new `establishing_line` slot block (claims: sim-backed, maxWords: 14), new snippet pool entry, expanded `mustPass.simCoherence` / `voiceBounds` / `diversity` / new `dedupe` rules, loopback section recording no Phase-1 gaps surfaced. Status bumped to `phase_7_voiced_surface_arc_complete`.

### Code changes

- **New** `src/cards/compose/pools/staffAside/establishingLine.ts` (11 snippets — 1 fallback + 8 single-condition + 2 two-condition).
- **Modified** `src/cards/compose/pools/staffAside/index.ts` — re-export the new pool as `staffAsideEstablishingLinePool`.
- **Modified** `src/cards/templates/staffAside.ts` — added the `establishing_line` slot (`role: 'utterance'`, `wordBudget: 14`, `claimMode: 'sim_backed'`, required); rewrote `buildStaffAsideBody` to consume `[establishing_line, aside_line, manner_note]` and dropped the textIngredients grounding fragment. Updated header comments to reference Phase 7.
- **New** `src/cards/templates/staffBurnout.ts` — `staffBurnoutTemplate` (id `staff_burnout.staff_request`, priority 65, voice register `staff_quarters`, four slots) + `staffBurnoutCard` (the `defineCompositionalCard` wrapper).
- **New** `src/cards/compose/pools/staffBurnout/{title,establishingLine,reactionLine,mannerNote,choiceLabel,effectPreview,index}.ts` (six pool files + barrel).
- **Modified** `src/cards/templates/index.ts` — swapped `staffRequestCard` for `staffBurnoutCard` (import, REQUIRED_CARDS array, re-export).
- **Modified** `src/cards/index.ts` — swapped `staffRequestCard` for `staffBurnoutCard` in the public re-export.
- **Deleted** `src/cards/templates/staffRequest.ts`.

### Test changes

- **New** `tests/cards/templates.staffBurnout.test.ts` — 15 integration tests mirroring `tests/cards/templates.staffAside.test.ts`. Covers appliesTo (positive, negative, cast-missing, no-overlap with staffAside), render output (body[0] sim-backed, body[1] voiced reaction, never-leak-textIngredients, title no-truncation + no-duplication, fallback behaviour, two-axis snippet selection, choice mechanical equivalence, tags/severity flow, determinism, no-mutation), voice variance across three profiles.
- **Modified** `tests/cards/templates.staffAside.test.ts` — body[0] / body[1] assertions reflect the new establishing-line-first body shape; added "never raw fragment" regression test; voice-variance test now checks body[1] rather than body[0]; updated fallback / two-axis / tic assertions.
- **Modified** `tests/cards/templates.test.ts` — Template 5 block migrates from `staffRequestCard` to `staffBurnoutCard`; `staffSeed` helper's timing corrected from `closing` to `morning_prep`.
- **Modified** `tests/cards/templates.voice.test.ts` — staffRequestCard voice block migrates to staffBurnoutCard; timing corrected.
- **Modified** `tests/cards/compose/gates/runAllGates.test.ts` — staffAsideTemplate block adds `establishing_line` to its diversity config (minDistinct: 1 — voice perturbation doesn't vary signal state); new `staffBurnoutTemplate` block exercises every gate against the new template with the new samplers.
- **Modified** `tests/cards/compose/gates/samplers.ts` — new `buildStaffBurnoutDeterminismSamples` and `buildStaffBurnoutDiversitySampler`.

### Bootstrap + PR #108 regression fixes (folded into same branch)

Three things broke since PR #108 that the first clean-baseline run surfaced. The arc's Phase 4 authoring loop can't iterate without these working, so they ship in this phase's prep commit (`395d883`):

- **New** `.claude/settings.json` + `.claude/hooks/session-start.sh` — `SessionStart` hook runs `npm install --no-audit --no-fund` on each fresh cloud session (gated on `CLAUDE_CODE_REMOTE`). Idempotent on warm containers.
- **Modified** `tests/cards/compose/phase132.responseConditions.test.ts` — typecheck error: `seedFamily.anyOf` got passed `string[]` because `IssueSeed.family` is typed `IssueSeedFamilyId | string`. Fixed via cast + new import.
- **Modified** `web/src/lib/cards/CardRenderer.svelte` — two `{#each}` blocks (`card.body`, `c.previewEffects`) used the rendered string as the key. Svelte 5 rejects duplicate keys at runtime; Phase 6's composed previews can legitimately produce the same text for two effects of the same choice. Switched both keys to the iteration index.

---

## Out of scope (explicit)

- Other staff-adjacent surfaces (Reports tab, tavern log, weekly review) → Phases 14 / 15 / 16.
- Extending the signal surface — Phase 1 already shipped what staff snippets need. The Phase-1 plan flagged blame-mode / burnout-band as Phase-7 candidates; the authoring pass concluded neither is needed (see loopback in the staff_burnout spec).
- Migrating the seven other legacy templates — Phases 8–14.
- Touching `voice/composer.ts` or `voice/tonePools.ts` — Phase 16 retires them.

---

## Verification

- `npm test -- --run tests/cards/templates.staffBurnout.test.ts` — 15/15.
- `npm test -- --run tests/cards/templates.staffAside.test.ts` — 15/15 (14 updated + 1 new regression test).
- `npm test -- --run tests/cards/compose/gates/runAllGates.test.ts` — 7/7 (drinkOrder, staffAside, drinkOrder choice pools, staffAside choice pools, bad-template, staffBurnout NEW, and the bad-template inspector test). All seven gates green for both real compositional staff templates.
- `npm run typecheck` — clean.
- `npm test -- --run` — **1980 / 1980 across 163 files** (+17 vs. the post-bootstrap baseline of 1963/162).
- Structural: `grep -rn 'staffRequestCard\|staff_burnout.request.closing' src/ tests/ web/` returns only comment-references documenting what was superseded.
