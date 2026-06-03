<script lang="ts">
  let {
    title,
    body,
  }: { title: string; body: string } = $props()
</script>

<section class="placeholder">
  <h2 class="display heading-line">{title}</h2>
  <p class="body">{body}</p>
  <p class="meta chip">to be wired in a later phase</p>
</section>

<style>
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-md);
    min-height: 60vh;
    padding: var(--sp-xl) var(--sp-md);
    text-align: center;
  }

  .heading-line {
    font-size: 22px;
    color: var(--accent);
    letter-spacing: 0.1em;
  }

  .body {
    max-width: 32ch;
    color: var(--text-dim);
    font-style: italic;
    line-height: 1.55;
  }

  .meta {
    color: var(--text-faint);
  }
</style>
