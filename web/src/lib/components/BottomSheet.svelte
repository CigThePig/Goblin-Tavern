<!--
  BottomSheet — generic mobile-first modal sheet.

  Slides up from the bottom, full-screen on phones, max 560px and rounded
  on larger viewports. Closes on backdrop click or Escape. Owners pass
  a `title` and any body content via the default slot; the sheet wraps
  itself in a scroll container and adds a sticky header.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    open,
    title,
    onclose,
    children,
    footer,
  }: {
    open: boolean
    title: string
    onclose: () => void
    children?: Snippet
    footer?: Snippet
  } = $props()

  // Phase 93 / ISSUE-053 — Modal a11y.
  // The dialog used to call `stopPropagation()` on every keydown, which
  // meant Escape never reached the backdrop handler once any control
  // inside the sheet had focus. The new contract:
  //   1. Escape is handled at the window level while the sheet is open.
  //      This is the only listener; the dialog no longer intercepts.
  //   2. On open, focus moves into the dialog itself so screen-reader
  //      and keyboard users land inside the modal context.
  //   3. On close, focus restores to the element that was active just
  //      before the sheet opened.
  let dialogEl: HTMLDivElement | undefined = $state(undefined)
  let previouslyFocused: HTMLElement | null = null

  $effect(() => {
    if (typeof document === 'undefined') return
    if (!open) return
    previouslyFocused = document.activeElement as HTMLElement | null
    // Focus the dialog after Svelte has mounted it. queueMicrotask
    // lets the DOM commit before we read the ref.
    queueMicrotask(() => {
      dialogEl?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onclose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Restore focus only when the sheet was actually closed by this
      // effect's teardown, i.e. when `open` flips back to false.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
      previouslyFocused = null
    }
  })
</script>

{#if open}
  <div
    class="sheet-backdrop"
    onclick={onclose}
    role="presentation"
  >
    <div
      class="sheet rise-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      bind:this={dialogEl}
      onclick={(e) => e.stopPropagation()}
    >
      <header class="sheet-head">
        <div class="drag-handle" aria-hidden="true"></div>
        <div class="head-row">
          <h2 class="title display">{title}</h2>
          <button class="close" type="button" aria-label="Close" onclick={onclose}>
            ✕
          </button>
        </div>
      </header>
      <div class="sheet-body">
        {#if children}{@render children()}{/if}
      </div>
      {#if footer}
        <footer class="sheet-foot">
          {@render footer()}
        </footer>
      {/if}
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--ink-deep) 85%, transparent);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 60;
  }

  .sheet {
    background: var(--surface);
    border-top: var(--border);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    width: 100%;
    max-width: var(--max-content);
    max-height: 90vh;
    max-height: 90dvh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--shadow-md);
  }

  @media (min-width: 560px) {
    .sheet-backdrop {
      align-items: center;
    }
    .sheet {
      border-radius: var(--radius-md);
      border: var(--border);
      max-height: 80vh;
    }
  }

  .sheet-head {
    position: sticky;
    top: 0;
    background: var(--surface);
    border-bottom: var(--border-faint);
    padding: var(--sp-xs) var(--sp-md) var(--sp-sm);
    z-index: 1;
  }

  .drag-handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: color-mix(in srgb, var(--ash) 40%, transparent);
    margin: 0 auto var(--sp-xs);
  }

  .head-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-sm);
  }

  .title {
    font-size: 16px;
    letter-spacing: 0.08em;
    color: var(--text);
  }

  .close {
    color: var(--text-faint);
    font-size: 16px;
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    transition: color var(--m-fast) var(--ease), background var(--m-fast) var(--ease);
  }

  .close:hover,
  .close:focus-visible {
    color: var(--text);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .sheet-body {
    overflow-y: auto;
    padding: var(--sp-md);
    flex: 1;
  }

  .sheet-foot {
    border-top: var(--border-faint);
    padding: var(--sp-sm) var(--sp-md);
    background: var(--surface);
  }
</style>
