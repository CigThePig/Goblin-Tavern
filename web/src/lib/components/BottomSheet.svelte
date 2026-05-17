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

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose()
  }
</script>

{#if open}
  <div
    class="sheet-backdrop"
    onclick={onclose}
    onkeydown={handleKey}
    role="presentation"
  >
    <div
      class="sheet rise-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
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
