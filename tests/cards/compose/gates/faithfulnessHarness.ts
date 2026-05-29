// Phase 167 / ISSUE-135 — Faithful Surface arc, Phase 5 (Close the Loop).
//
// The production-shape sample source for `checkFaithfulness`. Where the
// per-template `legibilityHarness` builds synthetic per-template samplers,
// this harness drives the REAL simulation: it runs `runCardlessSim` across
// several policy bots for a few in-game months, then renders every emitted
// seed through the SAME `pickCard` entry point the web UI uses. The result
// is `FAITHFULNESS_SAMPLES` — a flat list of `{ seed, state, cardView }`
// the player would actually have seen.
//
// Determinism: `runCardlessSim` is seeded and `pickCard` is pure over
// `(seed, state)`, so the sample list is identical on every import. It is
// memoised at module load — the live test, the canary, and the determinism
// test all share one build.
//
// Memory: this is the same machinery that makes `phase20.cardlessPlaytest`
// memory-heavy (a full `CardlessRunResult` retains every day's
// `stateBefore` + `SimResult`). We bound peak memory two ways: (1) run ONE
// bot at a time and let each heavy run go out of scope before the next, and
// (2) keep only the minimal `{ seed, state, cardView }` per card — never a
// reference to the `SimResult.reports` or the day record — so the heavy
// per-day payload is GC-eligible once the run is dropped. The test is routed
// to vitest's forks/isolated pool (see `vitest.config.ts`) so it gets its
// own process heap.

import { getPolicyBot, type PolicyBotId } from '../../../../src/sim/testing/policyBots'
import { runCardlessSim } from '../../../../src/sim/testing/simRunner'
import type { DayInputChooser } from '../../../../src/sim/testing/simRunner'
import { getIssueSeeds } from '../../../../src/sim/modules/issues/issueSeedQueries'
import { pickCard, cardRegistry } from '../../../../src/cards/registry'
import { pickCardForSeed } from '../../../../src/cards/selection'
import { FALLBACK_CARD_ID } from '../../../../src/cards/templates/index'
import type { ResponseIntent } from '../../../../src/sim/modules/issues/issueSeedTypes'
import type { FaithfulnessSample } from '../../../../src/cards/compose/gates/faithfulness'

/** The four bots driving the audit. Chosen to push state across the full
 *  band range the rules need: `auto_ignore_repairs` lets stress / area
 *  damage / pressures fester into the `high` band (rule a + d distressed
 *  side); `auto_staff_friendly` + `auto_clean_focused` keep meters in the
 *  `low` band (rule d calm side); `auto_profit_focused` diverges the
 *  economy. All four define `chooseResponse`, so seeds get resolved rather
 *  than piling up uniformly. */
const AUDIT_BOTS: readonly PolicyBotId[] = [
  'auto_clean_focused',
  'auto_profit_focused',
  'auto_staff_friendly',
  'auto_ignore_repairs',
]

/** ~3 in-game months per bot. 4 bots × 84 days at the normal seed-emission
 *  rate lands comfortably in the 2,000–3,000-card range the standing audit
 *  targets (the original ad-hoc audit was 2,578). */
const DAYS_PER_BOT = 84

/** Build the per-day chooser for a bot: take its owner actions + staff
 *  priorities, and resolve yesterday's seeds (carried in
 *  `state.modules.issueSeeds.seedsToday`) through its `chooseResponse` so
 *  pressures move through bands instead of saturating. */
function chooserFor(botId: PolicyBotId): DayInputChooser {
  const bot = getPolicyBot(botId)
  return (state) => {
    const responseIntents: ResponseIntent[] = []
    if (bot.chooseResponse) {
      for (const seed of getIssueSeeds(state, {})) {
        const intent = bot.chooseResponse(state, seed)
        if (intent) responseIntents.push(intent)
      }
    }
    return {
      ownerActions: [...bot.chooseActions(state)],
      ...(bot.chooseStaffPriorities
        ? { staffPriorities: bot.chooseStaffPriorities(state) }
        : {}),
      ...(responseIntents.length > 0 ? { responseIntents } : {}),
    }
  }
}

function buildFaithfulnessSamples(): FaithfulnessSample[] {
  const samples: FaithfulnessSample[] = []
  const candidates = cardRegistry.all()

  for (const botId of AUDIT_BOTS) {
    // One bot at a time. `run` is reassigned each iteration, so the prior
    // bot's heavy CardlessRunResult is GC-eligible before the next starts.
    const run = runCardlessSim({
      seed: `faithful-surface-phase5-${botId}`,
      days: DAYS_PER_BOT,
      chooseInput: chooserFor(botId),
    })

    for (const record of run.days) {
      // The seeds emitted this day live in the post-day state — render each
      // against that same state (the bands that back any fired flavor are
      // the state the card was shown against).
      const state = record.result.state
      for (const seed of getIssueSeeds(state, {})) {
        // Skip seeds that route to the fallback card — the four rules
        // target the 20 migrated compositional templates.
        const chosen = pickCardForSeed(seed, state, candidates)
        if (!chosen || chosen.id === FALLBACK_CARD_ID) continue
        // Minimal sample: seed + state + rendered view. No reference to the
        // day record or the SimResult.reports payload.
        samples.push({ seed, state, cardView: pickCard(seed, state) })
      }
    }
  }

  return samples
}

/** Memoised production-shape sample set, built once at import. */
export const FAITHFULNESS_SAMPLES: readonly FaithfulnessSample[] =
  buildFaithfulnessSamples()
