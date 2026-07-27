<!--
  CardDeck — vertical deck of seed-driven cards for service/closing.

  One card visible at a time; player taps a choice (or Ignore) and the
  deck advances. Resolved cards collapse to a thin strip at the top so
  the player can scroll back and change their mind until the beat ends.
  Counter ("2 of 4") sits in the sticky header.

  Props:
    - seeds: the IssueSeeds for this beat
    - pendingByseedId: existing player choices (so the deck restores on remount)
    - onresolve(seedId, choice|null): called when a card is acted on; null = ignore
    - oncomplete: called when every seed in the deck has a pending entry
-->
<script lang="ts">
  import { untrack } from 'svelte'
  import CardRenderer from '../cards/CardRenderer.svelte'
  import { renderCard } from '../cards/realCardRegistry'
  import {
    committedCoinCost,
    committedOwnerTimeCost,
    gateChoicesByCoin,
    gateChoicesByTime,
  } from '../cards/affordability'
  import { selectionLabelOf } from '../sim/selectionLabel'
  import { gameStore } from '../sim/gameStore.svelte'
  import type { IssueSeed } from '../cards/types'
  import type { CardChoice } from '../cards/types'

  type Pending =
    | { kind: 'choice'; slotId: string; verb: string; choice: CardChoice }
    | { kind: 'ignore' }

  let {
    seeds,
    pendingBySeedId,
    onresolve,
    oncomplete,
  }: {
    seeds: IssueSeed[]
    pendingBySeedId: Record<string, Pending>
    onresolve: (seedId: string, pending: Pending) => void
    oncomplete: () => void
  } = $props()

  // Cards rendered once per seed; CardView is a pure function of (seed, state)
  // so this is safe and avoids re-rendering on every keystroke.
  //
  // Phase 200 / audit Wave 1 (`P7-EXP-001`) — a choice the till cannot
  // cover is disabled before the player commits, priced against the
  // choices already committed today with the same cost function the sim
  // enforces at resolution.
  const cards = $derived(
    seeds.map((seed) => ({
      seed,
      // Phase 203 / audit Wave 4 (`P6-COMP-005`) — and the same gate for
      // the day clock, which owner actions and card choices share.
      view: gateChoicesByTime(
        gateChoicesByCoin(renderCard(seed, gameStore.state), seed, {
          coin: gameStore.state.coin,
          committed: committedCoinCost(
            gameStore.todaysSeeds,
            pendingBySeedId,
            seed.id,
          ),
        }),
        seed,
        {
          queuedMinutes: gameStore.minutesQueued,
          committed: committedOwnerTimeCost(
            gameStore.todaysSeeds,
            pendingBySeedId,
            seed.id,
          ),
        },
      ),
    })),
  )

  // Pointer to the current card. Auto-advances past resolved seeds.
  let index = $state(0)

  $effect(() => {
    // When the deck is fully resolved, signal completion exactly once.
    if (seeds.length > 0 && seeds.every((s) => pendingBySeedId[s.id])) {
      oncomplete()
    }
  })

  // Keep `index` pointed at the next unresolved card. Avoids the player
  // staring at a "resolved" card after picking something.
  //
  // The effect both reads and writes `index`. Without `untrack`, the
  // clamp `index = cards.length - 1` lands on a resolved card, which
  // re-fires the effect via the `index` dep — and the cycle hits
  // Svelte's effect_update_depth_exceeded. Tracking only the real
  // inputs (cards.length, pendingBySeedId) breaks the self-loop.
  $effect(() => {
    const len = cards.length
    const pending = pendingBySeedId
    untrack(() => {
      let next = index
      while (next < len && pending[cards[next]!.seed.id]) next += 1
      if (next >= len && len > 0) next = len - 1
      if (next !== index) index = next
    })
  })

  function pickChoice(seed: IssueSeed) {
    return (slotId: string, choice: CardChoice) => {
      onresolve(seed.id, { kind: 'choice', slotId, verb: choice.verb, choice })
    }
  }

  function ignore(seed: IssueSeed) {
    return () => {
      onresolve(seed.id, { kind: 'ignore' })
    }
  }

  function goTo(i: number) {
    if (i < 0 || i >= cards.length) return
    index = i
  }
</script>

{#if cards.length === 0}
  <p class="empty">No cards in this beat.</p>
{:else}
  <div class="deck">
    <div class="head">
      <span class="counter mono">
        {Math.min(index + 1, cards.length)} of {cards.length}
      </span>
      <div class="dots" role="tablist" aria-label="Card progress">
        {#each cards as { seed }, i (seed.id)}
          <button
            type="button"
            class="dot"
            class:active={i === index}
            class:resolved={!!pendingBySeedId[seed.id]}
            aria-label="Go to card {i + 1}"
            aria-current={i === index ? 'true' : undefined}
            onclick={() => goTo(i)}
          ></button>
        {/each}
      </div>
    </div>

    {#each cards as { seed, view }, i (seed.id)}
      {#if i === index}
        <div class="active-card rise-in">
          <CardRenderer
            card={view}
            onchoose={pickChoice(seed)}
            onignore={ignore(seed)}
          />
          {#if pendingBySeedId[seed.id]}
            <!-- Phase 202 / audit Wave 3 (`P6-COMP-001`) — repeat the
                 player's own choice wording, not the engine verb: this
                 rendered "Back Mira against the Ogres" as `noted: blame`.
                 The status line answers "which choices are final". -->
            <div class="resolved-overlay chip">
              <strong>{selectionLabelOf(pendingBySeedId[seed.id]!)}</strong>
              <span class="selection-status">Selected — revisable until End Day</span>
            </div>
          {/if}
        </div>
      {/if}
    {/each}

    {#if cards.length > 1}
      <div class="nav">
        <button
          type="button"
          class="nav-btn"
          onclick={() => goTo(index - 1)}
          disabled={index === 0}
        >
          ← Previous
        </button>
        <button
          type="button"
          class="nav-btn"
          onclick={() => goTo(index + 1)}
          disabled={index >= cards.length - 1}
        >
          Next →
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .deck {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
  }

  .empty {
    color: var(--text-faint);
    text-align: center;
    padding: var(--sp-lg) var(--sp-md);
    font-style: italic;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
  }

  .counter {
    color: var(--text-faint);
  }

  .dots {
    display: flex;
    gap: 6px;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--ash) 30%, transparent);
    border: 1px solid transparent;
    transition: background var(--m-fast) var(--ease);
  }

  .dot.resolved {
    background: var(--candle-soft);
  }

  .dot.active {
    border-color: var(--accent);
  }

  .active-card {
    position: relative;
  }

  .selection-status {
    display: block;
    font-size: 0.85em;
    opacity: 0.75;
  }

  .resolved-overlay {
    position: absolute;
    top: var(--sp-sm);
    right: var(--sp-xl);
    color: var(--accent-soft);
    background: var(--bg);
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--candle-soft);
  }

  .resolved-overlay strong {
    color: var(--accent);
    font-weight: 500;
  }

  .nav {
    display: flex;
    justify-content: space-between;
    gap: var(--sp-sm);
  }

  .nav-btn {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-faint);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--ash) 30%, transparent);
    transition: color var(--m-fast) var(--ease), border-color var(--m-fast) var(--ease);
    min-height: 44px;
  }

  .nav-btn:not(:disabled):hover,
  .nav-btn:not(:disabled):focus-visible {
    color: var(--text);
    border-color: var(--accent);
  }

  .nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
