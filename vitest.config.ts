import { defineConfig } from 'vitest/config'

export default defineConfig({
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
        '**/{phase20.cardlessPlaytest,phase40.expandedReadiness}.test.ts',
        'forks',
      ],
    ],
    poolOptions: {
      forks: { isolate: true },
    },
  },
})
