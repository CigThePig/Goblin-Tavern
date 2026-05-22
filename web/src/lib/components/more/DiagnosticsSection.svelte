<!--
  Diagnostics section of the More screen.

  Single button that copies a narrow JSON debug bundle (UI state, errors,
  prefs, brief tavern summary) to the clipboard for bug reports. Does
  not overlap the full state export in the Saves section above.
-->
<script lang="ts">
  import { debugBundleAsText } from '../../sim/debugBundle'

  type Status = { kind: 'idle' } | { kind: 'copied' } | { kind: 'error'; message: string }

  let status = $state<Status>({ kind: 'idle' })
  let clearTimer: ReturnType<typeof setTimeout> | undefined

  function scheduleClear() {
    if (clearTimer !== undefined) clearTimeout(clearTimer)
    clearTimer = setTimeout(() => {
      status = { kind: 'idle' }
      clearTimer = undefined
    }, 2000)
  }

  function legacyCopy(text: string): boolean {
    if (typeof document === 'undefined') return false
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    document.body.removeChild(ta)
    return ok
  }

  async function copyBundle() {
    const text = debugBundleAsText()
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        status = { kind: 'copied' }
        scheduleClear()
        return
      }
    } catch {
      // Fall through to legacy path.
    }
    if (legacyCopy(text)) {
      status = { kind: 'copied' }
    } else {
      status = { kind: 'error', message: 'Copy failed — try again.' }
    }
    scheduleClear()
  }
</script>

<section class="diagnostics-section" aria-labelledby="diag-h">
  <h2 id="diag-h" class="display heading-row">Diagnostics</h2>

  <p class="lede dim">
    Copies UI state, recent errors, preferences, and a brief tavern summary as
    JSON to your clipboard. Useful for bug reports. The Saves section above
    handles full state export.
  </p>

  <div class="actions">
    <button
      type="button"
      class="copy-btn"
      onclick={copyBundle}
      aria-describedby="diag-status"
    >
      Copy debug bundle
    </button>
    <span
      id="diag-status"
      class="status tag"
      class:status-ok={status.kind === 'copied'}
      class:status-err={status.kind === 'error'}
      role="status"
      aria-live="polite"
    >
      {#if status.kind === 'copied'}
        Copied.
      {:else if status.kind === 'error'}
        {status.message}
      {/if}
    </span>
  </div>
</section>

<style>
  .diagnostics-section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-sm);
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

  .lede {
    color: var(--text);
    font-size: 14px;
    line-height: 1.55;
  }

  .lede.dim {
    color: var(--text-dim);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--sp-sm);
    flex-wrap: wrap;
  }

  .copy-btn {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--candle-soft);
    border-radius: var(--radius-sm);
    padding: 10px 14px;
    min-height: 40px;
    transition:
      color var(--m-fast) var(--ease),
      border-color var(--m-fast) var(--ease);
  }

  .copy-btn:hover,
  .copy-btn:focus-visible {
    color: var(--accent);
    border-color: var(--accent);
  }

  .status {
    color: var(--text-faint);
    min-height: 1em;
  }

  .status-ok {
    color: var(--accent);
  }

  .status-err {
    color: var(--loss);
  }
</style>
