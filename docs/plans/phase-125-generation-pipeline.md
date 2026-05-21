# Phase 125 — Generation Pipeline (Living Cast arc, Phase E)

> Implements Phase E of [`living-cast-arc.md`](./living-cast-arc.md).
> Tracker entry: `ISSUE-094` in [`docs/ISSUE_TRACKER.md`](../ISSUE_TRACKER.md).
> Locked contracts honoured:
> [`card-composition-framework.md §7`](./card-composition-framework.md),
> [`living-cast-arc-phase-b.md`](./living-cast-arc-phase-b.md) (spec format is FIXED),
> Phase D's gate library at `src/cards/compose/gates/runAllGates.ts`.

## Context — why this change

Phases A (ISSUE-090), C (ISSUE-092), and D (ISSUE-093) are merged. The
composition runtime renders deterministic cards from committed
`SnippetPool` data; the six structural gates run on those pools as a
callable library that exposes `runAllGates(template, config)` — exactly
the surface Phase E imports.

Phase B is a hand-authored convergence artifact at
`docs/plans/living-cast-arc-phase-b.md`. It locks the **spec format**
(YAML with `templateId`, `voiceRegister`, `slots[]`, `voiceAxesInPlay`,
`verbalTicsCovered`, `allowedTargets`, `mustNotInvent`, `hardBounds`,
`gradientPolicy`, `positiveExemplars`, `negativeExamples`,
`snippetPools`, `diversityCases`, `mustPass`) and proves convergence on
`drink_order`. Phase B is **not** Claude Code work and must not be
redesigned here.

Phase E is the build-time loop: spec in → model generates → gates run →
failures retry → near-duplicates prune → committed `SnippetPool` TS file
out. Runs as a GitHub Action that opens a PR. The boundary between
non-determinism (generation) and determinism (runtime selection) is the
committed `.ts` file: once a pool lands, the assembler reads it as
plain data and the runtime stays byte-stable.

This phase **only adds** code under `scripts/generate-pool/`, committed
YAML under `specs/cards/`, tests under `tests/cards/compose/pipeline/`,
and one GitHub Action workflow. No `src/sim/` change, no
`src/cards/compose/` behavioural change, no DSL primitive added. The
Anthropic SDK lands as a dependency but only `scripts/` imports it —
`src/sim/` and `web/` stay clean.

## Locked decisions

| Question | Decision |
|---|---|
| Where does the pipeline live? | `scripts/generate-pool/` — outside the sim contract (which forbids `Math.random`, network, etc.). `scripts/` already holds non-runtime tooling (`run-tests.mjs`, `diagnose*.ts`). The Anthropic SDK is only imported here; the Vite build never sees it. |
| Where does the Phase-B spec live as a real file? | `specs/cards/drink_order.spec.yaml`. New top-level `specs/` dir signals "build-time inputs, not runtime data." Content is the YAML blocks lifted verbatim from `living-cast-arc-phase-b.md`. |
| Spec parser | New `yaml` dep + Zod schema (`zod` already a dep). Schema is **structural only**; the gates validate prose. Unknown keys reject. |
| Generation granularity | **One slot at a time, all candidates in a single call.** Per-slot prompt cleanly maps spec → output and lets retries target one slot. `drink_order` = two API calls per run (plus retries). |
| Model | `claude-sonnet-4-6` (Sonnet 4.6). Cheap enough for retry loops, smart enough for in-voice prose. Configurable via `--model` flag. |
| Prompt caching | Spec section + exemplars cached across retries (and across slots within a run) via `cache_control: { type: 'ephemeral' }`. Retry feedback (violations) goes in the uncached tail. |
| API key | `ANTHROPIC_API_KEY` env var. **User adds the repo secret before first workflow run.** Pipeline aborts at startup if absent. Never committed, never logged. |
| Where do generated pools land? | **Directly at `src/cards/compose/pools/<templateId>/<slotId>.ts`** — overwriting Phase B's hand-authored pools. PR shows the diff; user reviews and merges. Single source of truth; no sidecar/`_generated/` indirection. |
| Determinism boundary | The committed `.ts` pool file. Generation is non-deterministic at build time; runtime is deterministic. Emitter sorts snippets by `(specificity, id)` ascending so identical model output produces a byte-identical file. |
| Dedupe | Canonicalised text (lowercase, strip `[.,!?—–\-:;"'()]`, collapse whitespace) + normalised Levenshtein similarity ≥ **0.85**. Justified against existing 17-snippet `order_line` pool — no existing pair triggers. On near-duplicate: higher specificity wins; on tie, lex-smaller id. |
| Retry budget | 3 attempts per slot. Retries receive `GateViolation[]` + dedupe rejections in plain text. After 3 failures, script exits non-zero; workflow surfaces a failed Action. |
| CI trigger | `workflow_dispatch` only (manual). No auto-trigger on spec changes — keeps model spend deliberate. |
| Sim-coherence config | `representativeBannedNames(createInitialTavernState())` — same helper Phase D uses. Lifted from `tests/cards/compose/gates/samplers.ts` into `src/cards/compose/gates/representativeBannedNames.ts` so the pipeline can import it without reaching into `tests/`. |
| Network in tests | **Forbidden.** Tests inject a mock `generateCompletion`. The CI `test` job never sets `ANTHROPIC_API_KEY`. Only the dedicated `generate-pool` workflow does. |
| `Math.random()`? | Not used. `scripts/` is outside the sim contract; even so, no randomised inner step exists — dedupe and gates are deterministic given model output. |

