<!--
  Phase 98 — Saves section of the More screen.

  Shows the always-on autosave row at top, then up to five named
  snapshots. Snapshot lifecycle (create / rename / delete / load) plus
  export / import live here. Load and Import gate the destructive step
  behind an in-place confirm so an accidental tap can't replace the
  player's current run.
-->
<script lang="ts">
  import SnapshotRow from './SnapshotRow.svelte'
  import { gameStore } from '../../sim/gameStore.svelte'
  import {
    createSnapshot,
    deleteSnapshot,
    estimateStorageBytes,
    findOrphanSnapshots,
    listSnapshots,
    loadSnapshot,
    recoverOrphanSnapshots,
    renameSnapshot,
    type SnapshotMeta,
    MAX_NAMED_SNAPSHOTS,
    SNAPSHOT_WARN_BYTES,
    SNAPSHOT_BUDGET_BYTES,
  } from '../../sim/snapshots'
  import {
    exportSessionToFile,
    parseImportedSession,
    readFileAsText,
  } from '../../sim/exportImport'
  import { relativeTime } from '../../sim/persistence'

  let {
    onreplaced,
  }: {
    /** Called when an Import or snapshot Load successfully replaces
     * the current run — the parent (App.svelte) re-routes to the
     * just-hydrated run's route so the new world is immediately
     * playable. */
    onreplaced: () => void
  } = $props()

  let snapshots = $state<SnapshotMeta[]>(listSnapshots())
  let bytesUsed = $state(estimateStorageBytes())
  let orphans = $state<SnapshotMeta[]>(findOrphanSnapshots())

  // Naming dialog state for "Snapshot now".
  let creatingName = $state('')
  let creatingError = $state<string | undefined>(undefined)

  // Confirm-load dialog.
  let pendingLoadId = $state<string | undefined>(undefined)
  // Phase 89 / ISSUE-049 — Confirm-delete dialog. The id sits here
  // while the player decides; `confirmDelete()` triggers the actual
  // `deleteSnapshot` call. Mirrors the load-confirm pattern.
  let pendingDeleteId = $state<string | undefined>(undefined)

  // Import flow.
  let importInputEl: HTMLInputElement | undefined = $state(undefined)
  let importPreview = $state<
    | undefined
    | {
        day: number
        seedString: string
        tavernName: string
        rawText: string
      }
  >(undefined)
  let importError = $state<string | undefined>(undefined)

  const lastSavedRel = $derived.by(() => {
    if (!gameStore.lastSavedAt) return undefined
    return relativeTime(gameStore.lastSavedAt, new Date())
  })

  const overBudget = $derived(bytesUsed >= SNAPSHOT_WARN_BYTES)
  const limitReached = $derived(snapshots.length >= MAX_NAMED_SNAPSHOTS)

  function refresh() {
    snapshots = listSnapshots()
    bytesUsed = estimateStorageBytes()
    orphans = findOrphanSnapshots()
  }

  function recoverOrphans() {
    recoverOrphanSnapshots()
    refresh()
  }

  function clearSaveError() {
    gameStore.saveError = undefined
  }

  function takeSnapshot() {
    creatingError = undefined
    const name =
      creatingName.trim() ||
      `Day ${gameStore.state.calendar.totalDaysElapsed}`
    const session = gameStore.serializeForSave()
    const result = createSnapshot(name, session)
    if (!result.ok) {
      if (result.reason === 'storage_budget') {
        creatingError = "Storage is nearly full. Delete an older snapshot first."
      } else if (result.reason === 'limit_reached') {
        creatingError = `You already have ${MAX_NAMED_SNAPSHOTS} snapshots. Delete one to make room.`
      } else {
        creatingError = "Couldn't save snapshot — storage write failed."
      }
      return
    }
    creatingName = ''
    refresh()
  }

  function requestLoad(id: string) {
    pendingLoadId = id
  }

  function confirmLoad() {
    if (!pendingLoadId) return
    const outcome = loadSnapshot(pendingLoadId)
    if (outcome.kind === 'loaded') {
      gameStore.hydrateFromSave(outcome.save)
      pendingLoadId = undefined
      onreplaced()
      return
    }
    creatingError =
      outcome.kind === 'incompatible'
        ? `Snapshot is from a different save version (v${outcome.saveVersion}).`
        : `Snapshot won't load: ${outcome.reason}`
    pendingLoadId = undefined
  }

  function cancelLoad() {
    pendingLoadId = undefined
  }

  function handleDelete(id: string) {
    // Phase 89 / ISSUE-049 — Defer the destructive call behind a
    // confirmation, mirroring the load-confirm path. A mistap on the
    // row's × button no longer wipes the slot.
    pendingDeleteId = id
  }

  function confirmDelete() {
    if (!pendingDeleteId) return
    deleteSnapshot(pendingDeleteId)
    pendingDeleteId = undefined
    refresh()
  }

  function cancelDelete() {
    pendingDeleteId = undefined
  }

  function handleRename(id: string, name: string) {
    renameSnapshot(id, name)
    refresh()
  }

  function exportCurrent() {
    exportSessionToFile(gameStore.serializeForSave())
  }

  function pickImportFile() {
    importError = undefined
    importPreview = undefined
    importInputEl?.click()
  }

  async function handleImportFile(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const parsed = parseImportedSession(text)
      if (!parsed.ok) {
        importError = parsed.reason
        return
      }
      importPreview = {
        day: parsed.session.state.calendar.totalDaysElapsed,
        seedString: parsed.session.simSeed,
        tavernName: parsed.session.state.meta.tavernName,
        rawText: text,
      }
    } catch (err) {
      importError = `Couldn't read file: ${err instanceof Error ? err.message : 'unknown error'}`
    }
  }

  function confirmImport() {
    if (!importPreview) return
    const parsed = parseImportedSession(importPreview.rawText)
    if (!parsed.ok) {
      importError = parsed.reason
      return
    }
    gameStore.hydrateFromSave(parsed.session)
    importPreview = undefined
    onreplaced()
  }

  function cancelImport() {
    importPreview = undefined
    importError = undefined
  }
