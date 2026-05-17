<script lang="ts">
  import PressureRibbon from '../components/PressureRibbon.svelte'
  import Icon from '../components/Icon.svelte'
  import CardRenderer from '../cards/CardRenderer.svelte'
  import { renderMockCard } from '../cards/mockCardRegistry'
  import { gameStore } from '../sim/gameStore.svelte'
  import { significantDiffLines } from '../sim/significantDiffs'
  import type { CardChoice } from '../cards/types'

  let reportOpen = $state(false)
  /**
   * Tracks the choice the player marked for each seed this day. The
   * foundation pass doesn't actually pass these as responseIntents
   * (phase 88 owns that); for now they're a visual commitment so
   * cards don't feel inert.
   */
  let pendingChoices = $state<Record<string, { slotId: string; verb: string }>>({})

  const morningSeeds = $derived(
    gameStore.todaysSeeds.filter((s) => s.timing === 'morning_prep'),
  )
  const cards = $derived(
    morningSeeds.map((seed) => ({
      seed,
      view: renderMockCard(seed, gameStore.state),
      pending: pendingChoices[seed.id],
    })),
  )

  const staffCount = $derived(Object.keys(gameStore.state.staff).length)
  const stockSummary = $derived.by(() => {
    const entries = Object.values(gameStore.state.stock)
    const shown = entries.slice(0, 3)
    const more = entries.length - shown.length
    const parts = shown.map((s) => `${s.label.toLowerCase()} ${s.quantity}`)
    if (more > 0) parts.push(`+${more} more`)
    return parts.join(' · ')
  })

  const diffLines = $derived(significantDiffLines(gameStore.latestResult, 8))

  function runService() {
    // Phase 88 will translate `pendingChoices` into ResponseIntents
    // here. For the foundation, we discard them and just advance.
    gameStore.runDay()
    pendingChoices = {}
    reportOpen = true
  }

  function closeReport() {
    reportOpen = false
  }

  function chooseFromCard(seedId: string) {
    return (slotId: string, choice: CardChoice) => {
      pendingChoices = {
        ...pendingChoices,
        [seedId]: { slotId, verb: choice.verb },
      }
    }
  }

  function ignoreCard(seedId: string) {
    return () => {
      pendingChoices = {
        ...pendingChoices,
        [seedId]: { slotId: 'ignore', verb: 'ignore' },
      }
    }
  }
</script>

