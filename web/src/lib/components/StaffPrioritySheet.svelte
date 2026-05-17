<!--
  StaffPrioritySheet — assign per-staff priorities for the day.

  One row per staff member. Priority comes from `staffPriorityRegistry`,
  filtered by the staff's role. Defaults inherit from the role's default
  priority (sim handles fallback if a staff member is omitted from
  `staffPriorities`), but we still surface the current pick so the
  player can see what they're sticking with.

  Selection auto-applies — no save button — and survives sheet close.
-->
<script lang="ts">
  import BottomSheet from './BottomSheet.svelte'
  import { gameStore } from '../sim/gameStore.svelte'
  import {
    staffPriorityRegistry,
    getAllowedPrioritiesForRole,
    getDefaultPriorityForRole,
  } from '../../../../src/sim/registries/staffPriorityRegistry'

  let {
    open,
    priorities,
    onclose,
    onchange,
  }: {
    open: boolean
    priorities: Record<string, string>
    onclose: () => void
    onchange: (next: Record<string, string>) => void
  } = $props()

  const staff = $derived(Object.values(gameStore.state.staff))

  function currentPriorityFor(staffId: string, roleId: string): string {
    return priorities[staffId] ?? getDefaultPriorityForRole(roleId) ?? ''
  }

  function setPriority(staffId: string, priorityId: string) {
    onchange({ ...priorities, [staffId]: priorityId })
  }
</script>

<BottomSheet {open} title="Staff priorities" {onclose}>
  {#snippet children()}
    <div class="rows">
      {#each staff as member (member.id)}
        {@const allowed = getAllowedPrioritiesForRole(member.role)}
        {@const selected = currentPriorityFor(member.id, member.role)}
        <div class="row">
          <header class="who">
            <span class="name">{member.name.display}</span>
            <span class="role tag">{member.role.replace(/_/g, ' ')}</span>
          </header>
          <div class="meters mono">
            <span>morale {member.morale}</span>
            <span>stress {member.stress}</span>
          </div>
          <div class="options" role="radiogroup" aria-label="Priority for {member.name.display}">
            {#each allowed as priorityId (priorityId)}
              {@const def = staffPriorityRegistry.has(priorityId)
                ? staffPriorityRegistry.get(priorityId)
                : undefined}
              {#if def}
                <button
                  type="button"
                  class="opt"
                  class:selected={priorityId === selected}
                  role="radio"
                  aria-checked={priorityId === selected ? 'true' : 'false'}
                  onclick={() => setPriority(member.id, priorityId)}
                >
                  {def.label}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/snippet}
</BottomSheet>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: var(--sp-lg);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--sp-xs);
    padding-bottom: var(--sp-md);
    border-bottom: var(--border-faint);
  }

  .row:last-child {
    border-bottom: none;
  }

  .who {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sp-sm);
  }

  .name {
    font-family: var(--font-body);
    font-size: 17px;
    color: var(--text);
  }

  .role {
    color: var(--text-faint);
  }

  .meters {
    display: flex;
    gap: var(--sp-md);
    color: var(--text-faint);
  }

  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-xs);
  }

  .opt {
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-dim);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    border: 1px solid color-mix(in srgb, var(--candle-soft) 40%, transparent);
    background: var(--surface);
    min-height: 36px;
    transition: color var(--m-fast) var(--ease), border-color var(--m-fast) var(--ease),
      background var(--m-fast) var(--ease);
  }

  .opt:hover,
  .opt:focus-visible {
    color: var(--text);
    border-color: var(--accent);
  }

  .opt.selected {
    color: var(--accent);
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
</style>
