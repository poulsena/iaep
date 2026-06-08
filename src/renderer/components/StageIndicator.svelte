<script lang="ts">
  let {
    stage = "—",
    status = "idle",
  }: {
    stage?: string;
    status?: "idle" | "running" | "terminal" | "blocked";
  } = $props();
</script>

<div class="stage stage--{status}">
  <span class="stage__dot" aria-hidden="true"></span>
  <span class="stage__label">{stage}</span>
  <span class="stage__status">{status}</span>
</div>

<style>
  .stage {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.625rem 0;
    border-bottom: 1px solid var(--border);
  }

  .stage__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--fg-muted);
  }

  .stage--idle .stage__dot {
    background: transparent;
    border: 1.5px solid var(--fg-muted);
  }

  .stage--running .stage__dot {
    background: var(--success);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .stage--terminal .stage__dot {
    background: var(--fg-muted);
  }

  .stage--blocked .stage__dot {
    background: var(--danger);
  }

  .stage__label {
    font-size: 0.8125rem;
    color: var(--fg);
    flex: 1;
  }

  .stage__status {
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--fg-dim);
  }

  .stage--running .stage__status  { color: var(--success); }
  .stage--blocked .stage__status  { color: var(--danger); }
  .stage--terminal .stage__status { color: var(--fg-muted); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
</style>
