<script lang="ts">
  import { tick } from "svelte";

  let { entries = [] }: { entries: Array<{ stageId: string; content: string }> } = $props();

  let el: HTMLElement | undefined = $state();

  $effect(() => {
    void entries;
    tick().then(() => {
      if (el) el.scrollTop = el.scrollHeight;
    });
  });
</script>

<div class="feed" bind:this={el}>
  {#if entries.length === 0}
    <p class="feed__empty">no output</p>
  {:else}
    {#each entries as entry}
      <div class="feed__entry">
        <span class="feed__stage">{entry.stageId}</span>
        <pre class="feed__content">{entry.content}</pre>
      </div>
    {/each}
  {/if}
</div>

<style>
  .feed {
    overflow-y: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .feed__empty {
    font-size: 0.6875rem;
    color: var(--fg-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin: 0;
    padding: 0.5rem 0;
  }

  .feed__entry {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 0.75rem;
    align-items: start;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }

  .feed__stage {
    font-size: 0.625rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    padding-top: 0.1rem;
    flex-shrink: 0;
  }

  .feed__content {
    font-family: inherit;
    font-size: 0.75rem;
    color: var(--fg);
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.55;
  }
</style>
