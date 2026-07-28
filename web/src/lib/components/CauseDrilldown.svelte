<!--
  CauseDrilldown — bottom sheet showing the causes that contributed to
  a given diff path or pressure id on the day just closed.

  Reads `state.causes` via the projection helper. The list is already
  filtered to today's absolute day and sorted by weight desc.
-->
<script lang="ts">
  import BottomSheet from './BottomSheet.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import {
    causeShareOfChange,
    describeShare,
    humanizeCauseEntities,
    humanizeCauseReadable,
  } from '../../../../src/reports/labels/causePresentation'
  import {
    causesForPath,
    formatDiffPathTitle,
    buildPressureConsequenceLines,
  } from '../../../../src/reports/index'
  import type { CauseEntry } from '../../../../src/sim/state/TavernState'
  import { safeProject, type ProjectionSlot } from '../sim/projectionSlot'
  import { planActionCtaForPath } from '../sim/planActionCta'

  let {
    open,
    path,
    onclose,
  }: {
    open: boolean
    /** Diff path (e.g. `reputation.tasty`) or pressure path (`pressures.<id>`). */
    path: string | undefined
    onclose: () => void
  } = $props()

  const title = $derived(path ? formatDiffPathTitle(path) : '')

  // Phase 191 — when this drilldown is for a pressure (`pressures.<id>`),
  // surface the sim's own "if ignored" consequence line(s) as a header
  // callout. Silent for non-pressure paths and for pressures below their
  // danger band (no authored consequences).
  const consequences = $derived.by(() => {
    if (!path || !path.startsWith('pressures.')) return []
    const pressureId = path.slice('pressures.'.length)
    if (!pressureId) return []
    return buildPressureConsequenceLines(pressureId, gameStore.state)
  })
  // Phase 120 / ISSUE-059 — Wrap the cross-module cause lookup so a
  // throw renders an in-sheet "unavailable" panel instead of bubbling
  // through the App-level boundary and unmounting the whole reports
  // surface beneath it.
  const causesSlot: ProjectionSlot<CauseEntry[]> = $derived.by(() => {
    if (!path) return { ok: 'empty' }
    return safeProject(() => causesForPath(gameStore.state, path, { limit: 10 }))
  })
  const causes = $derived(causesSlot.ok === 'success' ? causesSlot.data : [])

  // The weight bar uses the maximum weight in the list as 100% so the
  // visual is relative — even small absolute weights look meaningful
  // when they're the dominant cause that day.
  const maxWeight = $derived(causes.reduce((m, c) => Math.max(m, c.weight), 1))

  function weightPct(c: CauseEntry): number {
    return Math.max(4, Math.min(100, (c.weight / maxWeight) * 100))
  }

  function directionMark(dir: CauseEntry['direction']): string {
    if (dir === 'increase') return '+'
    if (dir === 'decrease') return '−'
    return '·'
  }

  // Phase 202 / audit Wave 3 (`P6-COMP-003`) — this rendered raw
  // `kind/id` pairs. Names, not references.
  function actorLabel(c: CauseEntry): string {
    return humanizeCauseEntities(gameStore.state, c).join(', ')
  }

  // Phase 195 / ISSUE-162 — close the loop from insight to action. When an
  // owner action relieves what this drilldown is showing, surface a CTA
  // that routes to Day, forces the plan beat, and opens the ActionPicker
  // with the right tab (and the Suggested section in view when the source
  // is in its danger band). When nothing maps, `cta` is undefined and no
  // button renders — silence over a dead affordance (acceptance #6).
  const cta = $derived(planActionCtaForPath(path, gameStore.state))

  function planAction() {
    if (!cta) return
    // Close this sheet first so the player lands on the plan beat cleanly,
    // then hand the context to the Day screen via the store.
    onclose()
    // Phase 203 / audit Wave 4 (`P7-EXP-006`) — the target the drilldown is
    // about rides along, so the picker opens on it rather than making the
    // player rediscover it in a global list.
    gameStore.requestActionPicker({
      planBeat: true,
      tab: cta.tab,
      focusSuggested: cta.focusSuggested,
      ...(cta.preferredTargetId
        ? { preferredTargetId: cta.preferredTargetId }
        : {}),
      ...(cta.preferredTargetLabel
        ? { preferredTargetLabel: cta.preferredTargetLabel }
        : {}),
      ...(title ? { reason: title } : {}),
    })
  }
</script>

