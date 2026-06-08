<script lang="ts">
  let {
    label,
    value = $bindable(""),
    placeholder = "",
    type = "text",
    options = [],
  }: {
    label: string;
    value?: string;
    placeholder?: string;
    type?: "text" | "select";
    options?: string[];
  } = $props();
</script>

<label class="field">
  <span class="field__label">{label}</span>
  {#if type === "select"}
    <select class="field__input" bind:value>
      {#each options as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>
  {:else}
    <input class="field__input" {type} bind:value {placeholder} />
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
</style>
