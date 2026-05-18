<!--
  Phase 98 — About section. A tiny credits block on the More screen.
-->
<script lang="ts">
  import { gameStore } from '../../sim/gameStore.svelte'

  const tavernName = $derived(gameStore.state.meta.tavernName)
</script>

<section class="about-section" aria-labelledby="about-h">
  <h2 id="about-h" class="display heading-row">About</h2>

  <p class="line">
    <em>{tavernName}</em>
  </p>
  <p class="line dim">
    A headless tavern simulation with a card-shaped front. The rules engine ran for
    months before the first card was written; the cards reveal what the simulation
    already knows.
  </p>
  <p class="line tag">
    Phases 1–86: simulation. 87–97: cards, screens, voice, continuity. 98: this
    settings surface.
  </p>
</section>

<style>
  .about-section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
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

  .line {
    color: var(--text);
    font-size: 14px;
    line-height: 1.55;
  }

  .line.dim {
    color: var(--text-dim);
  }

  .line.tag {
    color: var(--text-faint);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
  }
</style>
