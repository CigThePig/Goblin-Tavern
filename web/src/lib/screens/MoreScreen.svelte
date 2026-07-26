<!--
  Phase 98 — "More" tab. Settings, Saves, Help, About.

  Vertical stack of sections rather than a sub-nav: each section is
  large enough that scrolling between them feels right on a phone, and
  the player never has to remember where settings are nested.

  The Saves section's destructive actions (Load snapshot, Import) emit
  `onreplaced` so the parent (`App.svelte`) can re-route the player
  into the freshly-hydrated run.
-->
<script lang="ts">
  import SettingsSection from '../components/more/SettingsSection.svelte'
  import SavesSection from '../components/more/SavesSection.svelte'
  import HelpSection from '../components/more/HelpSection.svelte'
  import DiagnosticsSection from '../components/more/DiagnosticsSection.svelte'
  import AboutSection from '../components/more/AboutSection.svelte'

  let {
    onreplaced,
    onretrysave,
  }: {
    onreplaced: () => void
    /** Re-attempt the last failed save now, without waiting for the
     * next autosave debounce (Phase 199 / audit Wave 0). */
    onretrysave: () => void
  } = $props()
</script>

<div class="more-screen">
  <SettingsSection />
  <SavesSection {onreplaced} {onretrysave} />
  <HelpSection />
  <DiagnosticsSection />
  <AboutSection />
</div>

<style>
  .more-screen {
    display: flex;
    flex-direction: column;
    gap: var(--sp-md);
    max-width: var(--max-content);
    margin: 0 auto;
    padding: var(--sp-md);
    padding-bottom: calc(var(--sp-xl) + env(safe-area-inset-bottom, 0));
  }
</style>