## Files

### New — spec

- `specs/cards/drink_order.spec.yaml` — verbatim Phase-B YAML
  (top-level keys + `positiveExemplars` + `negativeExamples` +
  `snippetPools` + `diversityCases` + `mustPass`). Header comment
  cross-links to the doc.

### New — pipeline (`scripts/generate-pool/`)

- `cli.ts` — entry. Flags: `--spec`, `--model`, `--max-retries`,
  `--dry-run`. Calls stages in order, exits non-zero on failure.
- `loadSpec.ts` — reads YAML → Zod → typed `GenerationSpec`.
- `specSchema.ts` — Zod schemas for the Phase-B spec shape. Disabled
  slots (`status: 'DISABLED_FOR_SPIKE'`) are a first-class case;
  pipeline skips them.
- `buildPrompt.ts` — pure `(spec, slotId, retryContext?) → { system,
  messages }`. Cache breakpoint after exemplars; retry context appends
  in the uncached tail.
- `callModel.ts` — thin Anthropic SDK wrapper. Reads
  `ANTHROPIC_API_KEY` from env; fail-fast if missing.
- `parseModelOutput.ts` — model text (a fenced YAML block matching
  `snippets[]`) → `Snippet[]` or structured `ParseError` with line info.
- `runGates.ts` — adapter: wraps the candidate `Snippet[]` in a minimal
  `CompositionalCardTemplate`, calls `runAllGates`, returns
  `AllGatesReport`. Diversity sampler reused from
  `tests/cards/compose/gates/samplers.ts`.
- `retryLoop.ts` — orchestrates parse + gate + dedupe with the retry
  budget. Re-uses cached prompt prefix.
- `dedupe.ts` — pure: `dedupePool(snippets, threshold = 0.85)`.
  Within-slot near-dup; cross-slot canonical-equality only.
- `levenshtein.ts` — ~25-line DP implementation; no new dep.
- `emitPool.ts` — pure: `(slotId, snippets) → string` rendering a `.ts`
  file matching the existing `orderLine.ts` shape (header comment,
  `import type { SnippetPool }`, sorted by `(specificity, id)`).
- `writePoolFiles.ts` — the only side-effecting module. Writes into
  `src/cards/compose/pools/<templateId>/`.
- `types.ts` — pipeline-local types.
- `index.ts` — re-exports + high-level `runPipeline(spec, opts)` for
  tests.

### New — production helper (lifted from test code)

- `src/cards/compose/gates/representativeBannedNames.ts` — moved from
  `tests/cards/compose/gates/samplers.ts`. Test file re-exports for
  backwards-compat.

### New — tests (`tests/cards/compose/pipeline/`)

