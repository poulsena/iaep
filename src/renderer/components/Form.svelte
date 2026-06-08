<script lang="ts">
  import { setContext } from "svelte";
  import type { Snippet } from "svelte";

  let {
    status = "idle",
    onsubmit,
    children,
  }: {
    status?: "idle" | "running";
    onsubmit?: () => void;
    children?: Snippet;
  } = $props();

  setContext("form", { get disabled() { return status === "running"; } });

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    onsubmit?.();
  }
</script>

<form class="form" onsubmit={handleSubmit}>
  {@render children?.()}
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
