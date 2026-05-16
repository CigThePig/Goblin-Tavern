<script lang="ts">
  import Icon from '../components/Icon.svelte'
  import { gameStore } from '../sim/gameStore.svelte'

  let { onstart }: { onstart: () => void } = $props()

  let advancedOpen = $state(false)
  let seedDraft = $state(gameStore.seedString)

  function openTavern() {
    gameStore.reset(seedDraft.trim() || 'crooked-keg')
    onstart()
  }
</script>

<main class="start">
  <div class="ambient">
    <span class="flame flicker" aria-hidden="true">
      <Icon name="flame" size={48} />
    </span>
  </div>

  <div class="hero">
    <h1 class="display title">Goblin Tavern</h1>
    <p class="sub">
      <em>The Crooked Keg</em>
    </p>
    <p class="mono atmos">
      Day zero. Coin in pocket. The smell of last night still hanging.
    </p>
  </div>

  <button class="primary" type="button" onclick={openTavern}>
    Open the Tavern
  </button>

  <div class="advanced">
    <button
      class="adv-toggle"
      type="button"
      aria-expanded={advancedOpen}
      onclick={() => (advancedOpen = !advancedOpen)}
    >
      {advancedOpen ? '▾' : '▸'} advanced
    </button>
    {#if advancedOpen}
      <div class="adv-body">
        <label class="adv-row">
          <span class="adv-label tag">seed</span>
          <input
            class="adv-input mono"
            type="text"
            bind:value={seedDraft}
            placeholder="crooked-keg"
            spellcheck="false"
            autocapitalize="off"
            autocomplete="off"
          />
        </label>
        <p class="adv-note mono">
          same seed + same input = same days. change to fork the world.
        </p>
      </div>
    {/if}
  </div>

  <footer class="foot tag">
    headless sim · 86 phases · cards forthcoming
  </footer>
</main>

<style>
  .start {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--sp-xl) var(--sp-md);
    gap: var(--sp-xl);
    text-align: center;
    background:
      radial-gradient(
        ellipse 60% 40% at 50% 30%,
        color-mix(in srgb, var(--accent) 8%, transparent) 0%,
        transparent 70%
      ),
      var(--bg);
  }

  .ambient {
    color: var(--accent);
    margin-top: var(--sp-xl);
    filter: drop-shadow(0 0 16px color-mix(in srgb, var(--accent) 50%, transparent));
  }

  .flame {
    display: inline-flex;
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-md);
    max-width: var(--max-content);
  }

  .title {
    font-size: var(--type-display-lg);
    color: var(--text);
  }

  .sub {
    font-size: 19px;
    color: var(--text-dim);
    font-style: italic;
  }

  .atmos {
    color: var(--text-faint);
    line-height: 1.6;
    max-width: 30ch;
  }

  .primary {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 16px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 14px var(--sp-xl);
    min-height: 48px;
    transition:
      background var(--m-fast) var(--ease),
      box-shadow var(--m-fast) var(--ease);
  }

  .primary:hover,
  .primary:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .advanced {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-sm);
    width: 100%;
    max-width: 320px;
  }

  .adv-toggle {
    color: var(--text-faint);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
  }

  .adv-body {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-sm);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
  }

  .adv-row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
    text-align: left;
  }

  .adv-label {
    color: var(--text-faint);
  }

  .adv-input {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--candle-soft);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    min-height: 36px;
    width: 100%;
  }

  .adv-note {
    color: var(--text-faint);
    text-align: left;
    font-size: 12px;
    line-height: 1.4;
  }

  .foot {
    color: var(--text-faint);
    opacity: 0.7;
  }
</style>