</script>

<section class="saves-section" aria-labelledby="saves-h">
  <h2 id="saves-h" class="display heading-row">Saves</h2>

  {#if gameStore.saveError}
    <div class="save-error" role="status">
      <p class="save-error-text">
        {#if gameStore.saveError.reason === 'quota'}
          Browser storage is full — your latest progress isn't saved.
          Delete a snapshot or export the run, then retry.
        {:else if gameStore.saveError.reason === 'unavailable'}
          The browser blocked save writes (private mode or storage off).
          Retry once storage is available.
        {:else}
          Couldn't write the latest autosave. Retry, and if it keeps
          failing, export the run so you don't lose progress.
        {/if}
      </p>
      <div class="confirm-actions">
        <button class="primary-btn" type="button" onclick={clearSaveError}>
          Dismiss
        </button>
      </div>
    </div>
  {/if}

  <div class="autosave-row">
    <div class="autosave-head">
      <h3 class="autosave-title">Autosave</h3>
      <span class="meta-pill">Day {gameStore.state.calendar.totalDaysElapsed}</span>
      {#if lastSavedRel}
        <span class="meta-pill">{lastSavedRel.phrase} ago</span>
      {/if}
    </div>
    <p class="autosave-sub">
      Updates every few seconds while you play. Survives tab close and lock screens.
    </p>
    <div class="snap-input-row">
      <input
        class="snap-name-input mono"
        type="text"
        placeholder={`Day ${gameStore.state.calendar.totalDaysElapsed} snapshot`}
        bind:value={creatingName}
        onkeydown={(e) => {
          if (e.key === 'Enter') takeSnapshot()
        }}
        disabled={limitReached}
      />
      <button
        class="primary-btn"
        type="button"
        onclick={takeSnapshot}
        disabled={limitReached}
      >
        Snapshot now
      </button>
    </div>
    {#if creatingError}
      <p class="error-line">{creatingError}</p>
    {/if}
  </div>

  <div class="snaps-list">
    {#if snapshots.length === 0}
      <p class="empty-note">
        No named snapshots yet. Tap "Snapshot now" before a big decision.
      </p>
    {:else}
      {#each snapshots as snap (snap.id)}
        <SnapshotRow
          snapshot={snap}
          onload={() => requestLoad(snap.id)}
          onrename={(name) => handleRename(snap.id, name)}
          ondelete={() => handleDelete(snap.id)}
        />
      {/each}
    {/if}
  </div>

  {#if pendingLoadId}
    <div class="confirm-block">
      <p class="confirm-text">
        Loading a snapshot will replace your current run. Continue?
      </p>
      <div class="confirm-actions">
        <button class="primary-btn" type="button" onclick={confirmLoad}>
          Replace current run
        </button>
        <button class="ghost-btn" type="button" onclick={cancelLoad}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if pendingDeleteId}
    <div class="confirm-block">
      <p class="confirm-text">
        Delete this snapshot? This can't be undone.
      </p>
      <div class="confirm-actions">
        <button class="primary-btn" type="button" onclick={confirmDelete}>
          Delete snapshot
        </button>
        <button class="ghost-btn" type="button" onclick={cancelDelete}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if orphans.length > 0}
    <div class="confirm-block">
      <p class="confirm-text">
        Found {orphans.length} recoverable snapshot payload{orphans.length === 1 ? '' : 's'}
        not tracked by the save list. They still take up browser storage.
      </p>
      <div class="confirm-actions">
        <button class="primary-btn" type="button" onclick={recoverOrphans}>
          Recover {orphans.length === 1 ? 'it' : 'them'}
        </button>
      </div>
    </div>
  {/if}

  <div class="io-row">
    <button class="ghost-btn" type="button" onclick={exportCurrent}>
      Export current save
    </button>
    <button class="ghost-btn" type="button" onclick={pickImportFile}>
      Import…
    </button>
    <input
      bind:this={importInputEl}
      type="file"
      accept="application/json,.json"
      style="display: none"
      onchange={handleImportFile}
    />
  </div>

  {#if importError}
    <p class="error-line">{importError}</p>
  {/if}

  {#if importPreview}
    <div class="confirm-block">
      <p class="confirm-text">
        Import <em>{importPreview.tavernName}</em>
        — Day {importPreview.day}, seed
        <code class="mono">{importPreview.seedString}</code>?
        This replaces your current run.
      </p>
      <div class="confirm-actions">
        <button class="primary-btn" type="button" onclick={confirmImport}>
          Replace current run
        </button>
        <button class="ghost-btn" type="button" onclick={cancelImport}>
          Cancel
        </button>
      </div>
    </div>
  {/if}

  {#if overBudget}
    <p class="warn-line">
      Browser storage is filling up
      ({Math.round((bytesUsed / SNAPSHOT_BUDGET_BYTES) * 100)}%).
      Delete an older snapshot to make room.
    </p>
  {/if}
</section>

<style>
  .saves-section {
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

  .autosave-row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding: var(--sp-sm);
    background: var(--surface-raised);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--radius-sm);
  }

  .autosave-head {
    display: flex;
    align-items: center;
    gap: var(--sp-xs);
    flex-wrap: wrap;
  }

  .autosave-title {
    font-family: var(--font-body);
    font-style: italic;
    font-weight: 500;
    font-size: var(--type-heading);
    color: var(--text);
    flex: 1;
    margin: 0;
  }

  .autosave-sub {
    color: var(--text-faint);
    font-size: 12px;
    line-height: 1.4;
  }

  .snap-input-row {
    display: flex;
    gap: var(--sp-xs);
    margin-top: var(--sp-xxs);
  }

  .snap-name-input {
    flex: 1;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--candle-soft);
    border-radius: var(--radius-sm);
    padding: 8px 10px;
    min-height: 40px;
    font-size: 13px;
  }

  .snap-name-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .snaps-list {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .empty-note {
    color: var(--text-faint);
    font-size: 13px;
    font-style: italic;
    text-align: center;
    padding: var(--sp-md);
  }

  .primary-btn {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    color: var(--accent);
    border: 1px solid var(--accent);
    background: transparent;
    border-radius: var(--radius-sm);
    padding: 8px 14px;
    min-height: 40px;
    transition: background var(--m-fast) var(--ease);
  }

  .primary-btn:disabled {
    color: var(--text-faint);
    border-color: var(--candle-soft);
    cursor: not-allowed;
  }

  .primary-btn:hover:not(:disabled),
  .primary-btn:focus-visible:not(:disabled) {
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .ghost-btn {
    font-family: var(--font-body);
    font-variant: small-caps;
    letter-spacing: 0.06em;
    font-size: 13px;
    color: var(--text-faint);
    border: 1px solid var(--candle-soft);
    background: transparent;
    border-radius: var(--radius-sm);
    padding: 8px 14px;
    min-height: 40px;
  }

  .ghost-btn:hover,
  .ghost-btn:focus-visible {
    color: var(--text-dim);
  }

  .confirm-block {
    padding: var(--sp-sm);
    background: color-mix(in srgb, var(--loss) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 40%, transparent);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .confirm-text {
    color: var(--text-dim);
    font-size: 13px;
    line-height: 1.45;
  }

  .confirm-actions {
    display: flex;
    gap: var(--sp-xs);
  }

  .io-row {
    display: flex;
    gap: var(--sp-xs);
    flex-wrap: wrap;
    padding-top: var(--sp-xs);
    border-top: var(--border-faint);
  }

  .error-line {
    color: var(--loss);
    font-size: 12px;
    line-height: 1.4;
  }

  .warn-line {
    color: var(--rust);
    font-size: 12px;
    line-height: 1.4;
  }

  .save-error {
    padding: var(--sp-sm);
    background: color-mix(in srgb, var(--loss) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--loss) 55%, transparent);
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
  }

  .save-error-text {
    color: var(--text);
    font-size: 13px;
    line-height: 1.45;
  }
</style>
