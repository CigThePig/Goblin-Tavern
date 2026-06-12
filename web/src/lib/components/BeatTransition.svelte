<!--
  BeatTransition — a brief pacing moment between day beats.

  Phase 87 ships no animation longer than 220ms; this component pushes
  to ~600ms because the player needs to perceive the engine *running*.
  Reduced-motion users get an instantaneous fade with the label only.

  Use: parent toggles `show` to true, listens for `oncomplete`, then
  transitions to the next beat.
-->
<script lang="ts">
  let {
    show,
    label = 'Service runs.',
    duration = 600,
    oncomplete,
  }: {
    show: boolean
    label?: string
    duration?: number
    oncomplete?: () => void
  } = $props()

  let timer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    if (show) {
      timer = setTimeout(() => {
        oncomplete?.()
      }, duration)
    }
    return () => {
      if (timer !== undefined) clearTimeout(timer)
    }
  })
</script>

{#if show}
  <div class="overlay" role="status" aria-live="polite">
    <div class="line flicker">{label}</div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 80;
    animation: fade-in 220ms var(--ease) both;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .line {
    font-family: var(--font-display);
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
    font-size: 16px;
  }
</style>
