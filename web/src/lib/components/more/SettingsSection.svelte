<!--
  Phase 98 — Settings section of the More screen.

  Surfaces every field of `Preferences` as a toggle / segmented control.
  Each setter on `prefsStore` writes through to localStorage
  synchronously, so the player gets immediate persistence with no save
  button.
-->
<script lang="ts">
  import { prefsStore } from '../../prefs/prefsStore.svelte'
  import type {
    FontScale,
    ReducedMotionMode,
  } from '../../prefs/preferences'

  const fontScales: { id: FontScale; label: string }[] = [
    { id: 'sm', label: 'Small' },
    { id: 'md', label: 'Medium' },
    { id: 'lg', label: 'Large' },
  ]

  const motionModes: { id: ReducedMotionMode; label: string; hint: string }[] = [
    { id: 'auto', label: 'Auto', hint: 'follow OS preference' },
    { id: 'off', label: 'Off', hint: 'force animation on' },
    { id: 'on', label: 'On', hint: 'force animation off' },
  ]

  function resetAll() {
    prefsStore.reset()
  }
</script>

<section class="settings-section" aria-labelledby="settings-h">
  <h2 id="settings-h" class="display heading-row">Settings</h2>

  <div class="row">
    <div class="row-label">
      <span class="row-title">Font scale</span>
      <span class="row-sub">Affects body text. Headings and tags stay fixed.</span>
    </div>
    <div class="seg" role="group" aria-label="Font scale">
      {#each fontScales as opt (opt.id)}
        <button
          type="button"
          class="seg-chip"
          class:selected={prefsStore.preferences.fontScale === opt.id}
          aria-pressed={prefsStore.preferences.fontScale === opt.id}
          onclick={() => prefsStore.setFontScale(opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <div class="row-label">
      <span class="row-title">Reduced motion</span>
      <span class="row-sub">Auto respects your OS setting. Off keeps animation even when the OS asks to reduce it.</span>
    </div>
    <div class="seg" role="group" aria-label="Reduced motion">
      {#each motionModes as opt (opt.id)}
        <button
          type="button"
          class="seg-chip"
          class:selected={prefsStore.preferences.reducedMotion === opt.id}
          aria-pressed={prefsStore.preferences.reducedMotion === opt.id}
          title={opt.hint}
          onclick={() => prefsStore.setReducedMotion(opt.id)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <div class="row">
    <div class="row-label">
      <span class="row-title">Show seed tags on cards</span>
      <span class="row-sub">A small label in each card's corner naming the seed family.</span>
    </div>
    <button
      type="button"
      class="toggle"
      role="switch"
      aria-label="Show seed tags on cards"
      aria-checked={prefsStore.preferences.showSeedTags}
      onclick={() => prefsStore.toggleSeedTags()}
    >
      <span class="toggle-track" class:on={prefsStore.preferences.showSeedTags}>
        <span class="toggle-knob"></span>
      </span>
    </button>
  </div>

  <div class="row">
    <div class="row-label">
      <span class="row-title">Confirm before ending day</span>
      <span class="row-sub">Adds a one-tap "are you sure?" to the End Day button.</span>
    </div>
    <button
      type="button"
      class="toggle"
      role="switch"
      aria-label="Confirm before ending day"
      aria-checked={prefsStore.preferences.confirmEndDay}
      onclick={() => prefsStore.toggleConfirmEndDay()}
    >
      <span class="toggle-track" class:on={prefsStore.preferences.confirmEndDay}>
        <span class="toggle-knob"></span>
      </span>
    </button>
  </div>

  <div class="row">
    <div class="row-label">
      <span class="row-title">First-encounter hints</span>
      <span class="row-sub">During your first week, an inline note explains each game term the first time you see it.</span>
    </div>
    <button
      type="button"
      class="toggle"
      role="switch"
      aria-label="Show first-encounter hints"
      aria-checked={prefsStore.preferences.showFirstEncounterHints}
      onclick={() => prefsStore.toggleFirstEncounterHints()}
    >
      <span class="toggle-track" class:on={prefsStore.preferences.showFirstEncounterHints}>
        <span class="toggle-knob"></span>
      </span>
    </button>
  </div>

  <div class="reset-row">
    <button class="ghost" type="button" onclick={resetAll}>
      Reset preferences to defaults
    </button>
  </div>
</section>

<style>
  .settings-section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    padding: var(--sp-md);
    background: var(--surface);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
  }

  .heading-row {
    font-size: var(--type-heading);
    color: var(--text);
    margin-bottom: var(--sp-xs);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-md);
    padding: var(--sp-xs) 0;
  }

  .row-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .row-title {
    color: var(--text);
    font-size: 15px;
  }

  .row-sub {
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.4;
  }

  .seg {
    display: flex;
    gap: 2px;
    background: var(--bg);
    border: 1px solid var(--candle-soft);
    border-radius: var(--radius-sm);
    padding: 2px;
    flex-shrink: 0;
  }

  .seg-chip {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.04em;
    font-size: 12px;
    color: var(--text-faint);
    padding: 6px 10px;
    min-height: 32px;
    border-radius: var(--radius-sm);
    transition:
      background var(--m-fast) var(--ease),
      color var(--m-fast) var(--ease);
  }

  .seg-chip:hover,
  .seg-chip:focus-visible {
    color: var(--text-dim);
  }

  .seg-chip.selected {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    color: var(--accent);
  }

  .toggle {
    padding: var(--sp-xxs);
    min-width: 44px;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-track {
    display: inline-block;
    width: 36px;
    height: 20px;
    background: var(--bg);
    border: 1px solid var(--candle-soft);
    border-radius: 20px;
    position: relative;
    transition: background var(--m-fast) var(--ease);
  }

  .toggle-track.on {
    background: color-mix(in srgb, var(--accent) 35%, transparent);
    border-color: var(--accent);
  }

  .toggle-knob {
    position: absolute;
    top: 1px;
    left: 1px;
    width: 16px;
    height: 16px;
    background: var(--text-dim);
    border-radius: 50%;
    transition:
      transform var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .toggle-track.on .toggle-knob {
    transform: translateX(16px);
    background: var(--accent);
  }

  .reset-row {
    display: flex;
    justify-content: flex-start;
    padding-top: var(--sp-xs);
    border-top: var(--border-faint);
  }

  .ghost {
    font-family: var(--font-body);
    font-size: 13px;
    color: var(--text-faint);
    padding: 8px 10px;
    min-height: 36px;
  }

  .ghost:hover,
  .ghost:focus-visible {
    color: var(--loss);
  }
</style>
