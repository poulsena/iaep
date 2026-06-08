<script lang="ts">
  import Button from "./Button.svelte";

  let {
    type = "merge",
    visible = false,
    ondecide,
  }: {
    type?: "approval" | "merge";
    visible?: boolean;
    ondecide?: (decision: "approve" | "deny") => void;
  } = $props();
</script>

{#if visible}
  <div class="gate">
    <span class="gate__label">
      {type === "merge" ? "merge gate" : "approval gate"}
    </span>
    <p class="gate__message">
      {type === "merge"
        ? "Run is ready to merge. Review and decide."
        : "Agent action requires approval."}
    </p>
    <div class="gate__actions">
      <Button variant="primary" onclick={() => ondecide?.("approve")}>
        Approve
      </Button>
      <Button variant="destructive" onclick={() => ondecide?.("deny")}>
        Deny
      </Button>
    </div>
  </div>
{/if}

<style>
  .gate {
    border: 1px solid var(--warn);
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .gate__label {
    font-size: 0.625rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--warn);
  }

  .gate__message {
    font-size: 0.8125rem;
    color: var(--fg);
    margin: 0;
    line-height: 1.5;
  }

  .gate__actions {
    display: flex;
    gap: 0.625rem;
    margin-top: 0.25rem;
  }
</style>
