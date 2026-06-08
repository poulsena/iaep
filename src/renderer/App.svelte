<script lang="ts">
  import { createRunStore } from "./run-store";
  import Button from "./components/Button.svelte";
  import Field from "./components/Field.svelte";
  import Form from "./components/Form.svelte";
  import GatePanel from "./components/GatePanel.svelte";
  import OutputFeed from "./components/OutputFeed.svelte";
  import StageIndicator from "./components/StageIndicator.svelte";
  import type { Lane, StageDefinition } from "../engine/types";

  const ipc = window.electronIpc;
  const { currentStage, status, outputEntries, gateVisible, gateType, start, decide } =
    createRunStore(ipc);

  const STAGES: Record<Lane, StageDefinition[]> = {
    "quick-change": [
      { name: "diagnose" },
      { name: "fix", role: "worker" },
      { name: "review", role: "reviewer" },
      { name: "qa", role: "qa" },
      { name: "distill", role: "librarian" },
    ],
    "full-feature": [
      { name: "diagnose" },
      { name: "plan" },
      { name: "implement", role: "worker" },
      { name: "review", role: "reviewer" },
      { name: "qa", role: "qa" },
      { name: "document", role: "librarian" },
    ],
  };

  let repoPath = $state("");
  let lane = $state("quick-change");
  let brief = $state("");

  const formStatus = $derived($status === "running" ? "running" : "idle");

  const stageStatus = $derived(
    $status === "running"
      ? "running"
      : $status === "blocked"
        ? "blocked"
        : $status === "idle"
          ? "idle"
          : "terminal"
  );

  function handleStart() {
    if (!repoPath || !brief.trim()) return;
    const repoKey = repoPath.split("/").filter(Boolean).at(-1) ?? repoPath;
    start({ repoKey, repoPath, lane: lane as Lane, stages: STAGES[lane as Lane], brief: { text: brief } });
  }
</script>

<div class="app">
  <header class="app__header">
    <span class="app__title">iaep</span>
  </header>

  <main class="app__main">
    <Form status={formStatus} onsubmit={handleStart}>
      <Field
        label="Repository path"
        bind:value={repoPath}
        placeholder="/home/user/my-project"
        onpick={() => ipc.showDirectoryDialog()}
      />
      <Field
        label="Lane"
        type="select"
        options={["quick-change", "full-feature"]}
        bind:value={lane}
      />
      <Field
        label="Brief"
        type="textarea"
        bind:value={brief}
        placeholder="Describe what you want done…"
      />
      <Button variant="primary" disabled={!brief.trim()}>
        {$status === "running" ? "Running…" : "Start run"}
      </Button>
    </Form>

    {#if $currentStage && $status !== "idle"}
      <StageIndicator stage={$currentStage} status={stageStatus} />
    {/if}

    <OutputFeed entries={$outputEntries} />

    <GatePanel
      type={$gateType ?? "merge"}
      visible={$gateVisible}
      ondecide={decide}
    />
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .app__header {
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .app__title {
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--fg-muted);
  }

  .app__main {
    flex: 1;
    padding: 1.5rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow-y: auto;
  }
</style>
