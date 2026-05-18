<!--
  AccuracyBadge — small chip for rumour / attribution accuracy.

  Phase 93. Maps the four accuracy levels to an icon + tone:
    true     → ★ confirmed   (text-dim)
    partial  → ◐ partial     (accent-soft)
    false    → ✗ false       (loss)
    unknown  → ? unknown     (text-faint)
-->
<script lang="ts">
  type Accuracy = 'true' | 'partial' | 'false' | 'unknown'
  let { accuracy }: { accuracy: Accuracy } = $props()

  const icon = $derived(
    accuracy === 'true' ? '★' :
    accuracy === 'partial' ? '◐' :
    accuracy === 'false' ? '✗' :
    '?'
  )
  const label = $derived(
    accuracy === 'true' ? 'confirmed' :
    accuracy === 'partial' ? 'partial' :
    accuracy === 'false' ? 'false' :
    'unknown'
  )
</script>

<span class="badge tag {accuracy}">
  <span aria-hidden="true">{icon}</span>
  <span>{label}</span>
</span>

<style>
  .badge {
    display: inline-flex;
    gap: 4px;
    align-items: baseline;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--ash) 30%, transparent);
    background: color-mix(in srgb, var(--surface-raised) 70%, transparent);
  }

  .badge.true {
    color: var(--text-dim);
    border-color: color-mix(in srgb, var(--gain) 35%, transparent);
  }

  .badge.partial {
    color: var(--accent-soft);
    border-color: color-mix(in srgb, var(--accent-soft) 35%, transparent);
  }

  .badge.false {
    color: var(--loss);
    border-color: color-mix(in srgb, var(--loss) 35%, transparent);
  }

  .badge.unknown {
    color: var(--text-faint);
  }
</style>
