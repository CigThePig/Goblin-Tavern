import { defineConfig, configDefaults } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

// Test-suite tiers (test-suite-timeout work). The full suite is gated by a
// handful of long-running multi-day playtest/simulation files — `phase20`
// alone runs ~349s serial in a single worker and single-handedly sets the
// wall-clock floor (~6 min). That is fine for a deliberate pre-merge run but
// too slow to run on every change, and in a remote (web) session a 6-minute
// run sits close to the foreground execution budget.
//
// `TEST_TIER` (set by the npm scripts via scripts/run-tests.mjs) splits the
// suite without touching any test content:
//   - `fast`  → everything EXCEPT the heavy files below (~1 min). The default
//               `npm test`; safe to run on every change.
//   - `heavy` → ONLY the heavy files. `npm run test:heavy`.
//   - `all`   → the complete suite. `npm run test:full`; also the default
//               when TEST_TIER is unset, so a bare `vitest run` stays complete.
//
// HEAVY_TEST_GLOBS is the single source of truth for the split — keep it here
// and nowhere else. When a file grows into a multi-minute playtest, add it.
const HEAVY_TEST_GLOBS = [
  'tests/sim/phase20.cardlessPlaytest.test.ts',
  'tests/sim/phase40.expandedReadiness.test.ts',
  'tests/sim/phase91.monthlyPersistence.test.ts',
  'tests/reports/monthlyOverviewProjection.test.ts',
]

const TIER = process.env.TEST_TIER ?? 'all'

const include = TIER === 'heavy' ? HEAVY_TEST_GLOBS : ['tests/**/*.test.ts']
const exclude =
  TIER === 'fast'
    ? [...configDefaults.exclude, ...HEAVY_TEST_GLOBS]
    : configDefaults.exclude

export default defineConfig({
  // Phase 97 / ISSUE-057 — `svelteTesting()` adds the `browser` resolve
  // condition so Svelte's client-side mount() is used in tests (the
  // SSR build throws "mount(...) is not available on the server").
  plugins: [svelte({ hot: false }), svelteTesting()],
  test: {
    include,
    exclude,
    // Tier 2 follow-up (docs/plans/phase-53-59-tier2-followups.md):
    // phase20 and phase40 call runMonths repeatedly and retain a full
    // per-day CardlessRunResult per test, which accumulates against
    // vitest's default thread worker and eventually OOMs the worker
    // (~6+ GB RSS before the run finishes). Routing just those files
    // into the forks pool with isolation gives each test its own
    // process heap that the OS reclaims between tests; the rest of
    // the suite stays on the faster default threads pool.
    poolMatchGlobs: [
      [
        // Phase 167 / ISSUE-135 — `faithfulness.test.ts` drives
        // runCardlessSim across four bots like phase20, so it belongs in
        // the isolated forks pool for its own reclaimable process heap.
        '**/{phase20.cardlessPlaytest,phase40.expandedReadiness,faithfulness}.test.ts',
        'forks',
      ],
    ],
    poolOptions: {
      forks: { isolate: true },
    },
    // Phase 97 / ISSUE-057 — Svelte component tests need a DOM. Route
    // anything under tests/web/components/ through jsdom; everything else
    // stays on the faster node default. `environmentMatchGlobs` is the
    // vitest 1.x API; renames in vitest 3.x — flag at upgrade time.
    environmentMatchGlobs: [['tests/web/components/**/*.test.ts', 'jsdom']],
  },
})
