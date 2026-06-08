<script lang="ts">
  import { getContext } from "svelte";
  import type { Snippet } from "svelte";

  let {
    variant = "primary",
    disabled = false,
    children,
    onclick,
  }: {
    variant?: "primary" | "destructive";
    disabled?: boolean;
    children?: Snippet;
    onclick?: () => void;
  } = $props();

  const form = getContext<{ disabled: boolean } | undefined>("form");
  const isDisabled = $derived(disabled || (form?.disabled ?? false));
</script>

<button class="btn btn--{variant}" disabled={isDisabled} {onclick}>
  {@render children?.()}
</button>

<style>
  .btn {
    appearance: none;
    outline: none;
    font-family: inherit;
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.5rem 1.25rem;
    border: 1px solid;
    cursor: pointer;
    transition: background 80ms, color 80ms;
    white-space: nowrap;
  }

  .btn--primary {
    background: transparent;
    color: var(--accent);
    border-color: var(--accent);
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--accent);
    color: var(--bg);
  }

  .btn--destructive {
    background: transparent;
    color: var(--fg-muted);
    border-color: var(--fg-muted);
  }

  .btn--destructive:hover:not(:disabled) {
    background: var(--fg-muted);
    color: var(--bg);
  }

  .btn:focus,
  .btn:focus-visible {
    outline: none;
  }

  .btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
