<script lang="ts">
  import TopBar from './TopBar.svelte'
  import BottomNav from './BottomNav.svelte'
  import type { Snippet } from 'svelte'
  import type { Route } from './BottomNav.svelte'

  let {
    route,
    onnavigate,
    children,
  }: {
    route: Route
    onnavigate: (r: Route) => void
    children: Snippet
  } = $props()
</script>

<div class="shell">
  <TopBar />
  <div class="content">
    {@render children()}
  </div>
  <BottomNav active={route} {onnavigate} />
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }

  .content {
    flex: 1;
    min-height: 0;
  }
</style>