<BottomSheet {open} {title} {onclose}>
  {#if consequences.length > 0}
    <div class="stakes" data-testid="pressure-stakes">
      <p class="stakes-label">If ignored</p>
      {#each consequences as line (line)}
        <p class="stakes-line">{line}</p>
      {/each}
    </div>
  {/if}
  {#if !path}
    <p class="quiet">no path selected</p>
  {:else if causesSlot.ok === 'error'}
    <div class="cause-error" role="alert">
      <p class="cause-error-title">Causes unavailable</p>
      <p class="cause-error-message mono">{causesSlot.error}</p>
    </div>
  {:else if causes.length === 0}
    <p class="quiet">no causes recorded for this change today.</p>
  {:else}
    <ul class="cause-list">
      {#each causes as cause (cause.id)}
        <li class="cause">
          <div class="cause-head">
            <span class="mark" data-dir={cause.direction}>{directionMark(cause.direction)}</span>
            <span class="readable">{humanizeCauseReadable(gameStore.state, cause)}</span>
            <span class="amount mono" data-dir={cause.direction}>
              {cause.amount > 0 ? '+' : ''}{cause.amount}
            </span>
          </div>
          <div class="weight-track">
            <div class="weight-fill" style="width: {weightPct(cause)}%"></div>
          </div>
          <div class="cause-meta tag">
            <!-- Phase 202 / audit Wave 3 — `weight 72` meant nothing to a
                 player; a share of the change means something. -->
            <span>{describeShare(causeShareOfChange(cause, causes))}</span>
            {#if actorLabel(cause)}
              <span>· {actorLabel(cause)}</span>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if cta}
    <!-- Phase 195 / ISSUE-162 — Reports → Action conversion. -->
    <button
      class="plan-cta"
      type="button"
      data-testid="plan-action-cta"
      onclick={planAction}
    >
      Plan an action against this
      <span class="plan-cta-arrow" aria-hidden="true">→</span>
    </button>
  {/if}
</BottomSheet>

<style>
  .quiet {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-lg) 0;
  }

  /* Phase 191 — pressure-stakes header callout. Sized between
     `.section-label` and body; subtle border, `--text` colour. */
  .stakes {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: var(--sp-sm);
    padding: var(--sp-sm);
    border: 1px solid color-mix(in srgb, var(--risk) 45%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--risk) 7%, transparent);
  }
  .stakes-label {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .stakes-line {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--text);
  }

  .cause-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
  }

  .cause {
    background: var(--bg);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
    padding: var(--sp-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .cause-head {
    display: grid;
    grid-template-columns: 16px 1fr auto;
    gap: var(--sp-xs);
    align-items: baseline;
  }

  .mark {
    font-family: var(--font-mono);
    text-align: center;
  }

  .mark[data-dir='increase'] {
    color: var(--gain);
  }
  .mark[data-dir='decrease'] {
    color: var(--loss);
  }
  .mark[data-dir='neutral'] {
    color: var(--text-faint);
  }

  .readable {
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.4;
  }

  .amount {
    color: var(--text-dim);
  }

  .amount[data-dir='increase'] {
    color: var(--gain);
  }
  .amount[data-dir='decrease'] {
    color: var(--loss);
  }

  .weight-track {
    height: 3px;
    background: color-mix(in srgb, var(--text) 18%, transparent);
    border-radius: 2px;
    overflow: hidden;
  }

  .weight-fill {
    height: 100%;
    background: var(--candle-soft);
    border-radius: 2px;
    transition: width var(--m-base) var(--ease);
  }

  .cause-meta {
    color: var(--text-faint);
    display: flex;
    gap: var(--sp-xs);
  }

  /* Phase 195 / ISSUE-162 — insight → action CTA. Full-width, sits below
     the cause list; mirrors the DayScreen primary affordance so it reads
     as "do something about this". */
  .plan-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-top: var(--sp-md);
    padding: 12px;
    min-height: 44px;
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-size: 13px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: background var(--m-fast) var(--ease);
  }

  .plan-cta:hover,
  .plan-cta:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .plan-cta-arrow {
    color: var(--accent-soft);
  }

  /* Phase 120 / ISSUE-059 — projection failure fallback. */
  .cause-error {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-md);
    background: color-mix(in srgb, var(--loss) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 40%, transparent);
    border-radius: var(--radius-md);
  }
  .cause-error-title {
    color: var(--text);
    font-weight: 600;
    font-size: 14px;
  }
  .cause-error-message {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.4;
    word-break: break-word;
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--bg);
    border-radius: var(--radius-sm);
  }
</style>
