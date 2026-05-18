<!--
  Phase 98 — First-encounter hint popover.

  Surfaces a small inline definition next to a `TermLabel` chip the
  first time it renders within the introductory week. The popover
  appears on first viewport intersection (so terms that only appear
  after scrolling don't pulse off-screen), auto-dismisses after
  FIRST_ENCOUNTER_AUTO_DISMISS_MS, and marks the term as "seen" on
  any dismiss path so it doesn't reappear.

  Only one hint is visible at a time globally — the prefs store
  serializes via `claimHintSlot()` / `releaseHintSlot()` so a viewport
  full of `TermLabel`s won't pulse in unison.
-->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { prefsStore } from '../prefs/prefsStore.svelte'
  import { FIRST_ENCOUNTER_AUTO_DISMISS_MS } from '../prefs/firstEncounter'
  import { glossaryStore } from '../glossary/glossaryStore.svelte'
  import { getTerm } from '../../../../src/reports/glossary'

  let {
    termId,
    anchor,
  }: {
    termId: string
    /** The HTMLElement the popover anchors against (the chip's button). */
    anchor: HTMLElement | undefined
  } = $props()

  const entry = $derived(getTerm(termId))

  let visible = $state(false)
  let observer: IntersectionObserver | undefined
  let dismissTimer: ReturnType<typeof setTimeout> | undefined
  let popoverEl: HTMLDivElement | undefined = $state(undefined)

  function dismiss() {
    if (!visible) return
    visible = false
    prefsStore.markTermSeen(termId)
    prefsStore.releaseHintSlot()
    if (dismissTimer !== undefined) {
      clearTimeout(dismissTimer)
      dismissTimer = undefined
    }
  }

  function showHint() {
    if (visible) return
    if (!prefsStore.claimHintSlot(termId)) return
    visible = true
    dismissTimer = setTimeout(dismiss, FIRST_ENCOUNTER_AUTO_DISMISS_MS)
  }

  function openGlossary() {
    glossaryStore.show(termId)
    dismiss()
  }

  function onDocumentPointer(e: MouseEvent) {
    if (!visible) return
    const target = e.target as Node | null
    if (popoverEl && target && popoverEl.contains(target)) return
    if (anchor && target && anchor.contains(target)) return
    dismiss()
  }

  function onKey(e: KeyboardEvent) {
    if (visible && e.key === 'Escape') dismiss()
  }

  onMount(() => {
    if (!anchor || typeof IntersectionObserver === 'undefined') {
      // Fallback: no observer support — show immediately. Tiny risk
      // that a non-visible chip flashes its hint; acceptable given
      // the IntersectionObserver gap is only really an issue in
      // headless test environments.
      showHint()
    } else {
      observer = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              showHint()
              observer?.disconnect()
              observer = undefined
              return
            }
          }
        },
        { threshold: 0.1 },
      )
      observer.observe(anchor)
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('click', onDocumentPointer, true)
      document.addEventListener('keydown', onKey)
    }
  })

  onDestroy(() => {
    if (observer) {
      observer.disconnect()
      observer = undefined
    }
    if (dismissTimer !== undefined) {
      clearTimeout(dismissTimer)
      dismissTimer = undefined
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', onDocumentPointer, true)
      document.removeEventListener('keydown', onKey)
    }
    // Release the slot defensively — if the component is unmounted
    // mid-hint, the prefs store would otherwise hold a stale claim.
    if (visible) {
      prefsStore.releaseHintSlot()
    }
  })
</script>

{#if visible && entry}
  <div
    bind:this={popoverEl}
    class="first-encounter-popover rise-in"
    role="dialog"
    aria-label={`First-encounter hint for ${entry.label}`}
  >
    <div class="title-row">
      <span class="title">{entry.label}</span>
      <button
        class="close-btn"
        type="button"
        aria-label="Dismiss hint"
        onclick={dismiss}
      >
        ✕
      </button>
    </div>
    <p class="line">{entry.oneLine}</p>
    {#if entry.longer}
      <button class="more-link" type="button" onclick={openGlossary}>
        tap to read more
      </button>
    {/if}
  </div>
{/if}

<style>
  .first-encounter-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: max(220px, min(280px, 80vw));
    padding: var(--sp-xs) var(--sp-sm);
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xxs);
    font-style: normal;
    text-align: left;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-xs);
  }

  .title {
    font-family: var(--font-display);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent);
  }

  .close-btn {
    color: var(--text-faint);
    font-size: 14px;
    padding: 4px 6px;
    min-width: 28px;
    min-height: 28px;
  }

  .close-btn:hover,
  .close-btn:focus-visible {
    color: var(--text);
  }

  .line {
    color: var(--text);
    font-size: 13px;
    line-height: 1.45;
  }

  .more-link {
    align-self: flex-start;
    font-family: var(--font-body);
    font-size: 12px;
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--accent) 50%, transparent);
    padding: 4px 0;
  }

  .more-link:hover,
  .more-link:focus-visible {
    color: var(--text);
  }
</style>
