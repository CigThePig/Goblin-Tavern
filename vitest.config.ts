import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'

export default defineConfig({
  // Phase 97 / ISSUE-057 — `svelteTesting()` adds the `browser` resolve
  // condition so Svelte's client-side mount() is used in tests (the
  // SSR build throws "mount(...) is not available on the server").
  plugins: [svelte({ hot: false }), svelteTesting()],
  test: {
    include: ['tests/**/*.test.ts'],
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
