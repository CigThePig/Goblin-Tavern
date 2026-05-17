<script lang="ts">
  type IconName =
    | 'mark'
    | 'stake-loss'
    | 'stake-gain'
    | 'stake-risk'
    | 'coin'
    | 'pressure'
    | 'staff'
    | 'stock'
    | 'trend-up'
    | 'trend-flat'
    | 'trend-down'
    | 'day'
    | 'reports'
    | 'tavern'
    | 'world'
    | 'flame'
    | 'seal'

  let {
    name,
    size = 16,
    label,
  }: { name: IconName; size?: number; label?: string } = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={label ? undefined : true}
  aria-label={label}
  role={label ? 'img' : undefined}
>
  {#if name === 'mark'}
    <path d="M7 9 L7 17 Q7 19 9 19 L15 19 Q17 19 17 17 L17 9 Z" />
    <path d="M17 11 Q20 11 20 13.5 Q20 16 17 16" />
    <path d="M10 5 Q11 7 9.5 9 M14 5 Q13 7 14.5 9" />
    <circle cx="12" cy="13" r="0.6" fill="currentColor" stroke="none" />
  {:else if name === 'stake-loss'}
    <path d="M12 5 L12 19 M6 13 L12 19 L18 13" />
  {:else if name === 'stake-gain'}
    <path d="M12 19 L12 5 M6 11 L12 5 L18 11" />
  {:else if name === 'stake-risk'}
    <path d="M12 3 L22 20 L2 20 Z" />
    <path d="M12 10 L12 14" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  {:else if name === 'coin'}
    <circle cx="12" cy="12" r="8" />
    <path d="M9 12 L12 9 L15 12 L12 15 Z" />
  {:else if name === 'pressure'}
    <path d="M5 17 Q5 8 12 8 Q19 8 19 17" />
    <path d="M12 8 L12 17" />
  {:else if name === 'staff'}
    <circle cx="12" cy="8" r="3" />
    <path d="M5 20 Q5 14 12 14 Q19 14 19 20" />
  {:else if name === 'stock'}
    <path d="M5 9 L12 5 L19 9 L19 17 L12 21 L5 17 Z" />
    <path d="M5 9 L12 13 L19 9 M12 13 L12 21" />
  {:else if name === 'trend-up'}
    <path d="M5 17 L11 11 L14 14 L19 8" />
    <path d="M14 8 L19 8 L19 13" />
  {:else if name === 'trend-flat'}
    <path d="M5 12 L19 12" />
  {:else if name === 'trend-down'}
    <path d="M5 7 L11 13 L14 10 L19 16" />
    <path d="M14 16 L19 16 L19 11" />
  {:else if name === 'day'}
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 3 L12 5 M12 19 L12 21 M3 12 L5 12 M19 12 L21 12 M5.6 5.6 L7 7 M17 17 L18.4 18.4 M5.6 18.4 L7 17 M17 7 L18.4 5.6"
    />
  {:else if name === 'reports'}
    <path d="M6 4 L18 4 L18 20 L6 20 Z" />
    <path d="M9 9 L15 9 M9 13 L15 13 M9 17 L13 17" />
  {:else if name === 'tavern'}
    <path d="M4 11 L4 19 L20 19 L20 11" />
    <path d="M3 11 L12 5 L21 11" />
    <path d="M10 19 L10 14 L14 14 L14 19" />
  {:else if name === 'world'}
    <circle cx="12" cy="12" r="8" />
    <path d="M4 12 L20 12 M12 4 Q16 8 16 12 Q16 16 12 20 Q8 16 8 12 Q8 8 12 4" />
  {:else if name === 'flame'}
    <path d="M12 3 Q8 8 8 13 Q8 18 12 21 Q16 18 16 13 Q16 9 13 6 Q12 8 11 9 Q12 6 12 3 Z" />
  {:else if name === 'seal'}
    <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="2" fill="var(--surface-raised)" stroke="none" />
  {/if}
</svg>