<main class="day">
  <section class="block" aria-label="At a glance">
    <div class="glance mono">
      <span><Icon name="coin" size={13} /> {gameStore.state.coin}</span>
      <span><Icon name="staff" size={13} /> {staffCount} staff</span>
      <span><Icon name="stock" size={13} /> {stockSummary}</span>
    </div>
  </section>

  <section class="block" aria-label="Pressures">
    <h2 class="block-label tag">Rising</h2>
    <PressureRibbon />
  </section>

  <section class="block" aria-label="Morning">
    <h2 class="block-label tag">Morning</h2>
    {#if cards.length === 0}
      <p class="quiet">
        the tavern is quiet. no urgent matters this morning.
      </p>
    {:else}
      <div class="card-stack">
        {#each cards as { seed, view, pending } (seed.id)}
          <div class="card-wrap" class:resolved={!!pending}>
            <CardRenderer
              card={view}
              onchoose={chooseFromCard(seed.id)}
              onignore={ignoreCard(seed.id)}
            />
            {#if pending}
              <div class="pending tag">
                noted: <strong>{pending.verb}</strong>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="block" aria-label="Run">
    <button class="run-btn" type="button" onclick={runService}>
      Run Service
    </button>
    <p class="run-note tag">
      no owner actions · staff on default priorities
    </p>
  </section>
</main>

{#if reportOpen && gameStore.latestResult}
  <div
    class="report-backdrop"
    onclick={closeReport}
    onkeydown={(e) => e.key === 'Escape' && closeReport()}
    role="presentation"
  >
    <div
      class="report rise-in"
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-labelledby="report-title"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <header class="report-head">
        <h2 id="report-title" class="display report-title">Day Closed</h2>
        <span class="tag">significant changes</span>
      </header>
      {#if diffLines.length === 0}
        <p class="quiet">a quiet day. nothing crossed a threshold.</p>
      {:else}
        <ul class="diff-list">
          {#each diffLines as d (d.path)}
            <li class="diff-row">
              <span class="diff-mark" data-dir={d.direction}>
                {d.direction === 'gain' ? '+' : d.direction === 'loss' ? '−' : '·'}
              </span>
              <span class="diff-text">{d.readable}</span>
            </li>
          {/each}
        </ul>
      {/if}
      <button class="next" type="button" onclick={closeReport}>
        Next Day
      </button>
    </div>
  </div>
{/if}

<style>
  .day {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
    padding: var(--sp-md);
    padding-bottom: calc(var(--nav-h) + var(--sp-lg));
    max-width: var(--max-content);
    margin: 0 auto;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .block-label {
    color: var(--accent);
    margin-bottom: 2px;
  }

  .glance {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-md);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    color: var(--text-dim);
    border: var(--border-faint);
  }

  .glance span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .quiet {
    color: var(--text-faint);
    font-style: italic;
    text-align: center;
    padding: var(--sp-lg) var(--sp-md);
    background: var(--surface);
    border-radius: var(--radius-md);
    border: var(--border-faint);
  }

  .card-stack {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .card-wrap {
    position: relative;
    transition: opacity var(--m-fast) var(--ease);
  }

  .card-wrap.resolved {
    opacity: 0.7;
  }

  .pending {
    position: absolute;
    top: var(--sp-sm);
    right: var(--sp-xl);
    color: var(--accent-soft);
    background: var(--ink-deep);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--candle-soft);
  }

  .pending strong {
    color: var(--accent);
    font-weight: 500;
  }

  .run-btn {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 15px;
    color: var(--accent);
    background: transparent;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 14px;
    min-height: 48px;
    transition: background var(--m-fast) var(--ease);
  }

  .run-btn:hover,
  .run-btn:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .run-note {
    color: var(--text-faint);
    text-align: center;
    margin-top: var(--sp-xs);
  }

  /* ─── Report dialog ─────────────────────────────────────────────── */

  .report-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--ink-deep) 80%, transparent);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 50;
    padding: var(--sp-md);
  }

  .report {
    background: var(--surface-raised);
    border: var(--border);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    padding: var(--sp-lg) var(--sp-md);
    max-width: var(--max-content);
    width: 100%;
    max-height: 80vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    box-shadow: var(--shadow-md);
  }

  @media (min-width: 560px) {
    .report-backdrop {
      align-items: center;
    }
    .report {
      border-radius: var(--radius-md);
    }
  }

  .report-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border-bottom: var(--border-faint);
    padding-bottom: var(--sp-sm);
  }

  .report-title {
    font-size: 22px;
    color: var(--text);
  }

  .diff-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .diff-row {
    display: grid;
    grid-template-columns: 16px 1fr;
    gap: var(--sp-xs);
    align-items: baseline;
    font-family: var(--font-body);
    font-size: 15px;
    line-height: 1.4;
  }

  .diff-mark {
    font-family: var(--font-mono);
    text-align: center;
  }

  .diff-mark[data-dir='gain'] {
    color: var(--gain);
  }
  .diff-mark[data-dir='loss'] {
    color: var(--loss);
  }
  .diff-mark[data-dir='neutral'] {
    color: var(--text-faint);
  }

  .diff-text {
    color: var(--text-dim);
  }

  .next {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 14px;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 12px;
    min-height: 48px;
    margin-top: var(--sp-xs);
  }

  .next:hover,
  .next:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
</style>
