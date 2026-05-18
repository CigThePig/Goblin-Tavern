<!--
  Phase 98 — Single named-snapshot row primitive used by SavesSection.

  The row carries its own rename input toggle so the parent doesn't
  have to track which row is editing. Load and Delete are emit-only;
  the parent gates them behind a confirm dialog.
-->
<script lang="ts">
  import type { SnapshotMeta } from '../../sim/snapshots'
  import { relativeTime } from '../../sim/persistence'

  let {
    snapshot,
    onload,
    onrename,
    ondelete,
  }: {
    snapshot: SnapshotMeta
    onload: () => void
    onrename: (name: string) => void
    ondelete: () => void
  } = $props()

  let renaming = $state(false)
  let draftName = $state('')

  const elapsed = $derived.by(() => relativeTime(snapshot.createdAt, new Date()))

  function startRename() {
    draftName = snapshot.name
    renaming = true
    // Focus the input on next tick. We avoid `autofocus` attribute per
    // a11y best practice — the player initiated the rename, so the
    // focus shift is expected.
    queueMicrotask(() => {
      renameInputEl?.focus()
      renameInputEl?.select()
    })
  }

  let renameInputEl: HTMLInputElement | undefined = $state(undefined)

  function commitRename() {
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== snapshot.name) {
      onrename(trimmed)
    }
    renaming = false
  }

  function cancelRename() {
    renaming = false
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
</script>

<div class="snap-row">
  <div class="snap-head">
    {#if renaming}
      <input
        bind:this={renameInputEl}
        class="rename-input mono"
        type="text"
        bind:value={draftName}
        onkeydown={(e) => {
          if (e.key === 'Enter') commitRename()
          if (e.key === 'Escape') cancelRename()
        }}
        spellcheck="false"
        autocomplete="off"
      />
      <button class="chip-action" type="button" onclick={commitRename}>Save</button>
      <button class="chip-action ghost" type="button" onclick={cancelRename}>Cancel</button>
    {:else}
      <h3 class="snap-name">{snapshot.name}</h3>
      <button class="chip-action ghost" type="button" onclick={startRename} aria-label="Rename">
        rename
      </button>
    {/if}
  </div>

  <div class="snap-meta">
    <span class="meta-pill">Day {snapshot.day}</span>
    {#if elapsed}
      <span class="meta-pill">{elapsed.phrase} ago</span>
    {/if}
    <span class="meta-pill">{formatBytes(snapshot.bytes)}</span>
    <span class="meta-pill mono">{snapshot.seedString}</span>
  </div>

  {#if snapshot.note}
    <p class="snap-note">{snapshot.note}</p>
  {/if}

  <div class="snap-actions">
    <button class="action-btn primary" type="button" onclick={onload}>Load</button>
    <button class="action-btn ghost" type="button" onclick={ondelete}>Delete</button>
  </div>
</div>

<style>
  .snap-row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-sm);
    background: var(--surface-raised);
    border: var(--border-faint);
    border-radius: var(--radius-sm);
  }

  .snap-head {
    display: flex;
    align-items: center;
    gap: var(--sp-xs);
    flex-wrap: wrap;
  }

  .snap-name {
    font-family: var(--font-body);
    font-style: italic;
    font-weight: 500;
    font-size: var(--type-heading);
    color: var(--text);
    margin: 0;
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }

  .rename-input {
    flex: 1;
    min-width: 100px;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--candle-soft);
    border-radius: var(--radius-sm);
    padding: 6px 8px;
    min-height: 32px;
    font-size: 14px;
  }

  .chip-action {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 12px;
    color: var(--accent);
    padding: 4px 8px;
    min-height: 28px;
  }

  .chip-action.ghost {
    color: var(--text-faint);
  }

  .chip-action:hover,
  .chip-action:focus-visible {
    color: var(--text);
  }

  .chip-action.ghost:hover,
  .chip-action.ghost:focus-visible {
    color: var(--text-dim);
  }

  .snap-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xxs);
  }

  .meta-pill {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.04em;
    font-size: 11px;
    color: var(--text-faint);
    background: var(--bg);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 50%, transparent);
    border-radius: var(--radius-sm);
    padding: 3px 6px;
  }

  .snap-note {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.4;
    font-style: italic;
  }

  .snap-actions {
    display: flex;
    gap: var(--sp-xs);
    margin-top: var(--sp-xxs);
  }

  .action-btn {
    flex: 1;
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    padding: 8px 12px;
    min-height: 40px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
  }

  .action-btn.primary {
    color: var(--accent);
    border-color: var(--accent);
  }

  .action-btn.primary:hover,
  .action-btn.primary:focus-visible {
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .action-btn.ghost {
    color: var(--text-faint);
    border-color: var(--candle-soft);
  }

  .action-btn.ghost:hover,
  .action-btn.ghost:focus-visible {
    color: var(--loss);
    border-color: var(--loss);
  }
</style>
