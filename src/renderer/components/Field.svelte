<script lang="ts">
  import { getContext } from "svelte";

  let {
    label,
    value = $bindable(""),
    placeholder = "",
    type = "text",
    options = [],
    disabled = false,
    onpick,
  }: {
    label: string;
    value?: string;
    placeholder?: string;
    type?: "text" | "select";
    options?: string[];
    disabled?: boolean;
    onpick?: () => Promise<string | undefined>;
  } = $props();

  const form = getContext<{ disabled: boolean } | undefined>("form");
  const isDisabled = $derived(disabled || (form?.disabled ?? false));

  async function handlePick() {
    const picked = await onpick?.();
    if (picked !== undefined) value = picked;
  }
</script>

<label class="field">
  <span class="field__label">{label}</span>
  {#if type === "select"}
    <select class="field__input" bind:value disabled={isDisabled}>
      {#each options as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
  {:else if onpick}
    <div class="field__row">
      <input class="field__input" {type} bind:value {placeholder} disabled={isDisabled} />
      <button class="field__browse" type="button" disabled={isDisabled} onclick={handlePick}>…</button>
    </div>
  {:else}
    <input class="field__input" {type} bind:value {placeholder} disabled={isDisabled} />
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field__label {
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  .field__row {
    display: flex;
    gap: 0;
  }

  .field__row .field__input {
    flex: 1;
    min-width: 0;
  }

  .field__input {
    font-family: inherit;
    font-size: 0.8125rem;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: 0.4375rem 0.625rem;
    outline: none;
    width: 100%;
    box-sizing: border-box;
    appearance: none;
  }

  .field__input:focus {
    border-color: var(--accent);
  }

  .field__input::placeholder {
    color: var(--fg-muted);
  }

  .field__input:disabled,
  select.field__input:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    background: var(--bg);
    -webkit-text-fill-color: var(--fg);
  }

  .field__browse {
    font-family: inherit;
    font-size: 0.8125rem;
    background: var(--bg);
    color: var(--fg-muted);
    border: 1px solid var(--border);
    margin-left: -1px;
    position: relative;
    padding: 0.4375rem 0.625rem;
    cursor: pointer;
    outline: none;
    flex-shrink: 0;
  }

  .field__browse:hover:not(:disabled) {
    color: var(--fg);
    border-color: var(--accent);
  }

  .field__browse:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
</style>