- `loadSpec.test.ts` — real `drink_order.spec.yaml` parses; unknown
  keys reject; disabled-slot handling.
- `buildPrompt.test.ts` — snapshot on the `order_line` prompt; cache
  breakpoint placement; retry context appends correctly.
- `parseModelOutput.test.ts` — happy path, bad fence, bad YAML, missing
  fields, unknown condition `kind`.
- `dedupe.test.ts` — real `orderLinePool` produces zero false positives
  at 0.85; planted near-dups trip; cross-slot canonical-equality case.
- `runGates.test.ts` — real `orderLinePool` clears all six gates
  through the adapter; planted bad snippets fail the expected gate.
- `retryLoop.test.ts` — injected mock `generateCompletion`. Sequences:
  invalid-then-valid → accepted; 3-invalid → structured failure;
  dedupe rejection → next retry sees the rejection in feedback.
- `emitPool.test.ts` — golden file: emit known `Snippet[]`, assert
  byte-equal `.ts`. Round-trip: dynamic `import()` the emitted file,
  assert `SnippetPool` equality.
- `integration.test.ts` — **convergence proof.** Loads
  `specs/cards/drink_order.spec.yaml`, threads a recorded fixture
  response as the mocked `generateCompletion`, runs the full pipeline,
  asserts the emitted pool clears `runAllGates`.

### New — GitHub Action

- `.github/workflows/generate-pool.yml` — `workflow_dispatch` only
  (with `spec` input, default `specs/cards/drink_order.spec.yaml`).
  Uses `actions/checkout@v4` + `actions/setup-node@v4` (matches
  `deploy.yml`). `npm ci`, then `npm run generate-pool -- --spec
  ${{ inputs.spec }}`. Env: `ANTHROPIC_API_KEY: ${{
  secrets.ANTHROPIC_API_KEY }}`. On success: opens a PR via
  `peter-evans/create-pull-request@v6`. Permissions: `contents: write,
  pull-requests: write`.

### Edits

- `package.json` — add deps `@anthropic-ai/sdk`, `yaml`; devDep `tsx`;
  script `"generate-pool": "tsx scripts/generate-pool/cli.ts"`.
- `docs/ISSUE_TRACKER.md` — index row for ISSUE-094 + full entry;
  update "Current work" §.
- `CLAUDE.md` — one-line Phase E note in the status paragraph.

## Verification matrix

| Check | How | Expected |
|---|---|---|
| Types | `npm run typecheck` | Clean. |
| Pipeline tests | `npm test -- --run tests/cards/compose/pipeline/` | All pass; SDK never called with a real key. |
| Full regression | `npm test -- --run` | No regressions. Phase D's 28 gate tests, Phase C runtime tests, sim tests stay green. |
| Spec round-trip | `loadSpec.test.ts` | `drink_order.spec.yaml` parses. |
| Convergence proof | `pipeline/integration.test.ts` | Fixture response → emitted pool clears `runAllGates`; emitted file matches snapshot; round-trip import yields the input `Snippet[]`. |
| Browser bundle clean | `npm run build` then inspect `dist/` | `@anthropic-ai/sdk` not in the bundle. |
| CI workflow | manual `gh workflow run generate-pool.yml` after secret set | Action completes; PR opens with regenerated pool files. |

## Do not do

- Do not redesign the Phase-B spec format.
- Do not expand the DSL primitives.
- Do not import the Anthropic SDK from `src/sim/` or `web/`.
- Do not use `Math.random()`.
- Do not call the API in tests/CI test job.
- Do not commit `ANTHROPIC_API_KEY` or echo it.
- Do not build an authoring GUI.
- Do not introduce a runtime voice transformer.
- Do not re-enable `sim_backed_hook` — spec carries it as `DISABLED_FOR_SPIKE`; pipeline skips it.

## Expected loop

Phase F reuses the pipeline as-is: each new situation gets a spec under
`specs/cards/<situation>.spec.yaml`, the workflow runs, the user
reviews the PR. No pipeline changes expected. If Phase F surfaces a
concrete gap (e.g. per-snippet `claims` metadata), that's a spec
amendment then, not a Phase E concern.
