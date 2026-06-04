# Build on the Claude Agent SDK behind a provider-agnostic AgentRuntime seam

Agent execution is built on the Claude Agent SDK, but accessed only through a thin provider-neutral `AgentRuntime` interface. "Provider-agnostic" in v1 means this seam exists and is implemented exactly once (on the SDK), not that multiple providers work. Building directly on the SDK gets the Phase 0 skeleton dogfooding fast and inherits tool allowlists, permission gates, hooks, and session management; the seam — consistent with the adapter pattern already used for execution (ADR-0002) and isolation (ADR-0003) — keeps SDK-specific assumptions from leaking above it.

## Considered Options

- Bespoke orchestration on the raw Anthropic API — maximum control, but rebuilds the agent loop and all reach controls from scratch.
- SDK in-process with no seam — fastest, but hard-codes a single provider into the workflow engine.

## Consequences

The agent-reach controls (tool allowlist, approval gates, scoped file access, audit) are thin-but-real in Phase 0, funneled through a single enforcement chokepoint at this seam, so Phase 2 hardening (gVisor, egress proxy, finer scoping) swaps implementations without relocating the chokepoint. We must resist letting SDK concepts surface in the workflow engine.
